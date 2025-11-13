import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script de backfill pour créer les liens DocumentLink manquants
 * pour les documents existants qui n'ont pas de liens appropriés
 */
async function backfillDocumentLinks() {
  console.log('🔄 Début du backfill des liens DocumentLink...');

  try {
    // 1. Trouver tous les documents actifs sans liens
    const documentsWithoutLinks = await prisma.document.findMany({
      where: {
        status: 'active',
        links: {
          none: {}
        }
      },
      include: {
        property: true,
        lease: true,
        transaction: true,
        loan: true,
        tenant: true
      }
    });

    console.log(`📄 Trouvé ${documentsWithoutLinks.length} documents sans liens`);

    let createdLinks = 0;

    for (const doc of documentsWithoutLinks) {
      const linksToCreate = [];

      // Lien GLOBAL (toujours créé)
      linksToCreate.push({
        documentId: doc.id,
        targetType: 'GLOBAL' as const,
        targetId: 'GLOBAL',
        role: 'PRIMARY' as const,
        entityName: 'Global'
      });

      // Lien PROPERTY si le document est lié à une propriété
      if (doc.propertyId) {
        linksToCreate.push({
          documentId: doc.id,
          targetType: 'PROPERTY' as const,
          targetId: doc.propertyId,
          role: 'PRIMARY' as const,
          entityName: doc.property?.name || 'Propriété'
        });
      }

      // Lien LEASE si le document est lié à un bail
      if (doc.leaseId) {
        const tenantName = doc.lease?.tenant ? 
          `${doc.lease.tenant.firstName} ${doc.lease.tenant.lastName}` : 
          'Locataire inconnu';
        linksToCreate.push({
          documentId: doc.id,
          targetType: 'LEASE' as const,
          targetId: doc.leaseId,
          role: 'PRIMARY' as const,
          entityName: `Bail ${tenantName}`
        });
      }

      // Lien TRANSACTION si le document est lié à une transaction
      if (doc.transactionId) {
        linksToCreate.push({
          documentId: doc.id,
          targetType: 'TRANSACTION' as const,
          targetId: doc.transactionId,
          role: 'PRIMARY' as const,
          entityName: doc.transaction?.label || 'Transaction'
        });
      }

      // Lien LOAN si le document est lié à un prêt
      if (doc.loanId) {
        linksToCreate.push({
          documentId: doc.id,
          targetType: 'LOAN' as const,
          targetId: doc.loanId,
          role: 'PRIMARY' as const,
          entityName: 'Prêt'
        });
      }

      // Lien TENANT si le document est lié à un locataire
      if (doc.tenantId) {
        const tenantName = doc.tenant ? 
          `${doc.tenant.firstName} ${doc.tenant.lastName}` : 
          'Locataire inconnu';
        linksToCreate.push({
          documentId: doc.id,
          targetType: 'TENANT' as const,
          targetId: doc.tenantId,
          role: 'PRIMARY' as const,
          entityName: tenantName
        });
      }

      // Créer tous les liens pour ce document
      if (linksToCreate.length > 0) {
        await prisma.documentLink.createMany({
          data: linksToCreate,
          skipDuplicates: true
        });
        createdLinks += linksToCreate.length;
        console.log(`✅ Créé ${linksToCreate.length} liens pour ${doc.fileName}`);
      }
    }

    // 2. Créer des liens dérivés pour les documents liés à des transactions
    console.log('🔄 Création des liens dérivés pour les transactions...');

    const transactionDocs = await prisma.document.findMany({
      where: {
        status: 'active',
        transactionId: { not: null },
        links: {
          some: {
            targetType: 'TRANSACTION'
          }
        }
      },
      include: {
        transaction: {
          include: {
            property: true,
            lease: {
              include: {
                tenant: true
              }
            }
          }
        }
      }
    });

    for (const doc of transactionDocs) {
      const transaction = doc.transaction;
      if (!transaction) continue;

      const linksToCreate = [];

      // Lien dérivé vers la propriété si la transaction a une propriété
      if (transaction.propertyId) {
        const existingPropertyLink = await prisma.documentLink.findFirst({
          where: {
            documentId: doc.id,
            targetType: 'PROPERTY',
            targetId: transaction.propertyId
          }
        });

        if (!existingPropertyLink) {
          linksToCreate.push({
            documentId: doc.id,
            targetType: 'PROPERTY' as const,
            targetId: transaction.propertyId,
            role: 'DERIVED' as const,
            entityName: transaction.property?.name || 'Propriété'
          });
        }
      }

      // Lien dérivé vers le bail si la transaction a un bail
      if (transaction.leaseId) {
        const existingLeaseLink = await prisma.documentLink.findFirst({
          where: {
            documentId: doc.id,
            targetType: 'LEASE',
            targetId: transaction.leaseId
          }
        });

        if (!existingLeaseLink) {
          const tenantName = transaction.lease?.tenant ? 
            `${transaction.lease.tenant.firstName} ${transaction.lease.tenant.lastName}` : 
            'Locataire inconnu';
          linksToCreate.push({
            documentId: doc.id,
            targetType: 'LEASE' as const,
            targetId: transaction.leaseId,
            role: 'DERIVED' as const,
            entityName: `Bail ${tenantName}`
          });
        }
      }

      if (linksToCreate.length > 0) {
        await prisma.documentLink.createMany({
          data: linksToCreate,
          skipDuplicates: true
        });
        createdLinks += linksToCreate.length;
        console.log(`✅ Créé ${linksToCreate.length} liens dérivés pour ${doc.fileName}`);
      }
    }

    console.log(`🎉 Backfill terminé ! ${createdLinks} liens créés au total`);

  } catch (error) {
    console.error('❌ Erreur lors du backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  backfillDocumentLinks()
    .then(() => {
      console.log('✅ Script de backfill terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur lors de l\'exécution du script:', error);
      process.exit(1);
    });
}

export { backfillDocumentLinks };
