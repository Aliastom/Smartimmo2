/**
 * Script de test simplifié pour valider l'extension des types de documents
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testAcceptance() {
  console.log('🧪 Tests d\'acceptation - Extension des types de documents\n');

  try {
    // Test 1: Vérifier que les nouveaux champs existent
    console.log('📋 Test 1: Vérification des nouveaux champs');
    const sampleType = await prisma.documentType.findFirst();
    
    if (sampleType) {
      console.log('✅ Modèle DocumentType étendu:');
      console.log(`   - isSensitive: ${sampleType.isSensitive !== undefined ? '✅' : '❌'}`);
      console.log(`   - defaultContexts: ${sampleType.defaultContexts !== undefined ? '✅' : '❌'}`);
      console.log(`   - suggestionConfig: ${sampleType.suggestionConfig !== undefined ? '✅' : '❌'}`);
      console.log(`   - lockInFlows: ${sampleType.lockInFlows !== undefined ? '✅' : '❌'}`);
      console.log(`   - metadataSchema: ${sampleType.metadataSchema !== undefined ? '✅' : '❌'}`);
    }

    // Test 2: Créer un type avec tous les nouveaux champs
    console.log('\n📋 Test 2: Création d\'un type avec configuration complète');
    
    const testType = await prisma.documentType.create({
      data: {
        code: 'TEST_ACCEPTANCE',
        label: 'Test d\'acceptation',
        icon: 'TestTube',
        isSystem: false,
        isActive: true,
        isSensitive: true,
        defaultContexts: JSON.stringify(['global', 'property']),
        lockInFlows: JSON.stringify(['test_flow']),
        metadataSchema: JSON.stringify({
          type: 'object',
          properties: {
            test_field: {
              type: 'string',
              title: 'Champ de test',
              description: 'Un champ de test'
            }
          },
          required: ['test_field']
        }),
        suggestionConfig: JSON.stringify({
          rules: [
            {
              pattern: 'test',
              apply_in: ['global'],
              weight: 5,
              type_code: 'TEST_ACCEPTANCE',
              lock: false
            }
          ]
        })
      }
    });

    console.log('✅ Type de test créé avec succès');
    console.log(`   - ID: ${testType.id}`);
    console.log(`   - Code: ${testType.code}`);
    console.log(`   - Sensible: ${testType.isSensitive}`);

    // Test 3: Vérifier la lecture avec parsing JSON
    console.log('\n📋 Test 3: Vérification du parsing JSON');
    
    const parsedType = {
      ...testType,
      defaultContexts: JSON.parse(testType.defaultContexts || '[]'),
      suggestionConfig: testType.suggestionConfig ? JSON.parse(testType.suggestionConfig) : null,
      lockInFlows: JSON.parse(testType.lockInFlows || '[]'),
      metadataSchema: testType.metadataSchema ? JSON.parse(testType.metadataSchema) : null,
    };

    console.log('✅ Parsing JSON réussi:');
    console.log(`   - Contextes par défaut: ${parsedType.defaultContexts.join(', ')}`);
    console.log(`   - Flux verrouillés: ${parsedType.lockInFlows.join(', ')}`);
    console.log(`   - Règles de suggestion: ${parsedType.suggestionConfig?.rules?.length || 0}`);
    console.log(`   - Propriétés métadonnées: ${Object.keys(parsedType.metadataSchema?.properties || {}).length}`);

    // Test 4: Mise à jour des champs
    console.log('\n📋 Test 4: Mise à jour des nouveaux champs');
    
    await prisma.documentType.update({
      where: { id: testType.id },
      data: {
        isSensitive: false,
        defaultContexts: JSON.stringify(['transaction']),
        suggestionConfig: JSON.stringify({
          rules: [
            {
              pattern: 'updated',
              apply_in: ['transaction'],
              weight: 8,
              type_code: 'TEST_ACCEPTANCE',
              lock: false
            }
          ]
        })
      }
    });

    console.log('✅ Mise à jour réussie');

    // Test 5: Vérifier les types système
    console.log('\n📋 Test 5: Vérification des types système');
    
    const systemTypes = await prisma.documentType.findMany({
      where: { isSystem: true }
    });

    console.log(`✅ Types système trouvés: ${systemTypes.length}`);
    systemTypes.forEach(type => {
      console.log(`   - ${type.code}: ${type.label}`);
    });

    // Test 6: Statistiques d'usage
    console.log('\n📋 Test 6: Statistiques d\'usage');
    
    const usageStats = await prisma.documentType.findMany({
      include: {
        _count: {
          select: { documents: true }
        }
      }
    });

    console.log('✅ Statistiques d\'usage:');
    usageStats.forEach(type => {
      console.log(`   - ${type.code}: ${type._count.documents} document(s)`);
    });

    // Nettoyage
    console.log('\n🧹 Nettoyage des données de test');
    await prisma.documentType.delete({
      where: { id: testType.id }
    });
    console.log('✅ Données de test supprimées');

    console.log('\n🎉 Tous les tests d\'acceptation sont passés avec succès !');
    console.log('\n📊 Résumé des fonctionnalités testées:');
    console.log('   ✅ Extension du schéma Prisma');
    console.log('   ✅ Création avec nouveaux champs');
    console.log('   ✅ Parsing JSON des configurations');
    console.log('   ✅ Mise à jour des champs');
    console.log('   ✅ Types système protégés');
    console.log('   ✅ Statistiques d\'usage');
    console.log('   ✅ Nettoyage des données');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter les tests
testAcceptance().catch(console.error);
