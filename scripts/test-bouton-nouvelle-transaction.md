# Test - Bouton "Nouvelle transaction" corrigé

## Instructions de test

### 1. Démarrer le serveur (si pas déjà fait)
```bash
npm run dev
```

### 2. Accéder à la page transactions
- Ouvrir votre navigateur
- Aller sur : `http://localhost:3000/transactions`

### 3. Test du bouton "Nouvelle transaction"

#### Test 1 : Ouverture de la modal
1. Cliquer sur le bouton **"Nouvelle Transaction"** (en haut à droite)
2. ✅ **Attendu** : La modal doit s'ouvrir
3. ✅ **Attendu** : Le titre doit être "Nouvelle transaction"
4. ✅ **Attendu** : 3 onglets visibles : "Informations essentielles", "Paiement", "Période"

#### Test 2 : Contexte global vérifié
1. Observer le champ **"Bien"**
2. ✅ **Attendu** : Le champ est vide
3. ✅ **Attendu** : Aucun badge "verrouillé" n'est affiché
4. ✅ **Attendu** : La liste déroulante contient tous les biens

#### Test 3 : Sélection d'un bien
1. Sélectionner un bien dans la liste déroulante
2. ✅ **Attendu** : Le champ "Bail" se met à jour avec les baux du bien
3. ✅ **Attendu** : Les baux ACTIF apparaissent en premier
4. Observer le message dans la console du navigateur (F12)

#### Test 4 : Sélection d'un bail
1. Sélectionner un bail dans la liste
2. ✅ **Attendu** : Le champ "Locataire" se remplit automatiquement
3. ✅ **Attendu** : Un badge "⚡ auto" apparaît à côté du locataire
4. ✅ **Attendu** : Le champ "Nature" se met sur "Loyer (recette)"
5. ✅ **Attendu** : Un badge "⚡ auto" apparaît à côté de Nature
6. ✅ **Attendu** : Le champ "Montant" se remplit avec loyer + charges
7. ✅ **Attendu** : Un badge "⚡ auto" apparaît à côté du montant

#### Test 5 : Génération du libellé
1. Observer le champ "Libellé"
2. ✅ **Attendu** : Le libellé est auto-généré (ex: "Loyer octobre 2025 – Nom du bien")
3. ✅ **Attendu** : Un badge "⚡ auto" apparaît à côté du libellé

#### Test 6 : Aperçu en temps réel
1. Faire défiler vers le bas de l'onglet "Informations essentielles"
2. ✅ **Attendu** : Une section "Aperçu de la transaction" est visible
3. ✅ **Attendu** : L'aperçu montre : Libellé, Nature, Catégorie, Montant
4. ✅ **Attendu** : L'aperçu se met à jour en temps réel

#### Test 7 : Modification manuelle
1. Modifier manuellement le champ "Libellé"
2. ✅ **Attendu** : Le badge "⚡ auto" disparaît
3. ✅ **Attendu** : Le libellé ne se met plus à jour automatiquement

#### Test 8 : Sélection de catégorie
1. Sélectionner une catégorie dans la liste
2. ✅ **Attendu** : Si une seule catégorie compatible, elle est auto-sélectionnée
3. ✅ **Attendu** : Si aucune catégorie compatible, message d'erreur clair

#### Test 9 : Validations
1. Laisser des champs obligatoires vides
2. ✅ **Attendu** : Le bouton "Créer" est désactivé
3. ✅ **Attendu** : Messages d'erreur clairs sous les champs vides
4. Remplir tous les champs obligatoires
5. ✅ **Attendu** : Le bouton "Créer" devient actif

#### Test 10 : Onglets Paiement et Période
1. Cliquer sur l'onglet **"Paiement"**
2. ✅ **Attendu** : Champs "Date de paiement", "Mode de paiement", "Notes" visibles
3. Cliquer sur l'onglet **"Période"**
4. ✅ **Attendu** : Champs "Début de période", "Nombre de mois couverts", "Répartition automatique" visibles

#### Test 11 : Création d'une transaction
1. Remplir tous les champs obligatoires
2. Cliquer sur **"Créer"**
3. ✅ **Attendu** : Spinner visible sur le bouton
4. ✅ **Attendu** : Toast de succès "Transaction créée avec succès"
5. ✅ **Attendu** : La modal se ferme
6. ✅ **Attendu** : La page se rafraîchit avec la nouvelle transaction

#### Test 12 : Fermeture de la modal
1. Ouvrir la modal
2. Cliquer sur le bouton **"X"** en haut à droite
3. ✅ **Attendu** : La modal se ferme
4. Ouvrir à nouveau la modal
5. Cliquer sur **"Annuler"** en bas
6. ✅ **Attendu** : La modal se ferme

## Vérifications dans la console

### Console du navigateur (F12)
- Pas d'erreurs JavaScript
- Logs de debug si configurés
- Requêtes API réussies (200 OK)

### Console du terminal (serveur)
- Pas d'erreurs de compilation
- Requêtes API loggées

## Résultats attendus

### ✅ Tous les tests passent
- Le bouton "Nouvelle transaction" fonctionne
- La modal s'ouvre dans le contexte global
- Tous les champs fonctionnent correctement
- Les badges "auto" et "verrouillé" s'affichent
- Les validations fonctionnent
- La création de transaction fonctionne

### ❌ Si un test échoue
1. Vérifier la console du navigateur pour les erreurs
2. Vérifier la console du serveur pour les erreurs
3. Vérifier que le serveur a été redémarré après les modifications
4. Consulter `FIX-BOUTON-NOUVELLE-TRANSACTION.md` pour la documentation

## Tests supplémentaires

### Test avec différents types de biens
1. Tester avec un bien qui a plusieurs baux ACTIF
2. Tester avec un bien qui n'a aucun bail
3. Tester avec un bien qui a des baux RÉSILIÉ uniquement

### Test avec différentes natures
1. Tester avec "Loyer (recette)"
2. Tester avec "Charges (recette)"
3. Tester avec "Réparation (dépense)"
4. Observer le filtrage des catégories

### Test de la répartition automatique
1. Aller dans l'onglet "Période"
2. Définir "Nombre de mois couverts" à 3
3. Cocher "Répartition automatique"
4. ✅ **Attendu** : Aperçu de la répartition affiché

## Support

Pour toute question ou problème :
- Consulter `UNIFIED-TRANSACTION-MODAL-GUIDE.md`
- Consulter `FIX-BOUTON-NOUVELLE-TRANSACTION.md`
- Exécuter `npx tsx scripts/test-unified-transaction-modal.ts`
