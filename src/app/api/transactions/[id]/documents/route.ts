import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const transactionId = params.id;
  console.log(`[API] GET /api/transactions/${transactionId}/documents`);

  if (!transactionId) {
    return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
  }

  try {
    // Récupérer les documents liés à la transaction via DocumentLink
    const documents = await prisma.document.findMany({
      where: {
        DocumentLink: {
          some: {
            linkedType: 'transaction',
            linkedId: transactionId
          }
        }
      },
      select: {
        id: true,
        fileName: true,
        mime: true,
        size: true,
        uploadedAt: true,
        status: true,
        DocumentType: {
          select: {
            id: true,
            label: true,
            code: true
          }
        },
        DocumentLink: {
          select: {
            linkedType: true,
            linkedId: true
          }
        }
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    console.log(`[API] Trouvé ${documents.length} documents liés pour la transaction ${transactionId}`);
    console.log(`[API] Premier document avec liaisons:`, documents[0] ? {
      id: documents[0].id,
      fileName: documents[0].fileName,
      linksCount: documents[0].DocumentLink?.length || 0,
      links: documents[0].DocumentLink
    } : 'Aucun document');

    // Enrichir les liens avec les informations des entités
    const enrichedDocuments = await Promise.all(
      documents.map(async (doc) => {
        const enrichedLinks = await Promise.all(
          doc.DocumentLink.map(async (link) => {
            let entityInfo = null;

            try {
              switch (link.linkedType) {
                case 'transaction':
                  const transaction = await prisma.transaction.findUnique({
                    where: { id: link.linkedId },
                    select: {
                      id: true,
                      label: true,
                      nature: true,
                      amount: true
                    }
                  });
                  entityInfo = transaction ? {
                    name: transaction.label || `Transaction ${transaction.nature}`,
                    type: 'Transaction',
                    details: `${transaction.amount}€`
                  } : null;
                  break;

                case 'property':
                  const property = await prisma.property.findUnique({
                    where: { id: link.linkedId },
                    select: {
                      id: true,
                      name: true,
                      address: true
                    }
                  });
                  entityInfo = property ? {
                    name: property.name,
                    type: 'Bien',
                    details: property.address
                  } : null;
                  break;

                case 'lease':
                  const lease = await prisma.lease.findUnique({
                    where: { id: link.linkedId },
                    select: {
                      id: true,
                      status: true,
                      Tenant: {
                        select: {
                          firstName: true,
                          lastName: true
                        }
                      }
                    }
                  });
                  entityInfo = lease ? {
                    name: `Bail ${lease.Tenant?.firstName} ${lease.Tenant?.lastName}`,
                    type: 'Bail',
                    details: lease.status
                  } : null;
                  break;

                case 'tenant':
                  const tenant = await prisma.tenant.findUnique({
                    where: { id: link.linkedId },
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true
                    }
                  });
                  entityInfo = tenant ? {
                    name: `${tenant.firstName} ${tenant.lastName}`,
                    type: 'Locataire',
                    details: tenant.email || ''
                  } : null;
                  break;

                case 'global':
                  entityInfo = {
                    name: 'Global',
                    type: 'Global',
                    details: 'Document global'
                  };
                  break;

                default:
                  entityInfo = {
                    name: link.linkedType,
                    type: link.linkedType,
                    details: ''
                  };
              }
            } catch (err) {
              console.error(`[API] Erreur lors de l'enrichissement du lien:`, err);
              entityInfo = {
                name: 'Erreur',
                type: link.linkedType,
                details: 'Impossible de charger les détails'
              };
            }

            return {
              ...link,
              entityInfo
            };
          })
        );

        return {
          ...doc,
          links: enrichedLinks
        };
      })
    );
    
    console.log(`[API] Documents enrichis avec liaisons détaillées`);
    console.log(`[API] Premier document enrichi:`, enrichedDocuments[0] ? {
      id: enrichedDocuments[0].id,
      fileName: enrichedDocuments[0].fileName,
      linksCount: enrichedDocuments[0].DocumentLink?.length || 0,
      firstLink: enrichedDocuments[0].DocumentLink?.[0]
    } : 'Aucun document');
    
    // Log détaillé pour debug
    if (enrichedDocuments.length > 0) {
      console.log(`[API] Document 0 links détaillés:`, JSON.stringify(enrichedDocuments[0].DocumentLink, null, 2));
    }
    
    return NextResponse.json({ documents: enrichedDocuments });
  } catch (error) {
    console.error(`[API] Erreur lors de la récupération des documents liés à la transaction ${transactionId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch linked documents' }, { status: 500 });
  }
}
