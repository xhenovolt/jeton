import { NextResponse } from 'next/server';
import {
  getAllInvoices,
  createInvoice,
  getNextInvoiceNumber,
  getInvoicesCount,
} from '@/lib/db-invoices';
import { validateInvoice, calculateTotals } from '@/lib/invoice-validation';

// GET - Fetch all invoices with pagination
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20', 10));
    const status = searchParams.get('status');
    const offset = (page - 1) * limit;

    const invoices = await getAllInvoices(limit, offset, status);
    const total = await getInvoicesCount(status);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json(
      {
        success: true,
        data: invoices,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch invoices',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// POST - Create new invoice
export async function POST(request) {
  try {
    const body = await request.json();

    // Validate data
    const validation = validateInvoice(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Generate invoice number if not provided
    let invoiceNumber = body.invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = await getNextInvoiceNumber();
    }

    // Prepare invoice data
    const invoiceData = {
      ...validation.data,
      invoiceNumber,
    };

    // Extract items before creating invoice
    const items = body.items || [];
    delete invoiceData.items;

    // Recalculate totals to ensure accuracy
    const totals = calculateTotals(items, 0, invoiceData.discount || 0);
    invoiceData.subtotal = totals.subtotal;
    invoiceData.tax = totals.tax;
    invoiceData.total = totals.total;
    invoiceData.balanceDue = totals.total - (invoiceData.amountPaid || 0);

    // Create invoice
    const newInvoice = await createInvoice(invoiceData, items);

    return NextResponse.json(
      {
        success: true,
        data: newInvoice,
        message: 'Invoice created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create invoice',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
