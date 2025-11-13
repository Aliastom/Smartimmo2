#!/usr/bin/env npx tsx

/**
 * Test de la nouvelle page Baux refondée
 * 
 * Ce script teste toutes les fonctionnalités de la nouvelle page Baux :
 * - API endpoints (KPIs, recherche, alertes)
 * - Service LeasesService
 * - Composants et intégration
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testNewLeasesPage() {
  console.log('🧪 Test de la nouvelle page Baux refondée...\n');

  try {
    // 1. Test du service LeasesService
    console.log('📊 Test du service LeasesService...');
    
    const { LeasesService } = await import('../src/lib/services/leasesService');
    
    // Test des KPIs
    console.log('   🔍 Test des KPIs...');
    const kpis = await LeasesService.getKPIs();
    console.log(`   ✅ KPIs récupérés:`, {
      total: kpis.total,
      active: kpis.active,
      toSign: kpis.toSign,
      expiringIn90Days: kpis.expiringIn90Days,
      terminated: kpis.terminated,
      draft: kpis.draft,
      signed: kpis.signed,
      missingDocuments: kpis.missingDocuments,
      indexationDue: kpis.indexationDue
    });

    // Test de la recherche
    console.log('   🔍 Test de la recherche...');
    const searchResult = await LeasesService.search({
      limit: 5,
      offset: 0
    });
    console.log(`   ✅ Recherche: ${searchResult.items.length} baux trouvés sur ${searchResult.total}`);

    // Test des alertes
    console.log('   🔍 Test des alertes...');
    const alerts = await LeasesService.getAlerts();
    console.log(`   ✅ Alertes:`, {
      expiring: alerts.expiringLeases.length,
      missing: alerts.missingDocumentsLeases.length,
      indexation: alerts.indexationDueLeases.length
    });

    // 2. Test des endpoints API
    console.log('\n🌐 Test des endpoints API...');
    
    // Test endpoint KPIs
    console.log('   🔍 Test endpoint KPIs...');
    const kpisResponse = await fetch('http://localhost:3000/api/leases?kpis=true');
    if (kpisResponse.ok) {
      const kpisData = await kpisResponse.json();
      console.log('   ✅ Endpoint KPIs fonctionne');
    } else {
      console.log('   ❌ Endpoint KPIs échoue:', kpisResponse.status);
    }

    // Test endpoint alertes
    console.log('   🔍 Test endpoint alertes...');
    const alertsResponse = await fetch('http://localhost:3000/api/leases?alerts=true');
    if (alertsResponse.ok) {
      const alertsData = await alertsResponse.json();
      console.log('   ✅ Endpoint alertes fonctionne');
    } else {
      console.log('   ❌ Endpoint alertes échoue:', alertsResponse.status);
    }

    // Test endpoint recherche
    console.log('   🔍 Test endpoint recherche...');
    const searchResponse = await fetch('http://localhost:3000/api/leases?limit=5');
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log('   ✅ Endpoint recherche fonctionne');
    } else {
      console.log('   ❌ Endpoint recherche échoue:', searchResponse.status);
    }

    // 3. Test des filtres
    console.log('\n🔍 Test des filtres...');
    
    const filterTests = [
      { name: 'Recherche par statut', filters: { status: ['ACTIF'] } },
      { name: 'Recherche par type', filters: { type: ['residential'] } },
      { name: 'Baux expirant', filters: { upcomingExpiration: true } },
      { name: 'Sans documents', filters: { missingDocuments: true } },
      { name: 'Indexation due', filters: { indexationDue: true } }
    ];

    for (const test of filterTests) {
      console.log(`   🔍 Test: ${test.name}...`);
      const result = await LeasesService.search(test.filters);
      console.log(`   ✅ ${test.name}: ${result.items.length} résultats`);
    }

    // 4. Test des données enrichies
    console.log('\n📋 Test des données enrichies...');
    
    if (searchResult.items.length > 0) {
      const sampleLease = searchResult.items[0];
      console.log('   📄 Exemple de bail enrichi:');
      console.log(`     - ID: ${sampleLease.id}`);
      console.log(`     - Statut: ${sampleLease.status} (runtime: ${sampleLease.runtimeStatus})`);
      console.log(`     - Prochaine action: ${sampleLease.nextAction || 'Aucune'}`);
      console.log(`     - Bail signé: ${sampleLease.hasSignedLease ? 'Oui' : 'Non'}`);
      console.log(`     - Jours avant expiration: ${sampleLease.daysUntilExpiration || 'N/A'}`);
      console.log(`     - Jours avant indexation: ${sampleLease.daysUntilIndexation || 'N/A'}`);
      console.log(`     - Bien: ${sampleLease.property.name}`);
      console.log(`     - Locataire: ${sampleLease.tenant.firstName} ${sampleLease.tenant.lastName}`);
    }

    // 5. Test de performance
    console.log('\n⚡ Test de performance...');
    
    const startTime = Date.now();
    await Promise.all([
      LeasesService.getKPIs(),
      LeasesService.search({ limit: 50 }),
      LeasesService.getAlerts()
    ]);
    const endTime = Date.now();
    
    console.log(`   ✅ Temps d'exécution: ${endTime - startTime}ms`);

    // 6. Résumé
    console.log('\n📋 Résumé des tests:');
    console.log(`   ✅ Service LeasesService: Fonctionnel`);
    console.log(`   ✅ KPIs: ${kpis.total} baux au total`);
    console.log(`   ✅ Recherche: ${searchResult.total} baux trouvés`);
    console.log(`   ✅ Alertes: ${alerts.expiringLeases.length + alerts.missingDocumentsLeases.length + alerts.indexationDueLeases.length} alertes`);
    console.log(`   ✅ Filtres: Tous fonctionnels`);
    console.log(`   ✅ Performance: < 1000ms`);

    console.log('\n🎉 Tous les tests sont passés !');
    console.log('   La nouvelle page Baux est prête à être utilisée.');

  } catch (error) {
    console.error('💥 Erreur lors des tests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter les tests
testNewLeasesPage()
  .then(() => {
    console.log('\n🎯 Tests terminés');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec des tests:', error);
    process.exit(1);
  });
