import { PrismaClient } from '@prisma/client';
import { classificationService } from '../src/services/ClassificationService.ts';

const prisma = new PrismaClient();

async function testSorting() {
  try {
    console.log('🧪 Test du tri des résultats de classification...');

    // Test avec un texte d'avis d'impôt
    const testText = `AVIS D'IMPOSITION\n\nDirection Générale des Finances Publiques\nAVIS DE MISE EN RECOUVREMENT\n\nRéférence: 2025-123456789\nPropriétaire: Jean DUPONT\nAdresse: 16 rue de la Paix, 75001 PARIS\n\nBase d'imposition: 850,00 €\nMontant dû: 425,00 €\n\nTaxe foncière sur les propriétés bâties\nExercice 2025\n\nDate limite de paiement: 15/10/2025\nMode de paiement: Virement, chèque, espèces\n\nDGFIP - Service des impôts`;

    console.log('📄 Texte de test:', testText.substring(0, 100) + '...');

    const result = await classificationService.classify(testText);

    console.log('\n📊 Résultats de classification (top 3):');
    result.classification.top3.forEach((item, index) => {
      console.log(`#${index + 1} ${item.typeLabel}`);
      console.log(`   Code: ${item.typeCode}`);
      console.log(`   Score normalisé: ${(item.normalizedScore * 100).toFixed(2)}%`);
      console.log(`   Score brut: ${item.rawScore}`);
      console.log(`   Seuil: ${(item.threshold * 100).toFixed(0)}%`);
      console.log(`   Mots-clés trouvés: ${item.matchedKeywords.length}`);
      console.log(`   Signaux trouvés: ${item.matchedSignals.length}`);
      console.log('');
    });

    // Vérifier que le tri est correct
    const scores = result.classification.top3.map(item => item.normalizedScore);
    const isSorted = scores.every((score, index) => 
      index === 0 || scores[index - 1] >= score
    );

    console.log(`✅ Tri correct: ${isSorted ? 'OUI' : 'NON'}`);
    
    if (!isSorted) {
      console.log('❌ Problème de tri détecté !');
      scores.forEach((score, index) => {
        console.log(`   #${index + 1}: ${(score * 100).toFixed(2)}%`);
      });
    }

    // Vérifier l'auto-assignation
    const bestMatch = result.classification.top3[0];
    const autoAssigned = bestMatch && bestMatch.normalizedScore >= bestMatch.threshold;
    console.log(`🎯 Auto-assignation: ${autoAssigned ? 'OUI' : 'NON'}`);
    if (!autoAssigned && bestMatch) {
      console.log(`   Raison: ${(bestMatch.normalizedScore * 100).toFixed(0)}% < ${(bestMatch.threshold * 100).toFixed(0)}%`);
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSorting();
