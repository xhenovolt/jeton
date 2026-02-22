import { NextResponse } from 'next/server';
import { getInvoiceByNumber, getInvoiceItems } from '@/lib/db-invoices';

// GET - Fetch invoice by invoice_number
export async function GET(request, { params }) {
  try {
    const { number } = params;

    if (!number) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invoice number is required',
        },
        { status: 400 }
      );
    }

    const invoice = await getInvoiceByNumber(number);
    if (!invoice) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invoice not found',
        },
        { status: 404 }
      );
    }

    const items = await getInvoiceItems(invoice.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...invoice,
          items,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching invoice by number:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch invoice',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
