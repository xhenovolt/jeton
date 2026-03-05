import { z } from 'zod';

// Invoice item schema
export const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  totalPrice: z.number().nonnegative('Total price cannot be negative'),
});

// Invoice schema
export const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required').max(50, 'Invoice number too long'),
  invoiceName: z.string().min(1, 'Invoice name is required').max(255, 'Invoice name too long'),
  clientName: z.string().min(1, 'Client name is required').max(255, 'Client name too long'),
  clientEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  clientPhone: z.string().max(20).optional(),
  clientAddress: z.string().max(255).optional(),
  companyName: z.string().max(255).optional(),
  companyAddress: z.string().max(255).optional(),
  companyServiceType: z.string().max(255).optional(),
  issueDate: z.string().datetime('Invalid date format'),
  dueDate: z.string().datetime('Invalid date format').optional(),
  subtotal: z.number().nonnegative('Subtotal cannot be negative'),
  tax: z.number().nonnegative('Tax cannot be negative'),
  discount: z.number().nonnegative('Discount cannot be negative'),
  total: z.number().nonnegative('Total cannot be negative'),
  amountPaid: z.number().nonnegative('Amount paid cannot be negative'),
  balanceDue: z.number().nonnegative('Balance due cannot be negative'),
  status: z.enum(['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled']),
  notes: z.string().optional(),
  currency: z.string().length(3).optional(),
  signedBy: z.string().max(255).optional(),
  signedByTitle: z.string().max(255).optional(),
  paymentMethods: z.array(z.string()).optional(),
  paymentMethodUsed: z.string().max(100).optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
});

// Update invoice schema (partial)
export const updateInvoiceSchema = invoiceSchema.partial().extend({
  items: z.array(invoiceItemSchema).optional(),
});

// Validate invoice data
export function validateInvoice(data) {
  try {
    // Guard: ensure data exists
    if (!data || typeof data !== 'object') {
      return { 
        valid: false, 
        data: null, 
        errors: { general: 'Request body must be a valid JSON object' } 
      };
    }

    const validated = invoiceSchema.parse(data);
    return { valid: true, data: validated, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = {};
      // Safely access errors property - support both error.errors and error.issues
      const zodErrors = error.errors || error.issues || [];
      
      if (!Array.isArray(zodErrors)) {
        return { 
          valid: false, 
          data: null, 
          errors: { general: 'Validation error - unable to parse errors' } 
        };
      }

      zodErrors.forEach((err) => {
        const path = err.path?.join('.') || 'unknown';
        errors[path] = err.message;
      });
      return { valid: false, data: null, errors };
    }
    
    // Catch any other error type
    return { 
      valid: false, 
      data: null, 
      errors: { general: error?.message || 'Validation failed - unknown error' } 
    };
  }
}

// Validate update invoice data
export function validateInvoiceUpdate(data) {
  try {
    // Guard: ensure data exists
    if (!data || typeof data !== 'object') {
      return { 
        valid: false, 
        data: null, 
        errors: { general: 'Request body must be a valid JSON object' } 
      };
    }

    const validated = updateInvoiceSchema.parse(data);
    return { valid: true, data: validated, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = {};
      // Safely access errors property - support both error.errors and error.issues
      const zodErrors = error.errors || error.issues || [];
      
      if (!Array.isArray(zodErrors)) {
        return { 
          valid: false, 
          data: null, 
          errors: { general: 'Validation error - unable to parse errors' } 
        };
      }

      zodErrors.forEach((err) => {
        const path = err.path?.join('.') || 'unknown';
        errors[path] = err.message;
      });
      return { valid: false, data: null, errors };
    }
    
    // Catch any other error type
    return { 
      valid: false, 
      data: null, 
      errors: { general: error?.message || 'Validation failed - unknown error' } 
    };
  }
}

// Validate invoice items (for updates)
export function validateInvoiceItems(items) {
  try {
    // Guard: ensure items is an array
    if (!Array.isArray(items)) {
      return { 
        valid: false, 
        data: null, 
        errors: { general: 'Items must be an array' } 
      };
    }

    const validated = z.array(invoiceItemSchema).min(1).parse(items);
    return { valid: true, data: validated, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = {};
      // Safely access errors property - support both error.errors and error.issues
      const zodErrors = error.errors || error.issues || [];
      
      if (!Array.isArray(zodErrors)) {
        return { 
          valid: false, 
          data: null, 
          errors: { general: 'Validation error - unable to parse errors' } 
        };
      }

      zodErrors.forEach((err) => {
        const path = err.path?.join('.') || 'unknown';
        errors[path] = err.message;
      });
      return { valid: false, data: null, errors };
    }
    
    // Catch any other error type
    return { 
      valid: false, 
      data: null, 
      errors: { general: error?.message || 'Validation failed - unknown error' } 
    };
  }
}

// Calculate totals from items
export function calculateTotals(items, taxRate = 0, discountAmount = 0) {
  const subtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax - discountAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    discount: Math.round(discountAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

// Validate calculations match
export function validateCalculations(items, subtotal, tax, discount, total) {
  const calculated = calculateTotals(items);
  const tolerance = 0.01; // Allow 1 cent difference due to rounding

  return (
    Math.abs(calculated.subtotal - subtotal) < tolerance &&
    Math.abs(calculated.tax - tax) < tolerance &&
    Math.abs(calculated.discount - discount) < tolerance &&
    Math.abs(calculated.total - total) < tolerance
  );
}

// Validate status transition
export function isValidStatusTransition(currentStatus, newStatus) {
  const allowedTransitions = {
    draft: ['sent', 'cancelled'],
    sent: ['paid', 'partially_paid', 'overdue', 'cancelled'],
    paid: ['sent'],
    partially_paid: ['paid', 'overdue', 'sent'],
    overdue: ['paid', 'partially_paid'],
    cancelled: ['draft'],
  };

  return allowedTransitions[currentStatus]?.includes(newStatus) || false;
}

// Check if invoice is editable
export function isInvoiceEditable(status) {
  return status === 'draft' || status === 'partially_paid';
}

// Format currency value
export function formatCurrency(value, currency = 'UGX') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// Parse ZodError into readable format
export function parseZodError(error) {
  if (error instanceof z.ZodError) {
    const errors = {};
    error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(err.message);
    });
    return errors;
  }
  return { general: 'Validation error' };
}
