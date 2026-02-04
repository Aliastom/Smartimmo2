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

    // ⚠️ INSTRUMENTATION : Log détaillé pour diagnostic
    console.log(`[DocumentLinks API] POST /api/documents/${documentId}/links`, {
      documentId,
      entityType,
      entityId,
      sessionOrgId: organizationId,
      timestamp: new Date().toISOString(),
    });

    if (!entityType) {
      return NextResponse.json({ success: false, error: 'entityType manquant' }, { status: 400 });
    }

    // Vérifier que le document existe
    const document = await prisma.document.findFirst({
      where: { id: documentId, organizationId },
    });

    if (!document) {
      // ⚠️ INSTRUMENTATION : Log détaillé si document non trouvé
      const docCheck = await prisma.document.findFirst({
        where: { id: documentId },
        select: { id: true, organizationId: true },
      });
      
      console.warn(`[DocumentLinks API] ❌ Document non trouvé`, {
        documentId,
        sessionOrgId: organizationId,
        entityType,
        entityId,
        // Vérifier si le document existe avec un autre orgId (scope mismatch)
        checkResult: docCheck ? { 
          exists: true, 
          docOrgId: docCheck.organizationId, 
          mismatch: docCheck.organizationId !== organizationId 
        } : { exists: false },
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Document non trouvé',
        details: docCheck ? `Document existe mais appartient à une autre organisation (docOrgId: ${docCheck.organizationId}, sessionOrgId: ${organizationId})` : 'Document inexistant',
      }, { status: 404 });
    }

    // ⚠️ INSTRUMENTATION : Log si document trouvé avec vérification orgId
    console.log(`[DocumentLinks API] ✅ Document trouvé`, {
      documentId,
      docOrgId: document.organizationId,
      sessionOrgId: organizationId,
      orgIdMatch: document.organizationId === organizationId,
    });

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
        case 'loan':
          entityExists = !!(await prisma.loan.findFirst({ where: { id: entityId, organizationId } }));
          break;
        case 'global':
          entityExists = true; // Global n'a pas besoin de validation
          break;
      }

      if (!entityExists) {
        console.warn(`[DocumentLinks API] ❌ Entité liée non trouvée`, {
          documentId,
          entityType,
          entityId,
          sessionOrgId: organizationId,
          docOrgId: document.organizationId,
        });
        return NextResponse.json({ 
          success: false, 
          error: 'Entité non trouvée',
          details: `L'entité ${entityType} avec l'ID ${entityId} n'existe pas ou n'appartient pas à l'organisation ${organizationId}`,
        }, { status: 404 });
      }
    }

    // Créer le lien (ou le récupérer s'il existe déjà)
    const linkedType = entityType.toLowerCase();
    const linkedId = entityId || entityType.toLowerCase();
    
    // Vérifier si le lien existe déjà
    const existingLink = await prisma.documentLink.findFirst({
      where: {
        documentId: documentId,
        linkedType: linkedType,
        linkedId: linkedId,
      },
    });

    if (existingLink) {
      // Le lien existe déjà, retourner un succès (idempotence)
      return NextResponse.json({
        success: true,
        data: existingLink,
        message: 'Lien déjà existant',
      });
    }

    // Créer le nouveau lien vers la transaction mère
    const link = await prisma.documentLink.create({
      data: {
        documentId: documentId,
        linkedType: linkedType,
        linkedId: linkedId,
      },
    });

    // ⚠️ POINT 2 : LIAISON AUTOMATIQUE : Si on crée un lien vers une transaction, créer aussi les liens vers ses commissions
    // SÉCURISATION : La commission est créée dans le même appel que la transaction mère (TransactionService),
    // mais pour éviter un timing fragile, on fait une retry si aucune commission n'est trouvée la première fois
    if (entityType.toLowerCase() === 'transaction' && entityId) {
      const maxRetries = 2;
      let retryCount = 0;
      let commissionTransactions: Array<{ id: string }> = [];
      
      while (retryCount < maxRetries) {
        try {
          // Chercher les transactions dérivées (commissions) : where parentTransactionId = transactionId
          commissionTransactions = await prisma.transaction.findMany({
            where: {
              parentTransactionId: entityId,
              organizationId: organizationId,
            },
            select: {
              id: true,
            },
          });

          if (commissionTransactions.length > 0) {
            console.log(`[DocumentLinks API] 🔗 Création automatique de ${commissionTransactions.length} lien(s) vers commission(s) pour transaction ${entityId} (tentative ${retryCount + 1})`);
            break; // Commission trouvée, sortir de la boucle
          } else if (retryCount === 0) {
            // Première tentative : commission pas encore créée, attendre un peu et réessayer
            console.log(`[DocumentLinks API] ⏳ Commission non trouvée pour transaction ${entityId}, retry dans 100ms...`);
            await new Promise(resolve => setTimeout(resolve, 100));
            retryCount++;
          } else {
            // Deuxième tentative : toujours pas de commission, log et sortir
            console.log(`[DocumentLinks API] ℹ️ Aucune commission trouvée pour transaction ${entityId} après ${retryCount + 1} tentative(s)`);
            break;
          }
        } catch (commissionError: any) {
          // Ne pas bloquer si la recherche des commissions échoue (log uniquement)
          console.warn(`[DocumentLinks API] ⚠️ Erreur lors de la recherche des commissions pour transaction ${entityId} (tentative ${retryCount + 1}):`, commissionError);
          break;
        }
      }
      
      // Créer les liens vers les commissions trouvées (idempotent)
      if (commissionTransactions.length > 0) {
        for (const commissionTx of commissionTransactions) {
          try {
            // Vérifier si le lien existe déjà (idempotence)
            const existingCommissionLink = await prisma.documentLink.findFirst({
              where: {
                documentId: documentId,
                linkedType: 'transaction',
                linkedId: commissionTx.id,
              },
            });

            if (!existingCommissionLink) {
              await prisma.documentLink.create({
                data: {
                  documentId: documentId,
                  linkedType: 'transaction',
                  linkedId: commissionTx.id,
                },
              });
              console.log(`[DocumentLinks API] ✅ Lien créé automatiquement vers commission ${commissionTx.id}`);
            } else {
              console.log(`[DocumentLinks API] ℹ️ Lien vers commission ${commissionTx.id} déjà existant (idempotent)`);
            }
          } catch (commissionLinkError: any) {
            // Ne pas bloquer si la création d'un lien commission échoue (log uniquement)
            console.warn(`[DocumentLinks API] ⚠️ Erreur lors de la création du lien vers commission ${commissionTx.id}:`, commissionLinkError);
          }
        }
      }
    }

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
