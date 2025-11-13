#!/usr/bin/env npx tsx

/**
 * Script pour tester le workflow dans bien/baux
 */

console.log('🧪 Test du workflow dans bien/baux après la correction\n');

console.log('✅ Correction appliquée dans /api/documents/finalize:');
console.log('   - Utilisation de finalDocumentUrl au lieu de document.url');
console.log('   - Ajout de logs détaillés pour tracer l\'exécution');
console.log('');

console.log('📋 Instructions pour tester dans bien/baux:');
console.log('1. Rechargez le serveur Next.js (Ctrl+C puis npm run dev)');
console.log('2. Allez sur la page de détail d\'une propriété (/biens/[id])');
console.log('3. Cliquez sur l\'onglet "Baux"');
console.log('4. Cliquez sur le bouton "Modifier" (icône Edit) d\'un bail ENVOYÉ');
console.log('5. Dans la modal, cliquez sur l\'onglet "Statut et workflow"');
console.log('6. Cliquez sur "Upload bail signé"');
console.log('7. Sélectionnez un fichier PDF ou image');
console.log('8. Cliquez sur "Enregistrer" dans la modal');
console.log('');

console.log('🔍 Logs à surveiller dans le terminal du serveur:');
console.log('   [Finalize] 🔍 Vérification du type de document:');
console.log('   [Finalize] 🔍 Document BAIL_SIGNE détecté: ...');
console.log('   [Finalize] ✅ leaseId récupéré depuis documentContext: ...');
console.log('   [Finalize] Liaisons BAIL_SIGNE créées pour document ...');
console.log('   [Finalize] ✅ Statut du bail ... mis à jour à \'SIGNÉ\' avec URL: ...');
console.log('');

console.log('✅ Résultat attendu:');
console.log('   - Le document est créé avec le type BAIL_SIGNE');
console.log('   - Les liaisons sont créées (LEASE, PROPERTY, TENANT, GLOBAL)');
console.log('   - Le bail passe de "ENVOYÉ" à "SIGNÉ"');
console.log('   - Le bail affiche le statut runtime "ACTIF" si la période est en cours');
console.log('   - La modal se met à jour avec le nouveau statut');
console.log('');

console.log('🎯 Bail de test disponible:');
console.log('   ID: cmgvewqfc0069n8iokl1lqctp');
console.log('   Statut: ENVOYÉ');
console.log('   Locataire: THOMASs DUBIGNY');
console.log('   Propriété: appart 6');
console.log('');

console.log('🚀 Prêt pour le test dans bien/baux !');

