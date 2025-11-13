#!/usr/bin/env npx tsx

/**
 * Script pour déboguer l'API de finalisation en temps réel
 */

console.log('🔍 Débogueur de l\'API de finalisation\n');

console.log('📋 Instructions:');
console.log('1. Ouvrez la console du navigateur (F12)');
console.log('2. Allez sur la page du bail avec statut "ENVOYÉ"');
console.log('3. Cliquez sur "Upload bail signé"');
console.log('4. Observez les logs dans la console du navigateur');
console.log('5. Regardez aussi les logs du serveur (terminal où vous avez lancé npm run dev)');

console.log('\n🔍 Logs à surveiller:');
console.log('   - [UploadReview] DEBUG - autoLinkingContext: {...}');
console.log('   - [UploadReview] DEBUG - autoLinkingDocumentType: BAIL_SIGNE');
console.log('   - [Finalize] Liaisons BAIL_SIGNE créées pour document ...');
console.log('   - [Finalize] Statut du bail ... mis à jour à \'SIGNÉ\'');

console.log('\n❌ Si vous ne voyez PAS ces logs:');
console.log('   - Le contexte n\'est pas passé correctement');
console.log('   - L\'API de finalisation n\'est pas appelée');
console.log('   - Il y a une erreur dans le flux');

console.log('\n✅ Si vous voyez ces logs mais le statut ne change pas:');
console.log('   - Il y a une erreur dans la mise à jour du bail');
console.log('   - Le leaseId n\'est pas correct');
console.log('   - Il y a une erreur de base de données');

console.log('\n🎯 Bail de test disponible:');
console.log('   ID: cmgvdz4og0001n8cc4x3miaw0');
console.log('   Statut: ENVOYÉ');
console.log('   Locataire: Stephaniezeee Jasmin');
console.log('   Propriété: Stephanie Jasmin');

console.log('\n🚀 Prêt pour le test !');

