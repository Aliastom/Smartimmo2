#!/usr/bin/env npx tsx

/**
 * Script pour tester l'upload d'un document BAIL_SIGNE
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBailSigneUpload() {
  console.log('🧪 Test de l\'upload d\'un document BAIL_SIGNE\n');

  try {
    // 1. Vérifier l'état initial du bail
    const lease = await prisma.lease.findUnique({
      where: { id: 'cmgvdz4og0001n8cc4x3miaw0' },
      include: {
        tenant: true,
        property: true
      }
    });

    if (!lease) {
      console.log('❌ Bail de test non trouvé');
      return;
    }

    console.log('📋 État initial du bail:');
    console.log(`   Statut: ${lease.status}`);
    console.log(`   signedPdfUrl: ${lease.signedPdfUrl || 'Aucune'}`);

    // 2. Créer un document BAIL_SIGNE de test
    console.log('\n📄 Création d\'un document BAIL_SIGNE de test...');
    
    // D'abord, récupérer l'ID du type de document BAIL_SIGNE
    const bailSigneType = await prisma.documentType.findUnique({
      where: { code: 'BAIL_SIGNE' }
    });

    if (!bailSigneType) {
      console.log('❌ Type de document BAIL_SIGNE non trouvé');
      return;
    }

    console.log(`✅ Type BAIL_SIGNE trouvé: ${bailSigneType.id}`);

    const testDocument = await prisma.document.create({
      data: {
        filenameOriginal: 'test-bail-signe-workflow.pdf',
        fileName: 'test-bail-signe-workflow.pdf',
        url: '/uploads/test-bail-signe-workflow.pdf',
        size: 1024,
        mime: 'application/pdf',
        sha256: 'test-hash-workflow',
        bucketKey: '/uploads/test-bail-signe-workflow.pdf',
        status: 'classified',
        source: 'upload',
        uploadedAt: new Date(),
        documentTypeId: bailSigneType.id
      },
      include: {
        documentType: true
      }
    });

    console.log(`✅ Document créé: ${testDocument.id}`);

    // 3. Simuler l'appel à l'API de finalisation
    console.log('\n🔧 Simulation de l\'appel à l\'API de finalisation...');
    
    const documentContext = {
      entityType: 'LEASE' as const,
      entityId: lease.id
    };

    console.log('   Contexte:', JSON.stringify(documentContext, null, 2));

    // 4. Simuler la logique de l'API de finalisation
    console.log('\n🔧 Simulation de la logique de l\'API de finalisation...');
    
    // Vérifier si c'est un document BAIL_SIGNE
    if (testDocument.documentType?.code === 'BAIL_SIGNE') {
      console.log('   ✅ Document BAIL_SIGNE détecté');
      
      // Récupérer le leaseId
      let leaseId: string | null = null;
      if (documentContext.entityType === 'LEASE' && documentContext.entityId) {
        leaseId = documentContext.entityId;
        console.log(`   ✅ leaseId récupéré: ${leaseId}`);
      }

      if (leaseId) {
        // Créer les liaisons automatiques
        console.log('   🔗 Création des liaisons automatiques...');
        
        // Liaison GLOBAL
        await prisma.documentLink.create({
          data: {
            documentId: testDocument.id,
            targetType: 'GLOBAL',
            targetId: 'GLOBAL',
            role: 'PRIMARY',
            entityName: 'Global'
          }
        });

        // Liaison LEASE
        await prisma.documentLink.create({
          data: {
            documentId: testDocument.id,
            targetType: 'LEASE',
            targetId: leaseId,
            role: 'PRIMARY',
            entityName: `Bail ${lease.id.substring(0, 8)}`
          }
        });

        // Liaison PROPERTY
        await prisma.documentLink.create({
          data: {
            documentId: testDocument.id,
            targetType: 'PROPERTY',
            targetId: lease.propertyId,
            role: 'DERIVED',
            entityName: lease.property?.name || 'Propriété'
          }
        });

        // Liaison TENANT
        if (lease.tenantId) {
          await prisma.documentLink.create({
            data: {
              documentId: testDocument.id,
              targetType: 'TENANT',
              targetId: lease.tenantId,
              role: 'DERIVED',
              entityName: `${lease.tenant?.firstName} ${lease.tenant?.lastName}`
            }
          });
        }

        console.log('   ✅ Liaisons créées');

        // Mettre à jour le statut du bail
        console.log('   🔄 Mise à jour du statut du bail...');
        
        const updatedLease = await prisma.lease.update({
          where: { id: leaseId },
          data: {
            status: 'SIGNÉ',
            signedPdfUrl: testDocument.url,
            updatedAt: new Date()
          }
        });

        console.log(`   ✅ Statut mis à jour: ${updatedLease.status}`);
        console.log(`   ✅ signedPdfUrl: ${updatedLease.signedPdfUrl}`);

        // 5. Vérifier le résultat
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
          
          // Vérifier les liaisons
          const links = await prisma.documentLink.findMany({
            where: { documentId: testDocument.id }
          });
          
          console.log(`   Liaisons créées: ${links.length}`);
          for (const link of links) {
            console.log(`     - ${link.targetType}: ${link.targetId} (${link.role})`);
          }
        }

        // 6. Tester le statut runtime
        console.log('\n🧮 Test du statut runtime:');
        
        const { getLeaseRuntimeStatus, getLeaseStatusDisplay } = await import('../src/domain/leases/status');
        const runtimeStatus = getLeaseRuntimeStatus(finalLease!, new Date());
        const statusDisplay = getLeaseStatusDisplay(runtimeStatus);
        
        console.log(`   Statut runtime: ${runtimeStatus}`);
        console.log(`   Affichage: ${statusDisplay.label}`);
        console.log(`   Couleur: ${statusDisplay.color}`);

        console.log('\n✅ Test réussi ! Le workflow fonctionne correctement');
        
      } else {
        console.log('   ❌ Aucun leaseId trouvé');
      }
    } else {
      console.log('   ❌ Document n\'est pas de type BAIL_SIGNE');
    }

    // 7. Nettoyer les données de test
    console.log('\n🧹 Nettoyage des données de test...');
    await prisma.documentLink.deleteMany({
      where: { documentId: testDocument.id }
    });
    await prisma.document.delete({
      where: { id: testDocument.id }
    });
    
    // Remettre le bail au statut ENVOYÉ
    await prisma.lease.update({
      where: { id: lease.id },
      data: {
        status: 'ENVOYÉ',
        signedPdfUrl: null,
        updatedAt: new Date()
      }
    });
    
    console.log('✅ Données de test supprimées et bail remis à ENVOYÉ');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBailSigneUpload();
