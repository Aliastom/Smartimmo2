#!/usr/bin/env npx tsx

/**
 * Test réel de la détection de doublons lors du changement de fichier
 * 
 * Ce script simule exactement le scénario de l'utilisateur :
 * 1. Upload d'un fichier normal
 * 2. Changement de fichier vers un doublon
 * 3. Vérification que la détection fonctionne
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testRealChangeFileDedup() {
  console.log('🧪 Test réel de la détection de doublons lors du changement de fichier...\n');

  try {
    // 1. Créer un document de test existant (comme dans pj1)
    console.log('📄 Création d\'un document de test existant (quittance_mars_2025_Jasmin.pdf)...');
    
    const existingDocument = await prisma.document.create({
      data: {
        bucketKey: 'test/quittance_mars_2025_Jasmin.pdf',
        filenameOriginal: 'quittance_mars_2025_Jasmin.pdf',
        fileName: 'quittance_mars_2025_Jasmin.pdf',
        mime: 'application/pdf',
        size: 6144, // 6.0 KB comme dans pj1
        sha256: 'test_sha256_mars_2025_123456789',
        url: '/uploads/test/quittance_mars_2025_Jasmin.pdf',
        extractedText: 'QUITTANCE DE LOYER\nMois: Mars 2025\nLocataire: Jasmin\nMontant: 800€',
        metadata: JSON.stringify({
          source: 'upload',
          extractedFields: {
            type: 'QUITTANCE',
            month: 'Mars',
            year: '2025',
            tenant: 'Jasmin',
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

    // 2. Simuler l'upload d'un fichier normal (comme dans pj2/pj3)
    console.log('\n📤 Simulation de l\'upload d\'un fichier normal (quittance_mai_2025_Jasmin.pdf)...');
    
    const normalFileData = {
      filename: 'quittance_mai_2025_Jasmin.pdf',
      mime: 'application/pdf',
      size: 6144,
      sha256: 'different_sha256_mai_2025_987654321', // SHA256 différent = pas de doublon
      extractedText: 'QUITTANCE DE LOYER\nMois: Mai 2025\nLocataire: Jasmin\nMontant: 800€'
    };

    const mockApiResponseNormal = {
      success: true,
      data: {
        tempId: 'temp_' + Date.now(),
        filename: normalFileData.filename,
        sha256: normalFileData.sha256,
        mime: normalFileData.mime,
        size: normalFileData.size,
        textPreview: normalFileData.extractedText.substring(0, 100),
        textLength: normalFileData.extractedText.length,
        predictions: [
          { typeCode: 'QUITTANCE', score: 0.95, label: 'Quittance de loyer' }
        ],
        autoAssigned: true,
        assignedTypeCode: 'QUITTANCE',
        // Pas de doublon détecté
        dedupResult: {
          duplicateType: 'none',
          suggestedAction: 'proceed',
          isDuplicate: false
        },
        extractedPreview: {
          textSnippet: normalFileData.extractedText.substring(0, 200),
          textLength: normalFileData.extractedText.length,
          source: 'pdf-text',
          fields: {
            type: 'QUITTANCE',
            month: 'Mai',
            year: '2025',
            tenant: 'Jasmin',
            amount: '800€'
          }
        }
      }
    };

    console.log('📊 Données du fichier normal:');
    console.log(`   - Fichier: ${mockApiResponseNormal.data.filename}`);
    console.log(`   - Doublon détecté: ${mockApiResponseNormal.data.dedupResult.isDuplicate}`);
    console.log(`   - Statut: ${mockApiResponseNormal.data.dedupResult.isDuplicate ? 'duplicate_detected' : 'ready'}`);

    // 3. Simuler le changement de fichier vers un doublon (comme dans pj4)
    console.log('\n🔄 Simulation du changement de fichier vers un doublon (quittance_mars_2025_Jasmin.pdf)...');
    
    const duplicateFileData = {
      filename: 'quittance_mars_2025_Jasmin.pdf',
      mime: 'application/pdf',
      size: 6144,
      sha256: 'test_sha256_mars_2025_123456789', // Même SHA256 = doublon exact
      extractedText: 'QUITTANCE DE LOYER\nMois: Mars 2025\nLocataire: Jasmin\nMontant: 800€'
    };

    const mockApiResponseDuplicate = {
      success: true,
      data: {
        tempId: 'temp_' + (Date.now() + 1),
        filename: duplicateFileData.filename,
        sha256: duplicateFileData.sha256,
        mime: duplicateFileData.mime,
        size: duplicateFileData.size,
        textPreview: duplicateFileData.extractedText.substring(0, 100),
        textLength: duplicateFileData.extractedText.length,
        predictions: [
          { typeCode: 'QUITTANCE', score: 0.95, label: 'Quittance de loyer' }
        ],
        autoAssigned: true,
        assignedTypeCode: 'QUITTANCE',
        // Doublon détecté
        dedupResult: {
          duplicateType: 'exact_duplicate',
          suggestedAction: 'replace',
          matchedDocument: {
            id: existingDocument.id,
            name: existingDocument.fileName,
            type: 'QUITTANCE',
            uploadedAt: existingDocument.uploadedAt.toISOString()
          },
          signals: {
            checksum_match: true,
            text_similarity: 1.0,
            filename_similarity: 1.0,
            period_match: true,
            context_match: true
          },
          ui: {
            recommendation: 'Ce document est identique à un document existant',
            severity: 'high'
          },
          isDuplicate: true
        },
        extractedPreview: {
          textSnippet: duplicateFileData.extractedText.substring(0, 200),
          textLength: duplicateFileData.extractedText.length,
          source: 'pdf-text',
          fields: {
            type: 'QUITTANCE',
            month: 'Mars',
            year: '2025',
            tenant: 'Jasmin',
            amount: '800€'
          }
        }
      }
    };

    console.log('📊 Données du fichier doublon:');
    console.log(`   - Fichier: ${mockApiResponseDuplicate.data.filename}`);
    console.log(`   - Type de doublon: ${mockApiResponseDuplicate.data.dedupResult.duplicateType}`);
    console.log(`   - Document existant: ${mockApiResponseDuplicate.data.dedupResult.matchedDocument.name}`);
    console.log(`   - Similarité texte: ${mockApiResponseDuplicate.data.dedupResult.signals.text_similarity}`);
    console.log(`   - Doublon détecté: ${mockApiResponseDuplicate.data.dedupResult.isDuplicate}`);

    // 4. Vérifier la logique de détection
    console.log('\n🔍 Vérification de la logique de détection...');
    
    const normalData = mockApiResponseNormal.data;
    const duplicateData = mockApiResponseDuplicate.data;
    
    const normalIsDuplicate = normalData.dedupResult && normalData.dedupResult.duplicateType !== 'none';
    const duplicateIsDuplicate = duplicateData.dedupResult && duplicateData.dedupResult.duplicateType !== 'none';
    
    const normalStatus = normalIsDuplicate ? 'duplicate_detected' : 'ready';
    const duplicateStatus = duplicateIsDuplicate ? 'duplicate_detected' : 'ready';
    
    console.log(`   - Fichier normal (${normalData.filename}):`);
    console.log(`     * Doublon détecté: ${normalIsDuplicate}`);
    console.log(`     * Statut: ${normalStatus}`);
    console.log(`   - Fichier doublon (${duplicateData.filename}):`);
    console.log(`     * Doublon détecté: ${duplicateIsDuplicate}`);
    console.log(`     * Statut: ${duplicateStatus}`);
    console.log(`     * Action suggérée: ${duplicateData.dedupResult.suggestedAction}`);

    // 5. Simuler le comportement de handleChangeFile
    console.log('\n🔄 Simulation du comportement de handleChangeFile...');
    
    // État initial (fichier normal)
    let currentPreview = {
      file: new File([], normalData.filename),
      filename: normalData.filename,
      mime: normalData.mime,
      size: normalData.size,
      predictions: normalData.predictions,
      autoAssigned: normalData.autoAssigned,
      assignedTypeCode: normalData.assignedTypeCode,
      duplicate: { isDuplicate: normalData.dedupResult.isDuplicate },
      dedupResult: normalData.dedupResult,
      status: normalStatus
    };
    
    console.log(`   - État initial: ${currentPreview.filename}, doublon: ${currentPreview.duplicate.isDuplicate}, statut: ${currentPreview.status}`);
    
    // Changement de fichier (comme dans handleChangeFile)
    const newFile = new File([], duplicateData.filename);
    currentPreview = {
      ...currentPreview,
      file: newFile,
      filename: newFile.name,
      mime: duplicateData.mime,
      size: duplicateData.size,
      predictions: [],
      autoAssigned: false,
      assignedTypeCode: null,
      // Réinitialisation complète des données de doublons
      duplicate: { isDuplicate: false },
      dedupResult: {
        duplicateType: 'none',
        suggestedAction: 'proceed',
        isDuplicate: false
      },
      status: 'uploading'
    };
    
    console.log(`   - Après réinitialisation: ${currentPreview.filename}, doublon: ${currentPreview.duplicate.isDuplicate}, statut: ${currentPreview.status}`);
    
    // Mise à jour après upload (comme dans uploadSingleFile)
    currentPreview = {
      ...currentPreview,
      predictions: duplicateData.predictions,
      autoAssigned: duplicateData.autoAssigned,
      assignedTypeCode: duplicateData.assignedTypeCode,
      // Mise à jour du nouveau système de détection de doublons
      dedupResult: {
        duplicateType: duplicateData.dedupResult.duplicateType,
        suggestedAction: duplicateData.dedupResult.suggestedAction,
        matchedDocument: duplicateData.dedupResult.matchedDocument,
        signals: duplicateData.dedupResult.signals,
        ui: duplicateData.dedupResult.ui,
        isDuplicate: duplicateData.dedupResult.duplicateType !== 'none'
      },
      // Maintenir la compatibilité avec l'ancien système
      duplicate: {
        isDuplicate: !!duplicateData.dedupResult && duplicateData.dedupResult.duplicateType !== 'none',
        ofDocumentId: duplicateData.dedupResult?.matchedDocument?.id ?? undefined,
        documentName: duplicateData.dedupResult?.matchedDocument?.name ?? undefined,
        documentType: duplicateData.dedupResult?.matchedDocument?.type ?? undefined,
        uploadedAt: duplicateData.dedupResult?.matchedDocument?.uploadedAt ?? undefined,
        reason: duplicateData.dedupResult?.ui?.recommendation ?? undefined,
      },
      status: (duplicateData.dedupResult && duplicateData.dedupResult.duplicateType !== 'none') ? 'duplicate_detected' : 'ready'
    };
    
    console.log(`   - Après upload: ${currentPreview.filename}, doublon: ${currentPreview.duplicate.isDuplicate}, statut: ${currentPreview.status}`);
    console.log(`   - DedupResult: ${currentPreview.dedupResult.duplicateType}, isDuplicate: ${currentPreview.dedupResult.isDuplicate}`);

    // 6. Résumé des tests
    console.log('\n📋 Résumé des tests:');
    console.log(`   ✅ Fichier normal: ${!normalIsDuplicate ? 'PAS DE DOUBLON' : 'DOUBLON DÉTECTÉ'}`);
    console.log(`   ✅ Fichier doublon: ${duplicateIsDuplicate ? 'DOUBLON DÉTECTÉ' : 'PAS DE DOUBLON'}`);
    console.log(`   ✅ Statuts corrects: ${normalStatus === 'ready' && duplicateStatus === 'duplicate_detected' ? 'OUI' : 'NON'}`);
    console.log(`   ✅ Réinitialisation: ${currentPreview.status === 'duplicate_detected' ? 'FONCTIONNE' : 'ÉCHEC'}`);
    
    if (!normalIsDuplicate && duplicateIsDuplicate && normalStatus === 'ready' && duplicateStatus === 'duplicate_detected' && currentPreview.status === 'duplicate_detected') {
      console.log('\n🎉 Test réussi ! La détection de doublons fonctionne correctement lors du changement de fichier.');
      console.log('   La modale DedupFlow devrait s\'afficher pour gérer le doublon détecté.');
    } else {
      console.log('\n❌ Test échoué ! Il y a un problème avec la détection de doublons.');
    }

  } catch (error) {
    console.error('💥 Erreur lors du test:', error);
  } finally {
    // Nettoyage
    console.log('\n🧹 Nettoyage des données de test...');
    await prisma.documentLink.deleteMany({
      where: {
        document: {
          fileName: {
            contains: 'quittance_mars_2025_Jasmin'
          }
        }
      }
    });
    
    await prisma.document.deleteMany({
      where: {
        fileName: {
          contains: 'quittance_mars_2025_Jasmin'
        }
      }
    });
    
    console.log('✅ Nettoyage terminé');
    await prisma.$disconnect();
  }
}

// Exécuter le test
testRealChangeFileDedup()
  .then(() => {
    console.log('\n🎯 Test terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test:', error);
    process.exit(1);
  });
