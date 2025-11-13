#!/usr/bin/env tsx

/**
 * Script de test pour l'API de récupération des documents brouillons
 */

console.log('🔍 TEST DE L\'API DRAFT DOCUMENTS');
console.log('=================================\n');

console.log('📋 ÉTAPES DE TEST:');
console.log('==================');
console.log('1. Créer un document en staging via la modale Transaction');
console.log('2. Ouvrir la console du navigateur (F12)');
console.log('3. Cliquer sur l\'icône 👁️ du document en brouillon');
console.log('4. Vérifier les logs dans la console');
console.log('');

console.log('🔍 LOGS À SURVEILLER:');
console.log('=====================');
console.log('Frontend (console navigateur):');
console.log('• [UploadReview] Chargement du document brouillon: <id>');
console.log('• [UploadReview] Réponse API: <status> <statusText>');
console.log('• [UploadReview] Données reçues: <data>');
console.log('• [UploadReview] Document chargé avec succès');
console.log('');

console.log('Backend (terminal serveur):');
console.log('• [API] Récupération du document brouillon: <id>');
console.log('• [API] Document trouvé: <document_info>');
console.log('• [API] Document pas en mode draft: <status_info>');
console.log('');

console.log('❌ ERREURS POSSIBLES:');
console.log('====================');
console.log('• 404: Document non trouvé');
console.log('• 400: Document pas en mode brouillon');
console.log('• 500: Erreur serveur');
console.log('');

console.log('✅ SOLUTION SI ERREUR:');
console.log('=====================');
console.log('1. Vérifier que le document existe en base');
console.log('2. Vérifier que status = "draft"');
console.log('3. Vérifier que uploadSessionId n\'est pas null');
console.log('4. Vérifier les logs pour identifier le problème');
console.log('');

console.log('🚀 PRÊT POUR LE TEST !');
console.log('======================');
console.log('Ouvrez la console et testez l\'icône 👁️ sur un document brouillon.');
