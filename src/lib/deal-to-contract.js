/**
 * Deal → Contract Conversion Service
 * 
 * When a deal is marked as "Won", automatically create a contract.
 * This enforces the founder workflow: Prospect → Client → Deal → Contract → Payment
 */

import { query } from './db.js';

/**
 * Convert a won deal to a contract
 * 
 * Pre-requisites:
 * - Deal must have stage = 'Won'
 * - Deal must have client_id (prospect should be converted first)
 * - Deal must have system_id (which product is being sold)
 * 
 * @param {string} dealId - Deal UUID
 * @param {Object} contractData - Optional contract configuration
 * @returns {Promise<Object>} Created contract
 */
export async function convertDealToContract(dealId, contractData = {}) {
  // Get deal with all required relationships
  const dealResult = await query(
    `SELECT 
       d.*,
       c.id as existing_client_id,
       c.name as client_name,
       ip.name as system_name
     FROM deals d
     LEFT JOIN clients c ON d.client_id = c.id
     LEFT JOIN intellectual_property ip ON d.system_id = ip.id
     WHERE d.id = $1`,
    [dealId]
  );

  if (dealResult.rowCount === 0) {
    throw new Error(`Deal ${dealId} not found`);
  }

  const deal = dealResult.rows[0];

  // Validate deal is won
  if (deal.stage !== 'Won') {
    throw new Error(`Deal must be marked as Won before creating contract. Current stage: ${deal.stage}`);
  }

  // Validate system_id exists
  if (!deal.system_id) {
    throw new Error('Cannot create contract: Deal must have a system_id (which product is being sold)');
  }

  // Validate client_id exists (prospect must be converted first)
  if (!deal.client_id) {
    // Check if there's a prospect that can be auto-converted
    if (deal.prospect_id) {
      throw new Error(
        'Cannot create contract: Prospect must be converted to client first. ' +
        `Prospect ID: ${deal.prospect_id}. Convert the prospect, then try again.`
      );
    }
    throw new Error('Cannot create contract: Deal must have a client_id');
  }

  // Check if contract already exists for this deal
  const existingContract = await query(
    'SELECT id FROM contracts WHERE deal_id = $1',
    [dealId]
  );

  if (existingContract.rowCount > 0) {
    return {
      success: false,
      error: 'Contract already exists for this deal',
      contract_id: existingContract.rows[0].id,
    };
  }

  // Create contract
  const {
    installation_fee = deal.value_estimate || 0,
    recurring_enabled = false,
    recurring_cycle = null,
    recurring_amount = null,
    start_date = new Date().toISOString().split('T')[0],
    terms = `Contract for ${deal.system_name || 'System'} - ${deal.title}`,
    status = 'active',
  } = contractData;

  const contractResult = await query(
    `INSERT INTO contracts (
       client_id,
       system_id,
       deal_id,
       installation_fee,
       recurring_enabled,
       recurring_cycle,
       recurring_amount,
       start_date,
       terms,
       status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      deal.client_id,
      deal.system_id,
      dealId,
      installation_fee,
      recurring_enabled,
      recurring_cycle,
      recurring_amount,
      start_date,
      terms,
      status,
    ]
  );

  const contract = contractResult.rows[0];

  // Log this in audit
  console.log(`✓ Contract created from deal: ${deal.title} → Contract ${contract.id}`);

  return {
    success: true,
    contract: {
      ...contract,
      installation_fee: parseFloat(contract.installation_fee),
      recurring_amount: contract.recurring_amount ? parseFloat(contract.recurring_amount) : null,
      client_name: deal.client_name,
      system_name: deal.system_name,
    },
    deal_id: dealId,
  };
}

/**
 * Convert prospect to client and optionally create a deal
 * 
 * @param {string} prospectId - Prospect UUID
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Created client (and optionally deal)
 */
export async function convertProspectToClient(prospectId, options = {}) {
  // Get prospect data
  const prospectResult = await query(
    `SELECT 
       p.*,
       ps.stage_name,
       pi.industry_name
     FROM prospects p
     LEFT JOIN prospect_stages ps ON p.current_stage_id = ps.id
     LEFT JOIN prospect_industries pi ON p.industry_id = pi.id
     WHERE p.id = $1`,
    [prospectId]
  );

  if (prospectResult.rowCount === 0) {
    throw new Error(`Prospect ${prospectId} not found`);
  }

  const prospect = prospectResult.rows[0];

  // Check if already converted
  if (prospect.status === 'converted') {
    const existingClient = await query(
      'SELECT id FROM clients WHERE prospect_id = $1',
      [prospectId]
    );
    if (existingClient.rowCount > 0) {
      return {
        success: false,
        error: 'Prospect already converted',
        client_id: existingClient.rows[0].id,
      };
    }
  }

  // Create client from prospect data
  const clientResult = await query(
    `INSERT INTO clients (
       prospect_id,
       name,
       email,
       phone,
       company_name,
       address,
       status,
       notes,
       converted_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
     RETURNING *`,
    [
      prospectId,
      prospect.prospect_name,
      prospect.email,
      prospect.phone_number,
      prospect.company_name,
      prospect.address,
      'active',
      options.notes || `Converted from prospect. Industry: ${prospect.industry_name || 'Unknown'}`,
    ]
  );

  const client = clientResult.rows[0];

  // Update prospect status
  await query(
    `UPDATE prospects SET status = 'converted', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [prospectId]
  );

  // Log activity
  await query(
    `INSERT INTO prospect_activities (
       prospect_id,
       activity_type,
       subject,
       description,
       activity_date
     ) VALUES ($1, 'converted', 'Converted to Client', $2, CURRENT_TIMESTAMP)`,
    [prospectId, `Client ID: ${client.id}`]
  );

  // Update any existing deals linked to this prospect
  await query(
    `UPDATE deals SET client_id = $1, updated_at = CURRENT_TIMESTAMP WHERE prospect_id = $2 AND client_id IS NULL`,
    [client.id, prospectId]
  );

  console.log(`✓ Prospect converted: ${prospect.prospect_name} → Client ${client.id}`);

  return {
    success: true,
    client,
    prospect_id: prospectId,
  };
}

/**
 * Win deal and create contract in one operation
 * 
 * @param {string} dealId - Deal UUID
 * @param {Object} contractData - Optional contract configuration
 * @returns {Promise<Object>} Result with updated deal and new contract
 */
export async function winDealAndCreateContract(dealId, contractData = {}) {
  // Update deal to Won status
  const dealUpdate = await query(
    `UPDATE deals SET stage = 'Won', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [dealId]
  );

  if (dealUpdate.rowCount === 0) {
    throw new Error(`Deal ${dealId} not found`);
  }

  const deal = dealUpdate.rows[0];

  // If deal has prospect but no client, try to convert
  if (deal.prospect_id && !deal.client_id) {
    const conversionResult = await convertProspectToClient(deal.prospect_id);
    if (conversionResult.success) {
      // Update deal with new client_id
      await query(
        'UPDATE deals SET client_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [conversionResult.client.id, dealId]
      );
      deal.client_id = conversionResult.client.id;
    }
  }

  // Now create contract
  const contractResult = await convertDealToContract(dealId, contractData);

  return {
    success: contractResult.success,
    deal,
    contract: contractResult.contract,
    error: contractResult.error,
  };
}

export default {
  convertDealToContract,
  convertProspectToClient,
  winDealAndCreateContract,
};
