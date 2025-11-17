# 📊 Optimisation des Performances - Smartimmo2

**Date :** Janvier 2025  
**Objectif :** Optimiser la qualité du code et les performances (front + back)

---

## 🎯 Résumé Exécutif

Ce document résume les optimisations de performance et de qualité de code réalisées sur l'application Smartimmo2. Les optimisations couvrent le frontend (React, Next.js), le backend (Prisma, PostgreSQL) et la configuration générale du projet.

---

## 🔍 Problèmes Identifiés

### 1. Double Chargement et Re-renders
- **Symptôme :** Pages effectuant plusieurs appels API au chargement (x4 dans certains cas)
- **Causes :**
  - React StrictMode activé en développement (normal, mais provoque des doubles renders)
  - `useEffect` sans protection contre les re-renders
  - Absence de cache avec React Query sur certaines pages
  - Objets de filtres recréés à chaque render

### 2. Logs de Débogage Prolifiques
- **Symptôme :** 10 759 occurrences de `console.log` dans 591 fichiers
- **Impact :** Console polluée, performance en production, sécurité (informations sensibles)

### 3. Requêtes Prisma Non Optimisées
- **Symptôme :** Chargement de toutes les transactions sans pagination (`/api/insights`)
- **Causes :**
  - Requêtes N+1 potentielles
  - Absence d'agrégation pour calculer les totaux
  - Chargement de données inutiles en mémoire

### 4. Configuration React Query Sous-Optimale
- **Symptôme :** `staleTime` trop court (30 secondes), refetch automatique activé
- **Impact :** Requêtes réseau inutiles, cache inefficace

### 5. Composants Lourds Sans Dynamic Import
- **Symptôme :** Recharts chargé de manière statique sur toutes les pages
- **Impact :** Bundle JavaScript plus gros, temps de chargement initial plus long

---

## ✅ Solutions Appliquées

### 1. Configuration ESLint Stricte

**Fichier :** `.eslintrc.cjs`

- ✅ Ajout de la règle `no-console` avec exceptions pour `console.warn`, `console.error`, `console.info`
- ✅ Exclusion des scripts et fichiers de test de la règle
- ✅ Conservation des règles de nommage existantes

```javascript
'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
```

### 2. Système de Logging Contrôlé

**Fichier :** `src/lib/utils/logger.ts`

- ✅ Création d'un wrapper `logDebug()` activé uniquement en développement ou via `NEXT_PUBLIC_DEBUG=true`
- ✅ Fonctions utilitaires : `logDebug()`, `logInfo()`, `logError()`, `logWarn()`
- ✅ Permet de contrôler les logs via variable d'environnement

**Utilisation :**
```typescript
import { logDebug, logError } from '@/lib/utils/logger';

logDebug('Message de débogage'); // Uniquement en dev
logError('Erreur critique'); // Toujours actif
```

### 3. Optimisation React Query

**Fichier :** `src/ui/providers/QueryProvider.tsx`

**Avant :**
```typescript
staleTime: 30_000, // 30 secondes
refetchOnWindowFocus: false,
```

**Après :**
```typescript
staleTime: 5 * 60 * 1000, // 5 minutes
gcTime: 10 * 60 * 1000, // 10 minutes
refetchOnWindowFocus: false,
refetchOnMount: false,
refetchOnReconnect: false,
```

**Bénéfices :**
- ✅ Cache plus long pour réduire les requêtes réseau
- ✅ Pas de refetch automatique au focus/remount
- ✅ ReactQueryDevtools uniquement en développement

### 4. Migration Dashboard vers React Query

**Fichier :** `src/app/dashboard/DashboardClientMonthly.tsx`

**Avant :**
- Utilisation de `useState` + `useEffect` pour le fetch
- Pas de cache, re-fetch à chaque montage

**Après :**
- Utilisation de `useQuery` de React Query
- Cache avec `staleTime: 2 minutes`
- Mémorisation des paramètres de requête avec `useMemo`

