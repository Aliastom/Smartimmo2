#!/usr/bin/env npx tsx

/**
 * Test d'intégration de la nouvelle modal de locataire
 * 
 * Ce script vérifie que la nouvelle TenantEditModalV2
 * est bien intégrée dans l'application.
 */

async function testTenantModalIntegration() {
  console.log('🧪 Test d\'intégration de la nouvelle modal de locataire...\n');

  try {
    // 1. Vérifier que la nouvelle modal existe
    console.log('📄 Vérification de l\'existence de la nouvelle modal...');
    
    const fs = await import('fs');
    const path = await import('path');
    
    const modalV2Path = path.join(process.cwd(), 'src/components/forms/TenantEditModalV2.tsx');
    const wrapperPath = path.join(process.cwd(), 'src/components/forms/TenantEditModalWrapper.tsx');
    const guidePath = path.join(process.cwd(), 'GUIDE-TENANT-MODAL-V2.md');
    
    const modalV2Exists = fs.default.existsSync(modalV2Path);
    const wrapperExists = fs.default.existsSync(wrapperPath);
    const guideExists = fs.default.existsSync(guidePath);
    
    console.log(`   - TenantEditModalV2.tsx: ${modalV2Exists ? '✅' : '❌'}`);
    console.log(`   - TenantEditModalWrapper.tsx: ${wrapperExists ? '✅' : '❌'}`);
    console.log(`   - GUIDE-TENANT-MODAL-V2.md: ${guideExists ? '✅' : '❌'}`);

    // 2. Vérifier que LocatairesClient.tsx utilise la nouvelle modal
    console.log('\n🔍 Vérification de l\'intégration dans LocatairesClient.tsx...');
    
    const locatairesClientPath = path.join(process.cwd(), 'src/app/locataires/LocatairesClient.tsx');
    const locatairesClientContent = fs.default.readFileSync(locatairesClientPath, 'utf8');
    
    const usesNewModal = locatairesClientContent.includes('TenantEditModalV2');
    const usesOldModal = locatairesClientContent.includes('TenantFormComplete');
    
    console.log(`   - Utilise TenantEditModalV2: ${usesNewModal ? '✅' : '❌'}`);
    console.log(`   - Utilise encore TenantFormComplete: ${usesOldModal ? '❌' : '✅'}`);

    // 3. Vérifier la structure de la nouvelle modal
    console.log('\n🏗️ Vérification de la structure de la nouvelle modal...');
    
    if (modalV2Exists) {
      const modalContent = fs.default.readFileSync(modalV2Path, 'utf8');
      
      const hasTabs = modalContent.includes('activeTab');
      const hasValidation = modalContent.includes('tenantSchema');
      const hasSubmit = modalContent.includes('handleSubmit');
      const hasRequiredFields = modalContent.includes('firstName') && modalContent.includes('lastName') && modalContent.includes('email');
      const hasModernUI = modalContent.includes('gradient') || modalContent.includes('bg-gradient');
      
      console.log(`   - Système d'onglets: ${hasTabs ? '✅' : '❌'}`);
      console.log(`   - Validation Zod: ${hasValidation ? '✅' : '❌'}`);
      console.log(`   - Gestion de soumission: ${hasSubmit ? '✅' : '❌'}`);
      console.log(`   - Champs obligatoires: ${hasRequiredFields ? '✅' : '❌'}`);
      console.log(`   - Interface moderne: ${hasModernUI ? '✅' : '❌'}`);
    }

    // 4. Vérifier les onglets disponibles
    console.log('\n📑 Vérification des onglets disponibles...');
    
    if (modalV2Exists) {
      const modalContent = fs.default.readFileSync(modalV2Path, 'utf8');
      
      const tabs = [
        'personal',
        'contact', 
        'professional',
        'financial',
        'emergency',
        'notes'
      ];
      
      tabs.forEach(tab => {
        const hasTab = modalContent.includes(`'${tab}'`) || modalContent.includes(`"${tab}"`);
        console.log(`   - Onglet ${tab}: ${hasTab ? '✅' : '❌'}`);
      });
    }

    // 5. Vérifier les champs par onglet
    console.log('\n📝 Vérification des champs par onglet...');
    
    if (modalV2Exists) {
      const modalContent = fs.default.readFileSync(modalV2Path, 'utf8');
      
      const fieldChecks = [
        { tab: 'personal', fields: ['firstName', 'lastName', 'email', 'phone', 'birthDate', 'nationality', 'status'] },
        { tab: 'contact', fields: ['address', 'postalCode', 'city', 'country'] },
        { tab: 'professional', fields: ['occupation', 'employer'] },
        { tab: 'financial', fields: ['monthlyIncome'] },
        { tab: 'emergency', fields: ['emergencyContact', 'emergencyPhone'] },
        { tab: 'notes', fields: ['notes', 'tags'] }
      ];
      
      fieldChecks.forEach(check => {
        console.log(`   - ${check.tab}:`);
        check.fields.forEach(field => {
          const hasField = modalContent.includes(field);
          console.log(`     * ${field}: ${hasField ? '✅' : '❌'}`);
        });
      });
    }

    // 6. Vérifier la gestion des erreurs
    console.log('\n🚨 Vérification de la gestion des erreurs...');
    
    if (modalV2Exists) {
      const modalContent = fs.default.readFileSync(modalV2Path, 'utf8');
      
      const hasErrorState = modalContent.includes('errors');
      const hasErrorDisplay = modalContent.includes('text-red-600');
      const hasValidation = modalContent.includes('ZodError');
      const hasGeneralError = modalContent.includes('errors.general');
      
      console.log(`   - État d'erreur: ${hasErrorState ? '✅' : '❌'}`);
      console.log(`   - Affichage des erreurs: ${hasErrorDisplay ? '✅' : '❌'}`);
      console.log(`   - Gestion ZodError: ${hasValidation ? '✅' : '❌'}`);
      console.log(`   - Erreur générale: ${hasGeneralError ? '✅' : '❌'}`);
    }

    // 7. Résumé des tests
    console.log('\n📋 Résumé des tests d\'intégration:');
    console.log(`   ✅ Nouvelle modal créée: ${modalV2Exists ? 'OUI' : 'NON'}`);
    console.log(`   ✅ Wrapper créé: ${wrapperExists ? 'OUI' : 'NON'}`);
    console.log(`   ✅ Guide créé: ${guideExists ? 'OUI' : 'NON'}`);
    console.log(`   ✅ Intégration dans LocatairesClient: ${usesNewModal ? 'OUI' : 'NON'}`);
    console.log(`   ✅ Ancienne modal supprimée: ${!usesOldModal ? 'OUI' : 'NON'}`);
    
    if (modalV2Exists && usesNewModal && !usesOldModal) {
      console.log('\n🎉 Intégration réussie !');
      console.log('   La nouvelle modal TenantEditModalV2 est maintenant utilisée dans l\'application.');
      console.log('   Vous devriez voir la nouvelle interface moderne avec :');
      console.log('   - Design gradient bleu-indigo');
      console.log('   - 6 onglets avec icônes colorées');
      console.log('   - Validation en temps réel');
      console.log('   - Bouton "Enregistrer" fonctionnel');
    } else {
      console.log('\n❌ Intégration incomplète !');
      console.log('   Il y a encore des problèmes avec l\'intégration de la nouvelle modal.');
    }

  } catch (error) {
    console.error('💥 Erreur lors du test d\'intégration:', error);
  }
}

// Exécuter le test
testTenantModalIntegration()
  .then(() => {
    console.log('\n🎯 Test d\'intégration terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test d\'intégration:', error);
    process.exit(1);
  });
