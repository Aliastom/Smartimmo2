import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

/**
 * PUT /api/admin/document-types/[id]/ocr-config
 * Met à jour la configuration OCR d'un type de document
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { suggestionsConfig, defaultContexts, flowLocks, metaSchema } = body;

    // Vérifier que le type de document existe
    const documentType = await prisma.documentType.findUnique({
      where: { id: params.id }
    });

    if (!documentType) {
      return NextResponse.json(
        { success: false, error: 'Type de document non trouvé' },
        { status: 404 }
      );
    }

    // Mettre à jour la configuration
    const updated = await prisma.documentType.update({
      where: { id: params.id },
      data: {
        suggestionsConfig: suggestionsConfig || null,
        defaultContexts: defaultContexts || null,
        flowLocks: flowLocks || null,
        metaSchema: metaSchema || null,
        updatedAt: new Date()
      }
    });

    console.log('[OCR Config] Type de document mis à jour:', {
      id: updated.id,
      code: updated.code,
      hasConfig: !!updated.suggestionsConfig
    });

    return NextResponse.json({
      success: true,
      data: updated
    });

  } catch (error) {
    console.error('[OCR Config] Erreur lors de la mise à jour:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/document-types/[id]/ocr-config
 * Récupère la configuration OCR d'un type de document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const documentType = await prisma.documentType.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        code: true,
        label: true,
        suggestionsConfig: true,
        defaultContexts: true,
        flowLocks: true,
        metaSchema: true
      }
    });

    if (!documentType) {
      return NextResponse.json(
        { success: false, error: 'Type de document non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: documentType
    });

  } catch (error) {
    console.error('[OCR Config] Erreur lors de la récupération:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

