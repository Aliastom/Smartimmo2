import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

// GET /api/documents/[id]/links - Récupérer les liens d'un document

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const documentId = params.id;

    const document = await prisma.document.findFirst({
      where: { id: documentId, organizationId },
      select: { id: true },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document non trouvé' },
        { status: 404 }
      );
    }

    const links = await prisma.documentLink.findMany({
      where: {
        documentId: documentId,
      },
      include: {
        Document: {
          select: {
            id: true,
            filenameOriginal: true,
          },
        },
      },
    });

    // Enrichir les liens avec les noms des entités
    const enrichedLinks = await Promise.all(
      links.map(async (link) => {
        let entityName = null;
        
        if (link.linkedId) {
          switch (link.linkedType) {
            case 'property':
              const property = await prisma.property.findFirst({
                where: { id: link.linkedId, organizationId },
                select: { name: true, address: true },
              });
              entityName = property ? `${property.name} - ${property.address}` : null;
              break;
              
            case 'lease':
              const lease = await prisma.lease.findFirst({
                where: { id: link.linkedId, organizationId },
                include: {
                  Property: { select: { name: true } },
                  Tenant: { select: { firstName: true, lastName: true } },
                },
              });
              entityName = lease ? `Bail ${lease.Property?.name || ''} - ${lease.Tenant?.firstName} ${lease.Tenant?.lastName}` : null;
              break;
              
            case 'tenant':
              const tenant = await prisma.tenant.findFirst({
                where: { id: link.linkedId, organizationId },
                select: { firstName: true, lastName: true },
              });
              entityName = tenant ? `${tenant.firstName} ${tenant.lastName}` : null;
              break;
              
            case 'transaction':
              const transaction = await prisma.transaction.findFirst({
                where: { id: link.linkedId, organizationId },
                select: { label: true, amount: true },
              });
              entityName = transaction ? `${transaction.label} - ${transaction.amount}€` : null;
              break;
              
            case 'global':
              entityName = 'Global';
              break;
          }
        }

        return {
          id: link.id,
          entityType: link.linkedType,
          entityId: link.linkedId,
          entityName,
          createdAt: link.createdAt,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedLinks,
    });
  } catch (error) {
    console.error('[DocumentLinks] Erreur GET:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la récupération des liens',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}

// POST /api/documents/[id]/links - Créer un nouveau lien
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const documentId = params.id;
    const { entityType, entityId } = await request.json();

    if (!entityType) {
      return NextResponse.json({ success: false, error: 'entityType manquant' }, { status: 400 });
    }

    // Vérifier que le document existe
    const document = await prisma.document.findFirst({
      where: { id: documentId, organizationId },
    });

    if (!document) {
      return NextResponse.json({ success: false, error: 'Document non trouvé' }, { status: 404 });
    }

    // Vérifier que l'entité existe (si entityId est fourni)
    if (entityId) {
      let entityExists = false;
      switch (entityType.toLowerCase()) {
        case 'property':
          entityExists = !!(await prisma.property.findFirst({ where: { id: entityId, organizationId } }));
          break;
        case 'lease':
          entityExists = !!(await prisma.lease.findFirst({ where: { id: entityId, organizationId } }));
          break;
        case 'tenant':
          entityExists = !!(await prisma.tenant.findFirst({ where: { id: entityId, organizationId } }));
          break;
        case 'transaction':
          entityExists = !!(await prisma.transaction.findFirst({ where: { id: entityId, organizationId } }));
          break;
        case 'global':
          entityExists = true; // Global n'a pas besoin de validation
          break;
      }

      if (!entityExists) {
        return NextResponse.json({ success: false, error: 'Entité non trouvée' }, { status: 404 });
      }
    }

    // Créer le lien
    const link = await prisma.documentLink.create({
      data: {
        documentId: documentId,
        linkedType: entityType.toLowerCase(),
        linkedId: entityId || entityType.toLowerCase(),
      },
    });

    return NextResponse.json({
      success: true,
      data: link,
      message: 'Lien créé avec succès',
    });
  } catch (error) {
    console.error('[DocumentLinks] Erreur POST:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la création du lien',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
