#!/usr/bin/env npx tsx

/**
 * Test que les liaisons s'affichent avec selectedType
 */

console.log('🧪 Test que les liaisons s\'affichent avec selectedType...\n');

console.log('🔧 Correction appliquée:');
console.log('   ✅ Logique modifiée pour utiliser selectedType quand autoLinkingDocumentType n\'est pas fourni');
console.log('   ✅ let typeToUse = autoLinkingDocumentType || selectedType;');
console.log('   ✅ selectedType ajouté aux dépendances du useEffect');

console.log('\n🎯 Maintenant la logique:');
console.log('   1. autoLinkingContext est passé (propertyId)');
console.log('   2. autoLinkingDocumentType est undefined (normal)');
console.log('   3. selectedType est défini par l\'IA ("Quittance de loyer")');
console.log('   4. typeToUse = undefined || "Quittance de loyer" = "Quittance de loyer"');
console.log('   5. DocumentAutoLinkingService.getLinkingDescription("Quittance de loyer", {propertyId})');
console.log('   6. Description générée avec les liaisons PROPERTY');

console.log('\n🧪 Instructions de test:');
console.log('   1. Ouvrir http://localhost:3000/biens/[id]?tab=documents');
console.log('   2. Ouvrir DevTools (F12) → Console');
console.log('   3. Cliquer sur "Uploader"');
console.log('   4. Sélectionner un fichier');
console.log('   5. Vérifier les logs dans la console');

console.log('\n📋 Logs attendus maintenant:');
console.log('   [UploadReview] DEBUG - autoLinkingContext: {propertyId: "[id]"}');
console.log('   [UploadReview] DEBUG - autoLinkingDocumentType: undefined');
console.log('   [UploadReview] DEBUG - selectedType: "Quittance de loyer"');
console.log('   [UploadReview] DEBUG - description générée avec type: "Quittance de loyer" [...]');

console.log('\n🎨 Résultat attendu dans la modal:');
console.log('   ✅ Section "Liaisons automatiques" visible');
console.log('   ✅ Badge "PROPERTY" affiché');
console.log('   ✅ Combobox "Type de document" activée');

console.log('\n🎉 Les liaisons devraient maintenant s\'afficher !');
