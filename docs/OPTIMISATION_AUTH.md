# ✅ Optimisation des Appels `/api/auth/me`

## ❌ Problème Identifié

**3 composants** appelaient `/api/auth/me` **toutes les 5 secondes** chacun :
1. `Sidebar.tsx` (ligne 140)
2. `UserDisplay.tsx` (ligne 49)
3. `Topbar.tsx` (ligne 37)

**Impact :**
- **3 appels simultanés toutes les 5 secondes** = **36 appels/minute** = **2160 appels/heure**
- En développement avec React StrictMode : **double les appels** = **72 appels/minute**
- Logs console pollués avec des appels répétitifs toutes les ~200ms
- Charge serveur inutile
- Latence réseau inutile

---

## ✅ Solution Appliquée

### 1. Hook Centralisé avec React Query

**Nouveau fichier :** `src/hooks/useAuth.ts`

```typescript
export function useAuth() {
  const { data, isLoading, error, refetch } = useQuery<AuthResponse | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        if (response.status === 401) {
          return null; // Non authentifié
        }
        throw new Error('Erreur lors de la récupération du profil');
      }
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes en cache
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    user: data?.user ?? null,
    isAuthenticated: !!data?.user,
    isLoading,
    error,
    refetch, // Permet de forcer un refresh si nécessaire
  };
}
```

**Avantages :**
- ✅ **1 seul appel** partagé entre tous les composants
- ✅ **Cache de 10 minutes** (l'utilisateur ne change pas souvent)
- ✅ **Pas de refetch automatique** (pas d'intervalle)
- ✅ **Mutualisation** : Tous les composants utilisent la même donnée en cache

### 2. Migration des Composants

**Avant :** (3 composants avec `setInterval` toutes les 5 secondes)
```typescript
useEffect(() => {
  async function fetchUser() {
    const response = await fetch('/api/auth/me');
    // ...
  }
  fetchUser();
  const interval = setInterval(fetchUser, 5000); // ❌ Toutes les 5 secondes
  return () => clearInterval(interval);
}, []);
```

**Après :** (1 hook React Query partagé)
```typescript
const { user, isAuthenticated } = useAuth(); // ✅ Hook centralisé
```

---

## 📊 Résultats

### Avant
- **3 appels toutes les 5 secondes** = 36 appels/minute
- En développement : **72 appels/minute** (React StrictMode)
- Logs console pollués

### Après
- **1 appel initial** au chargement
- **Cache de 10 minutes** : pas de nouveaux appels pendant 10 minutes
- **0 appels supplémentaires** (sauf invalidation manuelle)
- Logs console propres

### Impact
- **Réduction : -99% des appels API** (de 2160/heure à ~6/heure)
- **Charge serveur : -99%**
- **Console : Nettoyée**

---

## 📝 Fichiers Modifiés

### Créés
- ✅ `src/hooks/useAuth.ts` - Hook centralisé avec React Query

### Modifiés
- ✅ `src/components/layout/Sidebar.tsx` - Utilise `useAuth()`
- ✅ `src/components/auth/UserDisplay.tsx` - Utilise `useAuth()`
- ✅ `src/components/layout/Topbar.tsx` - Utilise `useAuth()`

---

## 🔄 Invalidation du Cache (si nécessaire)

Si vous devez forcer un refresh après login/logout :

```typescript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// Après login/logout
queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
// ou utiliser refetch() retourné par useAuth()
```

---

## ✅ Statut

**Optimisation complétée et appliquée !**

- ✅ Hook centralisé créé
- ✅ 3 composants migrés
- ✅ Intervalles supprimés
- ✅ React Query utilisé pour le cache

**Les logs `/api/auth/me` devraient maintenant être beaucoup plus rares (1 appel toutes les 10 minutes maximum).**

