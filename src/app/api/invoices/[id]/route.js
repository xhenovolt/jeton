import { NextResponse } from 'next/server';
import {
  getInvoiceById,
  getInvoiceItems,
  updateInvoice,
  deleteInvoice,
} from '@/lib/db-invoices';
import { validateInvoiceUpdate, calculateTotals } from '@/lib/invoice-validation';

// GET - Fetch single invoice by ID
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const invoice = await getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invoice not found',
        },
        { status: 404 }
      );
    }

    const items = await getInvoiceItems(id);

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
    console.error('Error fetching invoice:', error);
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

// PUT - Update invoice
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

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

    // Validate update data
    const validation = validateInvoiceUpdate(body);
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

    // Prepare update data
    const updateData = { ...validation.data };

    // Handle items update if provided
    if (body.items && Array.isArray(body.items)) {
      // Items will be updated separately after invoice update
      delete updateData.items;

      // Recalculate totals
      const totals = calculateTotals(body.items, 0, body.discount || 0);
      updateData.subtotal = totals.subtotal;
      updateData.tax = totals.tax;
      updateData.total = totals.total;
      updateData.balanceDue = totals.total - (body.amountPaid || existingInvoice.amount_paid || 0);
    }

    // Update invoice
    const updatedInvoice = await updateInvoice(id, updateData);

    return NextResponse.json(
      {
        success: true,
        data: updatedInvoice,
        message: 'Invoice updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update invoice',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete invoice
export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Check if invoice exists
    const invoice = await getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invoice not found',
        },
        { status: 404 }
      );
    }

    // Delete invoice (cascades to delete items)
    const deleted = await deleteInvoice(id);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete invoice',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Invoice deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete invoice',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
