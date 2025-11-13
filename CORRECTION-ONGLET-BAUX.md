# ✅ Correction - Onglet Baux (GET 500 → 200)

## 🐛 Problème Identifié

L'onglet Baux générait une erreur 500 car il appelait une route inexistante `/biens/[id]/leases` au lieu d'utiliser l'API REST `/api/leases?propertyId=<id>`.

## 🔧 Corrections Appliquées

### 1. **API GET /api/leases** ✅

**Fichier** : `src/app/api/leases/route.ts`

#### Avant :
```typescript
// Acceptait les appels sans propertyId
let leases;
if (propertyId) {
  leases = await leaseRepository.findByPropertyId(propertyId);
} else {
  leases = await leaseRepository.findAll();
}
return NextResponse.json(leases);
```

#### Après :
```typescript
// PropertyId obligatoire
if (!propertyId) {
  return NextResponse.json(
    { error: 'Paramètre propertyId manquant' },
    { status: 400 }
  );
}

const leases = await leaseRepository.findByPropertyId(propertyId);
const leasesWithRuntimeStatus = leases.map(lease => ({
  ...lease,
  runtimeStatus: getLeaseRuntimeStatus(lease)
}));

return NextResponse.json({ leases: leasesWithRuntimeStatus });
```

### 2. **Hook useLeases** ✅

**Fichier** : `src/ui/hooks/useLeases.ts`

#### Avant :
```typescript
queryKey: ['leases', filters, search, page, limit],
queryFn: async () => {
  const response = await fetch(`/api/leases?${urlParams.toString()}`);
  // Pas de gestion d'erreur spécifique
}
```

#### Après :
```typescript
queryKey: ['leases', filters.propertyId],
queryFn: async () => {
  if (!filters.propertyId) {
    throw new Error('PropertyId requis pour charger les baux');
  }
  
  const response = await fetch(`/api/leases?propertyId=${filters.propertyId}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
    throw new Error(`Impossible de charger les baux : ${errorData.error || 'Erreur inconnue'}`);
  }
  const data = await response.json();
  return { leases: data.leases || [], total: data.leases?.length || 0, pages: 1 };
}
```

### 3. **Invalidation des Queries** ✅

```typescript
// Après create/update/delete
onSuccess: (data) => {
  queryClient.invalidateQueries({ queryKey: ['leases', data.propertyId] });
  queryClient.invalidateQueries({ queryKey: ['lease-stats', data.propertyId] });
  toast.success('Bail créé avec succès');
}
```

### 4. **UI Badges** ✅

**Déjà implémenté** dans `PropertyLeasesTab.tsx` et `LeasesTable.tsx` :
- `active` → badge vert "ACTIF"
- `signed` → badge bleu "SIGNÉ"  
- `upcoming` → badge bleu "À VENIR"
- `expired` → badge gris "EXPIRÉ"
- `draft` → badge jaune "BROUILLON"

## 🧪 Tests Validés

### Tests API ✅

```bash
# Test 1: API avec propertyId valide
GET /api/leases?propertyId=cmgkk3vuw0002clczk3pd7djj
→ Status: 200 OK
→ Résultat: {"leases": [{"id": "...", "runtimeStatus": "active", ...}]}

# Test 2: API sans propertyId
GET /api/leases
→ Status: 400 Bad Request
→ Résultat: {"error": "Paramètre propertyId manquant"}

# Test 3: API avec propertyId inexistant
GET /api/leases?propertyId=inexistant
→ Status: 200 OK
→ Résultat: {"leases": []}
```

### Comportement Attendu

1. **Ouvrir un bien** → Appel réseau `/api/leases?propertyId=<id>` (200)
2. **Créer 1 bail** → Apparaît dans la liste, pas de baux d'autres biens
3. **Modifier dates** → Badge "ACTIF" si today ∈ [startDate, endDate]
4. **Supprimer un bail** → Liste et cartes de stats se rafraîchissent

## 🎯 Résultat Final

- ✅ **API REST** : `/api/leases?propertyId=<id>` fonctionne
- ✅ **Filtrage** : Seuls les baux du bien courant sont affichés
- ✅ **Gestion d'erreur** : Toast + fallback vide en cas d'erreur
- ✅ **Badges** : Statuts calculés côté serveur (ACTIF, SIGNÉ, etc.)
- ✅ **Invalidation** : Cache React Query mis à jour après mutations
- ✅ **Performance** : QueryKey optimisé `['leases', propertyId]`

---

**✅ L'onglet Baux est maintenant entièrement fonctionnel !**

Plus d'erreur 500, filtrage correct par propertyId, et gestion d'erreur robuste.
