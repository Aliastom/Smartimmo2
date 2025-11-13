import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/documents/[id]/links - Récupérer les liens d'un document
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const documentId = params.id;

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
              const property = await prisma.property.findUnique({
                where: { id: link.linkedId },
                select: { name: true, address: true },
              });
              entityName = property ? `${property.name} - ${property.address}` : null;
              break;
              
            case 'lease':
              const lease = await prisma.lease.findUnique({
                where: { id: link.linkedId },
                include: {
                  Property: { select: { name: true } },
                  Tenant: { select: { firstName: true, lastName: true } },
                },
              });
              entityName = lease ? `Bail ${lease.Property?.name || ''} - ${lease.Tenant?.firstName} ${lease.Tenant?.lastName}` : null;
              break;
              
            case 'tenant':
              const tenant = await prisma.tenant.findUnique({
                where: { id: link.linkedId },
                select: { firstName: true, lastName: true },
              });
              entityName = tenant ? `${tenant.firstName} ${tenant.lastName}` : null;
              break;
              
            case 'transaction':
              const transaction = await prisma.transaction.findUnique({
                where: { id: link.linkedId },
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
    const documentId = params.id;
    const { entityType, entityId } = await request.json();

    if (!entityType) {
      return NextResponse.json({ success: false, error: 'entityType manquant' }, { status: 400 });
    }

    // Vérifier que le document existe
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json({ success: false, error: 'Document non trouvé' }, { status: 404 });
    }

    // Vérifier que l'entité existe (si entityId est fourni)
    if (entityId) {
      let entityExists = false;
      switch (entityType.toLowerCase()) {
        case 'property':
          entityExists = !!(await prisma.property.findUnique({ where: { id: entityId } }));
          break;
        case 'lease':
          entityExists = !!(await prisma.lease.findUnique({ where: { id: entityId } }));
          break;
        case 'tenant':
          entityExists = !!(await prisma.tenant.findUnique({ where: { id: entityId } }));
          break;
        case 'transaction':
          entityExists = !!(await prisma.transaction.findUnique({ where: { id: entityId } }));
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
