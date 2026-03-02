# Checklist validation – Correctif « Importer mes données »

**Date :** 2025-03-01  
**Objectif :** Valider la correction de la régression sur le toggle « Importer mes données » (module Simulation fiscale).

---

## Modifications réalisées

### Phase 1 – Multi-tenant
- `requireAuth()` sur `/api/fiscal/aggregate` (POST et GET)
- `organizationId` obligatoire dans `FiscalAggregator.aggregate()`
- `getProperties()` filtre par `organizationId`
- Transactions filtrées par `organizationId` (défense en profondeur)
- Suppression de `userId: 'demo-user'` dans tous les clients
- Routes `simulate` et `optimize` passent `organizationId` à l’agrégateur

### Phase 2 – Offline-first
- Table `FiscalAggregateCache` dans IndexedDB (version 15)
- Cache après fetch réussi (clé `orgId:year:baseCalcul`)
- Mode offline : lecture cache IDB → badge « Données locales »
- Offline sans cache : message + bouton « Réessayer »
- Écouteur `online` pour proposer un rechargement

---

## Checklist de validation

### Local (npm run dev)

- [ ] Ouvrir `/fiscal` ou `/app?view=fiscal`
- [ ] Se connecter avec un compte ayant des biens
- [ ] Activer « Importer mes données » → les biens s’affichent
- [ ] Vérifier que les totaux (loyers, charges) correspondent
- [ ] Désactiver puis réactiver le toggle → rechargement correct
- [ ] Tester en mode offline (DevTools > Network > Offline) :
  - [ ] Après un import réussi en online → affichage du cache avec badge « Données locales »
  - [ ] Sans cache → message « Hors ligne » + bouton « Réessayer »
- [ ] Revenir en online → « Réessayer » recharge les données

### Vercel (production)

- [ ] Déployer sur Vercel
- [ ] Même scénario que en local
- [ ] Vérifier les logs serveur : `[API Aggregate] org=... year=... biens=...`

### Non-régression

- [ ] Sauvegarder une simulation → OK
- [ ] Charger une simulation sauvegardée → OK
- [ ] Calculer une simulation avec autofill → OK
- [ ] Export PDF → OK
- [ ] Page `/impots/simulation` (legacy) → autofill fonctionne

---

## Commandes utiles

```bash
# Build
npm run build

# Dev
npm run dev

# Test API aggregate (avec session cookie)
# Depuis la console navigateur après connexion :
fetch('/api/fiscal/aggregate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ year: 2025, baseCalcul: 'encaisse' }),
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

---

## Fichiers modifiés

| Fichier | Changements |
|---------|-------------|
| `src/app/api/fiscal/aggregate/route.ts` | `requireAuth()`, `organizationId`, suppression `userId` |
| `src/app/api/fiscal/simulate/route.ts` | `requireAuth()`, `organizationId` |
| `src/app/api/fiscal/optimize/route.ts` | `organizationId` passé à l’agrégateur |
| `src/services/tax/FiscalAggregator.ts` | `organizationId` dans options, `getProperties()`, `aggregateProperty()` |
| `src/components/fiscal/unified/tabs/SimulationTab.tsx` | Suppression `userId`, cache IDB, offline-first |
| `src/app/impots/simulation/SimulationClient.tsx` | Suppression `userId` |
| `src/lib/offline/db.ts` | Interface `FiscalAggregateCache`, table v15 |
