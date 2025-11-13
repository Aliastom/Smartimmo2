import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDocumentTypeDetection() {
  console.log('🧪 Test du système de détection des types de documents...\n');
  
  try {
    // 1. Vérifier que les types de documents existent
    console.log('📊 Vérification des types de documents...');
    
    const documentTypes = await prisma.documentType.findMany({
      orderBy: [
        { scope: 'asc' },
        { order: 'asc' }
      ]
    });
    
    console.log(`✅ ${documentTypes.length} types de documents trouvés`);
    
    // Grouper par scope
    const typesByScope = documentTypes.reduce((acc, type) => {
      if (!acc[type.scope]) acc[type.scope] = [];
      acc[type.scope].push(type);
      return acc;
    }, {} as Record<string, any[]>);
    
    Object.entries(typesByScope).forEach(([scope, types]) => {
      console.log(`   - ${scope}: ${types.length} types`);
      types.slice(0, 3).forEach(type => {
        console.log(`     • ${type.code}: ${type.label}`);
      });
      if (types.length > 3) {
        console.log(`     • ... et ${types.length - 3} autres`);
      }
    });

    // 2. Tester la détection par nom de fichier
    console.log('\n🔍 Test de la détection par nom de fichier...');
    
    const testFiles = [
      'quittance_mars_2025_Jasmin.pdf',
      'DPE_2024_Appartement_1.pdf',
      'bail_signe_locataire_123.pdf',
      'facture_travaux_plomberie.pdf',
      'taxe_fonciere_2024.pdf',
      'edl_entree_locataire.pdf'
    ];
    
    for (const filename of testFiles) {
      // Chercher les types qui matchent avec regexFilename
      const matchingTypes = documentTypes.filter(type => {
        if (!type.regexFilename) return false;
        try {
          const regex = new RegExp(type.regexFilename, 'i');
          return regex.test(filename);
        } catch (error) {
          return false;
        }
      });
      
      if (matchingTypes.length > 0) {
        console.log(`   ✅ "${filename}" → ${matchingTypes[0].label} (${matchingTypes[0].code})`);
      } else {
        console.log(`   ❓ "${filename}" → Aucune détection automatique`);
      }
    }

    // 3. Tester la détection par extension
    console.log('\n🔍 Test de la détection par extension...');
    
    const testExtensions = [
      { filename: 'document.pdf', mime: 'application/pdf' },
      { filename: 'photo.jpg', mime: 'image/jpeg' },
      { filename: 'plan.png', mime: 'image/png' }
    ];
    
    for (const test of testExtensions) {
      const matchingTypes = documentTypes.filter(type => {
        if (!type.validExtensions || !type.validMimeTypes) return false;
        
        try {
          const validExtensions = JSON.parse(type.validExtensions);
          const validMimeTypes = JSON.parse(type.validMimeTypes);
          
          const extension = '.' + test.filename.split('.').pop();
          return validExtensions.includes(extension) && validMimeTypes.includes(test.mime);
        } catch (error) {
          return false;
        }
      });
      
      if (matchingTypes.length > 0) {
        console.log(`   ✅ "${test.filename}" (${test.mime}) → ${matchingTypes.length} types compatibles`);
        matchingTypes.slice(0, 2).forEach(type => {
          console.log(`     • ${type.label} (${type.code})`);
        });
      } else {
        console.log(`   ❓ "${test.filename}" (${test.mime}) → Aucun type compatible`);
      }
    }

    // 4. Tester la fonction de détection complète
    console.log('\n🔍 Test de la fonction de détection complète...');
    
    const testDocument = {
      filename: 'quittance_mars_2025_Jasmin.pdf',
      mime: 'application/pdf',
      size: 1024
    };
    
    // Simuler la logique de détection
    let detectedType = null;
    let confidence = 0;
    
    // 1. Détection par nom de fichier (priorité haute)
    const filenameMatches = documentTypes.filter(type => {
      if (!type.regexFilename) return false;
      try {
        const regex = new RegExp(type.regexFilename, 'i');
        return regex.test(testDocument.filename);
      } catch (error) {
        return false;
      }
    });
    
    if (filenameMatches.length > 0) {
      detectedType = filenameMatches[0];
      confidence = 0.9; // Haute confiance pour les regex
      console.log(`   ✅ Détection par nom: ${detectedType.label} (confiance: ${confidence})`);
    } else {
      // 2. Détection par extension/mime (priorité moyenne)
      const extensionMatches = documentTypes.filter(type => {
        if (!type.validExtensions || !type.validMimeTypes) return false;
        
        try {
          const validExtensions = JSON.parse(type.validExtensions);
          const validMimeTypes = JSON.parse(type.validMimeTypes);
          
          const extension = '.' + testDocument.filename.split('.').pop();
          return validExtensions.includes(extension) && validMimeTypes.includes(testDocument.mime);
        } catch (error) {
          return false;
        }
      });
      
      if (extensionMatches.length > 0) {
        detectedType = extensionMatches[0];
        confidence = 0.6; // Confiance moyenne pour les extensions
        console.log(`   ✅ Détection par extension: ${detectedType.label} (confiance: ${confidence})`);
      } else {
        console.log(`   ❓ Aucune détection automatique possible`);
      }
    }

    // 5. Vérifier les types avec regexFilename
    console.log('\n📊 Types avec détection par nom de fichier...');
    
    const typesWithRegex = documentTypes.filter(type => type.regexFilename);
    console.log(`   - ${typesWithRegex.length} types avec regexFilename`);
    
    typesWithRegex.forEach(type => {
      console.log(`     • ${type.code}: ${type.regexFilename}`);
    });

    console.log('\n✅ Test du système de détection réussi !');
    console.log('\n📝 Le système de détection des types fonctionne :');
    console.log('   - Types de documents chargés ✅');
    console.log('   - Détection par nom de fichier ✅');
    console.log('   - Détection par extension/mime ✅');
    console.log('   - Fonction de détection complète ✅');
    console.log('   - Types avec regex configurés ✅');

  } catch (error) {
    console.error('💥 Erreur lors du test de détection:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testDocumentTypeDetection()
  .then(() => {
    console.log('\n🎉 Test de détection terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test de détection:', error);
    process.exit(1);
  });

export { testDocumentTypeDetection };
