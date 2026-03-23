# Diagnostic : Cohérence historique transactions ↔ timeline bail

## 1. Historique existant

Exécuter le diagnostic :

```bash
npx tsx scripts/diagnostic-lease-transactions.ts
```

Le script affiche :

- **Total transactions** : toutes les transactions
- **Transactions type loyer** : `nature` = RECETTE_LOYER, LOYER, ou contient LOYER
- **Avec leaseId** : nombre et %
- **Avec accounting_month** : nombre et %
- **Les 3 champs OK** : transactions déjà compatibles avec la timeline
- **Sans leaseId** / **Sans accounting_month** : à corriger

---

## 2. Risque de divergence : sources de données

| Composant | Route / contexte | Source de données | Mode |
|-----------|------------------|-------------------|------|
| **Timeline du bail** | `/app?view=baux` (drawer détail bail) | **IndexedDB** via `TransactionRepositoryOffline.getAll({ leaseId })` | Toujours App Shell |
| **Écran Finances** | `/app?view=transactions` | **IndexedDB** via `getTransactionRepositoryOffline().getAll()` | App Shell |
| **Écran Finances** | `/transactions` (route classique) | **API Prisma** via `GET /api/transactions` | Normal |
| **Modal Enregistrer paiement** | Ouvert depuis Baux | **IndexedDB** via `createTransactionServiceWithMode('app-shell')` | App Shell |

### Contexte de test (App Shell uniquement)

Si vous utilisez uniquement **`/app`** (App Shell) :

- Timeline bail, écran Finances et modal de paiement lisent/écrivent **toutes depuis IndexedDB**.
- Les données sont synchronisées Prisma ↔ IndexedDB par `syncGlobal` / `fullSync`.
- **Pas de divergence** entre ces 3 composants, à condition que la sync soit à jour.

### Risque de divergence

1. **Mode mixte** : Si vous alternez `/app` et `/transactions` (route classique), l’écran Finances peut afficher Prisma pendant que la timeline lit IndexedDB. Divergence possible tant que la sync n’a pas été effectuée.
2. **Sync non exécutée** : Après des modifications côté API/Prisma, IndexedDB n’est pas à jour tant qu’une sync (bouton ou automatique) n’a pas été lancée.
3. **PendingOps non poussées** : Des écritures faites en offline restent dans `pendingOps` et ne sont pas encore dans Prisma.

### Recommandation

- Pour des tests cohérents : utiliser **uniquement `/app`** et lancer une sync avant de vérifier la timeline.
- Vérifier la page `/app?view=sync` pour l’état des pendingOps et de la dernière sync.

---

## 3. Plan de rattrapage

### Objectif

Rattacher automatiquement les anciennes transactions de loyer à leur bail et mois, afin que la timeline soit correcte sans ressaisie manuelle.

### Critères de rattachement

Une transaction de loyer peut être rattachée si :

1. `nature` compatible loyer (RECETTE_LOYER, LOYER ou contient LOYER)
2. `amount > 0`
3. `propertyId` renseigné
4. Un seul bail **actif** couvre la période du mois de la transaction pour ce bien

### Algorithme proposé

1. **Sans leaseId** : pour chaque transaction loyer sans `leaseId` :
   - Déduire le mois couvert : `accounting_month` > `year`+`month` > `date`
   - Trouver les baux actifs du bien dont `startDate <= 1er du mois` et `(endDate ?? ∞) >= dernier du mois`
   - Si un seul bail trouvé → affecter `leaseId`
   - Si plusieurs baux (chevauchement) → ne pas modifier (ambiguïté)

2. **Sans accounting_month** : pour chaque transaction loyer sans `accounting_month` :
   - Utiliser `year`+`month` si présents
   - Sinon utiliser la `date` de la transaction

3. **Mise à jour** : exécuter les `UPDATE` en base (Prisma), puis lancer une sync pour mettre à jour IndexedDB.

### Script de rattrapage

```bash
npx tsx scripts/backfill-lease-transactions.ts [--dry-run]
```

- Sans `--dry-run` : applique les modifications en base.
- Avec `--dry-run` : affiche ce qui serait fait sans modifier la base.

### Limites

- Transactions sans `propertyId` : non rattachables.
- Plusieurs baux actifs pour le même bien sur la même période : ambiguïté, pas de rattachement automatique.
- Transactions antérieures au début du bail ou postérieures à sa fin : pas de rattachement.
