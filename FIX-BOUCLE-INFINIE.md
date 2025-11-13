# ✅ Correction de la boucle infinie

## Problème identifié

La page `/documents` effectuait des centaines d'appels API par seconde à cause d'une boucle infinie dans le hook `useDocuments`.

**Cause racine :**
- L'objet `filters` passé au hook changeait de référence à chaque render
- Cela déclenchait le `useCallback` qui recréait `fetchDocuments`
- Ce qui déclenchait le `useEffect`
- Ce qui re-rendait le composant
- Et ainsi de suite → **boucle infinie**

## Solution appliquée

### 1. Réécriture complète du hook `useDocuments`

**Avant** (❌ Instable) :
```typescript
const fetchDocuments = useCallback(async () => {
  // ...
}, [filters, limit]); // filters change à chaque render !

useEffect(() => {
  fetchDocuments(0);
}, [fetchDocuments]); // Se déclenche à chaque fois
```

**Après** (✅ Stable) :
```typescript
// Mémoriser les filtres avec dépendances explicites
const stableFilters = useMemo(() => filters, [
  filters.query,
  filters.type,
  filters.propertyId,
  // ... toutes les propriétés individuellement
]);

// Fetch directement dans useEffect avec cleanup
useEffect(() => {
  let isCancelled = false;
  
  const fetchDocuments = async () => {
    // ...
    if (!isCancelled) {
      setDocuments(data.documents);
    }
  };
  
  fetchDocuments();
  
  return () => {
    isCancelled = true; // Annule le fetch si le composant unmount
  };
}, [stableFilters, limit, refreshKey]);
```

**Avantages :**
- ✅ Les filtres sont mémorisés avec `useMemo` et dépendances explicites
- ✅ Le fetch est directement dans le `useEffect` (pas de `useCallback` intermédiaire)
- ✅ Cleanup avec `isCancelled` pour éviter les setState sur composant non monté
- ✅ `refreshKey` pour forcer un refetch quand nécessaire

### 2. Séparation query/submittedQuery dans `DocumentsGeneralPage`

**Avant** (❌ Fetch à chaque frappe) :
```typescript
const [searchQuery, setSearchQuery] = useState('');

const { documents } = useDocuments({
  query: searchQuery, // Change à chaque frappe !
});
```

**Après** (✅ Fetch uniquement sur submit) :
```typescript
const [searchQuery, setSearchQuery] = useState(''); // Valeur input
const [submittedQuery, setSubmittedQuery] = useState(''); // Valeur recherchée

const { documents } = useDocuments({
  query: submittedQuery, // Ne change que sur submit
});

const handleSearch = (e: React.FormEvent) => {
  e.preventDefault();
  setSubmittedQuery(searchQuery); // Déclenche le fetch
};
```

## Résultats

**Avant** :
```
GET /api/documents?... 200 in 15ms
GET /api/documents?... 200 in 14ms
GET /api/documents?... 200 in 15ms
GET /api/documents?... 200 in 16ms
GET /api/documents?... 200 in 14ms
(× ∞ en boucle)
```

**Après** :
```
GET /api/documents?... 200 in 799ms (montage initial)
(silence)
GET /api/documents?... 200 in 18ms (uniquement sur action utilisateur)
```

## Fichiers modifiés

1. ✅ `src/hooks/useDocuments.ts` - Réécriture complète
2. ✅ `src/components/documents/DocumentsGeneralPage.tsx` - Séparation query/submittedQuery

## Test

1. **Recharger la page** : http://localhost:3000/documents
2. **Ouvrir la console réseau** (F12 → Network)
3. **Observer** : Un seul appel API au chargement ✅
4. **Taper dans la recherche** : Aucun appel
5. **Appuyer sur Enter** : Un appel API ✅
6. **Cocher "Inclure supprimés"** : Un appel API ✅

## Performances

- **Appels API** : De ~∞/seconde → 1 au montage + 1 par action
- **Renders** : Minimal, uniquement quand nécessaire
- **Mémoire** : Pas de fuites (cleanup proper)

---

**Status** : ✅ **RÉSOLU**  
**Date** : 14 octobre 2025, 02:00  
**Technique** : useMemo pour filtres stables + useEffect direct + cleanup