**Bénéfices :**
- ✅ Réduction des appels API redondants
- ✅ Gestion d'erreur unifiée
- ✅ État de chargement optimisé

### 5. Optimisation Requêtes Prisma

**Fichier :** `src/app/api/insights/route.ts`

**Problème :** Chargement de TOUTES les transactions en mémoire pour calculer les totaux

**Avant :**
```typescript
const transactions = await prisma.transaction.findMany({ 
  where: { organizationId } 
});

transactions.forEach(transaction => {
  // Calculs en mémoire
});
```

**Après :**
```typescript
// Requêtes agrégées directes
const [incomeResult, expenseResult] = await Promise.all([
  prisma.transaction.aggregate({
    where: { organizationId, nature: { in: recetteCodes } },
    _sum: { amount: true }
  }),
  prisma.transaction.aggregate({
    where: { organizationId, nature: { in: depenseCodes } },
    _sum: { amount: true }
  })
]);
```

**Bénéfices :**
- ✅ Calculs effectués par PostgreSQL (plus rapide)
- ✅ Réduction drastique de l'utilisation mémoire
- ✅ Temps de réponse réduit, surtout avec beaucoup de transactions

### 6. Optimisation DocumentLinks

**Fichier :** `src/app/api/insights/route.ts`

**Avant :** Chargement de tous les champs de `DocumentLink`

**Après :**
```typescript
prisma.documentLink.findMany({
  where: { linkedType: 'transaction', Document: { organizationId } },
  select: { linkedId: true } // Seulement l'ID nécessaire
})
```

**Bénéfices :**
- ✅ Réduction de la bande passante
- ✅ Moins de données transférées depuis la DB

---

## 📋 Actions Recommandées (À Faire)

### 1. Nettoyage Console.log ✅ FAIT (Partiel)

**Priorité :** Moyenne  
**Estimation :** 2-4 heures

- [x] Remplacer les `console.log` des fichiers API critiques par `logDebug()` ou suppression
- [x] Cibler en priorité :
  - `src/app/api/transactions/route.ts` (54 occurrences) ✅ **FAIT**
  - `src/lib/ai/config.ts` (16 occurrences) ✅ **FAIT**
- [ ] Fichiers restants (optionnel) :
  - `src/components/transactions/TransactionModalV2.tsx` (135 occurrences)
  - `src/components/documents/UploadReviewModal.tsx` (54 occurrences)

**Script suggéré :**
```bash
# Trouver les fichiers avec le plus de console.log
grep -r "console.log" src --include="*.ts" --include="*.tsx" | \
  cut -d: -f1 | sort | uniq -c | sort -rn | head -20
```

### 2. Dynamic Import pour Recharts ✅ FAIT

**Priorité :** Haute  
**Estimation :** 1-2 heures

**Fichiers modifiés :**
- `src/components/dashboard/PatrimoineCharts.tsx` ✅
- `src/components/dashboard/MonthlyGraphs.tsx` ✅
- `src/components/bien/BienMiniCharts.tsx` ✅

**Bénéfices :**
- ✅ Réduction du bundle JavaScript initial (-10% à -20%)
- ✅ Temps de chargement initial réduit
- ✅ Recharts chargé uniquement quand nécessaire (code splitting)

**Exemple :**
```typescript
import dynamic from 'next/dynamic';

const ResponsiveContainer = dynamic(
  () => import('recharts').then(mod => mod.ResponsiveContainer),
  { ssr: false }
);

const BarChart = dynamic(
  () => import('recharts').then(mod => mod.BarChart),
  { ssr: false }
);
```

### 3. Index PostgreSQL ✅ FAIT

**Priorité :** Haute  
**Estimation :** 1 heure

**Migration créée :** `prisma/migrations/20250116184513_performance_indexes/migration.sql`

**11 index créés pour optimiser les requêtes fréquentes :**

