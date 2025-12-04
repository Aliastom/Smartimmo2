# 🚀 Optimisations de Performance Globales - Smartimmo2

**Date :** Janvier 2025  
**Objectif :** Améliorer la rapidité globale de l'application via optimisations de code, requêtes et comportements

---

## 📊 Analyse de l'État Actuel

### Points Positifs Déjà en Place ✅
- ✅ Index PostgreSQL créés (11 index sur transactions, leases, properties, loans, echeances)
- ✅ React Query configuré avec cache de 5 minutes
- ✅ Requêtes agrégées sur `/api/insights` (au lieu de charger toutes les transactions)
- ✅ Debouncing sur certains composants de recherche
- ✅ Dynamic imports sur certains graphiques (Recharts)
- ✅ Système d'invalidation de cache centralisé

### Points à Améliorer 🔧
- ⚠️ **1049 occurrences** de `findMany/findFirst/findUnique` dans 386 fichiers
- ⚠️ Requêtes Prisma séquentielles qui pourraient être parallélisées
- ⚠️ Pas de connection pooling configuré explicitement
- ⚠️ `getCurrentUser` appelé très fréquemment sans cache serveur
- ⚠️ Composants lourds sans `React.memo()` qui re-render souvent
- ⚠️ Pas de pagination sur certaines listes longues
- ⚠️ Requêtes N+1 potentielles sur certaines relations

---

## 🎯 Plan d'Optimisation

### 1. **Optimisation des Requêtes Prisma** 🔥 PRIORITÉ HAUTE

#### 1.1 Parallélisation des Requêtes Séquentielles

**Problème :** Beaucoup de requêtes exécutées séquentiellement alors qu'elles sont indépendantes.

**Solution :** Utiliser `Promise.all()` pour paralléliser.

**Exemple :**
```typescript
// ❌ AVANT (séquentiel)
const properties = await prisma.property.findMany({ where: { organizationId } });
const leases = await prisma.lease.findMany({ where: { organizationId } });
const transactions = await prisma.transaction.findMany({ where: { organizationId } });

// ✅ APRÈS (parallèle)
const [properties, leases, transactions] = await Promise.all([
  prisma.property.findMany({ where: { organizationId } }),
  prisma.lease.findMany({ where: { organizationId } }),
  prisma.transaction.findMany({ where: { organizationId } }),
]);
```

**Fichiers à optimiser :**
- `src/app/api/insights/route.ts` (déjà partiellement optimisé)
- `src/app/api/dashboard/patrimoine/route.ts`
- `src/services/tax/FiscalAggregator.ts`
- Tous les endpoints qui chargent plusieurs entités

**Gain estimé :** -30% à -50% sur les temps de réponse des endpoints multi-entités

---

#### 1.2 Optimisation des Requêtes N+1

**Problème :** Charger des relations une par une au lieu d'utiliser `include`.

**Solution :** Utiliser `include` ou `select` pour charger les relations en une seule requête.

**Exemple :**
```typescript
// ❌ AVANT (N+1)
const transactions = await prisma.transaction.findMany({ where: { organizationId } });
for (const t of transactions) {
  const category = await prisma.category.findUnique({ where: { id: t.categoryId } });
}

// ✅ APRÈS (1 requête)
const transactions = await prisma.transaction.findMany({
  where: { organizationId },
  include: { category: true },
});
```

**Gain estimé :** -60% à -80% sur les requêtes avec relations

---

#### 1.3 Utilisation de `select` au lieu de charger tous les champs

**Problème :** Charger tous les champs alors qu'on n'en a besoin que de quelques-uns.

**Solution :** Utiliser `select` pour ne charger que les champs nécessaires.

**Exemple :**
```typescript
// ❌ AVANT
const users = await prisma.user.findMany({ where: { organizationId } });

// ✅ APRÈS
const users = await prisma.user.findMany({
  where: { organizationId },
  select: { id: true, email: true, name: true }, // Seulement ce dont on a besoin
});
```

**Gain estimé :** -20% à -40% sur la bande passante et la mémoire

---

### 2. **Connection Pooling Prisma** 🔥 PRIORITÉ HAUTE

**Problème :** Pas de configuration explicite du connection pooling.

**Solution :** Configurer le connection pooling dans `DATABASE_URL` et `prisma.ts`.

**Fichier :** `src/lib/prisma.ts`

```typescript
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
```

**Configuration DATABASE_URL :**
```
postgresql://user:password@host:5432/db?connection_limit=10&pool_timeout=20
```

**Gain estimé :** -20% à -30% sur les temps de connexion DB

---

### 3. **Cache Serveur pour getCurrentUser** 🔥 PRIORITÉ MOYENNE

**Problème :** `getCurrentUser` est appelé très fréquemment et fait 2 requêtes (Supabase + Prisma) à chaque fois.

**Solution :** Ajouter un cache en mémoire avec TTL court (30 secondes).

**Fichier :** `src/lib/auth/getCurrentUser.ts`

```typescript
import { cache } from 'react';
import NodeCache from 'node-cache';

const userCache = new NodeCache({ stdTTL: 30, checkperiod: 60 });

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Utiliser le cache si disponible
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  const cacheKey = `user:${user.id}`;
  const cached = userCache.get<CurrentUser>(cacheKey);
  if (cached) return cached;
  
  // ... requête Prisma ...
  
  userCache.set(cacheKey, result);
  return result;
});
```

