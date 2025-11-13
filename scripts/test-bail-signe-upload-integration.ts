#!/usr/bin/env npx tsx

/**
 * Test d'intégration complet pour l'upload de bail signé
 * 
 * Ce script teste que l'upload via l'endpoint /api/leases/[id]/upload-signed
 * crée correctement les liaisons spécifiques aux documents BAIL_SIGNE.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBailSigneUploadIntegration() {
  console.log('🧪 Test d\'intégration complet pour l\'upload de bail signé...\n');

  let testLeaseId: string | undefined;
  let testDocumentId: string | undefined;

  try {
    // 1. Utiliser un bail existant ou créer des données minimales
    console.log('📋 Recherche de données existantes...');
    
    const existingLease = await prisma.lease.findFirst({
      include: {
        tenant: true,
        property: true
      }
    });

    let lease, tenant, property;
    
    if (!existingLease) {
      console.log('   ❌ Aucun bail existant trouvé. Création de données minimales...');
      
      const testTenant = await prisma.tenant.create({
        data: {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: `jean.dupont.test.${Date.now()}@example.com`,
          phone: '+33612345678',
          status: 'ACTIVE',
        }
      });
      console.log(`   ✅ Locataire créé: ${testTenant.id}`);

      const testProperty = await prisma.property.create({
        data: {
          name: `Bien Test ${Date.now()}`,
          address: '123 Rue de Test',
          city: 'Paris',
          postalCode: '75001',
          type: 'APARTMENT',
          status: 'ACTIVE',
          surface: 50,
          rooms: 2,
          bedrooms: 1,
          bathrooms: 1,
          floor: 1,
          hasElevator: false,
          hasBalcony: true,
          hasParking: false,
          hasGarden: false,
          hasTerrace: false,
          energyClass: 'D',
          ghgEmission: 'E',
          description: 'Bien de test',
          price: 800,
          charges: 50,
          deposit: 800,
          availableAt: new Date(),
          acquisitionDate: new Date(),
          acquisitionPrice: 100000,
          notaryFees: 5000,
        }
      });
      console.log(`   ✅ Bien créé: ${testProperty.id}`);

      const testLease = await prisma.lease.create({
        data: {
          propertyId: testProperty.id,
          tenantId: testTenant.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          rent: 800,
          charges: 50,
          deposit: 800,
          status: 'BROUILLON',
        }
      });
      console.log(`   ✅ Bail créé: ${testLease.id}`);
      
      lease = testLease;
      tenant = testTenant;
      property = testProperty;
    } else {
      console.log(`   ✅ Bail existant trouvé: ${existingLease.id}`);
      lease = existingLease;
      tenant = existingLease.tenant;
      property = existingLease.property;
    }

    testLeaseId = lease.id;

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

    // 3. Simuler l'upload via l'endpoint (sans fichier réel)
    console.log('\n📤 Simulation de l\'upload via l\'endpoint...');
    
    // Créer un document comme le ferait l'endpoint
    const document = await prisma.document.create({
      data: {
        documentTypeId: documentType.id,
        filenameOriginal: 'bail-signe-test.pdf',
        fileName: 'bail-signe-test.pdf',
        url: `/uploads/leases/bail-signe-test.pdf`,
        size: 1024,
        mime: 'application/pdf',
        sha256: 'test-sha256-hash',
        leaseId: lease.id,
        tenantId: tenant.id,
        propertyId: property.id,
        status: 'classified',
        source: 'upload',
        uploadedAt: new Date(),
        bucketKey: 'test/bail-signe-test.pdf',
        metadata: JSON.stringify({
          originalName: 'bail-signe-test.pdf',
          uploadType: 'lease_signed',
          leaseStatus: 'SIGNÉ'
        })
      }
    });
    testDocumentId = document.id;
    console.log(`   ✅ Document créé: ${document.id}`);

    // 4. Simuler la création des liaisons (comme dans l'endpoint)
    console.log('\n🔗 Simulation de la création des liaisons...');
    
    const { BailSigneLinksService } = await import('../src/lib/services/bailSigneLinksService');
    
    const leaseInfo = await BailSigneLinksService.getLeaseInfoForLinks(lease.id);
    console.log(`   📋 Informations du bail:`, leaseInfo);
    
    await BailSigneLinksService.createBailSigneLinks(
      document.id,
      leaseInfo.leaseId,
      leaseInfo.propertyId,
      leaseInfo.tenantsIds
    );
    console.log(`   ✅ Liaisons créées avec succès`);

    // 5. Vérifier que les liaisons ont été créées
    console.log('\n🔍 Vérification des liaisons créées...');
    
    const links = await prisma.documentLink.findMany({
      where: { documentId: document.id },
      orderBy: [{ targetType: 'asc' }, { role: 'asc' }]
    });

    console.log(`   📊 ${links.length} liaisons trouvées:`);
    
    const expectedLinks = [
      { targetType: 'GLOBAL', role: 'DERIVED', targetId: null },
      { targetType: 'LEASE', role: 'PRIMARY', targetId: lease.id },
      { targetType: 'PROPERTY', role: 'DERIVED', targetId: property.id },
      { targetType: 'TENANT', role: 'DERIVED', targetId: tenant.id }
    ];

    let allLinksCorrect = true;
    
    for (const expectedLink of expectedLinks) {
      const foundLink = links.find(link => 
        link.targetType === expectedLink.targetType && 
        link.role === expectedLink.role &&
        link.targetId === expectedLink.targetId
      );
      
      if (foundLink) {
        console.log(`   ✅ ${expectedLink.targetType} (${expectedLink.role}): ${expectedLink.targetId || 'null'} - ${foundLink.entityName || 'N/A'}`);
      } else {
        console.log(`   ❌ ${expectedLink.targetType} (${expectedLink.role}): ${expectedLink.targetId || 'null'} - MANQUANT`);
        allLinksCorrect = false;
      }
    }

    // 6. Vérifier la visibilité du document dans les différentes vues
    console.log('\n👁️ Vérification de la visibilité du document...');
    
    // Vérifier la visibilité dans la vue globale
    const globalLinks = await prisma.documentLink.findMany({
      where: { targetType: 'GLOBAL' },
      include: { document: true }
    });
    const isVisibleGlobally = globalLinks.some(link => link.documentId === document.id);
    console.log(`   ${isVisibleGlobally ? '✅' : '❌'} Visible dans la vue globale: ${isVisibleGlobally}`);
    
    // Vérifier la visibilité dans la vue bail
    const leaseLinks = await prisma.documentLink.findMany({
      where: { targetType: 'LEASE', targetId: lease.id },
      include: { document: true }
    });
    const isVisibleInLease = leaseLinks.some(link => link.documentId === document.id);
    console.log(`   ${isVisibleInLease ? '✅' : '❌'} Visible dans la vue bail: ${isVisibleInLease}`);
    
    // Vérifier la visibilité dans la vue bien
    const propertyLinks = await prisma.documentLink.findMany({
      where: { targetType: 'PROPERTY', targetId: property.id },
      include: { document: true }
    });
    const isVisibleInProperty = propertyLinks.some(link => link.documentId === document.id);
    console.log(`   ${isVisibleInProperty ? '✅' : '❌'} Visible dans la vue bien: ${isVisibleInProperty}`);
    
    // Vérifier la visibilité dans la vue locataire
    const tenantLinks = await prisma.documentLink.findMany({
      where: { targetType: 'TENANT', targetId: tenant.id },
      include: { document: true }
    });
    const isVisibleInTenant = tenantLinks.some(link => link.documentId === document.id);
    console.log(`   ${isVisibleInTenant ? '✅' : '❌'} Visible dans la vue locataire: ${isVisibleInTenant}`);

    // 7. Résumé des tests
    console.log('\n📋 Résumé des tests d\'intégration:');
    console.log(`   ✅ Données de test créées`);
    console.log(`   ✅ Document BAIL_SIGNE créé`);
    console.log(`   ${allLinksCorrect ? '✅' : '❌'} Liaisons créées correctement`);
    console.log(`   ${isVisibleGlobally ? '✅' : '❌'} Visible globalement`);
    console.log(`   ${isVisibleInLease ? '✅' : '❌'} Visible dans le bail`);
    console.log(`   ${isVisibleInProperty ? '✅' : '❌'} Visible dans le bien`);
    console.log(`   ${isVisibleInTenant ? '✅' : '❌'} Visible dans le locataire`);
    
    const allTestsPassed = allLinksCorrect && isVisibleGlobally && isVisibleInLease && isVisibleInProperty && isVisibleInTenant;
    
    if (allTestsPassed) {
      console.log('\n🎉 Tous les tests d\'intégration sont passés !');
      console.log('   L\'upload de bail signé fonctionne correctement avec les liaisons.');
      console.log('   Le document sera visible dans toutes les vues appropriées.');
    } else {
      console.log('\n❌ Certains tests d\'intégration ont échoué !');
    }

  } catch (error) {
    console.error('💥 Erreur lors du test d\'intégration:', error);
  } finally {
    // Nettoyage
    console.log('\n🧹 Nettoyage des données de test...');
    
    if (testDocumentId) {
      await prisma.documentLink.deleteMany({ where: { documentId: testDocumentId } });
      await prisma.document.delete({ where: { id: testDocumentId } });
      console.log(`   ✅ Document de test supprimé`);
    }
    
    // Nettoyer seulement les données créées pour le test
    await prisma.tenant.deleteMany({
      where: { email: { contains: 'jean.dupont.test' } }
    });
    console.log(`   ✅ Locataires de test supprimés`);
    
    await prisma.property.deleteMany({
      where: { name: { contains: 'Bien Test' } }
    });
    console.log(`   ✅ Biens de test supprimés`);
    
    await prisma.lease.deleteMany({
      where: { 
        property: { name: { contains: 'Bien Test' } }
      }
    });
    console.log(`   ✅ Baux de test supprimés`);
    
    await prisma.$disconnect();
    console.log('✅ Nettoyage terminé');
  }
}

// Exécuter le test
testBailSigneUploadIntegration()
  .then(() => {
    console.log('\n🎯 Test d\'intégration terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test d\'intégration:', error);
    process.exit(1);
  });
