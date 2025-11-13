#!/usr/bin/env tsx

/**
 * Script de test pour corriger le problème de montant de loyer
 * quand plusieurs baux sont disponibles et qu'un est sélectionné manuellement
 */

console.log('🔧 Test de correction du montant de loyer');
console.log('========================================\n');

console.log('🐛 Problème identifié:');
console.log('=====================');
console.log('   - Quand il y a un seul bail actif → montant se remplit ✅');
console.log('   - Quand il y a plusieurs baux et sélection manuelle → montant ne se remplit pas ❌');
console.log('   - La catégorie se met bien sur "Loyer" ✅');
console.log('   - Mais le montant reste vide ❌');
console.log('');

console.log('🔍 Analyse du problème:');
console.log('======================');
console.log('   - L\'effet "Modification du Bail" (lignes 139-192) devrait calculer le montant');
console.log('   - Il vérifie !autoFillState.isManual.amount avant de calculer');
console.log('   - Possible que isManual.amount soit true par erreur');
console.log('   - Ou que l\'effet ne se déclenche pas correctement');
console.log('');

console.log('🔧 Solution appliquée:');
console.log('=====================');
console.log('   - Ajout de logs de debug détaillés dans l\'effet de changement de bail');
console.log('   - Logs pour vérifier:');
console.log('     * Si l\'effet se déclenche');
console.log('     * Si le bail est trouvé');
console.log('     * Les valeurs rentAmount, rent, charges');
console.log('     * Si isManual.amount est true/false');
console.log('     * Si le montant est calculé et défini');
console.log('');

console.log('📋 Logs ajoutés:');
console.log('===============');
console.log('   - "=== CHANGEMENT DE BAIL ==="');
console.log('   - "LeaseId sélectionné: ..."');
console.log('   - "Bail trouvé: ..."');
console.log('   - "Rent amount: ..."');
console.log('   - "Rent: ..."');
console.log('   - "Charges: ..."');
console.log('   - "isManual.amount: ..."');
console.log('   - "Montant auto calculé: ..." ou "Montant manuel, pas de calcul auto"');
console.log('   - "Auto-fill state mis à jour"');
console.log('');

console.log('📝 Instructions de test:');
console.log('======================');
console.log('1. Ouvrez la modal "Nouvelle transaction"');
console.log('2. Sélectionnez un bien qui a plusieurs baux actifs');
console.log('3. Ouvrez la console du navigateur');
console.log('4. Sélectionnez un bail dans la liste déroulante');
console.log('5. Vérifiez les logs dans la console:');
console.log('   - L\'effet se déclenche-t-il ?');
console.log('   - Le bail est-il trouvé ?');
console.log('   - Les valeurs rent/charges sont-elles correctes ?');
console.log('   - isManual.amount est-il false ?');
console.log('   - Le montant est-il calculé ?');
console.log('6. Vérifiez que le champ "Montant" se remplit');
console.log('');

console.log('🚨 Problèmes possibles:');
console.log('======================');
console.log('1. isManual.amount est true par erreur');
console.log('2. L\'effet ne se déclenche pas (dépendances manquantes)');
console.log('3. Le bail n\'est pas trouvé dans la liste');
console.log('4. Les valeurs rent/charges sont undefined/null');
console.log('5. setValue ne fonctionne pas correctement');
console.log('');

console.log('💡 Solutions à tester:');
console.log('=====================');
console.log('1. Forcer isManual.amount à false au début');
console.log('2. Vérifier les dépendances de l\'useEffect');
console.log('3. Ajouter une vérification de l\'existence du bail');
console.log('4. Ajouter des logs pour setValue');
console.log('5. Tester avec un seul bail pour comparaison');
console.log('');

console.log('🎯 Objectif:');
console.log('===========');
console.log('Identifier pourquoi le montant ne se remplit pas quand');
console.log('plusieurs baux sont disponibles et qu\'un est sélectionné manuellement.');
