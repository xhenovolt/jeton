import { NextResponse } from 'next/server';
import {
  getInvoiceById,
  updateInvoiceItems,
  getInvoiceItems,
} from '@/lib/db-invoices';
import { validateInvoiceItems } from '@/lib/invoice-validation';

// PUT - Update invoice items
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Items array is required',
        },
        { status: 400 }
      );
    }

    // Check if invoice exists
    const existingInvoice = await getInvoiceById(id);
    if (!existingInvoice) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invoice not found',
        },
        { status: 404 }
      );
    }

    // Validate items
    const validation = validateInvoiceItems(items);
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

    // Update items
    await updateInvoiceItems(id, validation.data);

    // Return updated invoice with items
    const updatedItems = await getInvoiceItems(id);

    return NextResponse.json(
      {
        success: true,
        data: updatedItems,
        message: 'Invoice items updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating invoice items:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update invoice items',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
