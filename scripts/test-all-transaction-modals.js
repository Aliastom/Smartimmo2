/**
 * Script pour tester la cohérence des suggestions dans toutes les modals de transaction
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testAllTransactionModals() {
  console.log('🧪 Test de cohérence des modals de transaction\n');

  try {
    // Récupérer les types actifs
    const activeTypes = await prisma.documentType.findMany({
      where: { isActive: true },
      orderBy: [{ isSystem: 'desc' }, { order: 'asc' }]
    });

    const parsedTypes = activeTypes.map(type => ({
      ...type,
      defaultContexts: type.defaultContexts ? JSON.parse(type.defaultContexts) : [],
      suggestionConfig: type.suggestionConfig ? JSON.parse(type.suggestionConfig) : null,
      lockInFlows: type.lockInFlows ? JSON.parse(type.lockInFlows) : [],
      metadataSchema: type.metadataSchema ? JSON.parse(type.metadataSchema) : null,
    }));

    // Import dynamique du service
    const { suggestTypeGlobal } = await import('../src/services/documentSuggestion.js');

    const testFilename = 'quittance_octobre_2025_Jasmin (8).pdf';
    const testMime = 'application/pdf';

    console.log(`📄 Test avec: "${testFilename}"\n`);

    // Tester tous les contextes possibles
    const contexts = ['global', 'property', 'lease', 'transaction'];
    
    for (const context of contexts) {
      console.log(`🎯 Contexte: "${context}"`);
      
      const result = suggestTypeGlobal({
        context,
        filename: testFilename,
        mime: testMime
      }, parsedTypes);

      console.log(`   Résultat: ${result.type_code} ${Math.round(result.confidence * 100)}%`);
      
      if (result.evidence && result.evidence.length > 0) {
        console.log(`   Indices: ${result.evidence.slice(0, 2).join(', ')}`);
      }
      
      // Vérifier la cohérence
      if (context === 'property' || context === 'global') {
        const expectedType = 'RENT_RECEIPT';
        const expectedMinConfidence = 0.7;
        
        if (result.type_code === expectedType && result.confidence >= expectedMinConfidence) {
          console.log(`   ✅ CORRECT: ${expectedType} avec ${Math.round(result.confidence * 100)}%`);
        } else {
          console.log(`   ❌ PROBLÈME: Attendu ${expectedType} >= ${Math.round(expectedMinConfidence * 100)}%, obtenu ${result.type_code} ${Math.round(result.confidence * 100)}%`);
        }
      }
      
      console.log('');
    }

    console.log('🎉 Test terminé !');
    console.log('\n📋 Résumé attendu:');
    console.log('- global: RENT_RECEIPT 70%+ (pattern quittance)');
    console.log('- property: RENT_RECEIPT 70%+ (pattern + contexte)');
    console.log('- lease: RENT_RECEIPT 70%+ (pattern + contexte)');
    console.log('- transaction: RENT_RECEIPT 70%+ (pattern + contexte)');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAllTransactionModals().catch(console.error);
