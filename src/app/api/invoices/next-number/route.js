import { NextResponse } from 'next/server';
import { getNextInvoiceNumber } from '@/lib/db-invoices';

// GET - Get next invoice number
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || 'XH';

    const nextNumber = await getNextInvoiceNumber(prefix);

    return NextResponse.json(
      {
        success: true,
        data: {
          nextInvoiceNumber: nextNumber,
          prefix,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error generating next invoice number:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate invoice number',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