```sql
-- Transactions (5 index)
CREATE INDEX IF NOT EXISTS idx_transaction_org_nature ON "Transaction"("organizationId", "nature");
CREATE INDEX IF NOT EXISTS idx_transaction_org_date ON "Transaction"("organizationId", "date");
CREATE INDEX IF NOT EXISTS idx_transaction_org_accounting_month ON "Transaction"("organizationId", "accounting_month");
CREATE INDEX IF NOT EXISTS idx_transaction_org_rapprochement ON "Transaction"("organizationId", "rapprochementStatus") WHERE "rapprochementStatus" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transaction_org_nature_amount ON "Transaction"("organizationId", "nature", "amount");

-- Leases (2 index)
CREATE INDEX IF NOT EXISTS idx_lease_status_dates ON "Lease"("status", "startDate", "endDate");
CREATE INDEX IF NOT EXISTS idx_lease_org_status ON "Lease"("organizationId", "status");

-- Properties (2 index)
CREATE INDEX IF NOT EXISTS idx_property_org_type ON "Property"("organizationId", "type");
CREATE INDEX IF NOT EXISTS idx_property_city ON "Property"("city") WHERE "city" IS NOT NULL;

-- Loans (1 index)
CREATE INDEX IF NOT EXISTS idx_loan_org_active ON "Loan"("organizationId", "isActive");

-- Echeances (2 index)
CREATE INDEX IF NOT EXISTS idx_echeance_property_sens ON "EcheanceRecurrente"("propertyId", "sens");
CREATE INDEX IF NOT EXISTS idx_echeance_active ON "EcheanceRecurrente"("isActive") WHERE "isActive" = true;
```

**Note :** Les index DocumentLink existent déjà dans le schéma Prisma.

### 4. Pagination sur Tous les Endpoints

**Priorité :** Moyenne  
**Estimation :** 2-3 heures

Vérifier que tous les endpoints de liste supportent la pagination :
- ✅ `/api/transactions` - Déjà paginé
- ✅ `/api/documents` - Déjà paginé
- ✅ `/api/leases` - Déjà paginé
- ❓ Vérifier les autres endpoints

### 5. Memoization des Composants Lourds ✅ FAIT

**Priorité :** Basse  
**Estimation :** 1-2 heures

Ajout de `React.memo()` sur les composants de graphiques :
- `PatrimoineCharts` ✅
- `MonthlyGraphs` ✅
- `BienMiniCharts` (à considérer si nécessaire)

**Bénéfices :**
- ✅ Réduction des re-renders inutiles
- ✅ Meilleure performance sur les composants de graphiques

### 6. Virtualisation des Listes Longues

**Priorité :** Basse  
**Estimation :** 2-3 heures

Pour les tableaux avec beaucoup de lignes (> 100), utiliser `react-window` ou `react-virtuoso` :
- Liste des transactions
- Liste des documents
- Liste des baux

---

## 🎯 Métriques de Performance Attendues

### Frontend
- **Réduction du temps de chargement initial :** -30% à -50% (avec dynamic imports)
- **Réduction des appels API redondants :** -60% à -80% (avec React Query cache)
- **Réduction de la taille du bundle JS :** -10% à -20% (avec dynamic imports)

### Backend
- **Temps de réponse `/api/insights` :** -70% à -90% (avec requêtes agrégées)
- **Utilisation mémoire serveur :** -50% à -80% (sans chargement de toutes les transactions)
- **Charge base de données :** -40% à -60% (avec index et requêtes optimisées)

---

## 📚 Bonnes Pratiques pour la Suite

### 1. Logging
- ✅ Utiliser `logDebug()` pour les messages de débogage
- ✅ Utiliser `console.error()` pour les erreurs critiques
- ✅ Utiliser `console.warn()` pour les avertissements
- ❌ Ne jamais utiliser `console.log()` dans le code source (sauf scripts)

### 2. Fetching de Données
- ✅ Utiliser React Query pour toutes les requêtes client
- ✅ Définir un `staleTime` approprié selon la nature des données
- ✅ Utiliser `useMemo` pour mémoriser les paramètres de requête
- ✅ Protéger les `useEffect` avec des refs pour éviter les doubles appels

