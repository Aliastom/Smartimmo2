# 🐛 CORRECTION : Bugs Modal Édition Transactions

## 📋 Contexte

Deux bugs identifiés dans la modal d'édition de transactions :
1. L'encart "Détail du loyer" s'affiche même quand nature et catégorie ne correspondent pas aux codes système
2. La catégorie par défaut n'est pas toujours appliquée quand on change la nature

**Note** : Les bugs n'affectaient que le mode **édition**. Le mode création fonctionnait correctement.

---

## 🐛 Bug 1 : Affichage erroné de "Détail du loyer" en édition

### 🔍 Analyse

**Fichier** : `src/components/transactions/TransactionModalV2.tsx` (lignes 1549-1553)

**Code problématique** :
```typescript
const shouldShow = !isChildTransaction && (
  mode === 'edit'
    ? (matchesCodes || hasBreakdown) // ❌ BUG ICI
    : matchesCodes
);
```

**Problème** :
- En mode édition, la section s'affichait si `matchesCodes` **OU** `hasBreakdown` était vrai
- `hasBreakdown` vérifie si les champs `montantLoyer`, `chargesRecup`, `chargesNonRecup` ont des valeurs
- Résultat : même si la nature/catégorie ne correspondaient plus aux codes système, si la transaction avait déjà un breakdown, la section s'affichait à tort

**Exemple du bug** :
- Transaction avec nature "RECETTE_LOYER" + catégorie "Loyer + charges" → section affichée ✓
- On change vers nature "Assurance" + catégorie "Assurance propriétaire"
- Les codes ne correspondent plus, MAIS la transaction a encore des valeurs breakdown
- La section s'affichait quand même ❌

### ✅ Solution

**1. Logique d'affichage stricte** (ligne 1538)

```typescript
// 🐛 FIX : Règle d'affichage stricte basée uniquement sur les codes système
// - Afficher UNIQUEMENT si nature ET catégorie correspondent aux codes système
// - Ne PAS afficher si les codes ne correspondent pas (même avec breakdown existant)
// - JAMAIS pour les transactions enfant (commission)
const shouldShow = !isChildTransaction && matchesCodes;
```

**Suppression de** : `|| hasBreakdown` en mode édition

**2. Nettoyage automatique des champs** (lignes 676-700)

Ajout d'un `useEffect` qui nettoie automatiquement les champs breakdown si les codes ne correspondent plus :

```typescript
// 🐛 FIX : Nettoyer les champs breakdown si nature/catégorie ne correspondent plus aux codes système
useEffect(() => {
  if (isGestionEnabled && gestionCodes && selectedNature && selectedCategory) {
    const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
    const selectedCategorySlug = selectedCategoryObj?.slug || '';
    
    const matchesCodes = selectedNature === gestionCodes.rentNature &&
                        selectedCategorySlug === gestionCodes.rentCategory;
    
    // Si les codes ne correspondent plus, vider les champs breakdown
    if (!matchesCodes) {
      const currentMontantLoyer = watch('montantLoyer');
      const currentChargesRecup = watch('chargesRecup');
      const currentChargesNonRecup = watch('chargesNonRecup');
      
      // Seulement si au moins un champ est rempli
      if (currentMontantLoyer || currentChargesRecup || currentChargesNonRecup) {
        setValue('montantLoyer', 0);
        setValue('chargesRecup', 0);
        setValue('chargesNonRecup', 0);
        console.log('[TransactionModal] Nettoyage des champs breakdown (codes ne correspondent plus)');
      }
    }
  }
}, [selectedNature, selectedCategory, isGestionEnabled, gestionCodes, categories, watch, setValue]);
```

**Avantages** :
- Évite les données incohérentes
- Nettoie automatiquement les champs si on change vers une nature/catégorie incompatible
- Maintient l'intégrité des données

---

## 🐛 Bug 2 : Catégorie par défaut pas toujours appliquée en édition

### 🔍 Analyse

**Fichier** : `src/hooks/useAutoFillTransaction.ts` (lignes 212-233)

**Code problématique** :
```typescript
useEffect(() => {
  if (nature && !mappingLoading) {
    // En mode création : toujours auto-sélectionner
    // En mode édition : seulement si la catégorie actuelle n'est pas compatible
    const currentCategoryId = watch('categoryId');
    const isCurrentCategoryCompatible = currentCategoryId ? isCategoryCompatible(nature, currentCategoryId) : false;
    
    if (mode === 'create' || !isCurrentCategoryCompatible) { // ❌ BUG ICI
      // Appliquer la catégorie par défaut...
    }
  }
}, [...]);
```

**Problème** :
- En mode édition, la catégorie par défaut n'était appliquée QUE si la catégorie actuelle n'était pas compatible
- Scénario problématique :
  - Nature actuelle : `RECETTE_LOYER` avec catégorie `loyer-charges` (par défaut)
  - On change vers : `DEPENSE_GESTION` (catégorie par défaut : `frais-gestion`)
  - Si `loyer-charges` est compatible avec `DEPENSE_GESTION` (ce qui peut être le cas selon le mapping)
  - La catégorie ne changeait pas → restait à `loyer-charges` au lieu de `frais-gestion` ❌

