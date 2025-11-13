/**
 * Script pour tester l'API /api/documents/classify directement
 */

async function testApiClassify() {
  console.log('🧪 Test de l\'API /api/documents/classify\n');

  const testFilename = 'quittance_octobre_2025_Jasmin (8).pdf';
  const testMime = 'application/pdf';

  const contexts = ['global', 'property', 'lease', 'transaction'];
  
  for (const context of contexts) {
    console.log(`🎯 Test contexte: "${context}"`);
    
    try {
      const response = await fetch('http://localhost:3000/api/documents/classify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context,
          filename: testFilename,
          mime: testMime,
          ocr_excerpt: ''
        })
      });

      if (!response.ok) {
        console.log(`   ❌ Erreur HTTP: ${response.status}`);
        continue;
      }

      const result = await response.json();
      console.log(`   Résultat: ${result.type_code} ${Math.round(result.confidence * 100)}%`);
      
      if (result.evidence && result.evidence.length > 0) {
        console.log(`   Indices: ${result.evidence.slice(0, 2).join(', ')}`);
      }
      
      // Vérifier la cohérence
      const expectedType = 'RENT_RECEIPT';
      const expectedMinConfidence = 0.7;
      
      if (result.type_code === expectedType && result.confidence >= expectedMinConfidence) {
        console.log(`   ✅ CORRECT: ${expectedType} avec ${Math.round(result.confidence * 100)}%`);
      } else {
        console.log(`   ❌ PROBLÈME: Attendu ${expectedType} >= ${Math.round(expectedMinConfidence * 100)}%, obtenu ${result.type_code} ${Math.round(result.confidence * 100)}%`);
      }
      
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('🎉 Test terminé !');
  console.log('\n📋 Résumé attendu:');
  console.log('- Tous les contextes devraient donner RENT_RECEIPT 70%+');
  console.log('- Les indices devraient mentionner "Nom de fichier: quittance"');
}

// Vérifier que le serveur est en cours d'exécution
fetch('http://localhost:3000/api/health')
  .then(() => testApiClassify())
  .catch(() => {
    console.log('❌ Serveur non accessible sur localhost:3000');
    console.log('💡 Assurez-vous que le serveur Next.js est en cours d\'exécution (npm run dev)');
  });
