#!/usr/bin/env npx tsx

/**
 * Script de test complet du workflow BAIL_SIGNE
 */

console.log('🧪 Test complet du workflow BAIL_SIGNE\n');

console.log('📋 Instructions pour le test:');
console.log('1. Ouvrez la console du navigateur (F12)');
console.log('2. Allez sur la page des baux (/baux)');
console.log('3. Cliquez sur le bail avec statut "ENVOYÉ"');
console.log('4. Dans le drawer, cliquez sur "Uploader bail signé"');
console.log('5. Sélectionnez un fichier PDF');
console.log('6. Observez les logs dans la console du navigateur ET dans le terminal du serveur');

console.log('\n🔍 Logs à surveiller dans la console du navigateur:');
console.log('   [UploadReview] DEBUG - autoLinkingContext: {leaseId: "...", ...}');
console.log('   [UploadReview] DEBUG - autoLinkingDocumentType: BAIL_SIGNE');
console.log('   [UploadReview] DEBUG - selectedType: BAIL_SIGNE');

console.log('\n🔍 Logs à surveiller dans le terminal du serveur:');
console.log('   [Finalize] 🔍 Document BAIL_SIGNE détecté: ...');
console.log('   [Finalize] 🔍 documentContext: {...}');
console.log('   [Finalize] ✅ leaseId récupéré depuis documentContext: ...');
console.log('   [Finalize] Liaisons BAIL_SIGNE créées pour document ...');
console.log('   [Finalize] Statut du bail ... mis à jour à \'SIGNÉ\'');

console.log('\n❌ Si vous ne voyez PAS les logs [UploadReview] DEBUG:');
console.log('   - Le contexte n\'est pas passé correctement depuis l\'interface');
console.log('   - La modal n\'est pas ouverte avec le bon contexte');

console.log('\n❌ Si vous voyez les logs [UploadReview] mais PAS les logs [Finalize]:');
console.log('   - L\'API de finalisation n\'est pas appelée');
console.log('   - Il y a une erreur dans l\'upload du fichier');

console.log('\n❌ Si vous voyez les logs [Finalize] mais le statut ne change pas:');
console.log('   - Il y a une erreur dans la mise à jour du bail');
console.log('   - Le leaseId n\'est pas correct');

console.log('\n🎯 Bail de test disponible:');
console.log('   ID: cmgvdz4og0001n8cc4x3miaw0');
console.log('   Statut: ENVOYÉ');
console.log('   Locataire: Stephaniezeee Jasmin');
console.log('   Propriété: Stephanie Jasmin');

console.log('\n🔧 Si le problème persiste:');
console.log('   1. Vérifiez que le fichier sélectionné est un PDF');
console.log('   2. Vérifiez que l\'upload se termine sans erreur');
console.log('   3. Vérifiez que la page se recharge après l\'upload');
console.log('   4. Regardez les logs dans le terminal du serveur');

console.log('\n🚀 Prêt pour le test complet !');

