import { NextRequest, NextResponse } from 'next/server';
import { getExtractionService } from '@/services/extraction.service';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * POST /api/documents/:id/extract - Force la re-extraction des champs
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = context.params;
    
    const extractionService = getExtractionService();
    const result = await extractionService.reextract(id);

    return NextResponse.json({
      success: true,
      extraction: result,
    });
  } catch (error: any) {
    console.error('Error extracting document fields:', error);
    return NextResponse.json(
      { error: 'Failed to extract document fields', details: error.message },
      { status: 500 }
    );
  }
}

