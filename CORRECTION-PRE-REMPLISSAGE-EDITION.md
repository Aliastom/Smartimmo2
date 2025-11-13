# 🐛 CORRECTION : Pré-remplissage en Édition

## 📋 Problème

En mode **édition**, quand on change la nature et catégorie puis qu'on revient à "Loyer", les sections "Détail du loyer" et "Commission estimée" ne réapparaissent pas, car les champs breakdown ne sont pas pré-remplis automatiquement.

### 🔍 Scénario Problématique

1. ✅ Éditer transaction loyer → sections affichées correctement
2. ✅ Changer vers "Frais bancaires" → sections disparaissent (correct)
3. ❌ Revenir à "Loyer" + "Loyer + charges" → sections ne réapparaissent PAS

**Cause** : Les champs breakdown (`montantLoyer`, `chargesRecup`, `chargesNonRecup`) restent à 0 après le nettoyage, donc les sections ne s'affichent pas.

### ✅ Comportement Attendu (Mode Création)

En mode **création**, ça fonctionne parfaitement :
- Quand on sélectionne une nature "Loyer", les champs sont auto-remplis depuis le bail
- Les sections s'affichent correctement

---

## 🔍 Analyse Technique

### Architecture des useEffect

Avant le fix, il y avait un seul `useEffect` pour le pré-remplissage des champs breakdown :

```typescript
// useEffect ligne 558-594 (avant fix)
useEffect(() => {
  if (isAutoAmount && selectedLease) {
    // Pré-remplir breakdown...
  }
}, [selectedLease?.id, isAutoAmount, autoAmountValue, setValue]);
```

**Problème** : Cet `useEffect` se déclenche uniquement quand :
- Le **bail** change (`selectedLease?.id`)
- Le mode auto change (`isAutoAmount`)

Il ne se déclenche PAS quand on change de **nature** ou **catégorie** !

### Solution Implémentée

J'ai créé **deux `useEffect` spécialisés** avec des responsabilités séparées :

#### 1️⃣ `useEffect` pour le changement de BAIL (ligne 558-596)

**Rôle** : Pré-remplir les champs quand on sélectionne ou change un bail

**Dépendances** : `selectedLease?.id`, `isAutoAmount`, `autoAmountValue`, `setValue`, `isGestionEnabled`, `gestionCodes`

**Comportement** :
- Se déclenche uniquement quand le **bail** change
- Vérifie que nature et catégorie correspondent aux codes système
- Pré-remplit les champs (écrase les valeurs existantes)

```typescript
useEffect(() => {
  if (isAutoAmount && selectedLease) {
    setValue('amount', autoAmountValue);
    
    if (isGestionEnabled && gestionCodes) {
      const matchesCodes = /* vérification codes */;
      
      if (matchesCodes) {
        setValue('montantLoyer', selectedLease.rentAmount);
        setValue('chargesRecup', selectedLease.chargesRecupMensuelles);
        setValue('chargesNonRecup', selectedLease.chargesNonRecupMensuelles);
      }
    }
  }
}, [selectedLease?.id, isAutoAmount, autoAmountValue, setValue, isGestionEnabled, gestionCodes]);
```

#### 2️⃣ `useEffect` pour le changement de NATURE/CATÉGORIE (ligne 691-741)

**Rôle** : Nettoyer OU pré-remplir les champs quand on change de nature/catégorie

**Dépendances** : `selectedNature`, `selectedCategory`, `isGestionEnabled`, `gestionCodes`, `categories`, `watch`, `setValue`, `selectedLease`, `isAutoAmount`

**Comportement** :
- Se déclenche quand **nature** ou **catégorie** change
- **Si codes ne correspondent PAS** → nettoie les champs
- **Si codes correspondent ET champs vides** → pré-remplit depuis le bail

```typescript
useEffect(() => {
  if (!isGestionEnabled || !gestionCodes || !selectedNature || !selectedCategory) return;
  
  const matchesCodes = /* vérification codes */;
  
  // CAS 1 : Codes incompatibles → Nettoyer
  if (!matchesCodes) {
    const areFieldsFilled = /* vérifier si remplis */;
    if (areFieldsFilled) {
      setValue('montantLoyer', 0);
      setValue('chargesRecup', 0);
      setValue('chargesNonRecup', 0);
    }
  }
  // CAS 2 : Codes compatibles + champs vides → Pré-remplir
  else if (matchesCodes && selectedLease && isAutoAmount) {
    const areFieldsEmpty = /* vérifier si vides */;
    
    if (areFieldsEmpty) {
      setValue('montantLoyer', selectedLease.rentAmount);
      setValue('chargesRecup', selectedLease.chargesRecupMensuelles);
      setValue('chargesNonRecup', selectedLease.chargesNonRecupMensuelles);
    }
  }
}, [selectedNature, selectedCategory, /* ... */]);
```

---

## ✅ Solution Détaillée

