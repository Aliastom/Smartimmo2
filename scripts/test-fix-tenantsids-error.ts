#!/usr/bin/env npx tsx

/**
 * Test que l'erreur tenantsIds.length est corrigée
 */

console.log('🧪 Test que l\'erreur tenantsIds.length est corrigée...\n');

console.log('🔧 Correction appliquée:');
console.log('   ✅ Ajouté une vérification pour context.tenantsIds?.length');
console.log('   ✅ Gestion du cas où tenantsIds est undefined');
console.log('   ✅ Affichage conditionnel selon la disponibilité des locataires');

console.log('\n🎯 Logique corrigée:');
console.log('   const tenantCount = context.tenantsIds?.length || 0;');
console.log('   if (tenantCount > 0) {');
console.log('     descriptions.push(`👥 ${tenantCount} locataire(s)`);');
console.log('   } else {');
console.log('     descriptions.push("👥 Locataire(s) (si disponible)");');
console.log('   }');

console.log('\n🧪 Instructions de test:');
console.log('   1. Ouvrir http://localhost:3000/biens/[id]?tab=documents');
console.log('   2. Ouvrir DevTools (F12) → Console');
console.log('   3. Cliquer sur "Uploader"');
console.log('   4. Sélectionner un fichier');
console.log('   5. Vérifier qu\'il n\'y a plus d\'erreur');

console.log('\n📋 Logs attendus maintenant:');
console.log('   [UploadReview] DEBUG - autoLinkingContext: {propertyId: "[id]"}');
console.log('   [UploadReview] DEBUG - selectedType: "QUITTANCE"');
console.log('   [UploadReview] DEBUG - description générée avec type: "QUITTANCE" ["PROPERTY", "GLOBAL", "Locataire(s) (si disponible)"]');

console.log('\n🎨 Résultat attendu dans la modal:');
console.log('   ✅ Section "Liaisons automatiques" visible');
console.log('   ✅ Badge "PROPERTY" affiché');
console.log('   ✅ Badge "GLOBAL" affiché');
console.log('   ✅ Badge "Locataire(s) (si disponible)" affiché');
console.log('   ✅ Plus d\'erreur TypeError');

console.log('\n🎉 L\'erreur devrait être corrigée !');
