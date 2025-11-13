import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testApiSorting() {
  try {
    console.log('🧪 Test du tri via l\'API...');

    // Test avec un texte d'avis d'impôt
    const testText = `AVIS D'IMPOSITION\n\nDirection Générale des Finances Publiques\nAVIS DE MISE EN RECOUVREMENT\n\nRéférence: 2025-123456789\nPropriétaire: Jean DUPONT\nAdresse: 16 rue de la Paix, 75001 PARIS\n\nBase d'imposition: 850,00 €\nMontant dû: 425,00 €\n\nTaxe foncière sur les propriétés bâties\nExercice 2025\n\nDate limite de paiement: 15/10/2025\nMode de paiement: Virement, chèque, espèces\n\nDGFIP - Service des impôts`;

    console.log('📄 Texte de test:', testText.substring(0, 100) + '...');

    // Simuler l'appel API
    const formData = new FormData();
    formData.append('text', testText);
    formData.append('runId', 'test-run-' + Date.now());

    const response = await fetch('http://localhost:3000/api/admin/document-types/test-global', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`API Error: ${result.error}`);
    }

    console.log('\n📊 Résultats de classification (top 3):');
    result.data.classification.top3.forEach((item, index) => {
      console.log(`#${index + 1} ${item.typeLabel}`);
      console.log(`   Code: ${item.typeCode}`);
      console.log(`   Score normalisé: ${(item.normalizedScore * 100).toFixed(2)}%`);
      console.log(`   Score brut: ${item.rawScore}`);
      console.log(`   Seuil: ${(item.threshold * 100).toFixed(0)}%`);
      console.log(`   Mots-clés trouvés: ${item.matchedKeywords?.length || 0}`);
      console.log(`   Signaux trouvés: ${item.matchedSignals?.length || 0}`);
      console.log('');
    });

    // Vérifier que le tri est correct
    const scores = result.data.classification.top3.map(item => item.normalizedScore);
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
    const bestMatch = result.data.classification.top3[0];
    const autoAssigned = result.data.classification.autoAssigned;
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

testApiSorting();