### Logique du Second useEffect

```typescript
// 🐛 FIX : Gestion intelligente du breakdown (pré-remplissage OU nettoyage)
useEffect(() => {
  if (!isGestionEnabled || !gestionCodes || !selectedNature || !selectedCategory) return;
  
  const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
  const selectedCategorySlug = selectedCategoryObj?.slug || '';
  const matchesCodes = selectedNature === gestionCodes.rentNature &&
                      selectedCategorySlug === gestionCodes.rentCategory;
  
  // Si les codes ne correspondent PAS, nettoyer les champs
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
  // Si les codes correspondent ET qu'on a un bail, pré-remplir si les champs sont vides
  else if (matchesCodes && selectedLease && isAutoAmount) {
    const currentMontantLoyer = watch('montantLoyer') || 0;
    const currentChargesRecup = watch('chargesRecup') || 0;
    const currentChargesNonRecup = watch('chargesNonRecup') || 0;
    
    // Pré-remplir uniquement si les champs sont vides (évite d'écraser les valeurs manuelles)
    const areFieldsEmpty = currentMontantLoyer === 0 && currentChargesRecup === 0 && currentChargesNonRecup === 0;
    
    if (areFieldsEmpty) {
      if (selectedLease.rentAmount) {
        setValue('montantLoyer', selectedLease.rentAmount);
      }
      if (selectedLease.chargesRecupMensuelles) {
        setValue('chargesRecup', selectedLease.chargesRecupMensuelles);
      }
      if (selectedLease.chargesNonRecupMensuelles) {
        setValue('chargesNonRecup', selectedLease.chargesNonRecupMensuelles);
      }
      
      console.log('[TransactionModal] Pré-remplissage breakdown (retour à loyer):', {
        montantLoyer: selectedLease.rentAmount,
        chargesRecup: selectedLease.chargesRecupMensuelles,
        chargesNonRecup: selectedLease.chargesNonRecupMensuelles
      });
    }
  }
}, [selectedNature, selectedCategory, isGestionEnabled, gestionCodes, categories, watch, setValue, selectedLease, isAutoAmount]);
```

### Points Clés

1. ✅ **Vérification des codes** : `matchesCodes` compare nature et catégorie aux codes système
2. ✅ **Nettoyage conditionnel** : uniquement si codes incompatibles ET champs remplis
3. ✅ **Pré-remplissage conditionnel** : uniquement si codes compatibles ET champs vides ET bail sélectionné
4. ✅ **Console logs** : pour debug et traçabilité

---

## 🎯 Flux de Données

### Scénario Complet : Éditer → Changer → Revenir

#### Étape 1 : Ouvrir Édition Transaction Loyer

```
État initial :
- selectedNature = "RECETTE_LOYER"
- selectedCategory = "loyer-charges" (ID)
- montantLoyer = 538.26
- chargesRecup = 20
- chargesNonRecup = 35
- matchesCodes = TRUE
→ Section "Détail du loyer" ✓
→ Section "Commission" ✓
```

#### Étape 2 : Changer vers "Frais bancaires"

```
Actions :
1. Utilisateur sélectionne nature "Frais bancaires"
2. useAutoFillTransaction applique catégorie par défaut "Frais bancaires"

État après :
- selectedNature = "DEPENSE_BANQUE"
- selectedCategory = "frais-bancaires" (ID)

useEffect #2 se déclenche :
- matchesCodes = FALSE (codes ne correspondent plus)
- Champs remplis → NETTOIE
- montantLoyer = 0
- chargesRecup = 0
- chargesNonRecup = 0

→ Section "Détail du loyer" MASQUÉE ✓
→ Section "Commission" MASQUÉE ✓
```

#### Étape 3 : Revenir à "Loyer"

```
Actions :
1. Utilisateur sélectionne nature "Loyer"
2. useAutoFillTransaction applique catégorie par défaut "Loyer + charges"

État après :
- selectedNature = "RECETTE_LOYER"
- selectedCategory = "loyer-charges" (ID)

useEffect #2 se déclenche :
- matchesCodes = TRUE (codes correspondent)
- Champs vides (montantLoyer=0, chargesRecup=0, chargesNonRecup=0)
- selectedLease existe
- isAutoAmount = TRUE
- → PRÉ-REMPLIT depuis le bail ✓

Résultat :
- montantLoyer = 538.26
- chargesRecup = 20
- chargesNonRecup = 35

→ Section "Détail du loyer" RÉAPPARAÎT ✓
→ Section "Commission" RÉAPPARAÎT ✓
```

---

## 📊 Différences Création vs Édition

