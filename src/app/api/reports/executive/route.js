import { NextResponse } from 'next/server';
import { validateJWT } from '@/lib/jwt';
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
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = validateJWT(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

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
