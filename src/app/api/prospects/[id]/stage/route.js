/**
 * PUT /api/prospects/[id]/stage
 * Change prospect pipeline stage with audit trail
 */

import { changeProspectStage, getProspectById } from '@/lib/prospects.js';
import { requireApiAuth } from '@/lib/api-auth.js';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    // Get current user - throws 401 if not authenticated
    const user = await requireApiAuth();

    // Validate required fields
    if (!body.new_stage_id) {
      return Response.json(
        { success: false, error: 'new_stage_id is required' },
        { status: 400 }
      );
    }

    if (!body.reason_for_change) {
      return Response.json(
        { success: false, error: 'reason_for_change is required' },
        { status: 400 }
      );
    }

    // Verify prospect exists
    const prospect = await getProspectById(id);
    if (!prospect) {
      return Response.json(
        { success: false, error: 'Prospect not found' },
        { status: 404 }
      );
    }

    // Change stage (includes transactional history logging)
    const updatedProspect = await changeProspectStage(
      id,
      body.new_stage_id,
      body.reason_for_change,
      user.userId
    );

    return Response.json({
      success: true,
      message: 'Prospect stage changed successfully',
      data: updatedProspect.toJSON(),
    });
  } catch (error) {
    console.error('PUT /api/prospects/[id]/stage error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
