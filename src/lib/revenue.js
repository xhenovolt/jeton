import { query } from './db.js';

// Simple helper to guarantee the unified revenue_records table exists
// This mirrors the portion of the migration that creates that table and
// associated indexes. Calling it on every request is cheap because the
// DDL is "IF NOT EXISTS" and is therefore a no-op after the first run.
export async function ensureRevenueRecordsTable() {
  // create the core table
  await query(`
    CREATE TABLE IF NOT EXISTS revenue_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID UNIQUE REFERENCES deals(id) ON DELETE SET NULL,
      sale_id UUID UNIQUE REFERENCES sales(id) ON DELETE SET NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'deal' CHECK (type IN ('deal', 'sale')),
      status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost','partially_paid','credit','paid')),
      stage VARCHAR(80),
      title VARCHAR(255) NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_email VARCHAR(255),
      amount_total DECIMAL(19,2) NOT NULL DEFAULT 0,
      amount_received DECIMAL(19,2) NOT NULL DEFAULT 0,
      amount_outstanding DECIMAL(19,2) NOT NULL DEFAULT 0,
      probability DECIMAL(5,2) DEFAULT 0,
      weighted_value DECIMAL(19,2) DEFAULT 0,
      expected_revenue DECIMAL(19,2) DEFAULT 0,
      payment_status VARCHAR(30) NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid','Partially Paid','Paid','Credit','Overdue')),
      on_credit BOOLEAN NOT NULL DEFAULT FALSE,
      due_date DATE,
      follow_up_at TIMESTAMP,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // indexes used by sales/report endpoints
  await query('CREATE INDEX IF NOT EXISTS idx_revenue_records_status ON revenue_records(status)');
  await query('CREATE INDEX IF NOT EXISTS idx_revenue_records_payment_status ON revenue_records(payment_status)');
  await query('CREATE INDEX IF NOT EXISTS idx_revenue_records_due_date ON revenue_records(due_date)');
  await query('CREATE INDEX IF NOT EXISTS idx_revenue_records_customer_name ON revenue_records(customer_name)');
}

// export other helpers if we need them in future
export default {
  ensureRevenueRecordsTable,
};