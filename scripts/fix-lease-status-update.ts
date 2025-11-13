#!/usr/bin/env npx tsx

/**
 * Script pour corriger définitivement le problème de mise à jour du statut du bail
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixLeaseStatusUpdate() {
  console.log('🔧 Correction du problème de mise à jour du statut du bail\n');

  try {
    // 1. Trouver tous les baux avec statut "ENVOYÉ" qui ont des documents BAIL_SIGNE
    console.log('🔍 Recherche des baux avec documents BAIL_SIGNE mais statut incorrect...');
    
    const leasesWithBailSigne = await prisma.lease.findMany({
      where: { status: 'ENVOYÉ' },
      include: {
        tenant: true,
        property: true
      }
    });

    console.log(`📋 ${leasesWithBailSigne.length} baux avec statut "ENVOYÉ" trouvés`);

    for (const lease of leasesWithBailSigne) {
      console.log(`\n📄 Bail: ${lease.id}`);
      console.log(`   Statut: ${lease.status}`);
      console.log(`   Locataire: ${lease.tenant?.firstName} ${lease.tenant?.lastName}`);
      console.log(`   Propriété: ${lease.property?.name}`);

      // 2. Vérifier s'il y a des documents BAIL_SIGNE liés
      const bailSigneDocuments = await prisma.document.findMany({
        where: {
          documentType: {
            code: 'BAIL_SIGNE'
          },
          links: {
            some: {
              targetType: 'LEASE',
              targetId: lease.id
            }
          }
        },
        include: {
          documentType: true
        }
      });

      console.log(`   Documents BAIL_SIGNE liés: ${bailSigneDocuments.length}`);

      if (bailSigneDocuments.length > 0) {
        console.log('   ✅ Documents BAIL_SIGNE trouvés - Correction nécessaire');
        
        // 3. Corriger le statut du bail
        const updatedLease = await prisma.lease.update({
          where: { id: lease.id },
          data: {
            status: 'SIGNÉ',
            signedPdfUrl: bailSigneDocuments[0].url,
            updatedAt: new Date()
          }
        });

        console.log(`   🔧 Statut corrigé: ${updatedLease.status}`);
        console.log(`   🔧 signedPdfUrl: ${updatedLease.signedPdfUrl}`);
      } else {
        console.log('   ℹ️  Aucun document BAIL_SIGNE - Statut correct');
      }
    }

    // 4. Vérifier la logique de l'API de finalisation
    console.log('\n🔍 Vérification de la logique de l\'API de finalisation...');
    
    // Lire le fichier de l'API
    const fs = require('fs');
    const path = require('path');
    
    const apiPath = path.join(process.cwd(), 'src/app/api/documents/finalize/route.ts');
    const apiContent = fs.readFileSync(apiPath, 'utf8');
    
    // Vérifier si la logique de mise à jour est présente
    if (apiContent.includes('BAIL_SIGNE') && apiContent.includes('status: \'SIGNÉ\'')) {
      console.log('   ✅ Logique de mise à jour présente dans l\'API');
    } else {
      console.log('   ❌ Logique de mise à jour manquante dans l\'API');
    }

    // 5. Créer un script de test pour vérifier le workflow
    console.log('\n🧪 Création d\'un script de test pour le workflow...');
    
    const testScript = `
// Test du workflow BAIL_SIGNE
console.log('🧪 Test du workflow BAIL_SIGNE');

// Simuler l'upload d'un document BAIL_SIGNE
const testUpload = async () => {
  const response = await fetch('/api/documents/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tempId: 'test-temp-id',
      typeCode: 'BAIL_SIGNE',
      chosenTypeId: 'BAIL_SIGNE',
      predictions: [],
      ocrText: '',
      context: {
        entityType: 'LEASE',
        entityId: '${leasesWithBailSigne[0]?.id || 'test-lease-id'}'
      },
      customName: undefined,
      replaceDuplicateId: undefined,
      keepDuplicate: false,
      userReason: undefined,
      pendingClientId: undefined
    })
  });
  
  const result = await response.json();
  console.log('Résultat:', result);
};

// Exécuter le test
testUpload();
`;

    const testScriptPath = path.join(process.cwd(), 'scripts/test-workflow-browser.js');
    fs.writeFileSync(testScriptPath, testScript);
    
    console.log(`   ✅ Script de test créé: ${testScriptPath}`);
    console.log('   📋 Instructions:');
    console.log('      1. Ouvrez la console du navigateur (F12)');
    console.log('      2. Copiez-collez le contenu du script de test');
    console.log('      3. Exécutez-le pour tester l\'API directement');

    console.log('\n🎯 Résumé des corrections:');
    console.log(`   - ${leasesWithBailSigne.length} baux vérifiés`);
    console.log('   - Logique de l\'API vérifiée');
    console.log('   - Script de test créé');

  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixLeaseStatusUpdate();