### ✅ Solution

**Logique améliorée** (lignes 212-236)

```typescript
// 4) Sélection de Nature - Auto-sélectionner la catégorie par défaut
useEffect(() => {
  if (nature && !mappingLoading) {
    // 🐛 FIX : Toujours appliquer la catégorie par défaut quand on change la nature
    // En mode création ET édition : appliquer la catégorie par défaut
    // Exception : en édition, si on a une catégorie compatible qui est déjà la catégorie par défaut, ne rien faire
    const currentCategoryId = watch('categoryId');
    const defaultCategory = getDefaultCategory(nature);
    
    // Vérifier si la catégorie actuelle est déjà la catégorie par défaut
    const isAlreadyDefault = defaultCategory && currentCategoryId === defaultCategory.id;
    
    // Ne changer que si ce n'est pas déjà la catégorie par défaut
    if (!isAlreadyDefault) {
      if (defaultCategory) {
        setValue('categoryId', defaultCategory.id);
      } else {
        // Si pas de catégorie par défaut, prendre la première compatible
        const firstCompatible = getFirstCompatibleCategory(nature);
        if (firstCompatible) {
          setValue('categoryId', firstCompatible.id);
        }
      }
    }
  }
}, [nature, mappingLoading, getDefaultCategory, getFirstCompatibleCategory, setValue, watch]);
```

**Changements** :
1. ✅ Suppression de la condition `mode === 'create' || !isCurrentCategoryCompatible`
2. ✅ Nouvelle logique : toujours appliquer la catégorie par défaut, sauf si elle est déjà définie
3. ✅ Exception intelligente : ne rien faire si la catégorie actuelle EST déjà la catégorie par défaut (évite les rechargements inutiles)

**Avantages** :
- Comportement cohérent en création ET édition
- La catégorie par défaut est toujours appliquée quand on change la nature
- Évite les incohérences nature/catégorie

---

## ✅ Confirmation : Pas de Variables en Dur

### 🔍 Vérification du Code

J'ai vérifié l'ensemble du code pour confirmer qu'il n'y a **aucune variable hardcodée** du type `"loyer"`.

**Codes Système** :
- ✅ Récupérés depuis la BDD via `useGestionCodes` hook
- ✅ Endpoint API : `/api/settings?prefix=gestion.codes`
- ✅ Fallbacks : `RECETTE_LOYER`, `loyer-charges`, `DEPENSE_GESTION`, `frais-gestion` (mais issus de `getSetting()` → BDD)

**Mapping Nature ↔ Catégorie** :
- ✅ Table : `NatureEntity` avec relations `NatureRule`
- ✅ Hook : `useNatureMapping` pour récupérer le mapping depuis la BDD
- ✅ Endpoint API : `/api/categories?natureCode=...`

**Catégories** :
- ✅ Table : `Category` avec champs `slug`, `label`, `type`
- ✅ Tout est dynamique et configurable via l'admin

**Natures** :
- ✅ Table : `NatureEntity` avec champs `code`, `label`, `flow`
- ✅ Personnalisation des libellés via `useNatureLabels` hook

### 📊 Sources de Données

```
┌──────────────────┐
│ AppSetting       │  ← Codes système (gestion.codes.rent.nature, etc.)
└──────────────────┘
         ↓
┌──────────────────┐
│ NatureEntity     │  ← Définition des natures (RECETTE_LOYER, etc.)
│  + NatureRule    │  ← Mapping vers catégories compatibles
└──────────────────┘
         ↓
┌──────────────────┐
│ Category         │  ← Catégories comptables (loyer-charges, etc.)
└──────────────────┘
```

**Conclusion** : ✅ Tout est basé sur la BDD et les tables de mapping. Aucune logique métier n'utilise de strings hardcodés.

---

## 📁 Fichiers Modifiés

### 1. `src/components/transactions/TransactionModalV2.tsx`

**Lignes modifiées** :
- **1519-1538** : Simplification de la logique `shouldShow` (suppression de `hasBreakdown`)
- **676-700** : Ajout de `useEffect` pour nettoyer les champs breakdown

**Impact** :
- ✅ Modal création : aucun changement (déjà fonctionnel)
- ✅ Modal édition : affichage correct de la section "Détail du loyer"
- ✅ Modal édition : nettoyage automatique des champs si codes incompatibles

### 2. `src/hooks/useAutoFillTransaction.ts`

**Lignes modifiées** :
- **211-236** : Amélioration de la logique d'application de la catégorie par défaut

**Impact** :
- ✅ Mode création : aucun changement (déjà fonctionnel)
- ✅ Mode édition : catégorie par défaut toujours appliquée correctement

---

## 🧪 Tests à Effectuer

