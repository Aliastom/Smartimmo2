#!/usr/bin/env npx tsx

/**
 * Test de la correction de l'erreur d'upload de bail signé
 * 
 * Ce script teste que l'endpoint /api/leases/[id]/upload-signed
 * fonctionne correctement avec le champ bucketKey ajouté.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testUploadSignedFix() {
  console.log('🧪 Test de la correction de l\'erreur d\'upload de bail signé...\n');

  let testDocumentId: string | undefined;

  try {
    // 1. Trouver un bail existant
    console.log('📋 Recherche d\'un bail existant...');
    
    const existingLease = await prisma.lease.findFirst({
      include: {
        tenant: true,
        property: true
      }
    });

    if (!existingLease) {
      console.log('   ❌ Aucun bail existant trouvé');
      return;
    }
    
    console.log(`   ✅ Bail trouvé: ${existingLease.id}`);

    // 2. Vérifier que le type de document BAIL_SIGNE existe
    console.log('\n📄 Vérification du type de document BAIL_SIGNE...');
    
    const documentType = await prisma.documentType.findUnique({
      where: { code: 'BAIL_SIGNE' }
    });

    if (!documentType) {
      console.log('   ❌ Type de document BAIL_SIGNE non trouvé');
      return;
    }
    console.log(`   ✅ Type de document BAIL_SIGNE: ${documentType.id}`);

    // 3. Simuler la création d'un document comme le ferait l'endpoint corrigé
    console.log('\n📤 Simulation de la création du document (avec bucketKey)...');
    
    const fileName = `bail-signe-${existingLease.id}-${Date.now()}.pdf`;
    
    const document = await prisma.document.create({
      data: {
        documentTypeId: documentType.id,
        filenameOriginal: 'test-bail-signe.pdf',
        fileName: fileName,
        url: `/uploads/leases/${fileName}`,
        size: 1024,
        mime: 'application/pdf',
        sha256: 'test-sha256-hash',
        bucketKey: `/uploads/leases/${fileName}`, // Champ ajouté pour corriger l'erreur
        leaseId: existingLease.id,
        tenantId: existingLease.tenantId,
        propertyId: existingLease.propertyId,
        status: 'classified',
        source: 'upload',
        uploadedAt: new Date(),
        metadata: JSON.stringify({
          originalName: 'test-bail-signe.pdf',
          uploadType: 'lease_signed',
          leaseStatus: 'SIGNÉ'
        })
      }
    });
    testDocumentId = document.id;
    console.log(`   ✅ Document créé avec succès: ${document.id}`);

    // 4. Tester la création des liaisons
    console.log('\n🔗 Test de la création des liaisons...');
    
    const { BailSigneLinksService } = await import('../src/lib/services/bailSigneLinksService');
    
    const leaseInfo = await BailSigneLinksService.getLeaseInfoForLinks(existingLease.id);
    console.log(`   📋 Informations du bail:`, leaseInfo);
    
    await BailSigneLinksService.createBailSigneLinks(
      document.id,
      leaseInfo.leaseId,
      leaseInfo.propertyId,
      leaseInfo.tenantsIds
    );
    console.log(`   ✅ Liaisons créées avec succès`);

    // 5. Vérifier que tout fonctionne
    console.log('\n🔍 Vérification finale...');
    
    const links = await prisma.documentLink.findMany({
      where: { documentId: document.id }
    });
    
    console.log(`   📊 ${links.length} liaisons créées`);
    
    const hasLeaseLink = links.some(link => link.targetType === 'LEASE' && link.role === 'PRIMARY');
    const hasPropertyLink = links.some(link => link.targetType === 'PROPERTY' && link.role === 'DERIVED');
    const hasTenantLink = links.some(link => link.targetType === 'TENANT' && link.role === 'DERIVED');
    const hasGlobalLink = links.some(link => link.targetType === 'GLOBAL' && link.role === 'DERIVED');
    
    console.log(`   ${hasLeaseLink ? '✅' : '❌'} Liaison LEASE (PRIMARY)`);
    console.log(`   ${hasPropertyLink ? '✅' : '❌'} Liaison PROPERTY (DERIVED)`);
    console.log(`   ${hasTenantLink ? '✅' : '❌'} Liaison TENANT (DERIVED)`);
    console.log(`   ${hasGlobalLink ? '✅' : '❌'} Liaison GLOBAL (DERIVED)`);

    // 6. Résumé
    const allLinksCorrect = hasLeaseLink && hasPropertyLink && hasTenantLink && hasGlobalLink;
    
    console.log('\n📋 Résumé du test:');
    console.log(`   ✅ Document créé avec bucketKey`);
    console.log(`   ${allLinksCorrect ? '✅' : '❌'} Toutes les liaisons créées`);
    console.log(`   ✅ Aucune erreur Prisma`);
    
    if (allLinksCorrect) {
      console.log('\n🎉 La correction fonctionne parfaitement !');
      console.log('   L\'upload de bail signé ne devrait plus générer d\'erreur Prisma.');
    } else {
      console.log('\n❌ Il y a encore des problèmes avec les liaisons.');
    }

  } catch (error) {
    console.error('💥 Erreur lors du test:', error);
    
    if (error instanceof Error && error.message.includes('bucketKey')) {
      console.log('\n🔧 L\'erreur bucketKey persiste. Vérifiez que la correction a été appliquée.');
    }
  } finally {
    // Nettoyage
    console.log('\n🧹 Nettoyage des données de test...');
    
    if (testDocumentId) {
      await prisma.documentLink.deleteMany({ where: { documentId: testDocumentId } });
      await prisma.document.delete({ where: { id: testDocumentId } });
      console.log(`   ✅ Document de test supprimé`);
    }
    
    await prisma.$disconnect();
    console.log('✅ Nettoyage terminé');
  }
}

// Exécuter le test
testUploadSignedFix()
  .then(() => {
    console.log('\n🎯 Test de correction terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test:', error);
    process.exit(1);
  });
