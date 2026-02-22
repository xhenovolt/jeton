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

    // Get user ID from request (would be from auth context in real implementation)
    const createdById = body.created_by_id || '00000000-0000-0000-0000-000000000001';

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
    return Response.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
