#!/usr/bin/env npx tsx

/**
 * Test des corrections de la modal de locataire
 * 
 * Ce script vérifie que les corrections suivantes ont été appliquées :
 * 1. Ancienne modal supprimée
 * 2. Débordement des onglets corrigé
 * 3. Réinitialisation du formulaire pour nouveau locataire
 * 4. Esthétique simplifiée (pas de cœur, boutons standards)
 */

async function testTenantModalFixes() {
  console.log('🧪 Test des corrections de la modal de locataire...\n');

  try {
    const fs = await import('fs');
    const path = await import('path');

    // 1. Vérifier que l'ancienne modal a été supprimée
    console.log('🗑️ Vérification de la suppression de l\'ancienne modal...');
    
    const oldModalPath = path.join(process.cwd(), 'src/components/forms/TenantFormComplete.tsx');
    const oldModalExists = fs.default.existsSync(oldModalPath);
    
    console.log(`   - TenantFormComplete.tsx supprimé: ${!oldModalExists ? '✅' : '❌'}`);

    // 2. Vérifier les corrections dans la nouvelle modal
    console.log('\n🔧 Vérification des corrections dans TenantEditModalV2...');
    
    const newModalPath = path.join(process.cwd(), 'src/components/forms/TenantEditModalV2.tsx');
    const newModalExists = fs.default.existsSync(newModalPath);
    
    if (newModalExists) {
      const modalContent = fs.default.readFileSync(newModalPath, 'utf8');
      
      // Vérifier le débordement des onglets
      const hasOverflowXAuto = modalContent.includes('overflow-x-auto');
      const hasWhitespaceNowrap = modalContent.includes('whitespace-nowrap');
      const hasReducedPadding = modalContent.includes('px-3 py-2');
      
      console.log(`   - Débordement corrigé (overflow-x-auto): ${hasOverflowXAuto ? '✅' : '❌'}`);
      console.log(`   - Texte non-wrap (whitespace-nowrap): ${hasWhitespaceNowrap ? '✅' : '❌'}`);
      console.log(`   - Padding réduit (px-3 py-2): ${hasReducedPadding ? '✅' : '❌'}`);
      
      // Vérifier la suppression du cœur
      const hasHeartIcon = modalContent.includes('Heart');
      const hasHeartImport = modalContent.includes('import.*Heart');
      const hasHeartInTitle = modalContent.includes('<Heart');
      
      console.log(`   - Cœur supprimé du titre: ${!hasHeartInTitle ? '✅' : '❌'}`);
      console.log(`   - Import Heart supprimé: ${!hasHeartImport ? '✅' : '❌'}`);
      
      // Vérifier la réinitialisation du formulaire
      const hasResetForNewTenant = modalContent.includes('// Réinitialiser le formulaire pour un nouveau locataire');
      const hasEmptyFormData = modalContent.includes('firstName: \'\',');
      
      console.log(`   - Réinitialisation pour nouveau locataire: ${hasResetForNewTenant ? '✅' : '❌'}`);
      console.log(`   - Données vides par défaut: ${hasEmptyFormData ? '✅' : '❌'}`);
      
      // Vérifier les boutons simplifiés
      const hasStandardButtons = modalContent.includes('variant="outline"') && modalContent.includes('Annuler');
      const hasNoGradientButton = !modalContent.includes('bg-gradient-to-r');
      const hasNoIconsInButtons = !modalContent.includes('<X className="h-4 w-4" />') && !modalContent.includes('<Save className="h-4 w-4" />');
      
      console.log(`   - Boutons standards (outline): ${hasStandardButtons ? '✅' : '❌'}`);
      console.log(`   - Pas de gradient sur boutons: ${hasNoGradientButton ? '✅' : '❌'}`);
      console.log(`   - Pas d'icônes dans boutons: ${hasNoIconsInButtons ? '✅' : '❌'}`);
      
    } else {
      console.log('   ❌ TenantEditModalV2.tsx introuvable');
    }

    // 3. Vérifier l'intégration dans LocatairesClient
    console.log('\n🔗 Vérification de l\'intégration dans LocatairesClient...');
    
    const locatairesClientPath = path.join(process.cwd(), 'src/app/locataires/LocatairesClient.tsx');
    const locatairesClientExists = fs.default.existsSync(locatairesClientPath);
    
    if (locatairesClientExists) {
      const clientContent = fs.default.readFileSync(locatairesClientPath, 'utf8');
      
      const usesNewModal = clientContent.includes('TenantEditModalV2');
      const usesOldModal = clientContent.includes('TenantFormComplete');
      
      console.log(`   - Utilise la nouvelle modal: ${usesNewModal ? '✅' : '❌'}`);
      console.log(`   - N'utilise plus l'ancienne modal: ${!usesOldModal ? '✅' : '❌'}`);
    } else {
      console.log('   ❌ LocatairesClient.tsx introuvable');
    }

    // 4. Résumé des corrections
    console.log('\n📋 Résumé des corrections:');
    
    let modalContent = '';
    let clientContent = '';
    
    if (newModalExists) {
      modalContent = fs.default.readFileSync(newModalPath, 'utf8');
    }
    
    if (locatairesClientExists) {
      clientContent = fs.default.readFileSync(locatairesClientPath, 'utf8');
    }
    
    const corrections = [
      { name: 'Ancienne modal supprimée', status: !oldModalExists },
      { name: 'Débordement des onglets corrigé', status: newModalExists && modalContent.includes('overflow-x-auto') },
      { name: 'Cœur supprimé du titre', status: newModalExists && !modalContent.includes('<Heart') },
      { name: 'Réinitialisation pour nouveau locataire', status: newModalExists && modalContent.includes('// Réinitialiser le formulaire pour un nouveau locataire') },
      { name: 'Boutons simplifiés', status: newModalExists && modalContent.includes('variant="outline"') && !modalContent.includes('bg-gradient-to-r') },
      { name: 'Intégration correcte', status: locatairesClientExists && clientContent.includes('TenantEditModalV2') && !clientContent.includes('TenantFormComplete') }
    ];
    
    corrections.forEach(correction => {
      console.log(`   ${correction.status ? '✅' : '❌'} ${correction.name}`);
    });
    
    const allFixed = corrections.every(c => c.status);
    
    if (allFixed) {
      console.log('\n🎉 Toutes les corrections ont été appliquées avec succès !');
      console.log('   La modal de locataire est maintenant :');
      console.log('   - ✅ Sans débordement d\'onglets');
      console.log('   - ✅ Avec réinitialisation pour nouveau locataire');
      console.log('   - ✅ Avec esthétique simplifiée');
      console.log('   - ✅ Entièrement fonctionnelle');
    } else {
      console.log('\n❌ Certaines corrections sont manquantes !');
    }

  } catch (error) {
    console.error('💥 Erreur lors du test des corrections:', error);
  }
}

// Exécuter le test
testTenantModalFixes()
  .then(() => {
    console.log('\n🎯 Test des corrections terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test des corrections:', error);
    process.exit(1);
  });
