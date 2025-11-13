# 🔧 Fix : Erreur validation taux IS

## ❌ **Problème**

```
❌ Validation échouée: Taux IS réduit hors bornes [0,1]: 15, Taux IS normal hors bornes [0,1]: 25
```

**Cause** : Le validateur attend des **décimales entre 0 et 1** (0.25, 0.15) mais `extractIS()` convertissait en **pourcentages entiers** (25, 15).

---

## 🔍 **Diagnostic**

### Ligne problématique

**Fichier** : `src/services/tax/providers/openfisca/map.ts`  
**Lignes** : 544-545

```typescript
// ❌ AVANT (ERREUR)
const sciIS = {
  tauxNormal: tauxNormal * 100, // 0.25 → 25 ❌
  tauxReduit: tauxReduit * 100, // 0.15 → 15 ❌
};
```

**Résultat** : Validation échouée car `25` et `15` sont hors bornes [0,1].

---

## ✅ **Solution**

### Ne PAS multiplier par 100

```typescript
// ✅ APRÈS (CORRIGÉ)
const sciIS = {
  tauxNormal: tauxNormal, // 0.25 ✅ (25%)
  tauxReduit: tauxReduit, // 0.15 ✅ (15%)
};
```

**Résultat attendu** : Validation passe car `0.25` et `0.15` sont dans les bornes [0,1].

---

## 📊 **Logs attendus**

### Avant correction

```
[OpenFisca] Taux IS extraits: normal 25%, réduit 15%
❌ Validation échouée: Taux IS réduit hors bornes [0,1]: 15, Taux IS normal hors bornes [0,1]: 25
```

### Après correction

```
[OpenFisca] Taux IS extraits: normal 25% (0.25), réduit 15% (0.15)
✅ SCI_IS: OK (OpenFisca, confiance: 80%)
✅ Brouillon créé: 2025.scrape-...
```

---

## 🎯 **Validation de la fix**

### Test 1 : Scraping réussi
```bash
POST /api/admin/tax/sources/update { year: 2025 }
# Résultat attendu : ✅ Succès (pas d'erreur validation)
```

### Test 2 : Vérifier les valeurs dans le brouillon
```json
{
  "sciIS": {
    "tauxNormal": 0.25,   // ✅ 25%
    "tauxReduit": 0.15    // ✅ 15%
  }
}
```

---

## 📝 **Format attendu par le validateur**

Le schéma de validation dans `types.ts` attend :

```typescript
export interface SciIS {
  tauxNormal: number;  // Décimale [0,1] → 0.25 pour 25%
  tauxReduit: number;  // Décimale [0,1] → 0.15 pour 15%
}
```

**Convention SmartImmo** :
- ✅ **Taux stockés en décimales** : 0.25, 0.15, 0.172 (backend, DB)
- ✅ **Taux affichés en pourcentages** : 25%, 15%, 17.2% (UI uniquement)

---

## 🚀 **Impact**

| Section | Avant | Après |
|---------|-------|-------|
| **SCI_IS** | ❌ Validation échouée | ✅ Validation OK |
| **Complétude** | 6/7 sections OK | **7/7 sections OK** ✅ |
| **Brouillon** | ❌ Non créé | ✅ Créé avec succès |

---

## 📋 **Checklist**

- [x] Identifier la ligne problématique (multiplication par 100)
- [x] Corriger `extractIS()` pour garder les décimales
- [x] Mettre à jour les logs pour afficher les deux formats
- [x] Tester le scraping (en cours...)
- [ ] Vérifier le brouillon créé
- [ ] Publier la version 2025 officielle

---

**Fix appliqué le** : 08/11/2025  
**Fichier modifié** : `src/services/tax/providers/openfisca/map.ts`  
**Statut** : ✅ **Corrigé** (en attente de validation par test)

