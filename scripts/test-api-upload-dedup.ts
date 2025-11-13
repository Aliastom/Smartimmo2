#!/usr/bin/env npx tsx

/**
 * Test de l'API /api/documents/upload avec détection de doublons
 * 
 * Ce script teste l'API réelle pour s'assurer qu'elle retourne
 * correctement les données de détection de doublons.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function testApiUploadDedup() {
  console.log('🧪 Test de l\'API /api/documents/upload avec détection de doublons...\n');

  try {
    // 1. Créer un document de test existant
    console.log('📄 Création d\'un document de test existant...');
    
    const existingDocument = await prisma.document.create({
      data: {
        bucketKey: 'test/quittance_test_api.pdf',
        filenameOriginal: 'quittance_test_api.pdf',
        fileName: 'quittance_test_api.pdf',
        mime: 'application/pdf',
        size: 1024,
        sha256: 'test_sha256_api_123456789',
        url: '/uploads/test/quittance_test_api.pdf',
        extractedText: 'QUITTANCE DE LOYER\nMois: Janvier 2025\nMontant: 800€',
        metadata: JSON.stringify({
          source: 'upload',
          extractedFields: {
            type: 'QUITTANCE',
            month: 'Janvier',
            year: '2025',
            amount: '800€'
          }
        })
      }
    });

    // Créer un lien GLOBAL pour ce document
    await prisma.documentLink.create({
      data: {
        documentId: existingDocument.id,
        targetType: 'GLOBAL',
        targetId: null,
        role: 'PRIMARY',
        entityName: 'Global'
      }
    });

    console.log(`✅ Document existant créé: ${existingDocument.id}`);

    // 2. Créer un fichier temporaire pour le test
    console.log('\n📁 Création d\'un fichier temporaire pour le test...');
    
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const testFilePath = path.join(tempDir, 'quittance_test_api.pdf');
    const testContent = 'QUITTANCE DE LOYER\nMois: Janvier 2025\nMontant: 800€';
    fs.writeFileSync(testFilePath, testContent);
    
    console.log(`✅ Fichier temporaire créé: ${testFilePath}`);

    // 3. Tester l'API avec un fichier doublon
    console.log('\n🌐 Test de l\'API /api/documents/upload...');
    
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath), {
      filename: 'quittance_test_api.pdf',
      contentType: 'application/pdf'
    });

    try {
      const response = await fetch('http://localhost:3000/api/documents/upload', {
        method: 'POST',
        body: formData,
        headers: {
          ...formData.getHeaders(),
        },
      });

      const result = await response.json();
      
      console.log('📊 Réponse de l\'API:');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Success: ${result.success}`);
      
      if (result.success && result.data) {
        const data = result.data;
        console.log(`   - Temp ID: ${data.tempId}`);
        console.log(`   - Filename: ${data.filename}`);
        console.log(`   - SHA256: ${data.sha256}`);
        console.log(`   - Size: ${data.size}`);
        
        if (data.dedupResult) {
          console.log(`   - DedupResult:`);
          console.log(`     * duplicateType: ${data.dedupResult.duplicateType}`);
          console.log(`     * suggestedAction: ${data.dedupResult.suggestedAction}`);
          console.log(`     * isDuplicate: ${data.dedupResult.isDuplicate}`);
          
          if (data.dedupResult.matchedDocument) {
            console.log(`     * matchedDocument: ${data.dedupResult.matchedDocument.name}`);
            console.log(`     * matchedDocument ID: ${data.dedupResult.matchedDocument.id}`);
          }
          
          if (data.dedupResult.signals) {
            console.log(`     * signals:`, data.dedupResult.signals);
          }
        } else {
          console.log(`   - DedupResult: undefined`);
        }
        
        // Vérifier la structure attendue
        const hasDedupResult = !!data.dedupResult;
        const hasCorrectStructure = hasDedupResult && 
          typeof data.dedupResult.duplicateType === 'string' &&
          typeof data.dedupResult.suggestedAction === 'string' &&
          typeof data.dedupResult.isDuplicate === 'boolean';
        
        console.log('\n🔍 Vérification de la structure:');
        console.log(`   - DedupResult présent: ${hasDedupResult}`);
        console.log(`   - Structure correcte: ${hasCorrectStructure}`);
        
        if (hasDedupResult && hasCorrectStructure) {
          console.log('\n✅ L\'API retourne correctement les données de détection de doublons !');
        } else {
          console.log('\n❌ L\'API ne retourne pas les données de détection de doublons correctement.');
        }
        
      } else {
        console.log(`   - Error: ${result.error || 'Erreur inconnue'}`);
        console.log('\n❌ L\'API a retourné une erreur.');
      }
      
    } catch (fetchError) {
      console.log(`❌ Erreur lors de l'appel à l'API: ${fetchError.message}`);
      console.log('   Assurez-vous que le serveur de développement est démarré (npm run dev)');
    }

  } catch (error) {
    console.error('💥 Erreur lors du test:', error);
  } finally {
    // Nettoyage
    console.log('\n🧹 Nettoyage des données de test...');
    
    // Supprimer le fichier temporaire
    const tempDir = path.join(process.cwd(), 'temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('✅ Fichier temporaire supprimé');
    }
    
    // Supprimer les données de test de la base
    await prisma.documentLink.deleteMany({
      where: {
        document: {
          fileName: {
            contains: 'quittance_test_api'
          }
        }
      }
    });
    
    await prisma.document.deleteMany({
      where: {
        fileName: {
          contains: 'quittance_test_api'
        }
      }
    });
    
    console.log('✅ Données de test supprimées');
    await prisma.$disconnect();
  }
}

// Exécuter le test
testApiUploadDedup()
  .then(() => {
    console.log('\n🎯 Test terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test:', error);
    process.exit(1);
  });
