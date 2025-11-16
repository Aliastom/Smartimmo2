import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    const transaction = await prisma.transaction.findFirst({
      where: { id: params.id, organizationId },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        Lease_Transaction_leaseIdToLease: {
          select: {
            id: true,
            status: true,
            Tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        Category: {
          select: {
            id: true,
            label: true
          }
        },
        Lease_Transaction_bailIdToLease: {
          select: {
            id: true,
            status: true,
            Tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        // Les documents sont liés via DocumentLink, pas directement
      }
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction non trouvée' },
        { status: 404 }
      );
    }

    // Récupérer les documents liés via DocumentLink
    const documentLinks = await prisma.documentLink.findMany({
      where: {
        linkedType: 'transaction',
        linkedId: params.id,
        Document: {
          organizationId
        }
      },
      include: {
        Document: {
          select: {
            id: true,
            fileName: true,
            DocumentType: {
              select: {
                id: true,
                label: true,
                code: true
              }
            },
            uploadedAt: true
          }
        }
      }
    });

    // Transformation des données
    console.log('[API] GET /api/transactions/:id - Documents trouvés:', documentLinks.length);
    console.log('[API] GET /api/transactions/:id - DocumentLinks:', documentLinks);
    
    const transformedTransaction = {
      id: transaction.id,
      date: transaction.date.toISOString().split('T')[0],
      label: transaction.label,
      Property: transaction.Property || null,
      propertyId: transaction.Property?.id || '',
      lease: transaction.Lease_Transaction_leaseIdToLease || null,
      tenant: transaction.Lease_Transaction_leaseIdToLease?.Tenant || null,
      leaseId: transaction.Lease_Transaction_leaseIdToLease?.id || '',
      nature: {
        id: transaction.nature || '',
        label: transaction.nature || '', // TODO: Charger le label depuis NatureEntity
        type: transaction.nature?.includes('RECETTE') ? 'RECETTE' as const : 'DEPENSE' as const
      },
      Category: transaction.Category || null,
      categoryId: transaction.Category?.id || '',
      amount: transaction.amount,
      reference: transaction.reference || '',
      // Champs de paiement
      paymentDate: transaction.paidAt?.toISOString().split('T')[0] || '',
      paymentMethod: transaction.method || '',
      paidAt: transaction.paidAt?.toISOString().split('T')[0] || '',
      method: transaction.method || '',
      // Champs de période
      notes: transaction.notes || '',
      periodStart: transaction.periodStart?.toISOString().split('T')[0] || '',
      accountingMonth: transaction.accounting_month || '',
      // Extraire periodMonth et periodYear depuis accountingMonth (format: YYYY-MM)
      periodMonth: transaction.accounting_month ? transaction.accounting_month.split('-')[1] : '',
      periodYear: transaction.accounting_month ? parseInt(transaction.accounting_month.split('-')[0]) : new Date().getFullYear(),
      monthsCovered: transaction.monthsCovered ? parseInt(transaction.monthsCovered) : 1,
      // Champs de série (pour afficher le badge en mode édition)
      parentTransactionId: transaction.parentTransactionId,
      moisIndex: transaction.moisIndex,
      moisTotal: transaction.moisTotal,
      // ⚙️ GESTION DÉLÉGUÉE: Champs pour le badge "A"
      isAuto: transaction.isAuto,
      autoSource: transaction.autoSource,
      // ⚙️ GESTION DÉLÉGUÉE: Breakdown loyer et toggle Auto
      montantLoyer: transaction.montantLoyer || null,
      chargesRecup: transaction.chargesRecup || null,
      chargesNonRecup: transaction.chargesNonRecup || null,
      isAutoAmount: transaction.isAutoAmount,
      // Bail lié
      bailId: transaction.bailId,
      bail: transaction.Lease_Transaction_bailIdToLease,
      autoDistribution: false,
      hasDocument: documentLinks.length > 0,
      status: transaction.rapprochementStatus === 'rapprochee' ? 'rapprochee' : 'nonRapprochee',
      rapprochementStatus: transaction.rapprochementStatus,
      dateRapprochement: transaction.dateRapprochement?.toISOString() || null,
      bankRef: transaction.bankRef || null,
      Document: documentLinks.map(link => ({
        id: link.Document.id,
        name: link.Document.fileName,
        type: link.Document.DocumentType?.label || 'Type inconnu',
        createdAt: link.Document.uploadedAt.toISOString()
      }))
    };

    return NextResponse.json(transformedTransaction);

  } catch (error) {
    console.error('Erreur lors de la récupération de la transaction:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la transaction' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    const body = await request.json();
    const existingTransaction = await prisma.transaction.findFirst({
      where: { id: params.id, organizationId },
      select: { id: true }
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction non trouvée' },
        { status: 404 }
      );
    }
    
    // Si c'est uniquement un update de rapprochement (léger)
    if (body.rapprochementStatus !== undefined && Object.keys(body).length <= 3) {
      console.log('[API] PATCH /api/transactions/:id - Mise à jour rapprochement:', {
        transactionId: params.id,
        status: body.rapprochementStatus,
        bankRef: body.bankRef
      });

      const updateData: any = {
        rapprochementStatus: body.rapprochementStatus
      };

      if (body.rapprochementStatus === 'rapprochee') {
        updateData.dateRapprochement = new Date();
        if (body.bankRef) {
          updateData.bankRef = body.bankRef;
        }
      } else {
        updateData.dateRapprochement = null;
        updateData.bankRef = null;
      }

      const transaction = await prisma.transaction.update({
        where: { id: params.id },
        data: updateData
      });

      return NextResponse.json({
        ok: true,
        id: transaction.id,
        rapprochementStatus: transaction.rapprochementStatus,
        dateRapprochement: transaction.dateRapprochement
      });
    }

    // Si c'est un update complet, on traite comme PUT (ne pas casser l'existant)
    console.log('[API] PATCH/PUT /api/transactions/:id - Mise à jour complète');
    // Le code existant continue ci-dessous...
  } catch (error) {
    console.error('[API] Erreur PATCH /api/transactions/:id:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const body = await request.json();
    console.log('[API] PUT /api/transactions/:id - Données reçues:', {
      transactionId: params.id,
      stagedDocumentIds: body.stagedDocumentIds,
      stagedLinkItemIds: body.stagedLinkItemIds,
      hasStagedDocuments: !!(body.stagedDocumentIds && body.stagedDocumentIds.length > 0),
      hasStagedLinks: !!(body.stagedLinkItemIds && body.stagedLinkItemIds.length > 0),
      // Gestion déléguée - Breakdown
      montantLoyer: body.montantLoyer,
      chargesRecup: body.chargesRecup,
      chargesNonRecup: body.chargesNonRecup,
      isAutoAmount: body.isAutoAmount
    });

    const existingTransaction = await prisma.transaction.findFirst({
      where: { id: params.id, organizationId },
      select: { id: true }
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction non trouvée' },
        { status: 404 }
      );
    }

    // Supprimer les champs de série s'ils sont présents dans le body (non modifiables)
    delete (body as any).parentTransactionId;
    delete (body as any).moisIndex;
    delete (body as any).moisTotal;
    
    // Utiliser une transaction Prisma pour garantir la cohérence
    if (body.propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: body.propertyId, organizationId },
        select: { id: true }
      });
      if (!property) {
        return NextResponse.json({ error: 'Propriété introuvable' }, { status: 404 });
      }
    }

    if (body.leaseId) {
      const lease = await prisma.lease.findFirst({
        where: { id: body.leaseId, organizationId },
        select: { id: true }
      });
      if (!lease) {
        return NextResponse.json({ error: 'Bail introuvable' }, { status: 404 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mettre à jour la transaction (whitelist stricte - bailId ignoré)
      const transaction = await tx.transaction.update({
        where: { id: params.id },
        data: {
          // Relations - utiliser les objets de connexion
          Property: {
            connect: { id: body.propertyId }
          },
          Lease_Transaction_leaseIdToLease: body.leaseId ? {
            connect: { id: body.leaseId }
          } : undefined,
          Category: {
            connect: { id: body.categoryId }
          },
          // bailId: IGNORÉ - ne peut pas être modifié en édition
          // parentTransactionId, moisIndex, moisTotal: IGNORÉS - ne peuvent pas être modifiés en édition
          date: new Date(body.date),
          nature: body.natureId || body.nature,
          label: body.label,
          amount: parseFloat(body.amount),
          reference: body.reference || null,
          notes: body.notes || null,
          // Champs de paiement
          paidAt: body.paidAt ? new Date(body.paidAt) : (body.paymentDate ? new Date(body.paymentDate) : null),
          method: body.method || body.paymentMethod || null,
          // Champs de période
          accounting_month: body.accountingMonth || body.periodStart || null,
          monthsCovered: body.monthsCovered ? body.monthsCovered.toString() : null,
          // Champs de rapprochement (si présents dans le body)
          rapprochementStatus: body.rapprochementStatus !== undefined ? body.rapprochementStatus : undefined,
          dateRapprochement: body.rapprochementStatus === 'rapprochee' ? new Date() : (body.rapprochementStatus === 'non_rapprochee' ? null : undefined),
          bankRef: body.bankRef !== undefined ? body.bankRef : undefined,
          // Gestion déléguée - Breakdown loyer
          montantLoyer: body.montantLoyer !== undefined ? (body.montantLoyer ? parseFloat(body.montantLoyer) : null) : undefined,
          chargesRecup: body.chargesRecup !== undefined ? (body.chargesRecup ? parseFloat(body.chargesRecup) : null) : undefined,
          chargesNonRecup: body.chargesNonRecup !== undefined ? (body.chargesNonRecup ? parseFloat(body.chargesNonRecup) : null) : undefined,
          isAutoAmount: body.isAutoAmount !== undefined ? body.isAutoAmount : undefined
        },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        Lease_Transaction_leaseIdToLease: {
          select: {
            id: true,
            status: true,
            Tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        Category: {
          select: {
            id: true,
            label: true
          }
        }
      }
      });

      // 2. Finaliser les documents en staging si présents
      if (body.stagedDocumentIds && body.stagedDocumentIds.length > 0) {
        console.log('[API] Finalisation des documents en staging:', body.stagedDocumentIds);
        
        // Vérifier que les documents existent
        const existingDocs = await tx.document.findMany({
          where: { 
            id: { in: body.stagedDocumentIds },
            status: 'draft',
            organizationId
          },
          select: { id: true, fileName: true, status: true, fileSha256: true, textSha256: true }
        });
        console.log('[API] Documents draft trouvés:', existingDocs);

        // Vérification rapide des doublons (optimisée)
        if (existingDocs.length > 0) {
          const fileSha256s = existingDocs.map(doc => doc.fileSha256).filter(Boolean);
          if (fileSha256s.length > 0) {
            const duplicates = await tx.document.findMany({
              where: {
                fileSha256: { in: fileSha256s },
                status: 'active',
                id: { notIn: body.stagedDocumentIds },
                organizationId
              },
              select: { id: true, fileName: true, fileSha256: true }
            });
            
            if (duplicates.length > 0) {
              return NextResponse.json({
                success: false,
                error: `Document "${duplicates[0].fileName}" est un doublon exact`,
                duplicate: duplicates[0]
              }, { status: 409 });
            }
          }
        }

        // Mettre à jour le statut des documents de 'draft' à 'active'
        await tx.document.updateMany({
          where: { 
            id: { in: body.stagedDocumentIds },
            status: 'draft',
            organizationId
          },
          data: {
            status: 'active',
            uploadSessionId: null,
            intendedContextType: null,
            intendedContextTempKey: null
          }
        });

        console.log('Documents finalisés (liens créés après la transaction):', transaction.id);
      }

      // 3. Traiter les liens vers documents existants si présents
      if (body.stagedLinkItemIds && body.stagedLinkItemIds.length > 0) {
        console.log('[API] Traitement des liens vers documents existants:', body.stagedLinkItemIds);
        
        // Récupérer les staged items de type 'link'
        const stagedLinks = await tx.uploadStagedItem.findMany({
          where: {
            id: { in: body.stagedLinkItemIds },
            kind: 'link',
            organizationId
          },
          include: {
            Document: {
              select: {
                id: true,
                filenameOriginal: true
              }
            }
          }
        });

        console.log('Staged links trouvés (liens créés après la transaction):', stagedLinks.length);
      }

      // ⚙️ GESTION DÉLÉGUÉE: Mettre à jour la commission si applicable
      // Déclarer en dehors pour éviter ReferenceError si gestion désactivée
      let commissionUpdateResult: { commissionUpdated?: boolean; commissionNewValue?: number; warningLocked?: boolean } = {};
      let existingCommission: any = null;
      
      if (process.env.ENABLE_GESTION_SOCIETE === 'true') {
        const isRentNature = transaction.nature?.includes('LOYER') || transaction.nature?.includes('RECETTE_LOYER');
        
        if (isRentNature && body.montantLoyer) {
          // Récupérer la société de gestion du bien
          const propertyWithCompany = await tx.property.findFirst({
            where: { id: transaction.propertyId, organizationId },
            include: { ManagementCompany: true }
          });

          if (propertyWithCompany?.ManagementCompany && propertyWithCompany.ManagementCompany.actif) {
            // Chercher la commission liée
            existingCommission = await tx.transaction.findFirst({
              where: {
                parentTransactionId: transaction.id,
                  autoSource: 'gestion',
                  organizationId
              }
            });

            if (existingCommission) {
              if (existingCommission.isAuto) {
                // Recalculer la commission
                const { calcCommission } = await import('@/lib/gestion/calcCommission');
                const company = propertyWithCompany.ManagementCompany;
                
                const { commissionTTC } = calcCommission({
                  montantLoyer: body.montantLoyer,
                  chargesRecup: body.chargesRecup || 0,
                  modeCalcul: company.modeCalcul as 'LOYERS_UNIQUEMENT' | 'REVENUS_TOTAUX',
                  taux: company.taux,
                  fraisMin: company.fraisMin || undefined,
                  tvaApplicable: company.tvaApplicable,
                  tauxTva: company.tauxTva || 20,
                });

                // Mettre à jour la commission
                await tx.transaction.update({
                  where: { id: existingCommission.id },
                  data: {
                    amount: -commissionTTC, // Négatif car c'est une dépense
                  }
                });

                commissionUpdateResult = {
                  commissionUpdated: true,
                  commissionNewValue: commissionTTC
                };

                console.log(`[Commission] Mise à jour automatique: ${existingCommission.id} → ${commissionTTC}€`);
              } else {
                // Commission verrouillée manuellement
                commissionUpdateResult = { warningLocked: true };
                console.log(`[Commission] Non modifiée (isAuto=false): ${existingCommission.id}`);
              }
            } else {
              // Pas de commission existante, la créer (cas legacy)
              const { createManagementCommission } = await import('@/lib/services/managementCommissionService');
              try {
                // Calculer accounting_month si NULL
                let accountingMonth = transaction.accounting_month;
                if (!accountingMonth && transaction.date) {
                  const d = new Date(transaction.date);
                  accountingMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                }
                
                await createManagementCommission({
                  transactionId: transaction.id,
                  propertyId: transaction.propertyId,
                  organizationId,
                  montantLoyer: body.montantLoyer,
                  chargesRecup: body.chargesRecup || 0,
                  date: transaction.date,
                  accountingMonth: accountingMonth || undefined,
                  leaseId: transaction.leaseId || undefined,
                  bailId: transaction.bailId || undefined,
                }, tx);
                
                commissionUpdateResult = { commissionUpdated: true };
                console.log(`[Commission] Créée en édition (cas legacy): ${transaction.id}`);
              } catch (error) {
                console.error('[Commission] Erreur création en édition:', error);
              }
            }
          } else if (existingCommission?.isAuto) {
            // Le bien n'a plus de société, supprimer la commission auto
            await tx.transaction.delete({
              where: { id: existingCommission.id }
            });
            console.log(`[Commission] Supprimée (bien sans société): ${existingCommission.id}`);
          }
        }
      }

      return { transaction, ...commissionUpdateResult };
    }, {
      timeout: 15000 // 15 secondes pour les opérations complexes avec documents
    });

    // Créer les liens APRÈS la transaction pour éviter le timeout
    if (body.stagedDocumentIds && body.stagedDocumentIds.length > 0) {
      console.log('[API] Création des liens pour les documents finalisés...');
      const { createDocumentLinks } = await import('@/lib/services/documentLinkService');
      
      await Promise.all(body.stagedDocumentIds.map(async (docId: string) => {
        await createDocumentLinks(docId, result.transaction);
      }));
      console.log('Documents finalisés et liés à la transaction:', result.transaction.id);
    }

    if (body.stagedLinkItemIds && body.stagedLinkItemIds.length > 0) {
      console.log('[API] Création des liens pour les documents existants...');
      const { createDocumentLinks } = await import('@/lib/services/documentLinkService');
      
      // Récupérer les staged items de type 'link'
      const stagedLinks = await prisma.uploadStagedItem.findMany({
        where: {
          id: { in: body.stagedLinkItemIds },
          kind: 'link',
          organizationId
        },
        include: {
          Document: {
            select: {
              id: true,
              filenameOriginal: true
            }
          }
        }
      });

      for (const stagedLink of stagedLinks) {
        if (!stagedLink.Document) continue;
        const docId = stagedLink.Document.id;
        await createDocumentLinks(docId, result.transaction);
        console.log(`[API] Liens créés pour document existant: ${stagedLink.Document.filenameOriginal}`);
      }

      console.log('Liens vers documents existants créés pour la transaction:', result.transaction.id);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Erreur lors de la mise à jour de la transaction:', error);
    console.error('Détails de l\'erreur:', {
      message: error instanceof Error ? error.message : 'Erreur inconnue',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json(
      { 
        error: 'Erreur lors de la mise à jour de la transaction',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    // Récupérer le mode de suppression depuis les query params
    const url = new URL(request.url);
    const mode = (url.searchParams.get("mode") as "delete_docs" | "keep_docs_globalize") ?? "keep_docs_globalize";

    console.log(`[API] DELETE /api/transactions/${params.id} - Mode: ${mode}`);

    const existingTransaction = await prisma.transaction.findFirst({
      where: { id: params.id, organizationId },
      select: { id: true }
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction non trouvée' },
        { status: 404 }
      );
    }

    // Vérifier si la transaction a des documents liés
    const documentLinks = await prisma.documentLink.findMany({
      where: {
        linkedType: 'transaction',
        linkedId: params.id,
        Document: {
          organizationId
        }
      },
      select: { documentId: true }
    });

    const hasDocuments = documentLinks.length > 0;
    console.log(`[API] Transaction a ${documentLinks.length} document(s) lié(s)`);

    // ⚙️ GESTION DÉLÉGUÉE: Gérer les enfants (commissions) avant suppression
    const deleteChildren = url.searchParams.get("deleteChildren") === "true";
    let childrenInfo = { autoDeleted: 0, nonAutoKept: 0, hasNonAutoChildren: false };

    if (process.env.ENABLE_GESTION_SOCIETE === 'true') {
      // Trouver les enfants de cette transaction
      const children = await prisma.transaction.findMany({
        where: {
          parentTransactionId: params.id,
          autoSource: 'gestion',
          organizationId
        },
        select: {
          id: true,
          isAuto: true,
          amount: true
        }
      });

      if (children.length > 0) {
        const autoChildren = children.filter(c => c.isAuto);
        const nonAutoChildren = children.filter(c => !c.isAuto);

        // Supprimer systématiquement les enfants auto
        if (autoChildren.length > 0) {
          await prisma.transaction.deleteMany({
            where: {
              id: { in: autoChildren.map(c => c.id) },
              organizationId
            }
          });
          childrenInfo.autoDeleted = autoChildren.length;
          console.log(`[Commission] ${autoChildren.length} commission(s) auto supprimée(s)`);
        }

        // Gérer les enfants non-auto
        if (nonAutoChildren.length > 0) {
          if (deleteChildren) {
            // Supprimer aussi les enfants non-auto
            await prisma.transaction.deleteMany({
              where: {
                id: { in: nonAutoChildren.map(c => c.id) },
                organizationId
              }
            });
            console.log(`[Commission] ${nonAutoChildren.length} commission(s) non-auto supprimée(s) (flag actif)`);
          } else {
            // Ne pas supprimer, retourner une info
            childrenInfo.hasNonAutoChildren = true;
            childrenInfo.nonAutoKept = nonAutoChildren.length;
            
            return NextResponse.json({
              success: false,
              hasNonAutoChildren: true,
              nonAutoChildrenCount: nonAutoChildren.length,
              message: 'Cette transaction a des commissions liées non automatiques. Utilisez deleteChildren=true pour les supprimer également.'
            }, { status: 400 });
          }
        }
      }
    }

    if (hasDocuments) {
      // Utiliser la fonction de suppression avec gestion des documents
      const { deleteTransactionWithDocs } = await import('@/lib/docsSimple');
      await deleteTransactionWithDocs(params.id, mode, organizationId);
    } else {
      // Pas de documents, suppression simple
      await prisma.transaction.delete({
        where: { id: params.id }
      });
    }

    return NextResponse.json({ 
      success: true,
      mode,
      documentsAffected: documentLinks.length,
      ...childrenInfo
    });

  } catch (error) {
    console.error('Erreur lors de la suppression de la transaction:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la transaction' },
      { status: 500 }
    );
  }
}