#!/usr/bin/env npx tsx

/**
 * Script pour vérifier le statut du dernier bail modifié
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLatestLeaseStatus() {
  console.log('🔍 Vérification du dernier bail modifié\n');

  try {
    // Récupérer le dernier bail modifié
    const lease = await prisma.lease.findFirst({
      orderBy: {
        updatedAt: 'desc'
      },
      include: {
        tenant: true,
        property: true
      }
    });

    if (!lease) {
      console.log('❌ Aucun bail trouvé');
      return;
    }

    console.log('📋 Dernier bail modifié:');
    console.log(`   ID: ${lease.id}`);
    console.log(`   Propriété: ${lease.property?.name || 'N/A'}`);
    console.log(`   Locataire: ${lease.tenant?.firstName} ${lease.tenant?.lastName}`);
    console.log(`   Statut: ${lease.status}`);
    console.log(`   signedPdfUrl: ${lease.signedPdfUrl || 'Aucune'}`);
    console.log(`   Dernière modification: ${lease.updatedAt}`);

    // Vérifier le statut runtime
    const { getLeaseRuntimeStatus, getLeaseStatusDisplay } = await import('../src/domain/leases/status');
    const runtimeStatus = getLeaseRuntimeStatus(lease, new Date());
    const statusDisplay = getLeaseStatusDisplay(runtimeStatus);
    
    console.log('\n🧮 Statut runtime:');
    console.log(`   Statut calculé: ${runtimeStatus}`);
    console.log(`   Affichage: ${statusDisplay.label} (${statusDisplay.color})`);

    // Vérifier les documents liés
    const documents = await prisma.document.findMany({
      where: {
        links: {
          some: {
            targetType: 'LEASE',
            targetId: lease.id
          }
        }
      },
      include: {
        documentType: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 3
    });

    console.log('\n📄 Documents liés (3 derniers):');
    if (documents.length === 0) {
      console.log('   Aucun document');
    } else {
      for (const doc of documents) {
        console.log(`   - ${doc.filenameOriginal} (${doc.documentType?.code || 'N/A'})`);
        console.log(`     Créé: ${doc.createdAt}`);
      }
    }

    // Diagnostic
    console.log('\n🔍 Diagnostic:');
    if (lease.status === 'SIGNÉ' && lease.signedPdfUrl) {
      console.log('   ✅ Le workflow a fonctionné correctement !');
      console.log('   ✅ Le bail est passé en statut SIGNÉ avec le PDF attaché');
    } else if (lease.status === 'ENVOYÉ' && !lease.signedPdfUrl) {
      console.log('   ⚠️  Le bail est toujours en statut ENVOYÉ');
      console.log('   ⚠️  Aucun PDF signé attaché');
      console.log('   💡 Le workflow n\'a pas encore été testé ou n\'a pas fonctionné');
    } else if (lease.status === 'ENVOYÉ' && lease.signedPdfUrl) {
      console.log('   ❌ PROBLÈME: Le PDF est attaché mais le statut n\'a pas été mis à jour');
      console.log('   ❌ L\'API de finalisation n\'a pas traité correctement le document');
    } else {
      console.log(`   ℹ️  Statut actuel: ${lease.status}`);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestLeaseStatus();
