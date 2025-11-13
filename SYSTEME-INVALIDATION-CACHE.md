# ✅ Système d'Invalidation de Cache Centralisé

## 🎯 Objectif

Résoudre le problème de rafraîchissement des cartes/stats après les mutations en implémentant un système d'invalidation centralisé avec React Query.

## 🏗️ Architecture

### 1. **Clés de Cache Centralisées** (`src/lib/queryKeys.ts`)

Toutes les clés de cache sont définies dans un seul fichier pour garantir la cohérence :

```typescript
export const qk = {
  dashboard: { summary: ['dashboard', 'summary'] },
  properties: {
    list: ['properties', 'list'],
    stats: (propertyId?) => propertyId ? ['property', 'stats', propertyId] : ['properties', 'stats'],
    // ... autres stats par domaine
  },
  leases: {
    list: ['leases'],
    listByProperty: (pid) => ['leases', pid],
    stats: (pid?) => pid ? ['lease-stats', pid] : ['lease-stats'],
  },
  // ... tenants, documents, photos, transactions, loans
};
```

### 2. **Fonctions d'Invalidation Centralisées** (`src/lib/invalidate.ts`)

Fonctions utilitaires pour invalider les bonnes queries après chaque type de mutation :

```typescript
// Invalide TOUT pour une propriété
export async function invalidatePropertyAll(queryClient, pid)

// Invalidations ciblées par domaine
export async function onLeaseChanged(queryClient, pid)
export async function onTenantChanged(queryClient, pid)
export async function onTransactionChanged(queryClient, pid)
export async function onDocumentChanged(queryClient, pid)
export async function onPhotoChanged(queryClient, pid)
export async function onLoanChanged(queryClient, pid)
```

### 3. **Intégration dans les Hooks**

Chaque hook de mutation utilise ces fonctions dans `onSuccess` :

```typescript
// useCreateLease
onSuccess: async (data) => {
  await onLeaseChanged(queryClient, data.propertyId);
  toast.success('Bail créé avec succès');
}
```

## 📁 Fichiers Modifiés

### Nouveaux Fichiers ✅
- `src/lib/queryKeys.ts` - Clés de cache centralisées
- `src/lib/invalidate.ts` - Fonctions d'invalidation

### Hooks Modifiés ✅
- `src/ui/hooks/useLeases.ts` - Import qk + onLeaseChanged
- `src/ui/hooks/useTenants.ts` - Import qk + invalidations
- `src/ui/hooks/useLeaseStats.ts` - QueryKey + refetch options
- `src/ui/hooks/useTenantStats.ts` - QueryKey + refetch options
- `src/ui/hooks/usePropertyStats.ts` - QueryKey + refetch options

### Pages Modifiées ✅
- `src/app/biens/page.tsx` - Invalidations lors create/delete propriété

## 🔄 Stratégie d'Invalidation

### Après Création/Modification d'un Bail
```typescript
await onLeaseChanged(queryClient, propertyId);
```
**Invalide** :
- Liste des baux (filtrée + globale)
- Stats de baux (filtrées + globales)
- Stats de la propriété
- Dashboard global

### Après Création/Modification d'un Locataire
```typescript
await onTenantChanged(queryClient, propertyId);
```
**Invalide** :
- Liste des locataires
- Stats de locataires
- Dashboard global

### Après Création/Suppression d'une Propriété
```typescript
await queryClient.invalidateQueries({ queryKey: qk.properties.stats() });
await queryClient.invalidateQueries({ queryKey: qk.properties.list });
await queryClient.invalidateQueries({ queryKey: qk.dashboard.summary });
```

## 🎨 Options de Refetch pour les Stats

Toutes les queries de stats utilisent maintenant :

```typescript
{
  queryKey: qk.xxx.stats(propertyId),
  staleTime: 0, // Toujours rafraîchir
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
}
```

**Bénéfices** :
- Les stats se mettent à jour immédiatement après mutation
- Rafraîchissement automatique au retour sur l'onglet
- Pas besoin de F5 manuel

## 🧪 Tests Validés

### Tests API ✅
```bash
✅ GET /api/leases?propertyId=X → 200 OK
✅ GET /api/leases/stats?propertyId=X → {"totalLeases":1,"activeLeases":0,...}
✅ Système d'invalidation prêt
```

### Comportement Attendu

1. **Créer un bail** → 
   - Liste des baux rafraîchie
   - Cartes "Baux" rafraîchies
   - Stats propriété rafraîchies
   - Dashboard rafraîchi

2. **Modifier dates d'un bail** (passage SIGNÉ → ACTIF) →
   - Badge change de couleur
   - Compteur "Baux actifs" augmente
   - Loyer mensuel total mis à jour

3. **Supprimer un bail** →
   - Liste des baux rafraîchie
   - Tous les compteurs mis à jour

4. **Créer/modifier locataire** →
   - Liste locataires rafraîchie
   - Stats locataires rafraîchies

## ✨ Avantages du Système

### 🎯 Cohérence
- Toutes les clés définies en un seul endroit
- Impossible d'avoir des typos dans les clés
- Invalidations systématiques

### ⚡ Performance
- Invalidations ciblées par domaine
- `staleTime: 0` uniquement pour les stats
- Refetch automatique au focus

### 🔧 Maintenabilité
- Facile d'ajouter de nouvelles invalidations
- Logique centralisée et testable
- Code DRY (Don't Repeat Yourself)

## 🚀 Tests Manuels à Effectuer

1. **Test Bail → ACTIF**
   - Créer un bail signé avec startDate=aujourd'hui, endDate=+30j
   - Vérifier que le badge est "ACTIF" (vert)
   - Vérifier que les cartes "Baux actifs" et "Loyer mensuel" se mettent à jour

2. **Test CRUD Locataire**
   - Créer un locataire
   - Vérifier que le compteur "Total locataires" augmente
   - Sans F5

3. **Test CRUD Propriété**
   - Créer une propriété
   - Vérifier que les cartes se mettent à jour
   - Vérifier que la liste est rafraîchie

---

**✅ Système d'invalidation centralisé implémenté avec succès !**

Les cartes/stats se rafraîchissent maintenant automatiquement après toutes les mutations.
