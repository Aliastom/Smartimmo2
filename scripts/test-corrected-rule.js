/**
 * Script pour tester la règle corrigée
 */

import { PrismaClient } from '@prisma/client';
import { suggestTypeGlobal } from '../src/services/documentSuggestion.js';

const prisma = new PrismaClient();

async function testCorrectedRule() {
  console.log('🧪 Test de la règle corrigée\n');

  try {
    // Récupérer tous les types actifs
    const activeTypes = await prisma.documentType.findMany({
      where: { isActive: true },
      orderBy: [{ isSystem: 'desc' }, { order: 'asc' }]
    });

    // Parser les configurations JSON
    const parsedTypes = activeTypes.map(type => ({
      ...type,
      defaultContexts: type.defaultContexts ? JSON.parse(type.defaultContexts) : [],
      suggestionConfig: type.suggestionConfig ? JSON.parse(type.suggestionConfig) : null,
      lockInFlows: type.lockInFlows ? JSON.parse(type.lockInFlows) : [],
      metadataSchema: type.metadataSchema ? JSON.parse(type.metadataSchema) : null,
    }));

    // Tester avec le fichier
    const filename = 'quittance_octobre_2025_Jasmin (5).pdf';
    const result = suggestTypeGlobal({
      context: 'global',
      filename,
      mime: 'application/pdf'
    }, parsedTypes);

    console.log(`📄 Fichier testé: "${filename}"`);
    console.log(`🎯 Type suggéré: ${result.type_code}`);
    console.log(`📊 Confiance: ${Math.round(result.confidence * 100)}%`);
    console.log(`🔍 Évidence: ${result.evidence.join(', ')}`);
    
    if (result.alternatives.length > 0) {
      console.log(`🔄 Alternatives:`);
      result.alternatives.forEach(alt => {
        console.log(`   - ${alt.type_code}: ${Math.round(alt.confidence * 100)}%`);
      });
    }

    // Vérifier si c'est au-dessus du seuil d'auto-sélection
    const autoSelectThreshold = 0.7;
    const shouldAutoSelect = result.confidence >= autoSelectThreshold;
    
    console.log(`\n✅ Résultat:`);
    console.log(`   - Seuil d'auto-sélection: ${Math.round(autoSelectThreshold * 100)}%`);
    console.log(`   - Auto-sélection: ${shouldAutoSelect ? '✅ OUI' : '❌ NON'}`);
    
    if (shouldAutoSelect) {
      console.log(`   - 🎉 Le type devrait être sélectionné automatiquement !`);
    } else {
      console.log(`   - ⚠️ Confiance trop faible pour l'auto-sélection`);
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCorrectedRule().catch(console.error);
