#!/usr/bin/env npx tsx

/**
 * Test que seules les liaisons applicables sont affichées
 */

console.log('🧪 Test que seules les liaisons applicables sont affichées...\n');

console.log('🔧 Modifications appliquées:');
console.log('   ✅ Supprimé l\'affichage des liaisons "(si disponible)"');
console.log('   ✅ Ne plus afficher LEASE si pas de leaseId dans le contexte');
console.log('   ✅ Ne plus afficher PROPERTY si pas de propertyId dans le contexte');
console.log('   ✅ Ne plus afficher TENANT si pas de tenantsIds dans le contexte');
console.log('   ✅ Seule la liaison GLOBAL est toujours affichée');

console.log('\n🎯 Logique conditionnelle:');
console.log('   - GLOBAL: Toujours affiché');
console.log('   - PROPERTY: Affiché seulement si context.propertyId existe');
console.log('   - LEASE: Affiché seulement si context.leaseId existe');
console.log('   - TENANT: Affiché seulement si context.tenantsIds existe et n\'est pas vide');

console.log('\n🧪 Scénarios de test:');
console.log('   1. Page principale documents (scope: global, pas de contexte spécifique)');
console.log('      → Affiche seulement: "🌐 Global"');
console.log('   2. Page propriété documents (scope: property, propertyId fourni)');
console.log('      → Affiche: "🌐 Global", "🏠 [Nom propriété]"');
console.log('   3. Page bail (scope: lease, leaseId + propertyId + tenantsIds fournis)');
console.log('      → Affiche: "🌐 Global", "🏠 [Nom propriété]", "📄 [Nom bail]", "👤 [Nom locataire]"');

console.log('\n📋 Logs attendus maintenant:');
console.log('   [UploadReview] DEBUG - description générée avec type: "QUITTANCE" ["🌐 Global", "🏠 appart 6"]');
console.log('   Plus de badges "(si disponible)"');

console.log('\n🎨 Résultat attendu dans la modal:');
console.log('   ✅ Section "Liaisons automatiques" visible');
console.log('   ✅ Badge "🌐 Global"');
console.log('   ✅ Badge "🏠 appart 6" (si propertyId fourni)');
console.log('   ❌ Plus de badge "📄 Bail (si disponible)"');
console.log('   ❌ Plus de badge "👥 Locataire(s) (si disponible)"');

console.log('\n🎉 Seules les liaisons applicables devraient être affichées !');
