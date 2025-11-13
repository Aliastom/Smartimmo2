/**
 * Script de test pour valider l'extension des types de documents
 * Teste tous les cas d'usage mentionnés dans les exigences
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testDocumentTypesExtension() {
  console.log('🧪 Début des tests d\'acceptation pour l\'extension des types de documents\n');

  try {
    // Test 1: Créer un type custom "ID_DOC" avec metadataSchema
    console.log('📋 Test 1: Création d\'un type custom "ID_DOC" avec metadataSchema');
    
    const idDocType = await prisma.documentType.create({
      data: {
        code: 'ID_DOC',
        label: 'Pièce d\'identité',
        icon: 'Shield',
        isSystem: false,
        isActive: true,
        isSensitive: true,
        defaultContexts: JSON.stringify(['tenant', 'global']),
        lockInFlows: JSON.stringify([]),
        metadataSchema: JSON.stringify({
          type: 'object',
          properties: {
            side: {
              type: 'string',
              title: 'Face du document',
              description: 'Face avant ou arrière',
              enum: ['front', 'back']
            },
            country: {
              type: 'string',
              title: 'Pays d\'émission',
              description: 'Code pays ISO'
            },
            expires_at: {
              type: 'string',
              title: 'Date d\'expiration',
              format: 'date'
            },
            document_number: {
              type: 'string',
              title: 'Numéro du document',
              description: 'Numéro de série ou d\'identification'
            }
          },
          required: ['side', 'country', 'expires_at']
        }),
        suggestionConfig: JSON.stringify({
          rules: [
            {
              pattern: '(carte.*identit[ée]|passport|permis|pi[èe]ce.*identit[ée])',
              apply_in: ['tenant', 'global'],
              mime_in: ['image/*', 'application/pdf'],
              ocr_keywords: ['identité', 'passport', 'permis', 'carte nationale'],
              weight: 9,
              type_code: 'ID_DOC',
              lock: false
            }
          ],
          defaults_by_context: {
            tenant: 'ID_DOC',
            global: 'MISC'
          }
        })
      }
    });

    console.log('✅ Type ID_DOC créé avec succès');
    console.log(`   - ID: ${idDocType.id}`);
    console.log(`   - Sensible: ${idDocType.isSensitive}`);
    console.log(`   - Schéma métadonnées: ${idDocType.metadataSchema ? 'Défini' : 'Non défini'}`);

    // Test 2: Marquer "RENT_RECEIPT" avec lockInFlows
    console.log('\n🔒 Test 2: Ajout de verrous à RENT_RECEIPT');
    
    const rentReceiptType = await prisma.documentType.findFirst({
      where: { code: 'RENT_RECEIPT' }
    });

    if (rentReceiptType) {
      await prisma.documentType.update({
        where: { id: rentReceiptType.id },
        data: {
          lockInFlows: JSON.stringify(['rent_receipt_generation', 'payment_processing'])
        }
      });
      console.log('✅ Verrous ajoutés à RENT_RECEIPT');
      console.log('   - Flux verrouillés: rent_receipt_generation, payment_processing');
    } else {
      console.log('⚠️ Type RENT_RECEIPT non trouvé');
    }

    // Test 3: Ajouter des règles pour "TAX"
    console.log('\n📊 Test 3: Ajout de règles pour TAX');
    
    const taxType = await prisma.documentType.findFirst({
      where: { code: 'TAX' }
    });

    if (taxType) {
      await prisma.documentType.update({
        where: { id: taxType.id },
        data: {
          suggestionConfig: JSON.stringify({
            rules: [
              {
                pattern: '(avis.*imposition|taxe.*fonci[èe]re|imp[oô]ts?|fiscal|ifu)',
                apply_in: ['property', 'global'],
                mime_in: ['application/pdf'],
                ocr_keywords: ['avis d\'imposition', 'taxe foncière', 'impôt', 'fiscal', 'IFU'],
                weight: 10,
                type_code: 'TAX',
                lock: false
              }
            ],
            defaults_by_context: {
              property: 'TAX',
              global: 'MISC'
            }
          })
        }
      });
      console.log('✅ Règles ajoutées pour TAX');
    } else {
      console.log('⚠️ Type TAX non trouvé');
    }

    // Test 4: Tester la suggestion automatique
    console.log('\n🤖 Test 4: Test de la suggestion automatique');
    
    const testCases = [
      {
        filename: 'avis_impot_2024.pdf',
        mime: 'application/pdf',
        expectedType: 'TAX'
      },
      {
        filename: 'carte_identite_front.jpg',
        mime: 'image/jpeg',
        expectedType: 'ID_DOC'
      },
      {
        filename: 'quittance_octobre_2024.pdf',
        mime: 'application/pdf',
        expectedType: 'RENT_RECEIPT'
      }
    ];

    for (const testCase of testCases) {
      console.log(`   📄 Test: ${testCase.filename}`);
      
      // Simuler la suggestion (en utilisant le service)
      const { suggestTypeGlobal } = await import('../src/services/documentSuggestion.js');
      
      const activeTypes = await prisma.documentType.findMany({
        where: { isActive: true }
      });
      
      const parsedTypes = activeTypes.map(type => ({
        ...type,
        defaultContexts: type.defaultContexts ? JSON.parse(type.defaultContexts) : [],
        suggestionConfig: type.suggestionConfig ? JSON.parse(type.suggestionConfig) : null,
        lockInFlows: type.lockInFlows ? JSON.parse(type.lockInFlows) : [],
        metadataSchema: type.metadataSchema ? JSON.parse(type.metadataSchema) : null,
      }));

      const result = suggestTypeGlobal({
        context: 'global',
        filename: testCase.filename,
        mime: testCase.mime
      }, parsedTypes);

      const isCorrect = result.type_code === testCase.expectedType;
      console.log(`   ${isCorrect ? '✅' : '❌'} Résultat: ${result.type_code} (attendu: ${testCase.expectedType})`);
      console.log(`      Confiance: ${Math.round(result.confidence * 100)}%`);
      if (result.evidence.length > 0) {
        console.log(`      Évidence: ${result.evidence.join(', ')}`);
      }
    }

    // Test 5: Vérifier les protections système
    console.log('\n🛡️ Test 5: Vérification des protections système');
    
    const systemTypes = await prisma.documentType.findMany({
      where: { isSystem: true }
    });

    console.log(`   📊 Types système trouvés: ${systemTypes.length}`);
    for (const systemType of systemTypes) {
      console.log(`   - ${systemType.code}: ${systemType.label}`);
    }

    // Test 6: Vérifier les statistiques d'usage
    console.log('\n📈 Test 6: Vérification des statistiques d\'usage');
    
    for (const docType of [idDocType, rentReceiptType, taxType].filter(Boolean)) {
      const usage = await prisma.document.count({
        where: { documentTypeId: docType.id }
      });
      console.log(`   ${docType.code}: ${usage} document(s) utilisé(s)`);
    }

    // Test 7: Tester la suppression (doit échouer pour les types utilisés)
    console.log('\n🗑️ Test 7: Test de suppression');
    
    try {
      // Créer un document de test pour ID_DOC
      const testProperty = await prisma.property.findFirst();
      if (testProperty) {
        await prisma.document.create({
          data: {
            fileName: 'test_id_doc.pdf',
            mime: 'application/pdf',
            size: 1024,
            url: '/test/test_id_doc.pdf',
            documentTypeId: idDocType.id,
            propertyId: testProperty.id
          }
        });
        console.log('   📄 Document de test créé pour ID_DOC');
      }

      // Tenter de supprimer le type (doit échouer)
      try {
        await prisma.documentType.update({
          where: { id: idDocType.id },
          data: { isActive: false }
        });
        console.log('   ⚠️ Type ID_DOC désactivé (devrait être bloqué par la logique métier)');
      } catch (error) {
        console.log('   ✅ Suppression bloquée comme attendu');
      }
    } catch (error) {
      console.log('   ⚠️ Erreur lors du test de suppression:', error.message);
    }

    console.log('\n🎉 Tous les tests d\'acceptation sont terminés !');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter les tests
testDocumentTypesExtension().catch(console.error);
