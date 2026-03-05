/**
 * GET /api/contracts
 * LIST all contracts with filtering, pagination, and metrics
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const systemId = searchParams.get('systemId');
    const search = searchParams.get('search');
    const recurringOnly = searchParams.get('recurringOnly') === 'true';

    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = [];
    let paramIdx = 1;

    if (status) {
      whereClause.push(`c.status = $${paramIdx++}`);
      params.push(status);
    }

    if (clientId) {
      whereClause.push(`c.client_id = $${paramIdx++}`);
      params.push(clientId);
    }

    if (systemId) {
      whereClause.push(`c.system_id = $${paramIdx++}`);
      params.push(parseInt(systemId));
    }

    if (recurringOnly) {
      whereClause.push(`c.recurring_enabled = true`);
    }

    if (search) {
      whereClause.push(
        `(cl.name ILIKE $${paramIdx} OR ip.name ILIKE $${paramIdx++})`
      );
      params.push(`%${search}%`);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM contracts c
       JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN intellectual_property ip ON c.system_id = ip.id
       ${whereSQL}`,
      params
    );

    const total = parseInt(countResult.rows[0].count);

    // Get paginated contracts with metrics
    const contractsResult = await query(
      `SELECT
         c.*,
         cl.name as client_name,
         ip.name as system_name,
         COALESCE(SUM(p.amount_received), 0)::numeric as total_collected,
         COUNT(p.id)::integer as payment_count,
         MAX(p.date_received) as last_payment_date
       FROM contracts c
       JOIN clients cl ON c.client_id = cl.id
       LEFT JOIN intellectual_property ip ON c.system_id = ip.id
       LEFT JOIN payments p ON c.id = p.contract_id
       ${whereSQL}
       GROUP BY c.id, c.client_id, c.system_id, c.installation_fee, 
                c.recurring_enabled, c.recurring_cycle, c.recurring_amount,
                c.status, c.start_date, c.end_date, c.created_at, c.updated_at,
                c.terms, c.metadata, c.installation_date,
                cl.name, ip.name
       ORDER BY c.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    return Response.json({
      success: true,
      contracts: contractsResult.rows.map(row => ({
        ...row,
        installation_fee: parseFloat(row.installation_fee),
        recurring_amount: row.recurring_amount ? parseFloat(row.recurring_amount) : null,
        total_collected: parseFloat(row.total_collected),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching contracts:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/contracts
 * CREATE new contract with validation
 * REQUIRED: client_id, system_id
 * OPTIONAL: installation_fee, recurring config
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      client_id,
      system_id,
      installation_fee = 0,
      installation_date,
      recurring_enabled = false,
      recurring_cycle = null,
      recurring_amount = null,
      status = 'draft',
      start_date = new Date().toISOString().split('T')[0],
      end_date = null,
      terms = null,
    } = body;

    // Validation: Required fields
    if (!client_id) {
      return Response.json(
        { success: false, error: 'client_id is required' },
        { status: 400 }
      );
    }

    if (!system_id) {
      return Response.json(
        { success: false, error: 'system_id is required' },
        { status: 400 }
      );
    }

    // Validation: Recurring logic
    if (recurring_enabled) {
      if (!recurring_cycle || !recurring_amount || recurring_amount <= 0) {
        return Response.json(
          {
            success: false,
            error: 'If recurring_enabled=true, recurring_cycle and recurring_amount (>0) are required',
          },
          { status: 400 }
        );
      }
    } else {
      if (recurring_cycle !== null || recurring_amount !== null) {
        return Response.json(
          {
            success: false,
            error: 'If recurring_enabled=false, recurring_cycle and recurring_amount must be null',
          },
          { status: 400 }
        );
      }
    }

    // Validation: Client exists
    const clientCheck = await query(
      'SELECT id FROM clients WHERE id = $1 AND status = $2',
      [client_id, 'active']
    );
    if (clientCheck.rows.length === 0) {
      return Response.json(
        { success: false, error: 'Client not found or inactive' },
        { status: 404 }
      );
    }

    // Validation: System exists
    const systemCheck = await query(
      'SELECT id FROM intellectual_property WHERE id = $1 AND status IN ($2, $3)',
      [system_id, 'active', 'scaling']
    );
    if (systemCheck.rows.length === 0) {
      return Response.json(
        { success: false, error: 'System not found or inactive' },
        { status: 404 }
      );
    }

    // Create contract
    const result = await query(
      `INSERT INTO contracts (
         client_id, system_id, installation_fee, installation_date,
         recurring_enabled, recurring_cycle, recurring_amount,
         status, start_date, end_date, terms
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        client_id,
        system_id,
        installation_fee,
        installation_date || null,
        recurring_enabled,
        recurring_cycle,
        recurring_amount,
        status,
        start_date,
        end_date,
        terms,
      ]
    );

    const contract = result.rows[0];

    return Response.json(
      {
        success: true,
        contract: {
          ...contract,
          installation_fee: parseFloat(contract.installation_fee),
          recurring_amount: contract.recurring_amount ? parseFloat(contract.recurring_amount) : null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating contract:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