### 3. Requêtes Prisma
- ✅ Utiliser `aggregate()` pour les calculs (sum, count, avg)
- ✅ Utiliser `select` pour ne charger que les champs nécessaires
- ✅ Utiliser `include` avec `select` imbriqué pour optimiser les relations
- ✅ Éviter de charger toutes les entités en mémoire (pagination)
- ✅ Utiliser `where: { id: { in: [...] } }` au lieu de boucles avec requêtes

### 4. Composants React
- ✅ Utiliser `dynamic` import pour les composants lourds (Recharts, PDF, etc.)
- ✅ Utiliser `React.memo()` pour les composants purs
- ✅ Utiliser `useMemo` et `useCallback` judicieusement
- ✅ Éviter de recréer des objets/fonctions dans le render

### 5. Performance Monitoring
- ✅ Surveiller les métriques Lighthouse
- ✅ Utiliser React DevTools Profiler pour identifier les re-renders
- ✅ Utiliser React Query DevTools pour vérifier le cache
- ✅ Monitorer les temps de réponse API

---

## 🔧 Configuration React StrictMode

**Fichier :** `next.config.mjs`

React StrictMode est activé (`reactStrictMode: true`). C'est une bonne pratique pour détecter les bugs, mais il provoque des doubles renders en développement.

**Note :** Les doubles renders en développement sont **normaux** et n'affectent pas la production. Les protections ajoutées (`useRef`, `useMemo`, React Query cache) garantissent que même avec StrictMode, il n'y a pas de double fetch en production.

---

## 📝 Fichiers Modifiés

### Configuration
- ✅ `.eslintrc.cjs` - Ajout règle no-console
- ✅ `src/lib/utils/logger.ts` - Nouveau système de logging

### Frontend
- ✅ `src/ui/providers/QueryProvider.tsx` - Optimisation config React Query
- ✅ `src/app/dashboard/DashboardClientMonthly.tsx` - Migration vers React Query

### Backend
- ✅ `src/app/api/insights/route.ts` - Optimisation requêtes Prisma
- ✅ `src/services/tax/FiscalAggregator.ts` - Suppression console.log

### Documentation
- ✅ `docs/perf-optimisation.md` - Ce document

---

## ✅ Checklist de Validation

- [x] ESLint configuré avec règle no-console
- [x] Wrapper logDebug créé
- [x] React Query optimisé (staleTime, gcTime, refetch)
- [x] Dashboard migré vers React Query
- [x] Requêtes Prisma optimisées (insights)
- [x] Console.log remplacés dans fichiers critiques (`transactions/route.ts`, `ai/config.ts`)
- [x] Dynamic imports pour Recharts (3 composants optimisés)
- [x] Index PostgreSQL créés (`20250116184513_performance_indexes`)
- [x] **Index PostgreSQL appliqués avec succès !** ✅
- [x] Composants memoïsés (`PatrimoineCharts`, `MonthlyGraphs`)
- [ ] Virtualisation des listes (optionnel, à faire si nécessaire)

---

## 🚀 Prochaines Étapes

### ✅ Court terme (FAIT)
- ✅ Nettoyer les console.log des fichiers critiques
- ✅ Ajouter dynamic imports pour Recharts
- ✅ Créer les index PostgreSQL (migration prête)

### ✅ Immédiat (FAIT)
- ✅ **Migration PostgreSQL appliquée avec succès !**
  - 11 index PostgreSQL créés
  - Optimisations des requêtes actives

### 📋 Moyen terme (optionnel)
- Nettoyer les console.log restants dans les composants frontend
- Virtualisation des listes (si nécessaire)
- Monitoring de performance avec Lighthouse

### 📊 Long terme
- Audit complet des performances après déploiement
- Optimisations supplémentaires selon les métriques réelles
- Mise en place de tests de performance automatisés

---

**Document créé le :** Janvier 2025  
**Dernière mise à jour :** Janvier 2025

