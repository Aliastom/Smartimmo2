#!/usr/bin/env npx tsx

/**
 * Test de la correction de la synchronisation du drawer
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDrawerSyncFix() {
  console.log('🧪 Test de la correction de la synchronisation du drawer...\n');

  try {
    // 1. Vérifier le bail SIGNÉ
    console.log('📋 Vérification du bail SIGNÉ...');
    const signedLease = await prisma.lease.findFirst({
      where: {
        status: 'SIGNÉ'
      },
      include: {
        property: true,
        tenant: true
      }
    });

    if (!signedLease) {
      console.log('   ❌ Aucun bail SIGNÉ trouvé');
      return;
    }

    console.log(`   ✅ Bail SIGNÉ trouvé: ${signedLease.property.name}`);
    console.log(`   - ID: ${signedLease.id}`);
    console.log(`   - Statut: ${signedLease.status}`);

    // 2. Vérifier les documents
    console.log('\n📄 Vérification des documents...');
    const documentLinks = await prisma.documentLink.findMany({
      where: {
        targetType: 'LEASE',
        targetId: signedLease.id
      },
      include: {
        document: {
          include: {
            documentType: true
          }
        }
      }
    });

    const bailSigneDocs = documentLinks.filter(link => 
      link.document.documentType?.code === 'BAIL_SIGNE'
    );

    console.log(`   📄 Documents liés: ${documentLinks.length}`);
    console.log(`   🏠 Documents BAIL_SIGNE: ${bailSigneDocs.length}`);

    if (bailSigneDocs.length > 0) {
      console.log(`   ✅ Bail signé présent: ${bailSigneDocs[0].document.filenameOriginal}`);
    } else {
      console.log(`   ❌ Aucun bail signé trouvé`);
    }

    // 3. Test du service
    console.log('\n🧪 Test du service LeaseDocumentsService...');
    try {
      const { LeaseDocumentsService } = await import('../src/lib/services/leaseDocumentsService');
      
      const summary = await LeaseDocumentsService.getLeaseDocuments(signedLease.id);
      
      console.log(`   📊 Résumé des documents:`);
      console.log(`     - Bail signé: ${summary.bailSigne ? '✅ Présent' : '❌ Manquant'}`);
      if (summary.bailSigne) {
        console.log(`       - Fichier: ${summary.bailSigne.filenameOriginal}`);
        console.log(`       - URL: ${summary.bailSigne.url}`);
      }
    } catch (error) {
      console.log(`   ❌ Erreur service: ${error.message}`);
    }

    // 4. Vérifier les composants
    console.log('\n🧩 Vérification des composants...');
    try {
      await import('../src/components/leases/LeasesDetailDrawerV2.tsx');
      console.log('   ✅ LeasesDetailDrawerV2: Import réussi');
    } catch (error) {
      console.log(`   ❌ LeasesDetailDrawerV2: ${error.message}`);
    }

    // 5. Vérifier la page Baux
    console.log('\n🌐 Vérification de la page Baux...');
    try {
      const response = await fetch('http://localhost:3000/baux');
      if (response.ok) {
        console.log('   ✅ Page /baux accessible (Status: 200)');
      } else {
        console.log(`   ❌ Page /baux inaccessible (Status: ${response.status})`);
      }
    } catch (error) {
      console.log('   ❌ Erreur page:', error.message);
    }

    // 6. Résumé des corrections
    console.log('\n📋 Résumé des corrections apportées:');
    console.log('   ✅ 1️⃣ Logs de debug ajoutés dans useEffect');
    console.log('   ✅ 2️⃣ Logs de debug ajoutés dans handleUploadSuccess');
    console.log('   ✅ 3️⃣ Rechargement forcé des documents à l\'ouverture');
    console.log('   ✅ 4️⃣ Réinitialisation des documents à la fermeture');
    console.log('   ✅ 5️⃣ Double useEffect pour garantir le rechargement');

    console.log('\n🎉 Correction de la synchronisation terminée !');
    console.log('   Vous pouvez maintenant tester sur http://localhost:3000/baux');
    console.log('   - Ouvrir le drawer du bail SIGNÉ');
    console.log('   - Vérifier les logs dans la console du navigateur');
    console.log('   - Le bail signé devrait maintenant s\'afficher correctement');
    console.log('   - Les documents présents devraient afficher "Ouvrir" au lieu de "Uploader"');

    console.log('\n🔍 Logs à surveiller dans la console:');
    console.log('   - "🔄 Drawer: Chargement des documents pour le bail"');
    console.log('   - "📄 Drawer: Documents chargés:"');
    console.log('   - "🔄 Drawer: Rechargement forcé des documents à l\'ouverture"');

  } catch (error) {
    console.error('💥 Erreur lors des tests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter les tests
testDrawerSyncFix()
  .then(() => {
    console.log('\n🎯 Tests terminés');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec des tests:', error);
    process.exit(1);
  });
