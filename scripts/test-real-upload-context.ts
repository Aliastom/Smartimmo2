#!/usr/bin/env npx tsx

/**
 * Test pour vérifier le contexte réel passé lors de l'upload
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testRealUploadContext() {
  console.log('🔍 Test du contexte réel d\'upload\n');

  try {
    // 1. Trouver un bail avec statut "ENVOYÉ"
    const sentLease = await prisma.lease.findFirst({
      where: { status: 'ENVOYÉ' },
      include: {
        tenant: true,
        property: true
      }
    });

    if (!sentLease) {
      console.log('❌ Aucun bail avec statut "ENVOYÉ" trouvé');
      return;
    }

    console.log('📋 Bail trouvé:');
    console.log(`   ID: ${sentLease.id}`);
    console.log(`   Statut: ${sentLease.status}`);
    console.log(`   Locataire: ${sentLease.tenant?.firstName} ${sentLease.tenant?.lastName}`);
    console.log(`   Propriété: ${sentLease.property?.name}`);

    // 2. Simuler le contexte qui devrait être passé depuis l'interface
    console.log('\n🔗 Contexte qui devrait être passé depuis l\'interface:');
    
    const autoLinkingContext = {
      leaseId: sentLease.id,
      propertyId: sentLease.propertyId,
      tenantsIds: sentLease.tenantId ? [sentLease.tenantId] : []
    };

    console.log('   autoLinkingContext:', JSON.stringify(autoLinkingContext, null, 2));

    // 3. Simuler la logique de l'UploadReviewModal
    console.log('\n🧮 Simulation de la logique UploadReviewModal:');
    
    let finalContext;
    if (autoLinkingContext && (autoLinkingContext.leaseId || autoLinkingContext.propertyId || autoLinkingContext.tenantsIds?.length)) {
      if (autoLinkingContext.leaseId) {
        finalContext = {
          entityType: 'LEASE' as const,
          entityId: autoLinkingContext.leaseId
        };
        console.log('   ✅ Contexte LEASE détecté');
      } else if (autoLinkingContext.propertyId) {
        finalContext = {
          entityType: 'PROPERTY' as const,
          entityId: autoLinkingContext.propertyId
        };
        console.log('   ✅ Contexte PROPERTY détecté');
      } else if (autoLinkingContext.tenantsIds?.length) {
        finalContext = {
          entityType: 'TENANT' as const,
          entityId: autoLinkingContext.tenantsIds[0]
        };
        console.log('   ✅ Contexte TENANT détecté');
      }
    } else {
      finalContext = {
        entityType: 'GLOBAL' as const,
        entityId: undefined,
      };
      console.log('   ❌ Contexte GLOBAL (pas de données)');
    }

    console.log('   finalContext:', JSON.stringify(finalContext, null, 2));

    // 4. Simuler la logique de l'API finalize
    console.log('\n🔧 Simulation de la logique API finalize:');
    
    const documentContext = finalContext;
    let leaseId: string | null = null;

    if (documentContext.entityType === 'LEASE' && documentContext.entityId) {
      leaseId = documentContext.entityId;
      console.log(`   ✅ leaseId récupéré: ${leaseId}`);
    } else if (false) { // document.leaseId (pas disponible dans ce test)
      leaseId = null;
      console.log('   ❌ document.leaseId non disponible');
    }

    if (leaseId) {
      console.log('   ✅ Le bail sera mis à jour');
      
      // Vérifier que le bail existe
      const lease = await prisma.lease.findUnique({
        where: { id: leaseId }
      });
      
      if (lease) {
        console.log(`   ✅ Bail trouvé: ${lease.status}`);
      } else {
        console.log('   ❌ Bail non trouvé');
      }
    } else {
      console.log('   ❌ Aucun leaseId, le bail ne sera PAS mis à jour');
    }

    // 5. Test avec un contexte incorrect
    console.log('\n🧪 Test avec un contexte incorrect:');
    
    const incorrectContext = {
      entityType: 'GLOBAL' as const,
      entityId: undefined,
    };
    
    console.log('   Contexte incorrect:', JSON.stringify(incorrectContext, null, 2));
    
    let incorrectLeaseId: string | null = null;
    if (incorrectContext.entityType === 'LEASE' && incorrectContext.entityId) {
      incorrectLeaseId = incorrectContext.entityId;
    }
    
    console.log(`   leaseId récupéré: ${incorrectLeaseId || 'AUCUN'}`);
    console.log('   Résultat: Le bail ne sera PAS mis à jour');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRealUploadContext();

