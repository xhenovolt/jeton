/**
 * PROSPECT CRM LIBRARY
 * Object-Oriented Prospect Management System
 * Founder-grade CRM with full lifecycle tracking
 */

import { query } from '@/lib/db.js';

// ============================================================================
// PROSPECT CLASS
// ============================================================================

export class Prospect {
  constructor(data) {
    this.id = data.id;
    this.prospectName = data.prospect_name;
    this.email = data.email;
    this.phoneNumber = data.phone_number;
    this.whatsappNumber = data.whatsapp_number;
    this.companyName = data.company_name;
    this.industryId = data.industry_id;
    this.city = data.city;
    this.country = data.country;
    this.address = data.address;
    this.sourceId = data.source_id;
    this.currentStageId = data.current_stage_id;
    this.assignedSalesAgentId = data.assigned_sales_agent_id;
    this.createdById = data.created_by_id;
    this.firstContactedAt = data.first_contacted_at;
    this.lastActivityAt = data.last_activity_at;
    this.nextFollowupAt = data.next_followup_at;
    this.status = data.status;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  /**
   * Get human-readable stage name
   */
  getStageName(stages) {
    const stage = stages.find(s => s.id === this.currentStageId);
    return stage ? stage.stage_name : 'Unknown';
  }

  /**
   * Convert to API response format
   */
  toJSON() {
    return {
      id: this.id,
      prospect_name: this.prospectName,
      email: this.email,
      phone_number: this.phoneNumber,
      whatsapp_number: this.whatsappNumber,
      company_name: this.companyName,
      industry_id: this.industryId,
      city: this.city,
      country: this.country,
      address: this.address,
      source_id: this.sourceId,
      current_stage_id: this.currentStageId,
      assigned_sales_agent_id: this.assignedSalesAgentId,
      created_by_id: this.createdById,
      first_contacted_at: this.firstContactedAt,
      last_activity_at: this.lastActivityAt,
      next_followup_at: this.nextFollowupAt,
      status: this.status,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }
}

// ============================================================================
// PROSPECT ACTIVITY CLASS
// ============================================================================

export class ProspectActivity {
  constructor(data) {
    this.id = data.id;
    this.prospectId = data.prospect_id;
    this.activityType = data.activity_type;
    this.subject = data.subject;
    this.description = data.description;
    this.outcome = data.outcome;
    this.notes = data.notes;
    this.productsDiscussed = data.products_discussed || [];
    this.objections = data.objections;
    this.feedback = data.feedback;
    this.activityDate = data.activity_date;
    this.durationMinutes = data.duration_minutes;
    this.createdById = data.created_by_id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      prospect_id: this.prospectId,
      activity_type: this.activityType,
      subject: this.subject,
      description: this.description,
      outcome: this.outcome,
      notes: this.notes,
      products_discussed: this.productsDiscussed,
      objections: this.objections,
      feedback: this.feedback,
      activity_date: this.activityDate,
      duration_minutes: this.durationMinutes,
      created_by_id: this.createdById,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }
}

// ============================================================================
// PROSPECT SERVICE (Business Logic)
// ============================================================================

/**
 * Resolve user ID - validates that user exists in database
 * Falls back to first available user if not provided
 */
export async function resolveUserId(userIdInput) {
  try {
    // If user ID provided, verify it exists
    if (userIdInput) {
      const userResult = await query(
        'SELECT id FROM users WHERE id = $1 LIMIT 1',
        [userIdInput]
      );
      if (userResult.rowCount > 0) {
        return userIdInput; // Valid user found
      }
      console.warn(`User ${userIdInput} not found, falling back to first user`);
    }

    // Fall back to first available user in database
    const firstUserResult = await query(
      'SELECT id FROM users ORDER BY created_at ASC LIMIT 1'
    );
    
    if (firstUserResult.rowCount === 0) {
      throw new Error('No users exist in database');
    }
    
    const fallbackUserId = firstUserResult.rows[0].id;
    console.log(`Using fallback user: ${fallbackUserId}`);
    return fallbackUserId;
  } catch (error) {
    console.error('Error resolving user ID:', error);
    throw new Error(`Failed to resolve user: ${error.message}`);
  }
}

/**
 * Resolve source ID - accepts either UUID or source name string
 * If given a string that looks like a UUID, use it directly
 * If given a source name string, look it up in database
 */
export async function resolveSourceId(sourceInput) {
  if (!sourceInput) {
    throw new Error('Source is required');
  }

  // Check if it looks like a UUID (36 chars with hyphens)
  if (typeof sourceInput === 'string' && sourceInput.length === 36 && sourceInput.includes('-')) {
    return sourceInput; // Assume it's a valid UUID
  }

  // Look up by source name
  try {
    const result = await query(
      'SELECT id FROM prospect_sources WHERE LOWER(source_name) = LOWER($1) LIMIT 1',
      [sourceInput]
    );
    
    if (result.rowCount === 0) {
      throw new Error(`Prospect source "${sourceInput}" not found`);
    }
    
    return result.rows[0].id;
  } catch (error) {
    if (error.message.includes('not found')) {
      throw error;
    }
    throw new Error(`Failed to resolve source: ${error.message}`);
  }
}

export async function createProspect(prospectData, createdById) {
  try {
    const {
      prospect_name,
      email,
      phone_number,
      whatsapp_number,
      company_name,
      industry_id,
      city,
      country,
      address,
      source_id,
      assigned_sales_agent_id,
    } = prospectData;

    // Trim and normalize contact methods (handle empty strings and whitespace)
    const trimmedEmail = email?.trim() || '';
    const trimmedPhone = phone_number?.trim() || '';
    const trimmedWhatsapp = whatsapp_number?.trim() || '';

    // Validate required fields
    if (!prospect_name || !prospect_name.trim()) {
      throw new Error('Prospect name is required');
    }

    if (!trimmedEmail && !trimmedPhone && !trimmedWhatsapp) {
      throw new Error('At least one contact method (email, phone, or WhatsApp) is required');
    }

    // Resolve source ID (handles both UUID and source name string)
    let resolvedSourceId;
    try {
      resolvedSourceId = await resolveSourceId(source_id);
    } catch (sourceError) {
      throw new Error(`Source error: ${sourceError.message}`);
    }

    const result = await query(`
      INSERT INTO prospects (
        prospect_name, email, phone_number, whatsapp_number,
        company_name, industry_id, city, country, address,
        source_id, current_stage_id, assigned_sales_agent_id, created_by_id,
        status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11, $12, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      prospect_name.trim(),
      trimmedEmail || null,
      trimmedPhone || null,
      trimmedWhatsapp || null,
      company_name ? company_name.trim() : null,
      industry_id || null,
      city ? city.trim() : null,
      country ? country.trim() : null,
      address ? address.trim() : null,
      resolvedSourceId,
      assigned_sales_agent_id || null,
      createdById,
    ]);

    return new Prospect(result.rows[0]);
  } catch (error) {
    console.error('Error creating prospect:', error);
    throw error;
  }
}

export async function getProspectById(prospectId) {
  try {
    const result = await query('SELECT * FROM prospects WHERE id = $1', [prospectId]);
    if (result.rowCount === 0) return null;
    return new Prospect(result.rows[0]);
  } catch (error) {
    console.error('Error getting prospect:', error);
    throw error;
  }
}

export async function getAllProspects(filters = {}) {
  try {
    let queryStr = 'SELECT * FROM prospects WHERE status = \'active\'';
    const params = [];
    let paramIndex = 1;

    // Apply filters
    if (filters.stage_id) {
      queryStr += ` AND current_stage_id = $${paramIndex}`;
      params.push(filters.stage_id);
      paramIndex++;
    }

    if (filters.assigned_to) {
      queryStr += ` AND assigned_sales_agent_id = $${paramIndex}`;
      params.push(filters.assigned_to);
      paramIndex++;
    }

    if (filters.source_id) {
      queryStr += ` AND source_id = $${paramIndex}`;
      params.push(filters.source_id);
      paramIndex++;
    }

    if (filters.company_name) {
      queryStr += ` AND LOWER(company_name) LIKE LOWER($${paramIndex})`;
      params.push(`%${filters.company_name}%`);
      paramIndex++;
    }

    if (filters.search) {
      queryStr += ` AND (LOWER(prospect_name) LIKE LOWER($${paramIndex}) OR LOWER(email) LIKE LOWER($${paramIndex}))`;
      params.push(`%${filters.search}%`);
      params.push(`%${filters.search}%`);
      paramIndex += 2;
    }

    queryStr += ' ORDER BY created_at DESC LIMIT 1000';

    const result = await query(queryStr, params);
    return result.rows.map(row => new Prospect(row));
  } catch (error) {
    console.error('Error getting prospects:', error);
    throw error;
  }
}

export async function updateProspect(prospectId, updates) {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Only allow specific fields to be updated
    const allowedFields = [
      'prospect_name',
      'email',
      'phone_number',
      'whatsapp_number',
      'company_name',
      'industry_id',
      'city',
      'country',
      'address',
      'assigned_sales_agent_id',
      'next_followup_at',
      'status',
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(prospectId);

    const queryStr = `UPDATE prospects SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await query(queryStr, values);
    if (result.rowCount === 0) throw new Error('Prospect not found');

    return new Prospect(result.rows[0]);
  } catch (error) {
    console.error('Error updating prospect:', error);
    throw error;
  }
}

// ============================================================================
// PROSPECT ACTIVITY OPERATIONS
// ============================================================================

export async function logActivity(prospectId, activityData, createdById) {
  try {
    const {
      activity_type,
      subject,
      description,
      outcome,
      notes,
      products_discussed,
      objections,
      feedback,
      duration_minutes,
    } = activityData;

    if (!activity_type) {
      throw new Error('Activity type is required');
    }

    // Validate activity type
    const validTypes = [
      'call',
      'email',
      'meeting',
      'message',
      'note',
      'stage_change',
      'follow_up_set',
      'deal_created',
      'deal_converted',
    ];
    if (!validTypes.includes(activity_type)) {
      throw new Error(`Invalid activity type. Must be one of: ${validTypes.join(', ')}`);
    }

    const result = await query(`
      INSERT INTO prospect_activities (
        prospect_id, activity_type, subject, description, outcome,
        notes, products_discussed, objections, feedback, duration_minutes,
        activity_date, created_by_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      prospectId,
      activity_type,
      subject || null,
      description || null,
      outcome || null,
      notes || null,
      products_discussed || [],
      objections || null,
      feedback || null,
      duration_minutes || null,
      createdById,
    ]);

    // Update prospect's last_activity_at
    await query(`UPDATE prospects SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1`, [prospectId]);

    return new ProspectActivity(result.rows[0]);
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
}

export async function getProspectActivities(prospectId) {
  try {
    const result = await query(`
      SELECT * FROM prospect_activities
      WHERE prospect_id = $1
      ORDER BY activity_date DESC
    `, [prospectId]);

    return result.rows.map(row => new ProspectActivity(row));
  } catch (error) {
    console.error('Error getting prospect activities:', error);
    throw error;
  }
}

// ============================================================================
// PROSPECT STAGE MANAGEMENT
// ============================================================================

export async function changeProspectStage(prospectId, newStageId, reason, changedById) {
  try {
    // Get current stage
    const currentProspect = await getProspectById(prospectId);
    if (!currentProspect) throw new Error('Prospect not found');

    const previousStageId = currentProspect.currentStageId;

    if (previousStageId === newStageId) {
      throw new Error('New stage must be different from current stage');
    }

    // Start transaction
    await query('BEGIN');

    try {
      // Update prospect stage
      await query(
        `UPDATE prospects SET current_stage_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newStageId, prospectId]
      );

      // Log stage change
      await query(`
        INSERT INTO prospect_stage_history (prospect_id, previous_stage_id, new_stage_id, reason_for_change, changed_by_id, changed_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [prospectId, previousStageId, newStageId, reason || null, changedById]);

      // Log activity for stage change
      await logActivity(
        prospectId,
        {
          activity_type: 'stage_change',
          subject: 'Stage changed',
          description: `Prospect moved to new stage`,
          notes: reason,
        },
        changedById
      );

      await query('COMMIT');

      return {
        success: true,
        message: 'Prospect stage updated successfully',
        previous_stage_id: previousStageId,
        new_stage_id: newStageId,
      };
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error changing prospect stage:', error);
    throw error;
  }
}

// ============================================================================
// PROSPECT PIPELINE VIEWS
// ============================================================================

export async function getPipelineSummary() {
  try {
    const result = await query('SELECT * FROM prospect_pipeline_summary ORDER BY stage_order');
    return result.rows;
  } catch (error) {
    console.error('Error getting pipeline summary:', error);
    throw error;
  }
}

export async function getAgentPerformance() {
  try {
    const result = await query('SELECT * FROM prospect_agent_performance');
    return result.rows;
  } catch (error) {
    console.error('Error getting agent performance:', error);
    throw error;
  }
}

export async function getActivitySummary() {
  try {
    const result = await query('SELECT * FROM prospect_activity_summary');
    return result.rows;
  } catch (error) {
    console.error('Error getting activity summary:', error);
    throw error;
  }
}

// ============================================================================
// REFERENCE DATA
// ============================================================================

export async function getProspectSources() {
  try {
    const result = await query('SELECT id, source_name, description FROM prospect_sources ORDER BY source_name');
    return result.rows;
  } catch (error) {
    console.error('Error getting prospect sources:', error);
    throw error;
  }
}

export async function getProspectIndustries() {
  try {
    const result = await query('SELECT id, industry_name, category FROM prospect_industries ORDER BY industry_name');
    return result.rows;
  } catch (error) {
    console.error('Error getting prospect industries:', error);
    throw error;
  }
}

export async function getProspectStages() {
  try {
    const result = await query('SELECT id, stage_name, stage_order, description FROM prospect_stages ORDER BY stage_order');
    return result.rows;
  } catch (error) {
    console.error('Error getting prospect stages:', error);
    throw error;
  }
}
