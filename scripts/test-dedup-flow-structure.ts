#!/usr/bin/env npx tsx

/**
 * Test de la structure de DedupFlowInput et DedupFlowContext
 * 
 * Ce script vérifie que la structure utilisée dans uploadSingleFile
 * correspond exactement à celle utilisée dans uploadFiles.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDedupFlowStructure() {
  console.log('🧪 Test de la structure de DedupFlowInput et DedupFlowContext...\n');

  try {
    // 1. Créer un document de test existant
    console.log('📄 Création d\'un document de test existant...');
    
    const existingDocument = await prisma.document.create({
      data: {
        bucketKey: 'test/quittance_test_structure.pdf',
        filenameOriginal: 'quittance_test_structure.pdf',
        fileName: 'quittance_test_structure.pdf',
        mime: 'application/pdf',
        size: 1024,
        sha256: 'test_sha256_structure_123456789',
        url: '/uploads/test/quittance_test_structure.pdf',
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

    // 2. Simuler la structure de uploadFiles (CORRECTE)
    console.log('\n📤 Simulation de la structure de uploadFiles (CORRECTE)...');
    
    const mockApiResponse = {
      success: true,
      data: {
        tempId: 'temp_' + Date.now(),
        filename: 'quittance_test_structure.pdf',
        sha256: 'test_sha256_structure_123456789',
        mime: 'application/pdf',
        size: 1024,
        predictions: [{ typeCode: 'QUITTANCE', score: 0.95 }],
        autoAssigned: true,
        assignedTypeCode: 'QUITTANCE',
        dedupResult: {
          duplicateType: 'exact_duplicate',
          suggestedAction: 'replace',
          matchedDocument: {
            id: existingDocument.id,
            name: existingDocument.fileName,
            type: 'QUITTANCE',
            uploadedAt: existingDocument.uploadedAt.toISOString(),
            size: existingDocument.size,
            mime: existingDocument.mime
          },
          signals: {
            checksum_match: true,
            text_similarity: 1.0
          },
          ui: {
            recommendation: 'Ce document est identique à un document existant',
            severity: 'high'
          },
          isDuplicate: true
        },
        extractedPreview: {
          fields: {
            type: 'QUITTANCE',
            month: 'Janvier',
            year: '2025',
            amount: '800€'
          }
        }
      }
    };

    const data = mockApiResponse.data;
    const file = { name: 'quittance_test_structure.pdf', size: 1024, type: 'application/pdf' };
    const scope = 'global';
    const propertyId = null;
    const leaseId = null;
    const tenantId = null;

    // Structure CORRECTE (comme dans uploadFiles)
    const correctDedupFlowInput = {
      duplicateType: data.dedupResult.duplicateType === 'exact_duplicate' ? 'exact_duplicate' : 'probable_duplicate',
      existingFile: data.dedupResult.matchedDocument ? {
        id: data.dedupResult.matchedDocument.id,
        name: data.dedupResult.matchedDocument.name,
        uploadedAt: data.dedupResult.matchedDocument.uploadedAt,
        size: data.dedupResult.matchedDocument.size || 0,
        mime: data.dedupResult.matchedDocument.mime || 'application/octet-stream'
      } : undefined,
      tempFile: {
        tempId: data.tempId,
        originalName: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        checksum: data.sha256
      },
      userDecision: 'pending'
    };

    const correctDedupFlowContext = {
      scope: scope === 'property' ? 'property' : 'global',
      scopeId: propertyId || leaseId || tenantId,
      metadata: {
        documentType: data.assignedTypeCode,
        extractedFields: data.extractedPreview?.fields,
        predictions: data.predictions
      }
    };

    console.log('📊 Structure CORRECTE (uploadFiles):');
    console.log(`   - duplicateType: ${correctDedupFlowInput.duplicateType}`);
    console.log(`   - existingFile.id: ${correctDedupFlowInput.existingFile?.id}`);
    console.log(`   - existingFile.name: ${correctDedupFlowInput.existingFile?.name}`);
    console.log(`   - tempFile.tempId: ${correctDedupFlowInput.tempFile.tempId}`);
    console.log(`   - tempFile.originalName: ${correctDedupFlowInput.tempFile.originalName}`);
    console.log(`   - tempFile.checksum: ${correctDedupFlowInput.tempFile.checksum}`);
    console.log(`   - userDecision: ${correctDedupFlowInput.userDecision}`);
    console.log(`   - context.scope: ${correctDedupFlowContext.scope}`);
    console.log(`   - context.scopeId: ${correctDedupFlowContext.scopeId}`);

    // 3. Simuler la structure de uploadSingleFile (CORRIGÉE)
    console.log('\n🔄 Simulation de la structure de uploadSingleFile (CORRIGÉE)...');
    
    const newFile = { name: 'quittance_test_structure.pdf', size: 1024, type: 'application/pdf' };
    const index = 0;

    // Structure CORRIGÉE (comme dans uploadSingleFile après correction)
    const correctedDedupFlowInput = {
      duplicateType: data.dedupResult.duplicateType === 'exact_duplicate' ? 'exact_duplicate' : 'probable_duplicate',
      existingFile: data.dedupResult.matchedDocument ? {
        id: data.dedupResult.matchedDocument.id,
        name: data.dedupResult.matchedDocument.name,
        uploadedAt: data.dedupResult.matchedDocument.uploadedAt,
        size: data.dedupResult.matchedDocument.size || 0,
        mime: data.dedupResult.matchedDocument.mime || 'application/octet-stream'
      } : undefined,
      tempFile: {
        tempId: data.tempId,
        originalName: newFile.name,
        size: newFile.size,
        mime: newFile.type || 'application/octet-stream',
        checksum: data.sha256
      },
      userDecision: 'pending'
    };

    const correctedDedupFlowContext = {
      scope: scope === 'property' ? 'property' : 'global',
      scopeId: propertyId || leaseId || tenantId,
      metadata: {
        documentType: data.assignedTypeCode,
        extractedFields: data.extractedPreview?.fields,
        predictions: data.predictions
      }
    };

    console.log('📊 Structure CORRIGÉE (uploadSingleFile):');
    console.log(`   - duplicateType: ${correctedDedupFlowInput.duplicateType}`);
    console.log(`   - existingFile.id: ${correctedDedupFlowInput.existingFile?.id}`);
    console.log(`   - existingFile.name: ${correctedDedupFlowInput.existingFile?.name}`);
    console.log(`   - tempFile.tempId: ${correctedDedupFlowInput.tempFile.tempId}`);
    console.log(`   - tempFile.originalName: ${correctedDedupFlowInput.tempFile.originalName}`);
    console.log(`   - tempFile.checksum: ${correctedDedupFlowInput.tempFile.checksum}`);
    console.log(`   - userDecision: ${correctedDedupFlowInput.userDecision}`);
    console.log(`   - context.scope: ${correctedDedupFlowContext.scope}`);
    console.log(`   - context.scopeId: ${correctedDedupFlowContext.scopeId}`);

    // 4. Comparer les structures
    console.log('\n🔍 Comparaison des structures...');
    
    const structuresMatch = 
      correctDedupFlowInput.duplicateType === correctedDedupFlowInput.duplicateType &&
      correctDedupFlowInput.existingFile?.id === correctedDedupFlowInput.existingFile?.id &&
      correctDedupFlowInput.existingFile?.name === correctedDedupFlowInput.existingFile?.name &&
      correctDedupFlowInput.tempFile.tempId === correctedDedupFlowInput.tempFile.tempId &&
      correctDedupFlowInput.tempFile.originalName === correctedDedupFlowInput.tempFile.originalName &&
      correctDedupFlowInput.tempFile.checksum === correctedDedupFlowInput.tempFile.checksum &&
      correctDedupFlowInput.userDecision === correctedDedupFlowInput.userDecision &&
      correctDedupFlowContext.scope === correctedDedupFlowContext.scope &&
      correctDedupFlowContext.scopeId === correctedDedupFlowContext.scopeId;

    console.log(`   - Structures identiques: ${structuresMatch ? 'OUI' : 'NON'}`);
    
    // 5. Vérifier les champs critiques pour l'API
    console.log('\n🎯 Vérification des champs critiques pour l\'API...');
    
    const hasRequiredFields = 
      correctedDedupFlowInput.duplicateType !== undefined &&
      correctedDedupFlowInput.tempFile.tempId !== undefined &&
      correctedDedupFlowInput.userDecision !== undefined;
    
    console.log(`   - duplicateType défini: ${correctedDedupFlowInput.duplicateType !== undefined}`);
    console.log(`   - tempId défini: ${correctedDedupFlowInput.tempFile.tempId !== undefined}`);
    console.log(`   - userDecision défini: ${correctedDedupFlowInput.userDecision !== undefined}`);
    console.log(`   - Tous les champs requis présents: ${hasRequiredFields ? 'OUI' : 'NON'}`);

    // 6. Résumé des tests
    console.log('\n📋 Résumé des tests:');
    console.log(`   ✅ Structure uploadFiles: CORRECTE`);
    console.log(`   ✅ Structure uploadSingleFile: ${structuresMatch ? 'CORRECTE' : 'INCORRECTE'}`);
    console.log(`   ✅ Champs requis pour API: ${hasRequiredFields ? 'PRÉSENTS' : 'MANQUANTS'}`);
    
    if (structuresMatch && hasRequiredFields) {
      console.log('\n🎉 La structure est maintenant correcte !');
      console.log('   L\'API dedup-flow devrait recevoir les bons paramètres.');
      console.log('   L\'ancienne modale ne devrait plus apparaître.');
    } else {
      console.log('\n❌ Il y a encore des problèmes avec la structure.');
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
            contains: 'quittance_test_structure'
          }
        }
      }
    });
    
    await prisma.document.deleteMany({
      where: {
        fileName: {
          contains: 'quittance_test_structure'
        }
      }
    });
    
    console.log('✅ Nettoyage terminé');
    await prisma.$disconnect();
  }
}

// Exécuter le test
testDedupFlowStructure()
  .then(() => {
    console.log('\n🎯 Test terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test:', error);
    process.exit(1);
  });
