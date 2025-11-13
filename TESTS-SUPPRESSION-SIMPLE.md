# Tests - Système de Suppression Simple

## 🎯 Objectif

Ce document décrit comment préparer et exécuter les tests pour valider le système de suppression simple des documents et transactions.

## 📦 Préparation des données de test

### Exécution du script

```bash
npx tsx scripts/prepare-test-data-suppression.ts
```

### Données créées

Le script crée automatiquement :

#### Entités principales
- **P1** : Bien "Appartement Test Suppression"
- **Locataire** : Jean TestSuppression
- **L1** : Bail actif lié à P1 et au locataire
- **T1** : Transaction "Loyer Test Suppression" liée à P1 et L1

#### Documents de test
- **D1 (draft)** : `Document-D1-Draft-Multi-Liens.pdf`
  - Statut : `draft`
  - Lié à : Bien P1 + Bail L1 + Transaction T1
  - 📌 Pour tester la suppression avec multiples liaisons

- **D2 (final)** : `Document-D2-Final-Transaction.pdf`
  - Statut : `active`
  - Lié à : Transaction T1
  - 📌 Pour tester la suppression avec 1 liaison

- **D3 (isolé)** : `Document-D3-Final-Isole.pdf`
  - Statut : `active`
  - Lié à : AUCUN
  - 📌 Pour tester la suppression d'un document global/isolé

## ✅ Scénarios de test

### 1️⃣ Test : Suppression D1 (document avec multiples liaisons)

**Objectif** : Vérifier que la modal affiche toutes les liaisons avant suppression

**Étapes** :
1. Aller dans `/documents`
2. Chercher "Document-D1-Draft-Multi-Liens.pdf"
3. Cliquer sur le bouton Supprimer (icône Trash)
4. **Vérifications modal** :
   - ✅ Titre : "Supprimer ce document ?"
   - ✅ Message : "Attention : ce document est lié à :"
   - ✅ Liste affichée avec 3 liaisons :
     - Bien : Appartement Test Suppression
     - Bail : (avec nom du bien et locataire)
     - Transaction : Loyer Test Suppression
   - ✅ Texte d'avertissement : "La suppression entraînera la disparition définitive du fichier et de toutes ses liaisons. Êtes-vous sûr ?"
   - ✅ 2 boutons : "Annuler" (outline) et "Supprimer définitivement" (rouge)
5. Cliquer sur "Annuler" → Modal se ferme, rien n'est supprimé
6. Re-ouvrir la modal et cliquer sur "Supprimer définitivement"
7. **Vérifications post-suppression** :
   - ✅ Toast de succès affiché
   - ✅ Document supprimé de la liste
   - ✅ Fichier physique supprimé du disque (`storage/documents/test-d1-suppression.pdf`)
   - ✅ Les 3 liaisons supprimées de la table `DocumentLink`

**Commande de vérification** :
```sql
-- Doit retourner 0 résultat
SELECT * FROM DocumentLink WHERE documentId = 'test-d1-suppression';
```

---

### 2️⃣ Test : Suppression D2 (document avec 1 liaison)

**Objectif** : Vérifier que la modal affiche la liaison unique

**Étapes** :
1. Aller dans `/documents`
2. Chercher "Document-D2-Final-Transaction.pdf"
3. Cliquer sur le bouton Supprimer
4. **Vérifications modal** :
   - ✅ Liste affichée avec 1 liaison :
     - Transaction : Loyer Test Suppression
5. Confirmer la suppression
6. **Vérifications post-suppression** :
   - ✅ Document supprimé
   - ✅ Fichier physique supprimé
   - ✅ La liaison supprimée

---

### 3️⃣ Test : Suppression D3 (document isolé/global)

**Objectif** : Vérifier que la modal affiche le message simple sans liste de liaisons

