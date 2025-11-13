#!/usr/bin/env npx tsx

/**
 * Script pour tester directement l'API de finalisation
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testFinalizeApiDirect() {
  console.log('🧪 Test direct de l\'API de finalisation\n');

  try {
    // 1. Créer un document temporaire de test
    console.log('📄 Création d\'un document temporaire de test...');
    
    const testDocument = await prisma.document.create({
      data: {
        filenameOriginal: 'test-bail-signe-api.pdf',
        fileName: 'test-bail-signe-api.pdf',
        url: '/uploads/test-bail-signe-api.pdf',
        size: 1024,
        mime: 'application/pdf',
        sha256: 'test-hash-api',
        bucketKey: '/uploads/test-bail-signe-api.pdf',
        status: 'classified',
        source: 'upload',
        uploadedAt: new Date(),
        documentType: {
          connect: {
            code: 'BAIL_SIGNE'
          }
        }
      },
      include: {
        documentType: true
      }
    });

    console.log(`✅ Document créé: ${testDocument.id}`);
    console.log(`   Type: ${testDocument.documentType?.code}`);

    // 2. Récupérer un bail de test
    const testLease = await prisma.lease.findFirst({
      where: { status: 'ENVOYÉ' },
      include: {
        tenant: true,
        property: true
      }
    });

    if (!testLease) {
      console.log('❌ Aucun bail ENVOYÉ trouvé');
      return;
    }

    console.log(`✅ Bail de test: ${testLease.id}`);
    console.log(`   Statut: ${testLease.status}`);

    // 3. Tester l'API de finalisation directement
    console.log('\n🔧 Test de l\'API de finalisation...');
    
    const response = await fetch('http://localhost:3000/api/documents/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempId: 'test-temp-id-' + Date.now(),
        typeCode: 'BAIL_SIGNE',
        chosenTypeId: 'BAIL_SIGNE',
        predictions: [],
        ocrText: '',
        context: {
          entityType: 'LEASE',
          entityId: testLease.id
        },
        customName: undefined,
        replaceDuplicateId: undefined,
        keepDuplicate: false,
        userReason: undefined,
        pendingClientId: undefined
      })
    });

    console.log(`   Status: ${response.status}`);
    console.log(`   Status Text: ${response.statusText}`);

    const result = await response.json();
    console.log('   Response:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ API appelée avec succès');
      
      if (result.success) {
        console.log(`✅ Document créé: ${result.documentId}`);
        
        // Vérifier si le bail a été mis à jour
        const updatedLease = await prisma.lease.findUnique({
          where: { id: testLease.id }
        });

        if (updatedLease) {
          console.log(`   Statut du bail: ${updatedLease.status}`);
          console.log(`   signedPdfUrl: ${updatedLease.signedPdfUrl || 'Aucune'}`);
          
          if (updatedLease.status === 'SIGNÉ' && updatedLease.signedPdfUrl) {
            console.log('✅ Le bail a été mis à jour correctement !');
          } else {
            console.log('❌ Le bail n\'a pas été mis à jour');
          }
        }
      } else {
        console.log(`❌ Erreur: ${result.error}`);
      }
    } else {
      console.log('❌ Erreur HTTP:', response.status);
    }

    // 4. Nettoyer les données de test
    console.log('\n🧹 Nettoyage des données de test...');
    await prisma.document.delete({ where: { id: testDocument.id } });
    console.log('✅ Données de test supprimées');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFinalizeApiDirect();