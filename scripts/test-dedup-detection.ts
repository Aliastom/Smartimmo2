import { PrismaClient } from '@prisma/client';
import { dedupAI } from '../src/services/dedup-ai.service';

const prisma = new PrismaClient();

async function testDedupDetection() {
  console.log('🧪 Test de la détection de doublons...\n');
  
  try {
    // 1. Récupérer les documents existants
    console.log('1️⃣ Récupération des documents existants...');
    
    const existingDocs = await prisma.document.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        filenameOriginal: true,
        createdAt: true,
        mime: true,
        size: true,
        sha256: true,
        extractedText: true,
        documentType: {
          select: {
            code: true,
            label: true
          }
        }
      },
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`   📊 ${existingDocs.length} documents trouvés`);
    
    if (existingDocs.length === 0) {
      console.log('   ⚠️ Aucun document existant pour tester la détection');
      return;
    }
    
    // 2. Tester avec le premier document (simulation d'un doublon exact)
    const testDoc = existingDocs[0];
    console.log(`\n2️⃣ Test avec le document: ${testDoc.filenameOriginal}`);
    
    const tempFile = {
      id: 'test-temp-id',
      name: testDoc.filenameOriginal,
      bytes: testDoc.size,
      size_kb: Math.round(testDoc.size / 1024),
      pages: 1,
      ocr_text: testDoc.extractedText || '',
      ocr_quality: 0.8,
      detected_type: testDoc.documentType?.label || 'autre',
      checksum: testDoc.sha256 ? `sha256:${testDoc.sha256}` : ''
    };
    
    const existingCandidates = existingDocs.map(doc => ({
      id: doc.id,
      name: doc.filenameOriginal,
      uploadedAt: doc.createdAt.toISOString(),
      size_kb: Math.round(doc.size / 1024),
      pages: 1,
      ocr_text: doc.extractedText || '',
      ocr_quality: 0.8,
      type: doc.documentType?.label || 'Type inconnu',
      checksum: doc.sha256 ? `sha256:${doc.sha256}` : ''
    }));
    
    console.log(`   📊 ${existingCandidates.length} candidats pour comparaison`);
    
    // 3. Analyser avec DedupAI
    console.log('\n3️⃣ Analyse avec DedupAI...');
    
    const result = dedupAI.analyze(tempFile, existingCandidates);
    
    console.log('   📊 Résultat de l\'analyse:');
    console.log(`   - Type de doublon: ${result.duplicateType}`);
    console.log(`   - Action suggérée: ${result.suggestedAction}`);
    console.log(`   - Document correspondant: ${result.matchedDocument?.name || 'Aucun'}`);
    console.log(`   - Correspondance checksum: ${result.signals.checksum_match ? 'Oui' : 'Non'}`);
    console.log(`   - Similarité textuelle: ${(result.signals.text_similarity * 100).toFixed(1)}%`);
    
    if (result.ui) {
      console.log(`   - Titre UI: ${result.ui.title}`);
      console.log(`   - Sous-titre: ${result.ui.subtitle}`);
      console.log(`   - Recommandation: ${result.ui.recommendation}`);
    }
    
    // 4. Tester avec un document différent (simulation d'un non-doublon)
    console.log('\n4️⃣ Test avec un document différent...');
    
    const differentTempFile = {
      ...tempFile,
      name: 'document_different.pdf',
      ocr_text: 'Ceci est un document complètement différent avec du contenu unique.',
      checksum: 'sha256:different_hash_123456789'
    };
    
    const differentResult = dedupAI.analyze(differentTempFile, existingCandidates);
    
    console.log('   📊 Résultat pour document différent:');
    console.log(`   - Type de doublon: ${differentResult.duplicateType}`);
    console.log(`   - Action suggérée: ${differentResult.suggestedAction}`);
    console.log(`   - Similarité textuelle: ${(differentResult.signals.text_similarity * 100).toFixed(1)}%`);
    
    console.log('\n✅ Test de détection de doublons terminé !');
    
  } catch (error) {
    console.error('💥 Erreur lors du test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testDedupDetection()
  .then(() => {
    console.log('\n🎉 Test terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test:', error);
    process.exit(1);
  });

export { testDedupDetection };
