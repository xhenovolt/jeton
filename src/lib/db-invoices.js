import pkg from 'pg';
const { Pool } = pkg;

// Initialize connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Get a single invoice by ID
export async function getInvoiceById(invoiceId) {
  try {
    const result = await pool.query(
      'SELECT * FROM invoices WHERE id = $1',
      [invoiceId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching invoice:', error);
    throw error;
  }
}

// Get a single invoice by invoice_number
export async function getInvoiceByNumber(invoiceNumber) {
  try {
    const result = await pool.query(
      'SELECT * FROM invoices WHERE invoice_number = $1',
      [invoiceNumber]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching invoice by number:', error);
    throw error;
  }
}

// Get all invoice items for an invoice
export async function getInvoiceItems(invoiceId) {
  try {
    const result = await pool.query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at ASC',
      [invoiceId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching invoice items:', error);
    throw error;
  }
}

// Get all invoices with pagination
export async function getAllInvoices(limit = 20, offset = 0, status = null) {
  try {
    let query = 'SELECT * FROM invoices';
    const values = [];
    
    if (status) {
      query += ' WHERE status = $1';
      values.push(status);
      query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
      values.push(limit, offset);
    } else {
      query += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
      values.push(limit, offset);
    }
    
    const result = await pool.query(query, values);
    
    // Fetch items for each invoice
    const invoicesWithItems = await Promise.all(
      result.rows.map(async (invoice) => {
        const itemsResult = await pool.query(
          'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at ASC',
          [invoice.id]
        );
        return {
          ...invoice,
          items: itemsResult.rows,
        };
      })
    );
    
    return invoicesWithItems;
  } catch (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }
}

// Get total count of invoices
export async function getInvoicesCount(status = null) {
  try {
    let query = 'SELECT COUNT(*) as count FROM invoices';
    const values = [];
    
    if (status) {
      query += ' WHERE status = $1';
      values.push(status);
    }
    
    const result = await pool.query(query, values);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error('Error counting invoices:', error);
    throw error;
  }
}

// Create a new invoice with items
export async function createInvoice(invoiceData, items) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create invoice
    const invoiceResult = await client.query(
      `INSERT INTO invoices 
       (invoice_number, invoice_name, client_name, client_email, client_phone, client_address,
        company_name, company_address, company_service_type, issue_date, due_date,
        subtotal, tax, discount, total, amount_paid, balance_due, status, notes,
        currency, signed_by, signed_by_title, payment_methods, payment_method_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
       RETURNING id, invoice_number, created_at, updated_at`,
      [
        invoiceData.invoiceNumber,
        invoiceData.invoiceName,
        invoiceData.clientName,
        invoiceData.clientEmail || null,
        invoiceData.clientPhone || null,
        invoiceData.clientAddress || null,
        invoiceData.companyName || 'Xhenvolt Uganda SMC Limited',
        invoiceData.companyAddress || 'Bulubandi, Iganga, Uganda',
        invoiceData.companyServiceType || 'Software Development & Digital Solutions',
        invoiceData.issueDate,
        invoiceData.dueDate || null,
        invoiceData.subtotal || 0,
        invoiceData.tax || 0,
        invoiceData.discount || 0,
        invoiceData.total || 0,
        invoiceData.amountPaid || 0,
        invoiceData.balanceDue || 0,
        invoiceData.status || 'draft',
        invoiceData.notes || null,
        invoiceData.currency || 'UGX',
        invoiceData.signedBy || 'HAMUZA IBRAHIM',
        invoiceData.signedByTitle || 'Chief Executive Officer (CEO)',
        invoiceData.paymentMethods ? JSON.stringify(invoiceData.paymentMethods) : null,
        invoiceData.paymentMethodUsed || null,
      ]
    );
    
    const invoiceId = invoiceResult.rows[0].id;
    
    // Create invoice items
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO invoice_items 
           (invoice_id, description, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            invoiceId,
            item.description,
            item.quantity || 1,
            item.unitPrice,
            item.totalPrice,
          ]
        );
      }
    }
    
    await client.query('COMMIT');
    return invoiceResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating invoice:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Update invoice
export async function updateInvoice(invoiceId, updates) {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    const allowedFields = [
      'invoiceName', 'clientName', 'clientEmail', 'clientPhone', 'clientAddress',
      'issueDate', 'dueDate', 'subtotal', 'tax', 'discount', 'total',
      'amountPaid', 'balanceDue', 'status', 'notes', 'currency',
      'signedBy', 'signedByTitle', 'paymentMethods', 'paymentMethodUsed'
    ];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const dbField = key
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase()
          .replace(/^_/, '');
        fields.push(`${dbField} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }
    
    if (fields.length === 0) {
      return null;
    }
    
    fields.push(`updated_at = NOW()`);
    values.push(invoiceId);
    
    const query = `
      UPDATE invoices 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating invoice:', error);
    throw error;
  }
}

// Update invoice items (delete old, insert new)
export async function updateInvoiceItems(invoiceId, newItems) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Delete existing items
    await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoiceId]);
    
    // Insert new items
    if (newItems && newItems.length > 0) {
      for (const item of newItems) {
        await client.query(
          `INSERT INTO invoice_items 
           (invoice_id, description, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            invoiceId,
            item.description,
            item.quantity || 1,
            item.unitPrice,
            item.totalPrice,
          ]
        );
      }
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating invoice items:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Delete invoice (cascade delete items)
export async function deleteInvoice(invoiceId) {
  try {
    const result = await pool.query(
      'DELETE FROM invoices WHERE id = $1 RETURNING id',
      [invoiceId]
    );
    return result.rows[0] ? true : false;
  } catch (error) {
    console.error('Error deleting invoice:', error);
    throw error;
  }
}

// Update invoice status
export async function updateInvoiceStatus(invoiceId, status) {
  try {
    const result = await pool.query(
      'UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, invoiceId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating invoice status:', error);
    throw error;
  }
}

// Get next invoice number
export async function getNextInvoiceNumber(prefix = 'XH') {
  try {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM invoices 
       WHERE invoice_number LIKE $1`,
      [`${prefix}/INV/${year}${month}/%`]
    );
    
    const nextNum = parseInt(result.rows[0].count, 10) + 1;
    return `${prefix}/INV/${year}${month}/${String(nextNum).padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating invoice number:', error);
    throw error;
  }
}

// Get invoices by client
export async function getInvoicesByClient(clientName, limit = 20, offset = 0) {
  try {
    const result = await pool.query(
      `SELECT * FROM invoices 
       WHERE client_name ILIKE $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [`%${clientName}%`, limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching invoices by client:', error);
    throw error;
  }
}

// Get invoices by date range
export async function getInvoicesByDateRange(startDate, endDate, limit = 20, offset = 0) {
  try {
    const result = await pool.query(
      `SELECT * FROM invoices 
       WHERE issue_date >= $1 AND issue_date <= $2
       ORDER BY created_at DESC 
       LIMIT $3 OFFSET $4`,
      [startDate, endDate, limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching invoices by date range:', error);
    throw error;
  }
}

// Get invoice statistics
export async function getInvoiceStats() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_invoices,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'partially_paid' THEN 1 ELSE 0 END) as partially_paid_count,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
        COALESCE(SUM(total), 0) as total_amount,
        COALESCE(SUM(amount_paid), 0) as total_paid,
        COALESCE(SUM(balance_due), 0) as total_pending
      FROM invoices
    `);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    throw error;
  }
}

export default pool;
