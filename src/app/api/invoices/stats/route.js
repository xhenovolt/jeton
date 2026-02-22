import { NextResponse } from 'next/server';
import { getInvoiceStats } from '@/lib/db-invoices';

// GET - Get invoice statistics
export async function GET(request) {
  try {
    const stats = await getInvoiceStats();

    return NextResponse.json(
      {
        success: true,
        data: stats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch statistics',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
