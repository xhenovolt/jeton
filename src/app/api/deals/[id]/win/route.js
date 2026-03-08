/**
 * Win Deal API Route
 * POST - Mark deal as won and optionally create contract
 * 
 * This is the key workflow transition:
 * Prospect → Client → Deal (Won) → Contract
 */

import { getDealById, updateDealStage } from '@/lib/deals.js';
import { winDealAndCreateContract, convertDealToContract } from '@/lib/deal-to-contract.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;

    // Check if deal exists
    const deal = await getDealById(id);
    if (!deal) {
      return Response.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      );
    }

    // Check if already won
    if (deal.stage === 'Won') {
      // Try to create contract if doesn't exist
      try {
        const body = await request.json().catch(() => ({}));
        const contractResult = await convertDealToContract(id, body.contractData || {});
        
        if (contractResult.success) {
          return Response.json({
            success: true,
            message: 'Contract created for won deal',
            deal: deal,
            contract: contractResult.contract,
          });
        } else {
          return Response.json({
            success: true,
            message: contractResult.error || 'Deal already won',
            deal: deal,
            contract_id: contractResult.contract_id,
          });
        }
      } catch (contractError) {
        return Response.json({
          success: false,
          error: `Deal is won but contract creation failed: ${contractError.message}`,
          deal: deal,
        }, { status: 400 });
      }
    }

    // Parse body for contract configuration
    const body = await request.json().catch(() => ({}));
    const { createContract = true, contractData = {} } = body;

    // If not creating contract, just update stage
    if (!createContract) {
      const updatedDeal = await updateDealStage(id, 'Won');
      return Response.json({
        success: true,
        message: 'Deal marked as won',
        deal: updatedDeal,
        contract: null,
      });
    }

    // Win deal and create contract in one operation
    const result = await winDealAndCreateContract(id, contractData);

    if (result.success) {
      return Response.json({
        success: true,
        message: 'Deal won and contract created successfully',
        deal: result.deal,
        contract: result.contract,
      });
    } else {
      return Response.json({
        success: false,
        error: result.error || 'Failed to create contract',
        deal: result.deal,
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in POST /api/deals/[id]/win:', error);
    return Response.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
