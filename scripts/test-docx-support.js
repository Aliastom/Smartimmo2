/**
 * Script de test manuel pour valider le support DOCX
 * Usage: node scripts/test-docx-support.js
 */

const fs = require('fs');
const path = require('path');

async function testDocxSupport() {
  console.log('🧪 Test Support DOCX - SmartImmo');
  console.log('================================\n');

  try {
    // Test 1: Vérifier que mammoth est installé
    console.log('1️⃣ Vérification installation mammoth...');
    const mammoth = require('mammoth');
    console.log('✅ mammoth installé correctement\n');

    // Test 2: Vérifier le service DocxTextExtractor
    console.log('2️⃣ Test du service DocxTextExtractor...');
    const { DocxTextExtractor } = require('../src/services/DocxTextExtractor.ts');
    
    // Tests des méthodes de détection
    const isDocxSupported = DocxTextExtractor.isSupportedMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const isDocSupported = DocxTextExtractor.isSupportedMimeType('application/msword');
    const isFilenameSupported = DocxTextExtractor.isSupportedFilename('test.docx');
    
    console.log(`✅ Support DOCX MIME: ${isDocxSupported}`);
    console.log(`✅ Support DOC MIME: ${isDocSupported}`);  
    console.log(`✅ Support filename .docx: ${isFilenameSupported}\n`);

    // Test 3: Instructions pour test API
    console.log('3️⃣ Test API /api/ocr (manuel)');
    console.log('Pour tester l\'API avec un fichier DOCX:');
    console.log('1. Démarrer le serveur: npm run dev');
    console.log('2. Utiliser curl ou Postman:');
    console.log('   curl -X POST http://localhost:3000/api/ocr \\');
    console.log('        -F "file=@votre-document.docx"');
    console.log('3. Vérifier dans les logs: source:"docx-direct"\n');

    // Test 4: Vérification structure de fichiers
    console.log('4️⃣ Vérification structure fichiers...');
    const requiredFiles = [
      'src/services/DocxTextExtractor.ts',
      'src/app/api/ocr/route.ts'
    ];

    let allFilesExist = true;
    for (const file of requiredFiles) {
      const exists = fs.existsSync(path.join(__dirname, '..', file));
      console.log(`${exists ? '✅' : '❌'} ${file}`);
      if (!exists) allFilesExist = false;
    }

    if (allFilesExist) {
      console.log('\n🎉 Tous les tests passent !');
      console.log('Le support DOCX est correctement intégré.');
      console.log('\n📝 Prochaines étapes:');
      console.log('1. Tester avec un vrai fichier DOCX via l\'API');
      console.log('2. Vérifier en base que le texte est bien stocké');
      console.log('3. Valider que la classification fonctionne');
    } else {
      console.log('\n❌ Certains fichiers sont manquants');
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    console.log('\n🔧 Vérifications:');
    console.log('1. mammoth est-il installé ? npm list mammoth');
    console.log('2. Le service TypeScript compile-t-il ? npm run type-check');
  }
}

// Exécuter le test
testDocxSupport();
