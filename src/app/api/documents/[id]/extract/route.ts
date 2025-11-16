import { NextRequest, NextResponse } from 'next/server';
import { getExtractionService } from '@/services/extraction.service';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { prisma } from '@/lib/prisma';


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
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { id } = context.params;

    const document = await prisma.document.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document introuvable' },
        { status: 404 }
      );
    }
    
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

