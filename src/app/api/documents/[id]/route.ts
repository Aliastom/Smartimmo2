import { NextRequest, NextResponse } from 'next/server';
import { DocumentsService } from '@/lib/services/documents';
import { requireAuth } from '@/lib/auth/getCurrentUser';

/**
 * GET /api/documents/[id] - Récupérer un document par ID
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
    const { id } = params;

    const result = await DocumentsService.search({
      query: id,
      limit: 1,
      organizationId,
    });

    if (!result.Document || result.Document.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.Document[0]);
  } catch (error: any) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/documents/[id] - Mettre à jour un document
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { id } = params;
    const body = await request.json();

    const {
      status,
      documentTypeId,
      chosenTypeId,
      filenameOriginal,
      linkedTo,
      linkedId,
      tags,
      reclassify,
    } = body;

    // Renommage
    if (filenameOriginal !== undefined) {
      await DocumentsService.updateFilename(id, filenameOriginal, organizationId);
    }

    // Mise à jour du type de document
    if (chosenTypeId !== undefined) {
      await DocumentsService.updateDocumentType(id, chosenTypeId, organizationId);
    }

    // Reliaison
    if (linkedTo !== undefined) {
      await DocumentsService.relink(id, {
        linkedTo,
        linkedId,
        organizationId,
      });
    }

    // Reclassification
    if (reclassify) {
      const result = await DocumentsService.classifyAndExtract(id, organizationId);
      return NextResponse.json({
        success: true,
        classification: result,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Document updated',
    });
  } catch (error: any) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: 'Failed to update document', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/documents/[id] - Mettre à jour un document (alias pour PATCH)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rediriger vers PATCH pour la compatibilité
  return PATCH(request, { params });
}

/**
 * DELETE /api/documents/[id] - Supprimer un document (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const deletedBy = searchParams.get('deletedBy') || 'unknown';

    await DocumentsService.deleteSafely(id, deletedBy, organizationId);

    return NextResponse.json({
      success: true,
      message: 'Document deleted',
    });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document', details: error.message },
      { status: 500 }
    );
  }
}
