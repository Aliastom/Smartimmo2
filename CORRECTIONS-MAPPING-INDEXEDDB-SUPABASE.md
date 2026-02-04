# Corrections Mapping IndexedDB ↔ Supabase

## ✅ Corrections appliquées

### 1. Mapping `accountingMonth` → `accounting_month`
**Problème** : L'API retourne `accountingMonth` (camelCase) mais IndexedDB attend `accounting_month` (snake_case)

**Fichiers corrigés** :
- `src/lib/offline/fullSync.ts` : Ajout du mapping `accounting_month: item.accounting_month || item.accountingMonth || null`
- `src/lib/offline/syncGlobal.ts` : Même correction

### 2. Mapping `rapprochementStatus`
**Vérification** : Le champ est déjà bien mappé dans les deux sens
- Supabase : `rapprochementStatus` (String)
- IndexedDB : `rapprochementStatus` (String)
- ✅ Identique

### 3. Mapping des natures
**Problème potentiel** : Les natures sont indexées par `key` dans IndexedDB, mais les transactions utilisent `code`

**Correction** : Indexation double (par `key` et par `code` si différent) dans `useDashboardData.ts`

### 4. Fallback sur `date` pour le filtrage mensuel
**Correction** : Rétabli le fallback sur `date` si `accounting_month` n'est pas disponible (pour compatibilité avec données existantes)

## 🔍 Vérifications nécessaires

### Structure des champs Supabase vs IndexedDB

| Champ Supabase | Champ IndexedDB | Status |
|----------------|-----------------|--------|
| `accounting_month` | `accounting_month` | ✅ Corrigé (mapping API → IndexedDB) |
| `rapprochementStatus` | `rapprochementStatus` | ✅ Identique |
| `nature` (code) | `nature` (code) | ✅ Identique |
| `date` | `date` | ✅ Identique |
| `amount` | `amount` | ✅ Identique |
| `paidAt` | `paidAt` | ✅ Identique |

## 🚨 Points d'attention

1. **Resynchronisation nécessaire** : Après les corrections de mapping, il faut relancer une synchronisation complète pour que `accounting_month` soit correctement mappé dans IndexedDB

2. **Natures** : S'assurer que `tx.nature` dans les transactions correspond bien à `nature.key` dans IndexedDB (les deux doivent contenir le `code` de la nature)

3. **Calcul des sommes encaissées rapprochées** : 
   - Filtre : `flow === 'INCOME'` ET `rapprochementStatus === 'rapprochee'`
   - Mois : `accounting_month === month` (avec fallback sur `date` si nécessaire)