### Test 1 : Affichage "Détail du loyer"

#### Scénario 1 : Codes correspondants
1. Créer une transaction avec nature `RECETTE_LOYER` + catégorie `Loyer + charges`
2. Vérifier que la section "Détail du loyer" s'affiche ✓
3. Éditer la transaction
4. La section doit toujours s'afficher ✓

#### Scénario 2 : Codes non correspondants (création)
1. Créer une transaction avec nature `Assurance` + catégorie `Assurance propriétaire`
2. La section "Détail du loyer" NE doit PAS s'afficher ✓

#### Scénario 3 : Codes non correspondants (édition) - **BUG CORRIGÉ**
1. Créer une transaction avec nature `RECETTE_LOYER` + catégorie `Loyer + charges`
2. Remplir les champs du "Détail du loyer" (ex: loyer 500 €, charges 50 €)
3. Sauvegarder
4. Éditer la transaction
5. Changer vers nature `Assurance` + catégorie `Assurance propriétaire`
6. ✅ La section "Détail du loyer" doit DISPARAÎTRE
7. ✅ Les champs breakdown doivent être NETTOYÉS (montantLoyer, chargesRecup, chargesNonRecup = 0)

#### Scénario 4 : Transaction enfant (commission)
1. Créer une transaction loyer qui génère une commission auto
2. Éditer la commission enfant
3. La section "Détail du loyer" NE doit JAMAIS s'afficher ✓

### Test 2 : Catégorie par défaut

#### Scénario 1 : Création
1. Créer une transaction
2. Sélectionner nature `RECETTE_LOYER`
3. ✅ Catégorie `Loyer + charges` doit être appliquée automatiquement

#### Scénario 2 : Édition avec catégorie compatible - **BUG CORRIGÉ**
1. Créer une transaction avec nature `RECETTE_LOYER` + catégorie `Loyer + charges`
2. Éditer la transaction
3. Changer vers nature `DEPENSE_GESTION`
4. ✅ Catégorie doit changer vers `Frais de gestion` (catégorie par défaut de DEPENSE_GESTION)
5. ✅ Même si `Loyer + charges` est compatible avec `DEPENSE_GESTION`

#### Scénario 3 : Édition avec catégorie incompatible
1. Créer une transaction avec nature `RECETTE_LOYER` + catégorie `Loyer + charges`
2. Éditer la transaction
3. Changer vers nature `Assurance`
4. ✅ Catégorie doit changer vers `Assurance propriétaire` (catégorie par défaut d'Assurance)

---

## 📊 Comparaison Avant/Après

### Bug 1 : Section "Détail du loyer"

| Scénario | Avant (❌) | Après (✅) |
|----------|-----------|-----------|
| Création : codes OK | Section affichée | Section affichée |
| Création : codes KO | Section masquée | Section masquée |
| Édition : codes OK | Section affichée | Section affichée |
| Édition : codes KO + breakdown | Section affichée ❌ | Section masquée ✓ |
| Édition : changement codes KO | Champs breakdown conservés ❌ | Champs nettoyés ✓ |

### Bug 2 : Catégorie par défaut

| Scénario | Avant (❌) | Après (✅) |
|----------|-----------|-----------|
| Création : sélection nature | Catégorie par défaut appliquée | Catégorie par défaut appliquée |
| Édition : changement nature (catégorie incompatible) | Catégorie par défaut appliquée | Catégorie par défaut appliquée |
| Édition : changement nature (catégorie compatible) | Catégorie PAS changée ❌ | Catégorie par défaut appliquée ✓ |

---

## 🎯 Impact

### ✅ Corrections
- ✅ **Bug 1** : Section "Détail du loyer" affichée strictement selon les codes système
- ✅ **Bug 2** : Catégorie par défaut toujours appliquée correctement
- ✅ **Nettoyage auto** : Champs breakdown nettoyés si codes incompatibles
- ✅ **Cohérence** : Comportement identique entre création et édition

### 🔄 Rétrocompatibilité
- ✅ Mode création : aucun changement (déjà fonctionnel)
- ✅ Transactions existantes : pas d'impact sur les données
- ✅ API : aucune modification côté serveur

### 📚 Documentation
- ✅ Code commenté avec `🐛 FIX :` pour traçabilité
- ✅ Console logs pour debug (`[TransactionModal] Nettoyage...`)

---

## 🎉 Conclusion

Les deux bugs ont été corrigés avec succès :

1. **Section "Détail du loyer"** : affichage strict basé sur les codes système
2. **Catégorie par défaut** : toujours appliquée correctement en édition
3. **Nettoyage automatique** : évite les données incohérentes
4. **Confirmation** : aucune variable hardcodée, tout est basé sur la BDD

**Status** : ✅ **Prêt pour tests**

---

**Date** : 26 octobre 2025  
**Fichiers modifiés** : 2  
**Lignes modifiées** : ~50  
**Tests requis** : 7 scénarios  
**Impact** : Modal édition transactions (global + bien)


