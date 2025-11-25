import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

/**
 * GET /api/loans/[id]/documents
 * Récupère tous les documents liés à un prêt
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const loanId = params.id;

    const loan = await prisma.loan.findFirst({
      where: { id: loanId, organizationId: user.organizationId },
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Prêt non trouvé' },
        { status: 404 }
      );
    }

    const documents = await prisma.document.findMany({
      where: {
        loanId,
        organizationId: user.organizationId,
        deletedAt: null,
      },
      include: {
        DocumentType: {
          select: {
            id: true,
            label: true,
          },
        },
        DocumentLink: {
          select: {
            linkedType: true,
            linkedId: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    return NextResponse.json({
      documents: documents.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        filename: doc.filenameOriginal,
        DocumentType: doc.DocumentType,
        uploadedAt: doc.uploadedAt.toISOString(),
        createdAt: doc.createdAt.toISOString(),
        DocumentLink: doc.DocumentLink,
      })),
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des documents:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des documents' },
      { status: 500 }
    );
  }
}



