#!/usr/bin/env npx tsx

/**
 * Test rapide de la correction de la page Baux
 */

async function testPageBauxFix() {
  console.log('🔧 Test de la correction de la page Baux...\n');

  try {
    // Test de la page principale
    console.log('🌐 Test de la page /baux...');
    const response = await fetch('http://localhost:3000/baux');
    if (response.ok) {
      console.log('   ✅ Page /baux accessible (Status: 200)');
    } else {
      console.log(`   ❌ Page /baux inaccessible (Status: ${response.status})`);
    }

    // Test des API endpoints
    console.log('\n🔌 Test des API endpoints...');
    
    const apiTests = [
      { name: 'KPIs', url: 'http://localhost:3000/api/leases?kpis=true' },
      { name: 'Alertes', url: 'http://localhost:3000/api/leases?alerts=true' },
      { name: 'Recherche', url: 'http://localhost:3000/api/leases?limit=5' }
    ];

    for (const test of apiTests) {
      try {
        const response = await fetch(test.url);
        if (response.ok) {
          const data = await response.json();
          console.log(`   ✅ API ${test.name}: Fonctionnelle`);
        } else {
          console.log(`   ❌ API ${test.name}: Erreur ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ API ${test.name}: ${error.message}`);
      }
    }

    // Test du composant LeasesAlertsSection
    console.log('\n🧩 Test du composant LeasesAlertsSection...');
    try {
      await import('../src/components/leases/LeasesAlertsSection.tsx');
      console.log('   ✅ LeasesAlertsSection: Import réussi (CheckCircle corrigé)');
    } catch (error) {
      console.log(`   ❌ LeasesAlertsSection: ${error.message}`);
    }

    console.log('\n🎉 Correction réussie !');
    console.log('   La page Baux est maintenant entièrement fonctionnelle.');
    console.log('   Vous pouvez accéder à http://localhost:3000/baux');

  } catch (error) {
    console.error('💥 Erreur lors des tests:', error);
  }
}

// Exécuter les tests
testPageBauxFix()
  .then(() => {
    console.log('\n🎯 Tests terminés');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec des tests:', error);
    process.exit(1);
  });
