# Améliorations Déduplication Commissions Auto

## Problème actuel

Lors de la création offline d'un loyer avec gestion déléguée :
1. TransactionService crée automatiquement la commission **localement** (offline)
2. Une `pendingOp` CREATE est créée pour cette commission
3. Lors de la sync TO remote : le serveur reçoit le loyer et **recrée** automatiquement la commission
4. Résultat : **2 commissions** (locale + serveur) = doublon

## Solution actuelle (correctif)

Déduplication avant l'overwrite lors de la sync FROM remote :
- Détection des commissions auto du serveur
- Suppression des commissions locales correspondantes (transaction + pendingOp)
- Critères de matching : `parentTransactionId` + `accounting_month` + `amount` + `categoryId` + `isAuto` + `autoSource`

### Limites de cette approche

1. **Correctif, pas solution racine** : Le vrai problème est la double création (offline + serveur)
2. **Critères de matching peuvent être insuffisants** :
   - Si les IDs changent (multi-device, regénération)
   - Si le montant diffère légèrement (arrondis, calculs différents)
   - Si `categoryId` change (changement de catégorie système)
3. **Risque de masquer des erreurs** : Suppression de commissions légitimes si matching incorrect

## Recommandations long terme

### Option A — Idempotency Key (Recommandée)

**Principe** : Utiliser un `autoKey` unique pour identifier les commissions auto de manière fiable.

```typescript
// Générer un autoKey lors de la création de la commission
const autoKey = `gestion|${parentTransactionId}|${accountingMonth}|${Math.round(amount * 100)}|${categorySystemCode}`;

// Côté serveur : utiliser upsert sur autoKey (index unique)
// Côté client : stocker autoKey dans la transaction + pendingOp
// Sync : réconciliation par autoKey au lieu de parentTransactionId
```

**Avantages** :
- Identification fiable même si les IDs changent
- Zéro doublon garanti (index unique côté serveur)
- Résilient aux changements d'IDs, multi-device, etc.

**Implémentation** :
1. Ajouter champ `autoKey` à `Transaction` (schéma Prisma + IndexedDB)
2. TransactionService génère `autoKey` pour toutes les commissions auto
3. Côté serveur : vérifier existence par `autoKey` avant création (ou upsert)
4. Sync : réconciliation par `autoKey` au lieu de critères multiples

### Option B — Server-Only Creation (Plus simple)

**Principe** : En app-shell offline, **ne pas créer** la commission auto réellement.

**Implémentation** :
1. En app-shell offline : TransactionService crée **seulement** le loyer (pas la commission)
2. UI peut afficher une "commission estimée" (calculée, non persistée) pour l'UX
3. Lors de la sync : le serveur crée la commission (comportement normal)
4. Résultat : Une seule source de création = zéro doublon

**Avantages** :
- Solution simple, robuste
- Pas de déduplication nécessaire
- Serveur = source unique de vérité pour les commissions

**Inconvénients** :
- Commission pas "réelle" en offline (calculée seulement pour l'affichage)
- Changement d'UX (commission apparaît seulement après sync)

## Solution actuelle améliorée (court terme)

Pour rendre la déduplication actuelle plus robuste :

### Critères de matching renforcés

```typescript
const matchingLocalCommissions = allLocalTransactions.filter((t: any) => {
  // Critères obligatoires pour être considéré comme la même commission
  const sameParent = t.parentTransactionId === serverAutoTx.parentTransactionId;
  const sameMonth = t.accounting_month === serverAutoTx.accounting_month;
  const sameAmount = Math.abs((t.amount || 0) - (serverAutoTx.amount || 0)) < 0.01; // Tolérance 0.01€
  const sameCategory = t.categoryId === serverAutoTx.categoryId;
  const isAutoCommission = t.isAuto === true && t.autoSource === 'gestion';
  const differentId = t.id !== serverAutoTx.id;
  
  return sameParent && sameMonth && sameAmount && sameCategory && isAutoCommission && differentId;
});
```

### Logs de traçabilité

Logs détaillés pour chaque réconciliation :
- IDs (local vs serveur)
- Critères de matching utilisés
- Action effectuée

### Garde-fous

- Ne supprimer que si **tous** les critères matchent
- Logs clairs pour debug
- Gestion d'erreurs non bloquante (ne pas casser la sync)

## Migration recommandée

**✅ IMPLÉMENTÉ** : Option B (Server-Only) pour les commissions auto en app-shell offline

### Implémentation

**Modifications apportées** :

1. **TransactionService** (`src/domain/services/TransactionService.ts`) :
   - Ajout du paramètre `skipAutoCommissions?: boolean` dans `CreateTransactionParams` et `UpdateTransactionParams`
   - Modifications dans `createTransaction()` et `updateTransaction()` pour sauter la création de commissions si `skipAutoCommissions === true`
   - Logique : `if (!params.skipAutoCommissions && params.gestionEnabled !== false) { ... création commission ... }`

2. **TransactionsPageCore** (`src/features/transactions/TransactionsPageCore.tsx`) :
   - Ajout de `skipAutoCommissions: mode === 'app-shell'` lors des appels à `transactionService.createTransaction()` en mode app-shell
   - En mode app-shell, les commissions ne sont plus créées localement

3. **syncGlobal.ts** (`src/lib/offline/syncGlobal.ts`) :
   - Suppression complète de la logique de déduplication (plus nécessaire)
   - Commentaire explicatif : "OPTION B IMPLÉMENTÉE : Déduplication retirée car les commissions auto ne sont plus créées en app-shell offline"

### Comportement actuel

**En mode app-shell offline** :
- TransactionService crée **seulement** le loyer (pas la commission)
- Une `pendingOp` CREATE est créée uniquement pour le loyer
- Lors de la sync TO remote : le serveur reçoit le loyer et **crée automatiquement** la commission (comportement normal)
- Résultat : **Zéro doublon** (une seule source de création = serveur)

**En mode normal (online)** :
- TransactionService crée le loyer **et** la commission (comportement inchangé)
- Pas de `skipAutoCommissions`, donc création normale

### Avantages de cette implémentation

- ✅ **Simple** : Pas de changement de schéma nécessaire
- ✅ **Robuste** : Zéro doublon possible (serveur = source unique de vérité)
- ✅ **Pérenne** : Pas de logique de déduplication complexe à maintenir
- ✅ **Minimal** : Changements limités au code existant

### Limitation

- Les commissions n'apparaissent pas "réellement" en offline (elles sont créées seulement après sync)
- L'UI peut éventuellement afficher une "commission estimée" (calculée, non persistée) si nécessaire pour l'UX

### Long terme (si besoin de commissions offline "réelles")

Si besoin de commissions offline "réelles", implémenter Option A (autoKey/idempotency) :
- Nécessite migration de schéma
- Plus complexe mais plus flexible
- Permet d'avoir des commissions "réelles" même en offline