**Étapes** :
1. Aller dans `/documents`
2. Chercher "Document-D3-Final-Isole.pdf"
3. Cliquer sur le bouton Supprimer
4. **Vérifications modal** :
   - ✅ Titre : "Supprimer ce document ?"
   - ✅ Message simple : "La suppression entraînera la disparition définitive du fichier. Êtes-vous sûr ?"
   - ✅ PAS de liste de liaisons affichée
   - ✅ 2 boutons : "Annuler" et "Supprimer définitivement"
5. Confirmer la suppression
6. **Vérifications post-suppression** :
   - ✅ Document supprimé
   - ✅ Fichier physique supprimé

---

### 4️⃣ Test : Suppression D2 depuis la modal de transaction

**Objectif** : Vérifier que la suppression fonctionne depuis la modal d'édition de transaction

**Prérequis** : Réexécuter le script pour recréer D2 si nécessaire

**Étapes** :
1. Aller dans `/transactions`
2. Chercher "Loyer Test Suppression"
3. Cliquer sur la transaction pour éditer
4. Aller dans l'onglet "Documents"
5. Trouver "Document-D2-Final-Transaction.pdf"
6. Cliquer sur l'icône X (supprimer)
7. **Vérifications modal** :
   - ✅ Modal de confirmation s'affiche
   - ✅ Liste montre la liaison avec la transaction
8. Confirmer la suppression
9. **Vérifications post-suppression** :
   - ✅ Document supprimé
   - ✅ Liste des documents dans la modal se recharge automatiquement
   - ✅ Le document n'apparaît plus dans la liste

---

### 5️⃣ Test : Suppression transaction T1 - Mode "Supprimer les documents"

**Objectif** : Vérifier que les documents liés sont supprimés avec la transaction

**Prérequis** : Réexécuter le script pour recréer toutes les données

**Étapes** :
1. Aller dans `/transactions`
2. Chercher "Loyer Test Suppression"
3. Cliquer sur le bouton Supprimer
4. **Vérifications modal** :
   - ✅ Titre : "Supprimer cette transaction ?"
   - ✅ Message : "Attention : la transaction contient des documents..."
   - ✅ 2 choix radio affichés :
     - ○ Supprimer les documents et toutes leurs liaisons (action irréversible)
     - ○ Conserver les documents en ne laissant que la liaison globale
   - ✅ Le 2ème choix est sélectionné par défaut
5. Sélectionner le 1er choix : "Supprimer les documents..."
6. Cliquer sur "Supprimer la transaction"
7. **Vérifications post-suppression** :
   - ✅ Toast de succès : "Transaction et documents supprimés"
   - ✅ Transaction supprimée de la liste
   - ✅ Aller dans `/documents` : D1 et D2 ont disparu
   - ✅ Fichiers physiques supprimés du disque

**Commande de vérification** :
```sql
-- Doit retourner 0 résultat
SELECT * FROM Document WHERE id IN ('test-d1-suppression', 'test-d2-suppression');
SELECT * FROM Transaction WHERE id = 'test-t1-suppression';
```

---

### 6️⃣ Test : Suppression transaction T1 - Mode "Conserver les documents"

**Objectif** : Vérifier que les documents restent visibles dans /documents sans liaisons

**Prérequis** : Réexécuter le script pour recréer toutes les données

**Étapes** :
1. Aller dans `/transactions`
2. Chercher "Loyer Test Suppression"
3. Cliquer sur le bouton Supprimer
4. **Vérifications modal** :
   - ✅ 2 choix radio affichés
5. Garder le choix par défaut : "Conserver les documents en ne laissant que la liaison globale"
6. Cliquer sur "Supprimer la transaction"
7. **Vérifications post-suppression** :
   - ✅ Toast de succès : "Transaction supprimée, documents conservés"
   - ✅ Transaction supprimée de la liste
   - ✅ Aller dans `/documents` : D1 et D2 sont TOUJOURS présents
   - ✅ Fichiers physiques toujours sur le disque
   - ✅ Les documents n'ont PLUS de liaisons (deviennent "globaux")

