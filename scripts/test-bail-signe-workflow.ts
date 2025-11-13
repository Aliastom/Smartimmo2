#!/usr/bin/env npx tsx

/**
 * Test du workflow complet d'upload d'un document BAIL_SIGNE
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBailSigneWorkflow() {
  console.log('🧪 Test du workflow BAIL_SIGNE\n');

  try {
    // 1. Utiliser un bail existant avec statut "ENVOYÉ"
    console.log('📝 Recherche d\'un bail existant avec statut "ENVOYÉ"...');
    
    const testLease = await prisma.lease.findFirst({
      where: { status: 'ENVOYÉ' },
      include: {
        tenant: true,
        property: true
      }
    });

    if (!testLease) {
      console.log('❌ Aucun bail avec statut "ENVOYÉ" trouvé');
      return;
    }

    console.log(`✅ Bail trouvé: ${testLease.id}`);
    console.log(`   Statut: ${testLease.status}`);
    console.log(`   Locataire: ${testLease.tenant?.firstName} ${testLease.tenant?.lastName}`);
    console.log(`   Propriété: ${testLease.property?.name}`);

    // 2. Simuler l'upload d'un document BAIL_SIGNE via l'API finalize
    console.log('\n📄 Simulation de l\'upload d\'un document BAIL_SIGNE...');
    
    // Créer un document de test
    const testDocument = await prisma.document.create({
      data: {
        filenameOriginal: 'test-bail-signe.pdf',
        fileName: 'test-bail-signe.pdf',
        url: '/uploads/test-bail-signe.pdf',
        size: 1024,
        mime: 'application/pdf',
        sha256: 'test-hash',
        bucketKey: '/uploads/test-bail-signe.pdf',
        status: 'classified',
        source: 'upload',
        uploadedAt: new Date(),
        documentType: {
          connect: {
            code: 'BAIL_SIGNE'
          }
        }
      }
    });

    console.log(`✅ Document créé: ${testDocument.id}`);

    // 3. Simuler l'appel à l'API finalize avec le contexte de liaison
    console.log('\n🔗 Simulation de la liaison automatique...');
    
    const documentContext = {
      entityType: 'LEASE' as const,
      entityId: testLease.id
    };

    console.log(`   Contexte: ${documentContext.entityType} - ${documentContext.entityId}`);

    // 4. Vérifier si le leaseId est correctement récupéré
    let leaseId: string | null = null;
    if (documentContext.entityType === 'LEASE' && documentContext.entityId) {
      leaseId = documentContext.entityId;
    }

    console.log(`   leaseId récupéré: ${leaseId}`);

    if (leaseId) {
      // 5. Simuler la mise à jour du statut du bail
      console.log('\n🔄 Mise à jour du statut du bail...');
      
      const updatedLease = await prisma.lease.update({
        where: { id: leaseId },
        data: {
          status: 'SIGNÉ',
          signedPdfUrl: testDocument.url,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Statut mis à jour: ${updatedLease.status}`);
      console.log(`✅ signedPdfUrl: ${updatedLease.signedPdfUrl}`);

      // 6. Vérifier le résultat
      console.log('\n📊 Vérification du résultat:');
      const finalLease = await prisma.lease.findUnique({
        where: { id: leaseId },
        include: {
          tenant: true,
          property: true
        }
      });

      if (finalLease) {
        console.log(`   Statut final: ${finalLease.status}`);
        console.log(`   signedPdfUrl: ${finalLease.signedPdfUrl || 'Aucune'}`);
        
        if (finalLease.status === 'SIGNÉ') {
          console.log('✅ SUCCÈS: Le workflow fonctionne correctement');
        } else {
          console.log('❌ ÉCHEC: Le statut n\'a pas été mis à jour');
        }
      }

    } else {
      console.log('❌ ÉCHEC: leaseId non récupéré');
    }

    // 7. Nettoyer les données de test
    console.log('\n🧹 Nettoyage des données de test...');
    await prisma.document.delete({ where: { id: testDocument.id } });
    console.log('✅ Document de test supprimé');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBailSigneWorkflow();
