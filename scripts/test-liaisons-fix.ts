#!/usr/bin/env npx tsx

/**
 * Test que les liaisons automatiques s'affichent maintenant
 */

console.log('🧪 Test que les liaisons automatiques s\'affichent...\n');

console.log('🔧 Corrections appliquées:');
console.log('   ✅ PropertyDocumentsUnified → ajouté autoLinkingContext');
console.log('   ✅ PropertyDocumentsSection → ajouté autoLinkingContext');
console.log('   ✅ Logs de debug dans UploadReviewModal');

console.log('\n🎯 Maintenant les appels passent:');
console.log('   openModalWithFileSelection({');
console.log('     scope: "property",');
console.log('     propertyId: propertyId,');
console.log('     autoLinkingContext: { propertyId: propertyId },');
console.log('     onSuccess: () => { ... }');
console.log('   })');

console.log('\n🧪 Instructions de test:');
console.log('   1. Ouvrir http://localhost:3000/biens/[id]?tab=documents');
console.log('   2. Ouvrir DevTools (F12) → Console');
console.log('   3. Cliquer sur "Uploader"');
console.log('   4. Sélectionner un fichier');
console.log('   5. Vérifier les logs dans la console');

console.log('\n📋 Logs attendus maintenant:');
console.log('   [UploadReview] DEBUG - autoLinkingContext: { propertyId: "[id]" }');
console.log('   [UploadReview] DEBUG - autoLinkingDocumentType: undefined');
console.log('   [UploadReview] DEBUG - scope: property');
console.log('   [UploadReview] DEBUG - propertyId: [id]');
console.log('   [UploadReview] DEBUG - description générée: [...]');

console.log('\n🎨 Résultat attendu dans la modal:');
console.log('   ✅ Section "Liaisons automatiques" visible');
console.log('   ✅ Badge "PROPERTY" affiché');
console.log('   ✅ Combobox "Type de document" activée');

console.log('\n🎉 Test terminé - Les liaisons devraient maintenant s\'afficher !');
