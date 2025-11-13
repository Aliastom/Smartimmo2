import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testQuittanceSorting() {
  try {
    console.log('🧪 Test du tri avec un texte de quittance...');

    // Test avec un texte de quittance
    const testText = `QUITTANCE DE LOYER\n\nMontant réglé: 850,00 €\nPériode: mois de mai 2025\nReçu le: 15/05/2025\n\nLocataire: Jasmin\nPropriétaire: Immeuble ABC\n\nLoyer mensuel réglé pour la période du 1er au 31 mai 2025.`;

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

testQuittanceSorting();
