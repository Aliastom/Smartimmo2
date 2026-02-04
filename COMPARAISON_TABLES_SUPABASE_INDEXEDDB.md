# Comparaison Tables Supabase ↔ IndexedDB

## ✅ Tables renommées

| Supabase | IndexedDB (ancien) | IndexedDB (nouveau) | Status |
|----------|-------------------|---------------------|--------|
| `Category` | `accountingCategories` | `categories` | ✅ **CORRIGÉ** |

---

## 📊 Comparaison des champs par table

### 1. Category → categories

| Champ Supabase | Type | IndexedDB | API | Status |
|----------------|------|-----------|-----|--------|
| `id` | string | ✅ | ✅ | OK |
| `slug` | string | ✅ | ✅ | OK |
| `label` | string | ✅ | ✅ | OK |
| `type` | string | ✅ | ✅ | OK |
| `deductible` | boolean | ✅ | ✅ | OK |
| `capitalizable` | boolean | ✅ | ✅ | OK |
| `system` | boolean | ✅ | ✅ | ✅ **AJOUTÉ** |
| `actif` | boolean | ✅ | ✅ | OK |
| `createdAt` | DateTime | → `cachedAt` | ❌ | OK (remplacé) |
| `updatedAt` | DateTime | → `cachedAt` | ❌ | OK (remplacé) |

**Résultat : ✅ Tous les champs présents**

---

### 2. Transaction

| Champ Supabase | Type | IndexedDB | API | Status |
|----------------|------|-----------|-----|--------|
| `id` | string | ✅ | ✅ | OK |
| `organizationId` | string | ✅ | ✅ | OK |
| `propertyId` | string | ✅ | ✅ | OK |
| `leaseId` | string? | ✅ | ✅ | OK |
| `bailId` | string? | ✅ | ✅ | OK |
| `categoryId` | string? | ✅ | ✅ | OK |
| `label` | string | ✅ | ✅ | OK |
| `amount` | Float | ✅ | ✅ | OK |
| `date` | DateTime | ✅ | ✅ | OK |
| `reference` | string? | ✅ | ✅ | OK |
| `month` | Int? | ✅ | ✅ | OK |
| `year` | Int? | ✅ | ✅ | OK |
| `accounting_month` | string? | ✅ | ✅ | OK |
| `isRecurring` | boolean? | ✅ | ✅ | OK |
| `nature` | string? | ✅ | ✅ | OK |
| `paidAt` | DateTime? | ✅ | ✅ | OK |
| `method` | string? | ✅ | ✅ | OK |
| `notes` | string? | ✅ | ✅ | OK |
| `source` | string (default "MANUAL") | ❌ | ❌ | ❌ **MANQUE** |
| `idempotencyKey` | string? | ❌ | ❌ | ❌ **MANQUE** |
| `externalId` | string? | ❌ | ❌ | ❌ **MANQUE** |
| `externalType` | string? | ❌ | ❌ | ❌ **MANQUE** |
| `monthsCovered` | string? | ❌ | ✅ | ❌ **MANQUE IndexedDB** |
| `parentTransactionId` | string? | ❌ | ✅ | ❌ **MANQUE IndexedDB** |
| `moisIndex` | Int? | ❌ | ✅ | ❌ **MANQUE IndexedDB** |
| `moisTotal` | Int? | ❌ | ✅ | ❌ **MANQUE IndexedDB** |
| `rapprochementStatus` | string | ✅ | ✅ | OK |
| `dateRapprochement` | DateTime? | ✅ | ✅ | OK |
| `bankRef` | string? | ✅ | ✅ | OK |
| `montantLoyer` | Float? | ❌ | ✅ | ❌ **MANQUE IndexedDB** |
| `chargesRecup` | Float? | ❌ | ✅ | ❌ **MANQUE IndexedDB** |
| `chargesNonRecup` | Float? | ❌ | ✅ | ❌ **MANQUE IndexedDB** |
| `isAutoAmount` | boolean? | ❌ | ✅ | ❌ **MANQUE IndexedDB** |
| `managementCompanyId` | string? | ❌ | ✅ | ❌ **MANQUE IndexedDB** |
| `isAuto` | boolean | ❌ | ✅ | ❌ **MANQUE IndexedDB** |
| `autoSource` | string? | ❌ | ✅ | ❌ **MANQUE IndexedDB** |
| `createdAt` | DateTime | ✅ | ✅ | OK |
| `updatedAt` | DateTime | ✅ | ✅ | OK |

**Champs manquants dans IndexedDB (11 champs) :**
- `source`
- `idempotencyKey`
- `externalId`
- `externalType`
- `monthsCovered`
- `parentTransactionId`
- `moisIndex`
- `moisTotal`
- `montantLoyer`
- `chargesRecup`
- `chargesNonRecup`
- `isAutoAmount`
- `managementCompanyId`
- `isAuto`
- `autoSource`

---

### 3. Property