**Commande de vérification** :
```sql
-- Documents toujours présents
SELECT * FROM Document WHERE id IN ('test-d1-suppression', 'test-d2-suppression');
-- Aucune liaison restante
SELECT * FROM DocumentLink WHERE documentId IN ('test-d1-suppression', 'test-d2-suppression');
-- Transaction supprimée
SELECT * FROM Transaction WHERE id = 'test-t1-suppression';
```

---

### 7️⃣ Test : Suppression transaction sans documents

**Objectif** : Vérifier que la suppression est simple si pas de documents

**Prérequis** : 
1. Réexécuter le script
2. Supprimer manuellement D1 et D2 (ou via l'UI)

**Étapes** :
1. Aller dans `/transactions`
2. Chercher "Loyer Test Suppression"
3. Cliquer sur le bouton Supprimer
4. **Vérifications modal** :
   - ✅ Message simple : "Êtes-vous sûr de vouloir supprimer cette transaction ?"
   - ✅ PAS de choix radio (car pas de documents)
   - ✅ 2 boutons : "Annuler" et "Supprimer la transaction"
5. Confirmer la suppression
6. **Vérifications post-suppression** :
   - ✅ Transaction supprimée

---

## 🧹 Nettoyage

Pour supprimer toutes les données de test :

```bash
npx tsx scripts/clean-test-data-suppression.ts
```

Ce script supprime :
- Les 3 documents (D1, D2, D3)
- Les fichiers physiques
- La transaction (T1)
- Le bail (L1)
- Le locataire
- Le bien (P1)

## 📊 Checklist complète

- [ ] Test 1 : Suppression D1 (multi-liaisons)
- [ ] Test 2 : Suppression D2 (1 liaison)
- [ ] Test 3 : Suppression D3 (isolé)
- [ ] Test 4 : Suppression depuis modal transaction
- [ ] Test 5 : Suppression transaction mode "Supprimer docs"
- [ ] Test 6 : Suppression transaction mode "Conserver docs"
- [ ] Test 7 : Suppression transaction sans documents

## 🐛 Points d'attention

### UI/UX
- [ ] Les modals s'ouvrent correctement
- [ ] Le loading s'affiche pendant les opérations
- [ ] Les toasts de succès/erreur s'affichent
- [ ] Les listes se rechargent après suppression
- [ ] Pas de console errors
- [ ] Les textes français sont corrects

### Fonctionnel
- [ ] Les fichiers physiques sont bien supprimés du disque
- [ ] Les liaisons sont supprimées de la DB
- [ ] Le mode "keep_docs_globalize" conserve bien les documents
- [ ] Le mode "delete_docs" supprime bien tout
- [ ] Pas de doublons créés
- [ ] Pas de bugs lors d'annulation

### Performance
- [ ] Les modals s'ouvrent rapidement
- [ ] Le chargement des liaisons est rapide (<1s)
- [ ] Pas de ralentissements perceptibles

## 💡 Commandes utiles

### Vérifier les documents de test
```sql
SELECT id, filenameOriginal, status, 
       (SELECT COUNT(*) FROM DocumentLink WHERE documentId = Document.id) as nb_liens
FROM Document 
WHERE id LIKE 'test-%';
```

### Vérifier les liaisons
```sql
SELECT dl.*, d.filenameOriginal
FROM DocumentLink dl
JOIN Document d ON d.id = dl.documentId
WHERE dl.documentId LIKE 'test-%';
```

### Vérifier la transaction
```sql
SELECT t.*, 
       (SELECT COUNT(*) FROM DocumentLink WHERE linkedType = 'transaction' AND linkedId = t.id) as nb_docs
FROM Transaction t
WHERE t.id = 'test-t1-suppression';
```

---

**Bonne chance pour les tests ! 🚀**

