/**
 * GET /api/prospects/pipeline
 * GET /api/prospects/agents  
 * Dashboard aggregation endpoints for pipeline and agent metrics
 */

import { getPipelineSummary, getAgentPerformance, getActivitySummary } from '@/lib/prospects.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (endpoint === 'agents') {
      // Agent performance metrics
      const agentData = await getAgentPerformance();
      return Response.json({
        success: true,
        data: agentData,
        count: agentData.length,
      });
    }

    if (endpoint === 'activities') {
      // Activity summary
      const activityData = await getActivitySummary();
      return Response.json({
        success: true,
        data: activityData,
      });
    }

    // Default: Pipeline summary
    const pipelineData = await getPipelineSummary();
    return Response.json({
      success: true,
      data: pipelineData,
    });
  } catch (error) {
    console.error('GET /api/prospects/pipeline error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