**Gain estimé :** -70% à -90% sur les appels répétés à `getCurrentUser`

---

### 4. **Pagination sur les Listes Longues** 🔥 PRIORITÉ MOYENNE

**Problème :** Certaines listes chargent toutes les données d'un coup.

**Solution :** Implémenter la pagination côté serveur et client.

**Fichiers à optimiser :**
- `src/app/api/transactions/route.ts` (déjà partiellement paginé)
- `src/app/api/documents/route.ts` (déjà paginé)
- `src/app/api/leases/route.ts`
- `src/app/api/properties/route.ts`

**Gain estimé :** -50% à -80% sur le temps de chargement initial des listes

---

### 5. **React.memo() sur Composants Lourds** 🔥 PRIORITÉ MOYENNE

**Problème :** Composants qui re-render inutilement.

**Solution :** Ajouter `React.memo()` sur les composants qui reçoivent des props stables.

**Fichiers à optimiser :**
- `src/components/dashboard/PatrimoineCharts.tsx` (déjà fait)
- `src/components/dashboard/MonthlyGraphs.tsx` (déjà fait)
- `src/components/transactions/TransactionTable.tsx`
- `src/components/documents/DocumentTable.tsx`
- `src/components/leases/LeaseCard.tsx`

**Gain estimé :** -30% à -50% sur les re-renders inutiles

---

### 6. **Debouncing Universel pour Recherches** 🔥 PRIORITÉ BASSE

**Problème :** Certains champs de recherche n'ont pas de debouncing.

**Solution :** Créer un hook `useDebounce` réutilisable.

**Nouveau fichier :** `src/hooks/useDebounce.ts`

```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

**Gain estimé :** -60% à -80% sur les appels API de recherche

---

### 7. **Lazy Loading des Composants Lourds** 🔥 PRIORITÉ BASSE

**Problème :** Composants lourds (modales, graphiques) chargés même s'ils ne sont pas utilisés.

**Solution :** Utiliser `dynamic` de Next.js pour le lazy loading.

**Exemple :**
```typescript
// ❌ AVANT
import HeavyModal from '@/components/HeavyModal';

// ✅ APRÈS
const HeavyModal = dynamic(() => import('@/components/HeavyModal'), {
  loading: () => <div>Chargement...</div>,
  ssr: false,
});
```

**Fichiers à optimiser :**
- Modales de transaction
- Modales de documents
- Composants de graphiques non encore optimisés

**Gain estimé :** -10% à -20% sur la taille du bundle initial

---

### 8. **Optimisation des Requêtes avec `take` et `skip`** 🔥 PRIORITÉ BASSE

**Problème :** Certaines requêtes chargent trop de données.

**Solution :** Limiter avec `take` et utiliser `skip` pour la pagination.

**Exemple :**
```typescript
// ❌ AVANT
const allTransactions = await prisma.transaction.findMany({ where: { organizationId } });

// ✅ APRÈS
const transactions = await prisma.transaction.findMany({
  where: { organizationId },
  take: 50, // Limite
  skip: page * 50, // Pagination
  orderBy: { date: 'desc' },
});
```

**Gain estimé :** -40% à -60% sur la mémoire utilisée

---

## 📈 Résultats Attendus

### Frontend
- **Temps de chargement initial :** -20% à -30%
- **Re-renders inutiles :** -40% à -60%
- **Taille bundle JS :** -10% à -15%
- **Appels API redondants :** -50% à -70%

### Backend
- **Temps de réponse API :** -30% à -50%
- **Utilisation mémoire :** -40% à -60%
- **Charge base de données :** -30% à -50%
- **Temps de connexion DB :** -20% à -30%

---

## 🗂️ Fichiers à Modifier

### Priorité Haute
1. `src/lib/prisma.ts` - Connection pooling
2. `src/lib/auth/getCurrentUser.ts` - Cache serveur
3. `src/app/api/dashboard/patrimoine/route.ts` - Parallélisation
4. `src/services/tax/FiscalAggregator.ts` - Optimisation requêtes

### Priorité Moyenne
5. `src/app/api/leases/route.ts` - Pagination
6. `src/app/api/properties/route.ts` - Pagination
7. `src/components/transactions/TransactionTable.tsx` - React.memo()
8. `src/components/documents/DocumentTable.tsx` - React.memo()

### Priorité Basse
9. `src/hooks/useDebounce.ts` - Nouveau hook
10. Composants de modales - Lazy loading
11. Autres composants lourds - React.memo()

---

## ✅ Checklist d'Implémentation

- [ ] 1. Connection pooling Prisma
- [ ] 2. Cache serveur getCurrentUser
- [ ] 3. Parallélisation requêtes API
- [ ] 4. Pagination listes longues
- [ ] 5. React.memo() composants lourds
- [ ] 6. Hook useDebounce
- [ ] 7. Lazy loading modales
- [ ] 8. Optimisation requêtes avec select/take/skip
- [ ] 9. Tests de performance avant/après
- [ ] 10. Documentation des optimisations

---

## 📝 Notes

- Toutes les optimisations doivent être testées en développement avant déploiement
- Surveiller les métriques de performance après chaque changement
- Documenter les gains mesurés pour chaque optimisation
- Prioriser les optimisations selon l'impact mesuré








