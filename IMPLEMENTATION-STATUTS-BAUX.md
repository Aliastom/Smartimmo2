# ✅ Implémentation - Système de Statuts de Baux

## 🎯 Objectifs Atteints

### A) Calcul de statut côté serveur et UI ✅

**Règles implémentées :**
- **ACTIF** si: (status='SIGNÉ' OU signedPdfUrl existe) AND today ∈ [startDate, endDate] AND status != 'RÉSILIÉ'
- **EXPIRÉ** si: today > endDate
- **À VENIR** si: today < startDate ET signé
- **BROUILLON** si: pas signé (status='BROUILLON' ET pas de signedPdfUrl)
- **SIGNÉ** si: signé mais pas dans la période active

**Fonction utilitaire unique :** `getLeaseRuntimeStatus(lease, now=DateTime.local())` retournant `'active' | 'signed' | 'upcoming' | 'expired' | 'draft'`

**Fuseau horaire :** Europe/Paris avec comparaison en date-only (YYYY-MM-DD)

### B) API & Requêtes ✅

**Filtrage par propertyId :** ✅ Implémenté dans `GET /api/leases?propertyId=...`

**Champ calculé :** ✅ `runtimeStatus` ajouté à chaque bail dans l'API

**Statut persistant :** ✅ Le champ `status` DB est conservé pour l'historique

### C) UI ✅

**Badges selon runtimeStatus :**
- **active** → badge vert "ACTIF"
- **signed & upcoming** → badge bleu "SIGNÉ" / "À VENIR"
- **expired** → badge gris "EXPIRÉ"
- **draft** → badge jaune "BROUILLON"

**Filtrage par propertyId :** ✅ QueryKey React Query: `['leases', propertyId]`

**Invalidation des queries :** ✅ Après modification des dates ou upload de bail signé

**Compteur "baux actifs" :** ✅ Utilise `runtimeStatus === 'active'`

## 📁 Fichiers Créés/Modifiés

### 1. **Nouveaux fichiers**

#### `src/utils/date.ts`
```typescript
export const APP_TIMEZONE = 'Europe/Paris';
export function toLocalDate(date: Date | string, timezone: string = APP_TIMEZONE): string
export function isBetweenInclusive(date: Date | string, startDate: Date | string, endDate: Date | string, timezone: string = APP_TIMEZONE): boolean
export function getToday(timezone: string = APP_TIMEZONE): string
export function compareDates(date1: Date | string, date2: Date | string, timezone: string = APP_TIMEZONE): number
```

#### `src/domain/leases/status.ts`
```typescript
export type LeaseRuntimeStatus = 'active' | 'signed' | 'upcoming' | 'expired' | 'draft';
export function getLeaseRuntimeStatus(lease: Lease, now: string | Date = getToday()): LeaseRuntimeStatus
export function getLeaseStatusDisplay(status: LeaseRuntimeStatus): { label: string; className: string; color: string }
```

### 2. **Fichiers modifiés**

#### `src/app/api/leases/route.ts`
- ✅ Import de `getLeaseRuntimeStatus`
- ✅ Ajout de `runtimeStatus` à chaque bail dans la réponse GET
- ✅ Filtrage par `propertyId` maintenu

#### `src/app/api/leases/stats/route.ts`
- ✅ Import de `getLeaseRuntimeStatus`
- ✅ Calcul des stats avec le nouveau système
- ✅ `activeLeases` basé sur `runtimeStatus === 'active'`
- ✅ `totalMonthlyRent` pour les baux actifs uniquement

#### `src/ui/hooks/useLeases.ts`
- ✅ Interface `Lease` mise à jour avec `runtimeStatus` et `signedPdfUrl`
- ✅ Support du filtrage par `propertyId`

#### `src/ui/components/PropertyLeasesTab.tsx`
- ✅ Import de `getLeaseStatusDisplay`
- ✅ Utilisation du `runtimeStatus` côté serveur
- ✅ Badges mis à jour selon le nouveau système

#### `src/ui/shared/tables/LeasesTable.tsx`
- ✅ Import de `getLeaseStatusDisplay`
- ✅ Affichage des badges selon `runtimeStatus`
- ✅ Support des nouveaux statuts

#### `src/ui/leases-tenants/LeaseFormModal.tsx`
- ✅ Import de `getLeaseStatusDisplay` (préparé pour usage futur)

## 🧪 Tests Effectués

### Tests API ✅

```bash
# Test 1: API des baux avec propertyId
GET /api/leases?propertyId=cmgkk3vuw0002clczk3pd7djj
→ Status: 200 OK
→ Résultat: Bail avec runtimeStatus calculé

# Test 2: API des stats
GET /api/leases/stats
→ Status: 200 OK
→ Résultat: {"totalLeases":2,"activeLeases":1,"expiringIn60Days":0,"totalMonthlyRent":800}

# Test 3: Filtrage par propertyId
GET /api/leases?propertyId=inexistant
→ Status: 200 OK
→ Résultat: []
```

### État des Données de Test

- **2 baux totaux** dans le système
- **1 bail actif** (calculé avec le nouveau système)
- **800€ de loyer mensuel total** (baux actifs uniquement)
- **0 échéances < 60 jours**

## 🎨 Badges UI

| Statut | Couleur | Label | Classe CSS |
|--------|---------|-------|------------|
| `active` | Vert | ACTIF | `bg-green-100 text-green-800` |
| `signed` | Bleu | SIGNÉ | `bg-blue-100 text-blue-800` |
| `upcoming` | Bleu | À VENIR | `bg-blue-100 text-blue-800` |
| `expired` | Gris | EXPIRÉ | `bg-gray-100 text-gray-600` |
| `draft` | Jaune | BROUILLON | `bg-yellow-100 text-yellow-800` |

## 🔄 Logique de Calcul

### Détermination du statut signé
```typescript
const isSigned = lease.status === 'SIGNÉ' || lease.status === 'ACTIF' || !!lease.signedPdfUrl;
```

### Calcul du statut actif
```typescript
if (isBetweenInclusive(today, lease.startDate, lease.endDate)) {
  return 'active';
}
```

### Gestion des dates
- **Fuseau horaire :** Europe/Paris
- **Format de comparaison :** YYYY-MM-DD (date-only)
- **Bornes inclusives :** startDate ≤ today ≤ endDate

## 🚀 Prêt pour Tests Manuels

### Tests à Effectuer

1. **Créer 4 baux avec différents statuts :**
   - Bail 1: signé, start=today-2, end=today+10 → **ACTIF** (vert)
   - Bail 2: signé, start=today+2, end=today+30 → **À VENIR** (bleu)
   - Bail 3: signé, start=today-30, end=today-1 → **EXPIRÉ** (gris)
   - Bail 4: non signé → **BROUILLON** (jaune)

2. **Vérifier le filtrage par propriété :**
   - Page d'un bien → n'affiche QUE ses baux

3. **Vérifier le rafraîchissement automatique :**
   - Modifier les dates d'un bail → statut se met à jour sans F5

4. **Vérifier les compteurs :**
   - Cartes "Baux actifs" → utilise le nouveau système

---

**✅ Implémentation terminée et prête pour les tests manuels !**

Le système de statuts de baux est maintenant entièrement fonctionnel avec :
- Calcul côté serveur
- Filtrage par propertyId
- Badges UI cohérents
- Invalidation automatique des caches
- Support des fuseaux horaires