| Champ Supabase | Type | IndexedDB | API | Status |
|----------------|------|-----------|-----|--------|
| `id` | string | ✅ | ✅ | OK |
| `organizationId` | string | ✅ | ✅ | OK |
| `name` | string | ✅ | ✅ | OK |
| `type` | string | ✅ | ✅ | OK |
| `address` | string | ✅ | ✅ | OK |
| `postalCode` | string | ✅ | ✅ | OK |
| `city` | string | ✅ | ✅ | OK |
| `surface` | Float | ✅ | ✅ | OK |
| `rooms` | Int | ✅ | ✅ | OK |
| `acquisitionDate` | DateTime | ✅ | ✅ | OK |
| `acquisitionPrice` | Float | ✅ | ✅ | OK |
| `notaryFees` | Float | ✅ | ✅ | OK |
| `currentValue` | Float | ✅ | ✅ | OK |
| `status` | string | ✅ | ✅ | OK |
| `statusMode` | string | ✅ | ✅ | OK |
| `statusManual` | string? | ✅ | ✅ | OK |
| `occupation` | string | ✅ | ✅ | OK |
| `evalSource` | string? | ✅ | ✅ | OK |
| `evalDate` | DateTime? | ✅ | ✅ | OK |
| `exitFeesRate` | Float? | ✅ | ✅ | OK |
| `notes` | string? | ✅ | ✅ | OK |
| `managementCompanyId` | string? | ✅ | ✅ | OK |
| `fiscalTypeId` | string? | ✅ | ✅ | OK |
| `fiscalRegimeId` | string? | ✅ | ✅ | OK |
| `rentalMode` | string | ✅ | ✅ | OK |
| `airbnbListingId` | string? | ✅ | ✅ | OK |
| `isArchived` | boolean | ✅ | ✅ | OK |
| `archivedAt` | DateTime? | ✅ | ✅ | OK |
| `createdAt` | DateTime | ✅ | ✅ | OK |
| `updatedAt` | DateTime | ✅ | ✅ | OK |

**Résultat : ✅ Tous les champs présents**

---

### 4. Lease

| Champ Supabase | Type | IndexedDB | API | Status |
|----------------|------|-----------|-----|--------|
| `id` | string | ✅ | ✅ | OK |
| `organizationId` | string | ✅ | ✅ | OK |
| `propertyId` | string | ✅ | ✅ | OK |
| `tenantId` | string | ✅ | ✅ | OK |
| `type` | string | ✅ | ✅ | OK |
| `startDate` | DateTime | ✅ | ✅ | OK |
| `endDate` | DateTime? | ✅ | ✅ | OK |
| `rentAmount` | Float | ✅ | ✅ | OK |
| `deposit` | Float? | ✅ | ✅ | OK |
| `paymentDay` | Int? | ✅ | ✅ | OK |
| `notes` | string? | ✅ | ✅ | OK |
| `noticeMonths` | Int? | ✅ | ✅ | OK |
| `indexationType` | string? | ✅ | ✅ | OK |
| `furnishedType` | string? | ✅ | ✅ | OK |
| `overridesJson` | string? | ✅ | ✅ | OK |
| `status` | string | ✅ | ✅ | OK |
| `signedPdfUrl` | string? | ✅ | ✅ | OK |
| `chargesRecupMensuelles` | Float? | ✅ | ✅ | OK |
| `chargesNonRecupMensuelles` | Float? | ✅ | ✅ | OK |
| `createdAt` | DateTime | ✅ | ✅ | OK |
| `updatedAt` | DateTime | ✅ | ✅ | OK |

**Résultat : ✅ Tous les champs présents**

---

## ⚠️ Actions requises

### 1. ✅ FAIT : Renommer `accountingCategories` → `categories`

### 2. ✅ FAIT : Ajouter champ `system` à `CachedCategory`

### 3. ❌ À FAIRE : Ajouter les champs manquants à `LocalTransaction`

Champs à ajouter dans `src/lib/offline/db.ts` :
- `source?: string | null;`
- `idempotencyKey?: string | null;`
- `externalId?: string | null;`
- `externalType?: string | null;`
- `monthsCovered?: string | null;`
- `parentTransactionId?: string | null;`
- `moisIndex?: number | null;`
- `moisTotal?: number | null;`
- `montantLoyer?: number | null;`
- `chargesRecup?: number | null;`
- `chargesNonRecup?: number | null;`
- `isAutoAmount?: boolean | null;`
- `managementCompanyId?: string | null;`
- `isAuto?: boolean | null;`
- `autoSource?: string | null;`

### 4. ❌ À FAIRE : Vérifier que l'API retourne tous ces champs

L'API `/api/transactions` retourne déjà certains de ces champs (parentTransactionId, moisIndex, moisTotal, isAuto, autoSource, managementCompanyId) mais pas tous (source, idempotencyKey, externalId, externalType manquent dans le select).

---

## Résumé

- **Tables renommées :** 1 (categories) ✅
- **Champs manquants identifiés :** 
  - Category : 0 (après ajout de `system`) ✅
  - Transaction : 15 champs ❌
  - Property : 0 ✅
  - Lease : 0 ✅
