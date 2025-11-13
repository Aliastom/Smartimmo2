import fs from 'fs';
import path from 'path';

async function testUploadDedup() {
  console.log('🧪 Test d\'upload avec détection de doublons...\n');
  
  try {
    // 1. Créer un fichier de test
    console.log('1️⃣ Création d\'un fichier de test...');
    
    const testContent = 'QUITTANCE DE LOYER\n\nPériode du 1er mars 2025 au 31 mars 2025\n\nLocataire: M. Test\nAdresse: 123 rue de test, 75001 Paris\n\nMontant du loyer: 850,00 €\nCharges: 120,00 €\nTotal: 970,00 €';
    
    const testFilePath = path.join(process.cwd(), 'test-quittance.pdf');
    fs.writeFileSync(testFilePath, testContent);
    
    console.log('   ✅ Fichier de test créé:', testFilePath);
    
    // 2. Premier upload
    console.log('\n2️⃣ Premier upload...');
    
    const formData1 = new FormData();
    const file1 = new File([testContent], 'quittance_test_1.pdf', { type: 'application/pdf' });
    formData1.append('file', file1);
    
    const response1 = await fetch('http://localhost:3000/api/documents/upload', {
      method: 'POST',
      body: formData1
    });
    
    const result1 = await response1.json();
    
    if (result1.success) {
      console.log('   ✅ Premier upload réussi');
      console.log('   📊 Doublon détecté:', result1.data.dedupResult?.duplicateType !== 'none');
      console.log('   📊 Type:', result1.data.dedupResult?.duplicateType || 'none');
    } else {
      console.log('   ❌ Premier upload échoué:', result1.error);
    }
    
    // 3. Deuxième upload (même contenu)
    console.log('\n3️⃣ Deuxième upload (même contenu)...');
    
    const formData2 = new FormData();
    const file2 = new File([testContent], 'quittance_test_2.pdf', { type: 'application/pdf' });
    formData2.append('file', file2);
    
    const response2 = await fetch('http://localhost:3000/api/documents/upload', {
      method: 'POST',
      body: formData2
    });
    
    const result2 = await response2.json();
    
    if (result2.success) {
      console.log('   ✅ Deuxième upload réussi');
      console.log('   📊 Doublon détecté:', result2.data.dedupResult?.duplicateType !== 'none');
      console.log('   📊 Type:', result2.data.dedupResult?.duplicateType || 'none');
      console.log('   📊 Document correspondant:', result2.data.dedupResult?.matchedDocument?.name || 'Aucun');
      console.log('   📊 Action suggérée:', result2.data.dedupResult?.suggestedAction || 'proceed');
    } else {
      console.log('   ❌ Deuxième upload échoué:', result2.error);
    }
    
    // 4. Nettoyage
    console.log('\n4️⃣ Nettoyage...');
    
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log('   ✅ Fichier de test supprimé');
    }
    
    console.log('\n✅ Test d\'upload terminé !');
    
  } catch (error) {
    console.error('💥 Erreur lors du test:', error);
    throw error;
  }
}

// Exécuter le test
testUploadDedup()
  .then(() => {
    console.log('\n🎉 Test terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test:', error);
    process.exit(1);
  });

export { testUploadDedup };
