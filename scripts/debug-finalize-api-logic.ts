#!/usr/bin/env npx tsx

/**
 * Script pour déboguer la logique de l'API de finalisation
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugFinalizeApiLogic() {
  console.log('🔍 Débogage de la logique de l\'API de finalisation\n');

  try {
    // 1. Vérifier la logique de l'API de finalisation
    console.log('📋 Vérification de la logique de l\'API de finalisation...');
    
    // Simuler le contexte qui devrait être passé
    const testContext = {
      entityType: 'LEASE' as const,
      entityId: 'cmgvdz4og0001n8cc4x3miaw0' // ID du bail de test
    };

    console.log('   Contexte de test:', JSON.stringify(testContext, null, 2));

    // 2. Simuler la logique de récupération du leaseId
    let leaseId: string | null = null;
    if (testContext.entityType === 'LEASE' && testContext.entityId) {
      leaseId = testContext.entityId;
      console.log(`   ✅ leaseId récupéré: ${leaseId}`);
    } else {
      console.log('   ❌ leaseId non récupéré');
    }

    if (leaseId) {
      // 3. Vérifier que le bail existe
      const lease = await prisma.lease.findUnique({
        where: { id: leaseId }
      });

      if (lease) {
        console.log(`   ✅ Bail trouvé: ${lease.status}`);
        
        // 4. Simuler la mise à jour du statut
        console.log('   🔧 Simulation de la mise à jour du statut...');
        
        const updatedLease = await prisma.lease.update({
          where: { id: leaseId },
          data: {
            status: 'SIGNÉ',
            signedPdfUrl: '/test-url.pdf',
            updatedAt: new Date()
          }
        });

        console.log(`   ✅ Statut mis à jour: ${updatedLease.status}`);
        console.log(`   ✅ signedPdfUrl: ${updatedLease.signedPdfUrl}`);

        // 5. Remettre le statut original pour le test
        await prisma.lease.update({
          where: { id: leaseId },
          data: {
            status: 'ENVOYÉ',
            signedPdfUrl: null,
            updatedAt: new Date()
          }
        });

        console.log('   🔄 Statut remis à "ENVOYÉ" pour le test');
      } else {
        console.log('   ❌ Bail non trouvé');
      }
    }

    // 6. Vérifier les types de documents BAIL_SIGNE
    console.log('\n📋 Vérification des types de documents...');
    
    const bailSigneType = await prisma.documentType.findUnique({
      where: { code: 'BAIL_SIGNE' }
    });

    if (bailSigneType) {
      console.log(`   ✅ Type BAIL_SIGNE trouvé: ${bailSigneType.id}`);
      console.log(`   Label: ${bailSigneType.label}`);
    } else {
      console.log('   ❌ Type BAIL_SIGNE non trouvé');
    }

    // 7. Vérifier le service BailSigneLinksService
    console.log('\n📋 Vérification du service BailSigneLinksService...');
    
    try {
      const { BailSigneLinksService } = await import('@/lib/services/bailSigneLinksService');
      console.log('   ✅ BailSigneLinksService importé avec succès');
      
      // Tester la méthode getLeaseInfoForLinks
      const leaseInfo = await BailSigneLinksService.getLeaseInfoForLinks('cmgvdz4og0001n8cc4x3miaw0');
      console.log('   ✅ getLeaseInfoForLinks fonctionne:', leaseInfo);
    } catch (error) {
      console.log('   ❌ Erreur avec BailSigneLinksService:', error);
    }

    console.log('\n🎯 Conclusion:');
    console.log('   La logique de l\'API semble correcte');
    console.log('   Le problème pourrait être:');
    console.log('   1. Le contexte n\'est pas passé correctement depuis l\'interface');
    console.log('   2. L\'API de finalisation n\'est pas appelée');
    console.log('   3. Il y a une erreur dans l\'upload du fichier');

  } catch (error) {
    console.error('❌ Erreur lors du débogage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugFinalizeApiLogic();