| Aspect | Mode Création | Mode Édition (avant fix) | Mode Édition (après fix) |
|--------|---------------|-------------------------|-------------------------|
| **Changement bail** | Pré-remplit auto ✓ | Pré-remplit auto ✓ | Pré-remplit auto ✓ |
| **Changement vers autre nature** | Nettoie ✓ | Nettoie ✓ | Nettoie ✓ |
| **Retour à nature loyer** | Pré-remplit auto ✓ | Champs vides ❌ | Pré-remplit auto ✓ |
| **Sections réapparaissent** | Oui ✓ | Non ❌ | Oui ✓ |

---

## 📁 Fichiers Modifiés

### `src/components/transactions/TransactionModalV2.tsx`

**Lignes modifiées** :

1. **558-596** : Premier `useEffect` (changement bail)
   - Commentaires améliorés
   - Retrait de `selectedNature` et `selectedCategory` des dépendances (intentionnel)
   - Log de debug : "Pré-remplissage breakdown (changement bail)"

2. **691-741** : Second `useEffect` (changement nature/catégorie) - **NOUVEAU**
   - Gestion intelligente : nettoyage OU pré-remplissage
   - Vérifie si champs vides avant pré-remplissage
   - Log de debug : "Pré-remplissage breakdown (retour à loyer)"

**Impact** :
- ✅ Comportement identique entre création et édition
- ✅ Sections réapparaissent correctement quand on revient à loyer
- ✅ Pas d'écrasement des valeurs manuelles

---

## 🧪 Tests à Effectuer

### Test 1 : Scénario Principal

1. **Éditer** une transaction loyer existante
   - ✅ Vérifier que sections "Détail du loyer" et "Commission" s'affichent
   - ✅ Vérifier que champs sont remplis (montantLoyer, chargesRecup, chargesNonRecup)

2. **Changer** vers nature "Frais bancaires" + catégorie "Frais bancaires"
   - ✅ Sections disparaissent
   - ✅ Champs nettoyés (vérifier dans console : "Nettoyage des champs breakdown")

3. **Revenir** à nature "Loyer" + catégorie "Loyer + charges"
   - ✅ Sections réapparaissent
   - ✅ Champs pré-remplis depuis le bail (vérifier console : "Pré-remplissage breakdown (retour à loyer)")
   - ✅ Section "Commission estimée" affichée

### Test 2 : Changement de Bail

1. **Créer** une transaction avec bail A
   - ✅ Champs pré-remplis avec valeurs du bail A

2. **Changer** vers bail B
   - ✅ Champs mis à jour avec valeurs du bail B
   - ✅ Vérifier console : "Pré-remplissage breakdown (changement bail)"

### Test 3 : Mode Création

1. **Créer** une nouvelle transaction
2. **Sélectionner** un bien et un bail
3. **Sélectionner** nature "Loyer"
   - ✅ Champs pré-remplis automatiquement
   - ✅ Sections affichées

4. **Changer** vers "Frais bancaires"
   - ✅ Sections disparaissent

5. **Revenir** à "Loyer"
   - ✅ Sections réapparaissent
   - ✅ Champs pré-remplis

---

## 🎉 Résultat Final

### ✅ Comportement Unifié

Le comportement est maintenant **identique** entre création et édition :
- ✅ Changement de nature → sections apparaissent/disparaissent correctement
- ✅ Retour à nature loyer → sections réapparaissent avec champs pré-remplis
- ✅ Estimation commission affichée correctement

### 🔄 Séparation des Responsabilités

**useEffect #1 (changement bail)** :
- Déclenché par : changement de bail
- Action : pré-remplit toujours (écrase valeurs)
- Log : "changement bail"

**useEffect #2 (changement nature/catégorie)** :
- Déclenché par : changement de nature ou catégorie
- Action : nettoie OU pré-remplit si vide
- Log : "retour à loyer" ou "nettoyage"

### 📝 Logs de Debug

Les console.log ajoutés permettent de tracer le flux :
```
[TransactionModal] Nettoyage des champs breakdown (codes ne correspondent plus)
[TransactionModal] Pré-remplissage breakdown (retour à loyer): { montantLoyer: 538.26, ... }
[TransactionModal] Pré-remplissage breakdown (changement bail): { ... }
```

---

## 🎯 Impact

### ✅ Corrections
- ✅ **Pré-remplissage en édition** : champs breakdown remplis automatiquement
- ✅ **Sections réapparaissent** : "Détail du loyer" et "Commission" s'affichent
- ✅ **Comportement cohérent** : identique entre création et édition

### 🔄 Rétrocompatibilité
- ✅ Mode création : aucun changement
- ✅ Transactions existantes : pas d'impact
- ✅ API : aucune modification

### 📚 Maintenabilité
- ✅ Code commenté avec contexte
- ✅ Logs de debug pour traçabilité
- ✅ Séparation claire des responsabilités

---

**Date** : 26 octobre 2025  
**Fichier modifié** : `src/components/transactions/TransactionModalV2.tsx`  
**Lignes modifiées** : ~100  
**Tests requis** : 3 scénarios  
**Status** : ✅ **Prêt pour tests**

