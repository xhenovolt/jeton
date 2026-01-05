import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth.js';
import { 
  getExecutiveSummary,
  getTopAssets,
  getTopLiabilities
} from '@/lib/reports';

/**
 * GET /api/reports/executive
 * Returns executive dashboard summary
 */
export async function GET(request) {
  try {
    // Get user from session
    const user = await requireApiAuth();

    const [
      summary,
      topAssets,
      topLiabilities
    ] = await Promise.all([
      getExecutiveSummary(),
      getTopAssets(5),
      getTopLiabilities(5)
    ]);

    return NextResponse.json({
      summary,
      topAssets,
      topLiabilities
    });
  } catch (error) {
    console.error('Error in /api/reports/executive:', error);
    return NextResponse.json(
      { error: 'Failed to fetch executive report' },
      { status: 500 }
    );
  }
}
