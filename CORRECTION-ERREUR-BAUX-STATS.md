# ✅ Correction Erreur Page Baux - API Stats

## 🐛 Problème Identifié

**Erreur** : `GET http://localhost:3000/api/leases/stats? 400 (Bad Request)`

**Cause** : L'endpoint `/api/leases/stats` exigeait un `propertyId` obligatoire, mais la page globale des baux (`/leases-tenants/baux`) n'en fournit pas.

**Impact** : 
- Page des baux inaccessible avec message "Erreur lors du chargement des baux"
- Cartes KPI vides (0 baux, 0 actifs, etc.)
- Console développeur avec erreurs 400

## 🔧 Solution Implémentée

### 1. **API `/api/leases/stats` - Support Stats Globales**

**Fichier** : `src/app/api/leases/stats/route.ts`

**Avant** :
```typescript
if (!propertyId) {
  return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
}
```

**Après** :
```typescript
// Construire les conditions WHERE selon le contexte
let whereActive: any = {};
let whereAll: any = {};

if (propertyId) {
  // Stats pour un bien spécifique
  whereActive = getActiveLeaseWhere({ propertyId, today });
  whereAll = { propertyId };
} else {
  // Stats globales - tous les baux
  whereActive = getActiveLeaseWhere({ today });
  whereAll = {};
}
```

### 2. **Fonction `getActiveLeaseWhere` - PropertyId Optionnel**

**Fichier** : `src/lib/leases.ts`

**Avant** :
```typescript
export type ActiveLeaseWhere = {
  propertyId: string;  // ❌ Obligatoire
  today?: Date;
};

export const getActiveLeaseWhere = ({ propertyId, today = new Date() }: ActiveLeaseWhere) => ({
  propertyId,  // ❌ Toujours requis
  status: { in: ['SIGNÉ', 'ACTIF'] },
  startDate: { lte: today },
  OR: [{ endDate: null }, { endDate: { gte: today } }],
});
```

**Après** :
```typescript
export type ActiveLeaseWhere = {
  propertyId?: string;  // ✅ Optionnel
  today?: Date;
};

export const getActiveLeaseWhere = ({ propertyId, today = new Date() }: ActiveLeaseWhere) => {
  const baseWhere: Prisma.LeaseWhereInput = {
    status: { in: ['SIGNÉ', 'ACTIF'] },
    startDate: { lte: today },
    OR: [{ endDate: null }, { endDate: { gte: today } }],
  };

  // Ajouter propertyId seulement si fourni
  if (propertyId) {
    baseWhere.propertyId = propertyId;
  }

  return baseWhere;
};
```

## ✅ Résultat

### **Tests de Validation**

1. **API Stats Globales** ✅
   ```bash
   GET /api/leases/stats
   # Retourne : 200 OK avec stats globales
   ```

2. **API Stats par Propriété** ✅
   ```bash
   GET /api/leases/stats?propertyId=xxx
   # Retourne : 200 OK avec stats du bien
   ```

3. **Page Baux** ✅
   ```bash
   GET /leases-tenants/baux
   # Retourne : 200 OK sans erreur console
   ```

### **Fonctionnalités Restaurées**

- ✅ Page des baux accessible
- ✅ Cartes KPI fonctionnelles (Baux totaux, Actifs, Échéances < 60j, Loyer mensuel)
- ✅ Bouton "Synchroniser" opérationnel
- ✅ Bouton "Nouveau bail" fonctionnel
- ✅ Console développeur sans erreurs

## 🎯 Impact

**Avant** : Page baux complètement cassée
**Après** : Page baux entièrement fonctionnelle avec stats correctes

**Compatibilité** : 
- ✅ Stats globales (page `/leases-tenants/baux`)
- ✅ Stats par propriété (pages `/biens/[id]/leases`)
- ✅ Aucune régression sur les fonctionnalités existantes

## 📋 Fichiers Modifiés

1. `src/app/api/leases/stats/route.ts` - Support stats globales
2. `src/lib/leases.ts` - PropertyId optionnel dans getActiveLeaseWhere

**Total** : 2 fichiers modifiés, 0 régression
