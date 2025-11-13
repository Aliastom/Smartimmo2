#!/usr/bin/env npx tsx

/**
 * Script pour vérifier le type de document créé
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDocumentType() {
  console.log('🔍 Vérification du type de document créé\n');

  try {
    // 1. Récupérer le dernier document créé
    const lastDocument = await prisma.document.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        documentType: {
          select: {
            id: true,
            code: true,
            label: true
          }
        }
      }
    });

    if (!lastDocument) {
      console.log('❌ Aucun document trouvé');
      return;
    }

    console.log('📄 Dernier document créé:');
    console.log(`   ID: ${lastDocument.id}`);
    console.log(`   Nom: ${lastDocument.filenameOriginal}`);
    console.log(`   Créé: ${lastDocument.createdAt}`);
    console.log(`   Type ID: ${lastDocument.documentTypeId}`);
    console.log(`   Type Code: ${lastDocument.documentType?.code || 'Aucun'}`);
    console.log(`   Type Label: ${lastDocument.documentType?.label || 'Aucun'}`);

    // 2. Vérifier si c'est un document BAIL_SIGNE
    if (lastDocument.documentType?.code === 'BAIL_SIGNE') {
      console.log('\n✅ Document BAIL_SIGNE détecté !');
      
      // 3. Vérifier les liaisons
      const links = await prisma.documentLink.findMany({
        where: { documentId: lastDocument.id },
        include: {
          document: {
            select: { filenameOriginal: true }
          }
        }
      });

      console.log(`   Liaisons créées: ${links.length}`);
      for (const link of links) {
        console.log(`     - ${link.targetType}: ${link.targetId} (${link.role})`);
      }

      // 4. Vérifier si le bail a été mis à jour
      const leaseLinks = links.filter(link => link.targetType === 'LEASE');
      if (leaseLinks.length > 0) {
        const leaseId = leaseLinks[0].targetId;
        const lease = await prisma.lease.findUnique({
          where: { id: leaseId },
          select: {
            id: true,
            status: true,
            signedPdfUrl: true,
            tenant: {
              select: { firstName: true, lastName: true }
            },
            property: {
              select: { name: true }
            }
          }
        });

        if (lease) {
          console.log('\n📋 Bail lié:');
          console.log(`   ID: ${lease.id}`);
          console.log(`   Statut: ${lease.status}`);
          console.log(`   signedPdfUrl: ${lease.signedPdfUrl || 'Aucune'}`);
          console.log(`   Locataire: ${lease.tenant?.firstName} ${lease.tenant?.lastName}`);
          console.log(`   Propriété: ${lease.property?.name}`);

          if (lease.status === 'SIGNÉ' && lease.signedPdfUrl) {
            console.log('\n✅ Le bail a été correctement mis à jour !');
          } else {
            console.log('\n❌ Le bail n\'a pas été mis à jour correctement');
            console.log('   Problème: L\'API de finalisation n\'a pas traité le document BAIL_SIGNE');
          }
        }
      }
    } else {
      console.log('\n❌ Le document n\'est pas de type BAIL_SIGNE');
      console.log('   Problème: Le type de document n\'a pas été correctement associé');
    }

    // 5. Vérifier tous les documents récents
    console.log('\n📋 Derniers 5 documents créés:');
    const recentDocuments = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        documentType: {
          select: {
            code: true,
            label: true
          }
        }
      }
    });

    for (const doc of recentDocuments) {
      console.log(`   - ${doc.filenameOriginal} (${doc.documentType?.code || 'Aucun type'}) - ${doc.createdAt.toLocaleString()}`);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDocumentType();

