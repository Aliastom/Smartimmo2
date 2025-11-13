# ✅ Correction Baux Actifs - Source de Vérité Unifiée

## 🎯 Problèmes Corrigés

**A) ✅ Carte "Loyer mensuel total"** : Restait à 0 alors qu'il y a des baux actifs  
**B) ✅ Compteur "Actifs"** : N'était pas aligné avec le tableau (1 vs 2)  
**C) ✅ Drawer "Baux actifs"** : Affichait "Locataire inconnu" au lieu du nom

## 🔧 Implémentation

### 1. ✅ **Utilitaire Unifié - Source de Vérité**
**Fichier** : `src/lib/leases.ts`

```typescript
export const getActiveLeaseWhere = ({ propertyId, today = new Date() }): Prisma.LeaseWhereInput => ({
  propertyId,
  status: { in: ['SIGNÉ', 'ACTIF'] },
  startDate: { lte: today },
  OR: [{ endDate: null }, { endDate: { gte: today } }],
});

export const isLeaseActive = (lease: any, today: Date = new Date()): boolean => {
  if (!['SIGNÉ', 'ACTIF'].includes(lease.status)) return false;
  if (new Date(lease.startDate) > today) return false;
  if (lease.endDate && new Date(lease.endDate) < today) return false;
  return true;
};
```

### 2. ✅ **API Stats des Baux - Logique Unifiée**
**Fichier** : `src/app/api/leases/stats/route.ts`

**Avant** : Logique complexe avec `getLeaseRuntimeStatus`  
**Après** : Source de vérité unique avec `getActiveLeaseWhere`

```typescript
const [totalCount, activeCount, rentSum, expiringCount] = await prisma.$transaction([
  prisma.lease.count({ where: whereAll }),
  prisma.lease.count({ where: whereActive }),
  prisma.lease.aggregate({
    _sum: { rentAmount: true },
    where: whereActive,
  }),
  // ... échéances < 60 jours
]);

return {
  totalLeases: totalCount,
  activeLeases: activeCount,
  totalMonthlyRent: monthlyRentTotalCents / 100,
};
```

### 3. ✅ **Drawer - Affichage du Locataire**
**Fichier** : `src/ui/components/PropertyDrawerLight.tsx`

**Avant** :
```typescript
<span className="font-medium">{lease.tenantName || 'Locataire inconnu'}</span>
```

**Après** :
```typescript
<span className="font-medium">
  {lease.tenant ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : 'Locataire inconnu'}
</span>
```

### 4. ✅ **Filtrage Unifié dans le Drawer**
**Fichier** : `src/ui/components/PropertyDrawerLight.tsx`

**Avant** :
```typescript
const activeLeases = Array.isArray(leases) ? leases.filter(l => l.status === 'ACTIF') : [];
```

**Après** :
```typescript
const activeLeases = Array.isArray(leases) ? leases.filter(l => isLeaseActive(l)) : [];
```

## 📊 Critères "Actif" Unifiés

### Règles Appliquées Partout
```typescript
// Un bail est "actif" si :
status IN ['SIGNÉ', 'ACTIF'] 
AND startDate <= today 
AND (endDate IS NULL OR endDate >= today)
```

### Exclusions
- ❌ `draft` (brouillon)
- ❌ `future` (startDate > today)
- ❌ `expired` (endDate < today)

## 🧪 Tests Validés

### API Stats
```bash
✅ GET /api/leases/stats?propertyId=cmgkk3vuw0002clczk3pd7djj
   → Total: 3 baux
   → Actifs: 1 bail (au lieu de 2)
   → Loyer mensuel total: 900€ (au lieu de 0€)
```

### API Baux avec Locataire
```bash
✅ GET /api/leases?propertyId=cmgkk3vuw0002clczk3pd7djj
   → Tenant: THOMAS DUBIGNY
   → Email: thomas.dubigny@gmail.com
```

### Page des Biens
```bash
✅ GET /biens
   → Status: 200 (page accessible)
   → Cartes et drawer fonctionnels
```

## 🎯 Résultats

### A) Carte "Loyer mensuel total"
- **Avant** : 0,00 €
- **Après** : 900,00 € (somme des baux actifs uniquement)

### B) Compteur "Actifs"
- **Avant** : 2 (incohérent avec le tableau)
- **Après** : 1 (aligné avec la logique unifiée)

### C) Drawer "Baux actifs"
- **Avant** : "Locataire inconnu"
- **Après** : "THOMAS DUBIGNY" (nom réel du locataire)

## 🔄 Cohérence Assurée

- ✅ **Tableau des baux** : Utilise la même logique `isLeaseActive()`
- ✅ **Cartes de résumé** : Utilise la même API `getActiveLeaseWhere()`
- ✅ **Drawer latéral** : Utilise la même logique + affichage locataire
- ✅ **API stats** : Source de vérité unique pour tous les calculs

**🎉 Les 3 points sont corrigés avec une source de vérité unifiée pour les baux actifs !**
