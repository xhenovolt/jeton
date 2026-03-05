/**
 * Contract Validation and Business Logic
 * Enforces all contract creation and modification rules
 */

import { z } from 'zod';

/**
 * Contract creation validator
 * Enforces:
 * - system_id required
 * - client_id required
 * - Recurring validation: if recurring_enabled=true, both cycle and amount required
 */
export const contractCreateSchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  system_id: z.number().int().positive('Invalid system ID'),
  installation_fee: z.number().nonnegative('Installation fee must be >= 0').default(0),
  installation_date: z.string().date().optional(),
  recurring_enabled: z.boolean().default(false),
  recurring_cycle: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annual']).nullable(),
  recurring_amount: z.number().positive().nullable(),
  status: z.enum(['draft', 'active', 'completed', 'suspended']).default('draft'),
  start_date: z.string().date().default(new Date().toISOString().split('T')[0]),
  end_date: z.string().date().nullable(),
  terms: z.string().optional(),
}).refine(
  (data) => {
    // If recurring is enabled, cycle and amount must be provided
    if (data.recurring_enabled) {
      return data.recurring_cycle !== null && data.recurring_cycle !== undefined &&
             data.recurring_amount !== null && data.recurring_amount !== undefined &&
             data.recurring_amount > 0;
    }
    // If recurring is disabled, cycle and amount must be null
    return data.recurring_cycle === null && data.recurring_amount === null;
  },
  {
    message: 'If recurring_enabled=true, recurring_cycle and recurring_amount must be provided. If false, both must be null.',
  }
);

export const contractUpdateSchema = contractCreateSchema.partial();

/**
 * Payment validator
 * Enforces:
 * - contract exists
 * - amount > 0
 */
export const paymentCreateSchema = z.object({
  contract_id: z.string().uuid('Invalid contract ID'),
  amount_received: z.number().positive('Amount must be > 0'),
  date_received: z.string().date().default(new Date().toISOString().split('T')[0]),
  payment_method: z.enum(['cash', 'bank_transfer', 'mobile_money', 'check', 'credit_card', 'crypto', 'other']).default('other'),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Allocation validator
 * Enforces:
 * - payment exists
 * - amount > 0
 * - allocation_type valid
 * - allocated_amount <= payment.amount_received
 */
export const allocationCreateSchema = z.object({
  payment_id: z.string().uuid('Invalid payment ID'),
  allocation_type: z.enum(['operating', 'vault', 'expense', 'investment', 'custom']),
  category_id: z.string().uuid().nullable().optional(),
  custom_category: z.string().optional(),
  amount: z.number().positive('Amount must be > 0'),
  description: z.string().optional(),
});

/**
 * Expense validator
 * Enforces:
 * - category exists
 * - amount > 0
 */
export const expenseCreateSchema = z.object({
  category_id: z.string().uuid('Invalid category ID'),
  amount: z.number().positive('Amount must be > 0'),
  expense_date: z.string().date().default(new Date().toISOString().split('T')[0]),
  description: z.string().optional(),
  payment_method: z.string().optional(),
  reference_number: z.string().optional(),
});

/**
 * Validate client exists and is active
 */
export async function validateClientExists(db, clientId) {
  const result = await db.query(
    'SELECT id FROM clients WHERE id = $1 AND status = $2',
    [clientId, 'active']
  );
  return result.rows.length > 0;
}

/**
 * Validate system exists and is active (from intellectual_property table)
 */
export async function validateSystemExists(db, systemId) {
  const result = await db.query(
    'SELECT id FROM intellectual_property WHERE id = $1 AND status IN ($2, $3)',
    [systemId, 'active', 'scaling']
  );
  return result.rows.length > 0;
}

/**
 * Validate contract exists
 */
export async function validateContractExists(db, contractId) {
  const result = await db.query(
    'SELECT id FROM contracts WHERE id = $1',
    [contractId]
  );
  return result.rows.length > 0;
}

/**
 * Validate payment exists
 */
export async function validatePaymentExists(db, paymentId) {
  const result = await db.query(
    'SELECT id FROM payments WHERE id = $1',
    [paymentId]
  );
  return result.rows.length > 0;
}

/**
 * Check if payment is fully allocated
 * Returns: { isFullyAllocated, allocatedAmount, remainingAmount }
 */
export async function checkPaymentAllocation(db, paymentId) {
  const result = await db.query(
    `SELECT 
       p.amount_received,
       COALESCE(SUM(a.amount), 0) as allocated_amount
     FROM payments p
     LEFT JOIN allocations a ON p.id = a.payment_id
     WHERE p.id = $1
     GROUP BY p.id, p.amount_received`,
    [paymentId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Payment not found');
  }
  
  const row = result.rows[0];
  const amountReceived = Number(row.amount_received);
  const allocatedAmount = Number(row.allocated_amount);
  const remainingAmount = amountReceived - allocatedAmount;
  
  return {
    isFullyAllocated: Math.abs(remainingAmount) < 0.01, // Account for floating point
    allocatedAmount,
    remainingAmount,
    amountReceived,
  };
}

/**
 * Validate that sum of allocations equals payment amount
 */
export async function validateAllocationSum(db, paymentId, newAllocationAmount = 0) {
  const { amountReceived, allocatedAmount } = await checkPaymentAllocation(db, paymentId);
  const totalAfterNew = allocatedAmount + newAllocationAmount;
  
  return {
    valid: totalAfterNew <= amountReceived,
    totalAllocation: totalAfterNew,
    amountReceived,
    remaining: amountReceived - totalAfterNew,
  };
}

/**
 * Calculate revenue metrics for a contract
 */
export async function getContractMetrics(db, contractId) {
  const result = await db.query(
    `SELECT
       c.id,
       c.recurring_enabled,
       c.recurring_amount,
       c.recurring_cycle,
       c.installation_fee,
       c.status,
       COALESCE(SUM(p.amount_received), 0) as total_collected,
       COUNT(p.id) as payment_count,
       MAX(p.date_received) as last_payment_date
     FROM contracts c
     LEFT JOIN payments p ON c.id = p.contract_id
     WHERE c.id = $1
     GROUP BY c.id, c.recurring_enabled, c.recurring_amount, c.recurring_cycle, c.installation_fee, c.status`,
    [contractId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Contract not found');
  }
  
  return result.rows[0];
}

/**
 * Detect orphaned payments (money with no allocation)
 */
export async function detectOrphanedPayments(db) {
  const result = await db.query(
    `SELECT pa.* FROM payment_allocation_audit pa
     WHERE pa.unallocated_amount > 0.01`
  );
  
  return result.rows;
}

/**
 * Detect overallocated payments (allocations exceed payment amount)
 */
export async function detectOverallocations(db) {
  const result = await db.query(
    `SELECT pa.* FROM payment_allocation_audit pa
     WHERE pa.unallocated_amount < -0.01`
  );
  
  return result.rows;
}
