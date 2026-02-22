import { NextResponse } from 'next/server';
import { getInvoiceById, updateInvoiceStatus } from '@/lib/db-invoices';
import { isValidStatusTransition } from '@/lib/invoice-validation';

const VALID_STATUSES = ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'];

// PUT - Update invoice status
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    const { status } = body;

    // Validate status
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid status',
          message: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
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

    // Validate status transition
    if (!isValidStatusTransition(existingInvoice.status, status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid status transition',
          message: `Cannot transition from '${existingInvoice.status}' to '${status}'`,
          currentStatus: existingInvoice.status,
          requestedStatus: status,
        },
        { status: 400 }
      );
    }

    // Update status
    const updatedInvoice = await updateInvoiceStatus(id, status);

    return NextResponse.json(
      {
        success: true,
        data: updatedInvoice,
        message: `Invoice status updated to '${status}'`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating invoice status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update invoice status',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
