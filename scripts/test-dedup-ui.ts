import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDedupUI() {
  console.log('🧪 Test de l\'interface de détection de doublons...\n');
  
  try {
    // 1. Récupérer le document existant
    const existingDoc = await prisma.document.findFirst({
      where: { deletedAt: null },
      select: {
        id: true,
        filenameOriginal: true,
        sha256: true,
        extractedText: true,
        createdAt: true
      }
    });
    
    if (!existingDoc) {
      console.log('❌ Aucun document existant pour tester');
      return;
    }
    
    console.log('📄 Document existant trouvé:');
    console.log(`   - Nom: ${existingDoc.filenameOriginal}`);
    console.log(`   - SHA256: ${existingDoc.sha256}`);
    console.log(`   - Texte: ${existingDoc.extractedText?.length || 0} caractères`);
    
    // 2. Simuler un upload avec le même contenu
    console.log('\n🔄 Simulation d\'un upload avec le même contenu...');
    
    const formData = new FormData();
    const file = new File([existingDoc.extractedText || ''], existingDoc.filenameOriginal, { 
      type: 'application/pdf' 
    });
    formData.append('file', file);
    
    const response = await fetch('http://localhost:3000/api/documents/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    console.log('📊 Résultat de l\'upload:');
    console.log(`   - Succès: ${result.success}`);
    
    if (result.success && result.data) {
      const data = result.data;
      console.log(`   - TempId: ${data.tempId}`);
      console.log(`   - SHA256: ${data.sha256}`);
      console.log(`   - DedupResult: ${JSON.stringify(data.dedupResult, null, 2)}`);
      
      if (data.dedupResult) {
        console.log('\n🎯 Analyse du résultat DedupAI:');
        console.log(`   - Type de doublon: ${data.dedupResult.duplicateType}`);
        console.log(`   - Action suggérée: ${data.dedupResult.suggestedAction}`);
        console.log(`   - Document correspondant: ${data.dedupResult.matchedDocument?.name || 'Aucun'}`);
        console.log(`   - Correspondance checksum: ${data.dedupResult.signals?.checksum_match || false}`);
        console.log(`   - Similarité textuelle: ${data.dedupResult.signals?.text_similarity || 0}`);
        
        if (data.dedupResult.ui) {
          console.log(`   - Titre UI: ${data.dedupResult.ui.title}`);
          console.log(`   - Sous-titre: ${data.dedupResult.ui.subtitle}`);
          console.log(`   - Recommandation: ${data.dedupResult.ui.recommendation}`);
        }
      } else {
        console.log('   ❌ Aucun résultat DedupAI');
      }
    } else {
      console.log(`   ❌ Erreur: ${result.error || 'Erreur inconnue'}`);
    }
    
  } catch (error) {
    console.error('💥 Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDedupUI();
