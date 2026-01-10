/**
 * Activity Analytics API
 * GET: User activity and system-wide analytics
 */

import { query } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-utils';



function checkAdminAccess(authData) {
  return authData.role === 'superadmin' || authData.role === 'admin';
}

export async function GET(request) {
  try {
    const authData = await verifyAuth(request);
    if (!authData) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const hasPermission = checkAdminAccess(authData);
    if (!hasPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7'; // days
    const userId = searchParams.get('user_id');

    // Most accessed modules
    const modulesResult = await query(
      `SELECT module, COUNT(*) as count
       FROM activity_logs
       WHERE created_at > NOW() - INTERVAL '${period} days'
       GROUP BY module
       ORDER BY count DESC`
    );

    // Most used features
    const featuresResult = await query(
      `SELECT action_type, COUNT(*) as count
       FROM activity_logs
       WHERE created_at > NOW() - INTERVAL '${period} days'
       GROUP BY action_type
       ORDER BY count DESC
       LIMIT 10`
    );

    // User activity if specified
    let userActivity = null;
    if (userId) {
      const userActivityResult = await query(
        `SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as activity_count
         FROM activity_logs
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${period} days'
         GROUP BY DATE_TRUNC('day', created_at)
         ORDER BY date DESC`,
        [userId]
      );

      userActivity = userActivityResult.rows;
    }

    // Active users
    const activeUsersResult = await query(
      `SELECT COUNT(DISTINCT user_id) as active_users
       FROM activity_logs
       WHERE created_at > NOW() - INTERVAL '1 day'`
    );

    // Online sessions
    const onlineResult = await query(
      `SELECT COUNT(*) as online_count
       FROM sessions
       WHERE is_active = true AND expires_at > NOW()`
    );

    // Top modules by usage
    const topModulesResult = await query(
      `SELECT module, COUNT(*) as usage_count
       FROM activity_logs
       WHERE created_at > NOW() - INTERVAL '${period} days'
       GROUP BY module
       ORDER BY usage_count DESC`
    );

    return Response.json({
      success: true,
      data: {
        period: `${period} days`,
        summary: {
          active_users: parseInt(activeUsersResult.rows[0]?.active_users || 0),
          online_users: parseInt(onlineResult.rows[0]?.online_count || 0),
        },
        modules: modulesResult.rows,
        features: featuresResult.rows,
        topModules: topModulesResult.rows,
        userActivity,
      },
    });
  } catch (error) {
    console.error('Activity analytics error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
