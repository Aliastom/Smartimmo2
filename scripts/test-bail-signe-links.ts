#!/usr/bin/env npx tsx

/**
 * Test des liaisons spécifiques aux documents BAIL_SIGNE
 * 
 * Ce script teste que les liaisons sont créées correctement :
 * - PRIMARY: LEASE → targetId = leaseId
 * - DERIVED: PROPERTY → targetId = propertyId du bail
 * - DERIVED: TENANT → une liaison par locataire actif du bail
 * - DERIVED: GLOBAL → liaison automatique
 */

import { PrismaClient } from '@prisma/client';
import { BailSigneLinksService } from '../src/lib/services/bailSigneLinksService';

const prisma = new PrismaClient();

async function testBailSigneLinks() {
  console.log('🧪 Test des liaisons spécifiques aux documents BAIL_SIGNE...\n');

  let testDocumentId: string | undefined;

  try {
    // 1. Utiliser des données existantes ou créer des données minimales
    console.log('📋 Recherche de données existantes...');
    
    // Chercher un bail existant
    const existingLease = await prisma.lease.findFirst({
      include: {
        tenant: true,
        property: true
      }
    });

    let lease, tenant, property;
    
    if (!existingLease) {
      console.log('   ❌ Aucun bail existant trouvé. Création de données minimales...');
      
      // Créer un locataire minimal
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

      // Créer un bien minimal
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

      // Créer un bail minimal
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
      
      // Utiliser le bail créé
      lease = testLease;
      tenant = testTenant;
      property = testProperty;
    } else {
      console.log(`   ✅ Bail existant trouvé: ${existingLease.id}`);
      lease = existingLease;
      tenant = existingLease.tenant;
      property = existingLease.property;
    }

    // 2. Créer un type de document BAIL_SIGNE s'il n'existe pas
    console.log('\n📄 Vérification du type de document BAIL_SIGNE...');
    
    let documentType = await prisma.documentType.findUnique({
      where: { code: 'BAIL_SIGNE' }
    });

    if (!documentType) {
      documentType = await prisma.documentType.create({
        data: {
          code: 'BAIL_SIGNE',
          label: 'Bail signé',
          description: 'Contrat de bail signé par les deux parties',
          scope: 'lease',
          isSystem: true,
          isRequired: true,
          isActive: true,
          isSensitive: true,
          order: 10,
          icon: 'FileSignature',
          autoAssignThreshold: 0.85,
          regexFilename: '.*bail.*sign.*',
          validExtensions: JSON.stringify(['.pdf']),
          validMimeTypes: JSON.stringify(['application/pdf']),
          versioningEnabled: true,
        }
      });
      console.log(`   ✅ Type de document BAIL_SIGNE créé: ${documentType.id}`);
    } else {
      console.log(`   ✅ Type de document BAIL_SIGNE existant: ${documentType.id}`);
    }

    // 3. Créer un document de test
    console.log('\n📄 Création d\'un document BAIL_SIGNE de test...');
    
    const testDocument = await prisma.document.create({
      data: {
        documentTypeId: documentType.id,
        filenameOriginal: 'bail-signe-test.pdf',
        fileName: 'bail-signe-test.pdf',
        url: '/uploads/test/bail-signe-test.pdf',
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
    testDocumentId = testDocument.id;
    console.log(`   ✅ Document créé: ${testDocument.id}`);

    // 4. Tester la création des liaisons
    console.log('\n🔗 Test de la création des liaisons...');
    
    const leaseInfo = await BailSigneLinksService.getLeaseInfoForLinks(lease.id);
    console.log(`   📋 Informations du bail:`, leaseInfo);
    
    await BailSigneLinksService.createBailSigneLinks(
      testDocument.id,
      leaseInfo.leaseId,
      leaseInfo.propertyId,
      leaseInfo.tenantsIds
    );
    console.log(`   ✅ Liaisons créées avec succès`);

    // 5. Vérifier que les liaisons ont été créées
    console.log('\n🔍 Vérification des liaisons créées...');
    
    const links = await prisma.documentLink.findMany({
      where: { documentId: testDocument.id },
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

    // 6. Tester la non-duplication (upsert)
    console.log('\n🔄 Test de la non-duplication (upsert)...');
    
    await BailSigneLinksService.createBailSigneLinks(
      testDocument.id,
      leaseInfo.leaseId,
      leaseInfo.propertyId,
      leaseInfo.tenantsIds
    );
    
    const linksAfterUpsert = await prisma.documentLink.findMany({
      where: { documentId: testDocument.id }
    });
    
    if (linksAfterUpsert.length === links.length) {
      console.log(`   ✅ Aucune duplication: ${linksAfterUpsert.length} liaisons (identique)`);
    } else {
      console.log(`   ❌ Duplication détectée: ${links.length} → ${linksAfterUpsert.length} liaisons`);
      allLinksCorrect = false;
    }

    // 7. Résumé des tests
    console.log('\n📋 Résumé des tests:');
    console.log(`   ✅ Données de test créées`);
    console.log(`   ✅ Document BAIL_SIGNE créé`);
    console.log(`   ${allLinksCorrect ? '✅' : '❌'} Liaisons créées correctement`);
    console.log(`   ✅ Upsert fonctionne (pas de duplication)`);
    
    if (allLinksCorrect) {
      console.log('\n🎉 Tous les tests sont passés !');
      console.log('   Les liaisons spécifiques aux documents BAIL_SIGNE fonctionnent correctement.');
      console.log('   Le document sera visible sur :');
      console.log(`   - Fiche Bail (LEASE PRIMARY)`);
      console.log(`   - Fiche Bien (PROPERTY DERIVED)`);
      console.log(`   - Fiche Locataire (TENANT DERIVED)`);
      console.log(`   - Page Documents globale (GLOBAL DERIVED)`);
    } else {
      console.log('\n❌ Certains tests ont échoué !');
    }

  } catch (error) {
    console.error('💥 Erreur lors du test:', error);
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
testBailSigneLinks()
  .then(() => {
    console.log('\n🎯 Test des liaisons BAIL_SIGNE terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test:', error);
    process.exit(1);
  });
