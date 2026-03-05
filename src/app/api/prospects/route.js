/**
 * GET /api/prospects
 * POST /api/prospects
 * 
 * Get all prospects or create a new prospect
 * OOP-based Prospect CRM implementation
 */

import {
  createProspect,
  getAllProspects,
  getProspectSources,
  getProspectIndustries,
  getProspectStages,
  resolveUserId,
} from '@/lib/prospects.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Check if requesting reference data
    const dataType = searchParams.get('data');
    
    if (dataType === 'sources') {
      const sources = await getProspectSources();
      return Response.json({ success: true, data: sources });
    }
    
    if (dataType === 'industries') {
      const industries = await getProspectIndustries();
      return Response.json({ success: true, data: industries });
    }
    
    if (dataType === 'stages') {
      const stages = await getProspectStages();
      return Response.json({ success: true, data: stages });
    }

    // Get prospects with filters
    const filters = {
      stage_id: searchParams.get('stage_id') ? parseInt(searchParams.get('stage_id')) : null,
      assigned_to: searchParams.get('assigned_to'),
      source_id: searchParams.get('source_id') ? parseInt(searchParams.get('source_id')) : null,
      company_name: searchParams.get('company'),
      search: searchParams.get('search'),
    };

    const prospects = await getAllProspects(filters);

    return Response.json({
      success: true,
      data: prospects.map(p => p.toJSON()),
      count: prospects.length,
    });
  } catch (error) {
    console.error('GET /api/prospects error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { prospect_name, email, phone_number, whatsapp_number, company_name, industry_id, source_id, assigned_sales_agent_id } = body;

    // Defensive: log raw body and all values for debugging
    console.log('POST /api/prospects - Raw Body:', JSON.stringify(body, null, 2));
    console.log('POST /api/prospects - Parsed Fields:', {
      prospect_name: prospect_name || 'undefined',
      prospect_name_type: typeof prospect_name,
      prospect_name_trimmed: prospect_name?.trim() || 'empty',
      email: email || 'undefined',
      email_type: typeof email,
      email_trimmed: email?.trim() || 'empty',
      phone_number: phone_number || 'undefined',
      phone_number_type: typeof phone_number,
      phone_number_trimmed: phone_number?.trim() || 'empty',
      whatsapp_number: whatsapp_number || 'undefined',
      whatsapp_number_type: typeof whatsapp_number,
      whatsapp_number_trimmed: whatsapp_number?.trim() || 'empty',
      source_id: source_id || 'undefined',
      source_id_type: typeof source_id,
    });

    // Get user ID from request headers or use fallback
    const userIdFromHeader = request.headers.get('x-user-id');
    let createdById;
    try {
      createdById = await resolveUserId(userIdFromHeader);
      console.log(`Using user ID: ${createdById}`);
    } catch (userError) {
      console.error('User resolution failed:', userError);
      throw new Error(`Cannot create prospect: ${userError.message}`);
    }

    const prospect = await createProspect(
      {
        prospect_name,
        email,
        phone_number,
        whatsapp_number,
        company_name,
        industry_id,
        source_id,
        assigned_sales_agent_id,
      },
      createdById
    );

    return Response.json(
      {
        success: true,
        message: 'Prospect created successfully',
        data: prospect.toJSON(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/prospects error:', error);
    
    // Defensive: more specific error messages and status codes
    const errorMessage = error?.message || 'Failed to create prospect';
    
    // Determine appropriate status code based on error type
    let statusCode = 500;
    if (errorMessage.includes('required')) {
      statusCode = 400; // Bad request - missing required field
    } else if (errorMessage.includes('not found')) {
      statusCode = 404; // Not found - referenced resource doesn't exist
    } else if (errorMessage.includes('already exists')) {
      statusCode = 409; // Conflict - duplicate
    } else if (errorMessage.includes('Source error')) {
      statusCode = 400; // Bad request - invalid source
    }

    return Response.json(
      { 
        success: false, 
        error: errorMessage,
        details: {
          type: error?.constructor?.name,
          statusCode,
        },
      },
      { status: statusCode }
    );
  }
}
