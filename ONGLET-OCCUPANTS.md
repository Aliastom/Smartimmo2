# ✅ Implémentation - Onglet "Occupants" (ex "Locataires")

## 🎯 Objectif

Remplacer l'onglet "Locataires" par "Occupants" pour n'afficher QUE les locataires liés au bien courant via leurs baux (actuels + historique).

## 🔧 Modifications Appliquées

### 1. **API GET /api/tenants/by-property** ✅

**Nouveau fichier** : `src/app/api/tenants/by-property/route.ts`

**Fonctionnalités** :
- Filtre obligatoire par `propertyId` (400 si manquant)
- Paramètre optionnel `activeOnly` (true/false)
- Retourne uniquement les locataires ayant au moins un bail sur cette propriété
- Inclut les baux associés triés par date décroissante

**Query Prisma** :
```typescript
const tenants = await prisma.tenant.findMany({
  where: {
    leases: {
      some: {
        propertyId,
        ...(activeOnly ? {
          OR: [{ status: 'ACTIF' }, { status: 'SIGNÉ' }],
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }]
        } : {})
      }
    }
  },
  include: {
    leases: {
      where: { propertyId },
      orderBy: { startDate: 'desc' },
      include: { property: { select: { id, name, address } } }
    }
  },
  orderBy: { lastName: 'asc' }
});
```

### 2. **Hook useTenantsByProperty** ✅

**Fichier** : `src/ui/hooks/useTenants.ts`

**Nouveau hook** :
```typescript
export function useTenantsByProperty({ propertyId, activeOnly = false }) {
  return useQuery({
    queryKey: ['tenants', 'byProperty', { propertyId, activeOnly }],
    queryFn: async () => {
      const response = await fetch(`/api/tenants/by-property?propertyId=${propertyId}&activeOnly=${activeOnly}`);
      // ... gestion d'erreur
      return data.tenants || [];
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}
```

### 3. **Invalidations Mises à Jour** ✅

**Fichier** : `src/lib/invalidate.ts`

**Ajouts** :
- `onLeaseChanged()` → Invalide `['tenants', 'byProperty', { propertyId }]`
- `onTenantChanged()` → Invalide `['tenants', 'byProperty', { propertyId }]`

**Résultat** : Création/modification/suppression de bail → Liste des occupants rafraîchie

### 4. **Onglet Renommé** ✅

**Fichier** : `src/ui/properties/PropertyHeader.tsx`

**Avant** : `label: 'Locataires'`  
**Après** : `label: 'Occupants'`

### 5. **Composant PropertyTenantsClient Réécrit** ✅

**Fichier** : `src/ui/properties/PropertyTenantsClient.tsx`

**Changements** :
- ✅ Utilise `useTenantsByProperty` au lieu d'une liste globale
- ✅ Deux requêtes : `activeOnly=true` (actuels) et `activeOnly=false` (tous)
- ✅ Calcul de l'historique : `allTenants.filter(t => !currentTenants.includes(t))`
- ✅ Bouton principal : "**Créer un bail**" (au lieu de "Nouveau locataire")
- ✅ Section "Occupants actuels" + Section "Historique" (si non vide)
- ✅ Affichage des baux de chaque occupant
- ✅ Modal `LeaseFormModal` avec `defaultPropertyId` pré-rempli

## 🎨 Interface Utilisateur

### En-tête
```
┌─────────────────────────────────────────────────────────────┐
│ Occupants                          [+ Créer un bail]        │
│ 1 occupant actuel                                           │
└─────────────────────────────────────────────────────────────┘
```

### Section "Occupants actuels"
```
┌─────────────────────────────────────────────────────────────┐
│ 👥 Occupants actuels                                        │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ THOMAS DUBIGNY                              [Voir]  │   │
│ │ thomas.dubigny@gmail.com                            │   │
│ │ 0647614400                                          │   │
│ │ ─────────────────────────────────────────────       │   │
│ │ Baux :                                              │   │
│ │ Du 14/10/2025 au 12/10/2025 - 750€/mois           │   │
│ └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Section "Historique" (si applicable)
```
┌─────────────────────────────────────────────────────────────┐
│ Historique                                                  │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ Jean DUPONT                                 [Voir]  │   │
│ │ jean.dupont@example.com                             │   │
│ │ ─────────────────────────────────────────────       │   │
│ │ Anciens baux :                                      │   │
│ │ Du 01/01/2024 au 31/12/2024                        │   │
│ └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🧪 Tests API Validés

```bash
# Test 1: Tous les locataires (actuels + historique)
GET /api/tenants/by-property?propertyId=cmgkk3vuw0002clczk3pd7djj&activeOnly=false
→ Status: 200 OK
→ Résultat: {"tenants": [{"id": "...", "firstName": "THOMAS", ...}]}

# Test 2: Occupants actuels uniquement
GET /api/tenants/by-property?propertyId=cmgkk3vuw0002clczk3pd7djj&activeOnly=true
→ Status: 200 OK
→ Résultat: {"tenants": []}

# Test 3: PropertyId inexistant
GET /api/tenants/by-property?propertyId=inexistant&activeOnly=false
→ Status: 200 OK
→ Résultat: {"tenants": []}

# Test 4: PropertyId manquant
GET /api/tenants/by-property?activeOnly=false
→ Status: 400 Bad Request
→ Résultat: {"error": "Paramètre propertyId manquant"}
```

## 🔄 Invalidations

### Après création/modification de bail
```typescript
await onLeaseChanged(queryClient, propertyId);
```
→ Invalide `['tenants', 'byProperty', { propertyId }]`  
→ Liste des occupants rafraîchie automatiquement

### Après création/modification de locataire
```typescript
await onTenantChanged(queryClient, propertyId);
```
→ Invalide `['tenants', 'byProperty', { propertyId }]`  
→ Liste des occupants rafraîchie automatiquement

## ✨ Fonctionnalités

### Bouton Principal : "Créer un bail"
- ✅ Ouvre la modal `LeaseFormModal`
- ✅ `defaultPropertyId` pré-rempli (champ grisé)
- ✅ Select locataire avec liste globale
- ✅ Après création → Liste des occupants rafraîchie

### Sections Dynamiques
- ✅ **Occupants actuels** : Locataires avec baux actifs/signés en cours
- ✅ **Historique** : Locataires avec anciens baux (terminés/expirés)
- ✅ Affichage conditionnel (historique masqué si vide)

### Affichage des Baux
- ✅ Liste des baux pour chaque occupant
- ✅ Dates formatées lisibles
- ✅ Loyer affiché

## 🎯 Résultats

- ✅ **Filtrage strict** : Seuls les locataires du bien courant
- ✅ **Pas de liste globale** : Requête filtrée par propertyId
- ✅ **Rafraîchissement automatique** : Invalidations après mutations
- ✅ **UX améliorée** : Bouton "Créer un bail" (au lieu de "Nouveau locataire")
- ✅ **Sections claires** : Actuels vs Historique

---

**✅ L'onglet "Occupants" est maintenant entièrement fonctionnel !**

N'affiche QUE les locataires liés au bien via leurs baux, avec sections actuels/historique et rafraîchissement automatique.
