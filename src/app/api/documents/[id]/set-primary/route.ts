import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

/**
 * POST /api/documents/[id]/set-primary
 * Définit un document comme principal pour un contexte donné
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const documentId = params.id;
    const body = await request.json();
    const { entityType, entityId } = body;

    if (!entityType) {
      return NextResponse.json(
        { success: false, error: 'entityType est requis' },
        { status: 400 }
      );
    }

    if (entityType !== 'GLOBAL' && !entityId) {
      return NextResponse.json(
        { success: false, error: 'entityId est requis pour entityType != GLOBAL' },
        { status: 400 }
      );
    }

    // Vérifier que le document existe
    const document = await prisma.document.findFirst({
      where: { id: documentId, organizationId },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document introuvable' },
        { status: 404 }
      );
    }

    if (entityType !== 'GLOBAL' && entityId) {
      const exists = await ensureEntityBelongsToOrg(entityType, entityId, organizationId);
      if (!exists) {
        return NextResponse.json(
          { success: false, error: 'Entité introuvable ou non autorisée' },
          { status: 404 }
        );
      }
    }

    // Transaction: mettre tous les autres liens à isPrimary=false, puis celui-ci à true
    await prisma.$transaction(async (tx) => {
      // 1. Mettre tous les liens existants pour ce contexte à isPrimary=false
      await tx.documentLink.updateMany({
        where: {
          entityType,
          entityId: entityId || null,
          isPrimary: true,
          Document: {
            organizationId,
          },
        },
        data: {
          isPrimary: false,
        },
      });

      // 2. Mettre le lien du document actuel à isPrimary=true (ou le créer s'il n'existe pas)
      await tx.documentLink.upsert({
        where: {
          documentId_entityType_entityId: {
            documentId,
            entityType,
            entityId: entityId || null,
          },
        },
        update: {
          isPrimary: true,
        },
        create: {
          documentId,
          entityType,
          entityId: entityId || null,
          isPrimary: true,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Document défini comme principal',
    });
  } catch (error) {
    console.error('[SetPrimary] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la mise à jour',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

async function ensureEntityBelongsToOrg(entityType: string, entityId: string, organizationId: string) {
  switch (entityType) {
    case 'PROPERTY':
    case 'property':
      return prisma.property.findFirst({ where: { id: entityId, organizationId }, select: { id: true } });
    case 'LEASE':
    case 'lease':
      return prisma.lease.findFirst({ where: { id: entityId, organizationId }, select: { id: true } });
    case 'TENANT':
    case 'tenant':
      return prisma.tenant.findFirst({ where: { id: entityId, organizationId }, select: { id: true } });
    case 'TRANSACTION':
    case 'transaction':
      return prisma.transaction.findFirst({ where: { id: entityId, organizationId }, select: { id: true } });
    case 'LOAN':
    case 'loan':
      return prisma.loan.findFirst({ where: { id: entityId, organizationId }, select: { id: true } });
    default:
      return null;
  }
}

