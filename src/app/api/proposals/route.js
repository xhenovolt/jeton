import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission, buildDataScopeFilter } from '@/lib/permissions.js';

const PROPOSAL_SELECT = `
  SELECT
    pr.*,
    p.company_name  AS prospect_name,
    p.email         AS prospect_email,
    p.contact_name  AS prospect_contact,
    p.phone         AS prospect_phone,
    ds.name         AS system_name,
    ds.positioning  AS system_positioning,
    ds.description  AS system_description,
    pp.name         AS plan_name,
    pp.installation_fee,
    pp.annual_subscription,
    pp.student_limit,
    pp.is_popular,
    u.full_name     AS created_by_name
  FROM proposals pr
  JOIN prospects   p  ON p.id  = pr.prospect_id
  JOIN drais_systems ds ON ds.id = pr.system_id
  JOIN pricing_plans pp ON pp.id = pr.selected_plan_id
  LEFT JOIN users u ON u.id = pr.created_by
`;

/**
 * GET /api/proposals
 * List all proposals (optionally filtered by prospect_id or status)
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'prospects.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { searchParams } = new URL(request.url);
    const prospect_id = searchParams.get('prospect_id');
    const status = searchParams.get('status');

    const params = [];
    let sql = PROPOSAL_SELECT + ' WHERE 1=1';

    if (prospect_id) { params.push(prospect_id); sql += ` AND pr.prospect_id = $${params.length}`; }
    if (status)      { params.push(status);      sql += ` AND pr.status = $${params.length}`; }

    sql += ' ORDER BY pr.created_at DESC';

    const result = await query(sql, params);

    // Attach features for each proposal's plan
    const proposals = await Promise.all(
      result.rows.map(async (row) => {
        const feats = await query(
          `SELECT * FROM pricing_features WHERE plan_id = $1 ORDER BY display_order`,
          [row.selected_plan_id]
        );
        return { ...row, features: feats.rows };
      })
    );

    return NextResponse.json({ success: true, data: proposals });
  } catch (error) {
    console.error('[Proposals] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch proposals' }, { status: 500 });
  }
}

/**
 * POST /api/proposals
 * Create a new proposal with snapshot
 */
export async function POST(request) {
  const perm = await requirePermission(request, 'prospects.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const body = await request.json();
    const { prospect_id, system_id, selected_plan_id, custom_notes, discount_percent, payment_terms } = body;

    if (!prospect_id || !system_id || !selected_plan_id) {
      return NextResponse.json(
        { success: false, error: 'prospect_id, system_id, and selected_plan_id are required' },
        { status: 400 }
      );
    }

    // Validate prospect exists
    const prospectRes = await query(`SELECT * FROM prospects WHERE id = $1`, [prospect_id]);
    if (!prospectRes.rows[0]) {
      return NextResponse.json({ success: false, error: 'Prospect not found' }, { status: 404 });
    }

    // Validate plan exists and belongs to the right system
    const planRes = await query(
      `SELECT pp.*, ds.name AS system_name, ds.positioning, ds.description AS system_description
       FROM pricing_plans pp
       JOIN drais_systems ds ON ds.id = pp.system_id
       WHERE pp.id = $1 AND pp.system_id = $2`,
      [selected_plan_id, system_id]
    );
    if (!planRes.rows[0]) {
      return NextResponse.json({ success: false, error: 'Plan not found or does not belong to the specified system' }, { status: 404 });
    }

    // Get features for the plan
    const featuresRes = await query(
      `SELECT * FROM pricing_features WHERE plan_id = $1 ORDER BY display_order`,
      [selected_plan_id]
    );

    // Create the proposal
    const proposalRes = await query(
      `INSERT INTO proposals
         (prospect_id, system_id, selected_plan_id, custom_notes, discount_percent, payment_terms, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'generated', $7)
       RETURNING *`,
      [
        prospect_id,
        system_id,
        selected_plan_id,
        custom_notes || null,
        discount_percent || 0,
        payment_terms || null,
        auth.userId,
      ]
    );
    const proposal = proposalRes.rows[0];
    const prospect = prospectRes.rows[0];
    const plan = planRes.rows[0];

    // Build full snapshot payload
    const discountAmt = (parseFloat(plan.installation_fee) + parseFloat(plan.annual_subscription)) * (parseFloat(discount_percent || 0) / 100);
    const snapshot = {
      proposal_id:         proposal.id,
      generated_at:        new Date().toISOString(),
      school_name:         prospect.company_name,
      contact_name:        prospect.contact_name,
      email:               prospect.email,
      phone:               prospect.phone,
      system: {
        id:          system_id,
        name:        plan.system_name,
        positioning: plan.positioning,
        description: plan.system_description,
      },
      plan: {
        id:                  plan.id,
        name:                plan.name,
        installation_fee:    parseFloat(plan.installation_fee),
        annual_subscription: parseFloat(plan.annual_subscription),
        student_limit:       plan.student_limit,
        is_popular:          plan.is_popular,
      },
      features:        featuresRes.rows,
      discount_percent: parseFloat(discount_percent || 0),
      discount_amount:  discountAmt,
      custom_notes:    custom_notes || null,
      payment_terms:   payment_terms || null,
    };

    // Save the snapshot (immutable record)
    await query(
      `INSERT INTO proposal_snapshots (proposal_id, full_payload) VALUES ($1, $2)`,
      [proposal.id, JSON.stringify(snapshot)]
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'CREATE', 'proposal', $2, $3)`,
      [auth.userId, proposal.id, JSON.stringify({ prospect_id, plan: plan.name })]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      data: { ...proposal, snapshot, features: featuresRes.rows, plan, prospect },
    }, { status: 201 });
  } catch (error) {
    console.error('[Proposals] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create proposal' }, { status: 500 });
  }
}
