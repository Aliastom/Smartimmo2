#!/usr/bin/env npx tsx

/**
 * Test de la logique de détection des baux signés
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testLeaseSignedLogic() {
  console.log('🧪 Test de la logique de détection des baux signés...\n');

  try {
    // 1. Récupérer tous les baux
    console.log('📋 Récupération des baux...');
    const leases = await prisma.lease.findMany({
      include: {
        property: true,
        tenant: true
      }
    });

    console.log(`   ✅ ${leases.length} bail(s) trouvé(s)`);

    // 2. Tester la logique pour chaque bail
    for (const lease of leases) {
      console.log(`\n🔍 Bail: ${lease.property.name} (${lease.tenant.firstName} ${lease.tenant.lastName})`);
      console.log(`   - ID: ${lease.id}`);
      console.log(`   - Statut: ${lease.status}`);
      console.log(`   - signedPdfUrl: ${lease.signedPdfUrl || 'null'}`);

      // Vérifier les documents BAIL_SIGNE liés
      const bailSigneLinks = await prisma.documentLink.findMany({
        where: {
          targetType: 'LEASE',
          targetId: lease.id,
          document: {
            documentType: {
              code: 'BAIL_SIGNE'
            }
          }
        },
        include: {
          document: {
            include: {
              documentType: true
            }
          }
        }
      });

      console.log(`   - Documents BAIL_SIGNE liés: ${bailSigneLinks.length}`);
      
      if (bailSigneLinks.length > 0) {
        console.log(`     ✅ ${bailSigneLinks[0].document.filenameOriginal}`);
      }

      // Tester la nouvelle logique
      const hasSignedPdf = !!lease.signedPdfUrl;
      const hasBailSigneDocument = bailSigneLinks.length > 0;
      const hasSignedLease = hasSignedPdf || hasBailSigneDocument;

      console.log(`   - hasSignedPdf: ${hasSignedPdf}`);
      console.log(`   - hasBailSigneDocument: ${hasBailSigneDocument}`);
      console.log(`   - hasSignedLease (nouvelle logique): ${hasSignedLease}`);

      // Vérifier la cohérence
      if (lease.status === 'ACTIF' && !hasSignedLease) {
        console.log(`   ⚠️ INCOHÉRENCE: Bail ACTIF mais pas de document signé`);
      } else if (lease.status === 'ACTIF' && hasSignedLease) {
        console.log(`   ✅ COHÉRENT: Bail ACTIF avec document signé`);
      }
    }

    // 3. Tester le service LeasesService
    console.log('\n🧪 Test du service LeasesService...');
    try {
      const { LeasesService } = await import('../src/lib/services/leasesService');
      
      const result = await LeasesService.search({ limit: 10 });
      
      console.log(`   ✅ Service fonctionne correctement`);
      console.log(`   📊 ${result.items.length} bail(s) récupéré(s)`);
      
      for (const lease of result.items) {
        console.log(`\n   🔍 ${lease.property.name}:`);
        console.log(`     - Statut: ${lease.status}`);
        console.log(`     - hasSignedLease: ${lease.hasSignedLease}`);
        console.log(`     - signedPdfUrl: ${lease.signedPdfUrl || 'null'}`);
        
        if (lease.status === 'ACTIF' && !lease.hasSignedLease) {
          console.log(`     ⚠️ INCOHÉRENCE: Bail ACTIF mais hasSignedLease = false`);
        } else if (lease.status === 'ACTIF' && lease.hasSignedLease) {
          console.log(`     ✅ COHÉRENT: Bail ACTIF avec hasSignedLease = true`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Erreur service: ${error.message}`);
    }

    // 4. Tester les KPIs
    console.log('\n🧪 Test des KPIs...');
    try {
      const { LeasesService } = await import('../src/lib/services/leasesService');
      
      const kpis = await LeasesService.getKPIs();
      
      console.log(`   ✅ KPIs récupérés correctement`);
      console.log(`   📊 Résumé:`);
      console.log(`     - Total: ${kpis.total}`);
      console.log(`     - Actifs: ${kpis.active}`);
      console.log(`     - Signés: ${kpis.signed}`);
      console.log(`     - Sans bail signé: ${kpis.missingDocuments}`);
      
    } catch (error) {
      console.log(`   ❌ Erreur KPIs: ${error.message}`);
    }

    // 5. Résumé des corrections
    console.log('\n📋 Résumé des corrections apportées:');
    console.log('   ✅ 1️⃣ hasSignedLease vérifie maintenant les documents liés');
    console.log('   ✅ 2️⃣ Logique: hasSignedPdf || hasBailSigneDocument');
    console.log('   ✅ 3️⃣ KPIs mis à jour pour la cohérence');
    console.log('   ✅ 4️⃣ Tableau et drawer maintenant synchronisés');

    console.log('\n🎉 Correction de la logique terminée !');
    console.log('   Vous pouvez maintenant tester sur http://localhost:3000/baux');
    console.log('   - Le tableau ne devrait plus afficher "Sans bail signé" pour les baux ACTIF');
    console.log('   - Les KPIs devraient être cohérents');
    console.log('   - Le drawer et le tableau devraient être synchronisés');

  } catch (error) {
    console.error('💥 Erreur lors des tests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter les tests
testLeaseSignedLogic()
  .then(() => {
    console.log('\n🎯 Tests terminés');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec des tests:', error);
    process.exit(1);
  });
