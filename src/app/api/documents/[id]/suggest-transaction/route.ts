import { NextRequest, NextResponse } from 'next/server';
import { transactionSuggestionService } from '@/services/TransactionSuggestionService';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/documents/[id]/suggest-transaction
 * Analyse un document et retourne une suggestion de transaction
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    const document = await prisma.document.findFirst({
      where: { id: params.id, organizationId },
      select: { id: true },
    });

    if (!document) {
      return NextResponse.json({
        success: false,
        error: 'Document introuvable',
      }, { status: 404 });
    }

    console.log('[API] Suggestion de transaction pour document:', params.id);

    const suggestion = await transactionSuggestionService.fromDocument(params.id);

    if (!suggestion) {
      return NextResponse.json({
        success: false,
        message: 'Aucune suggestion générée'
      });
    }

    return NextResponse.json({
      success: true,
      data: suggestion
    });

  } catch (error) {
    console.error('[API] Erreur lors de la suggestion:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 });
  }
}

