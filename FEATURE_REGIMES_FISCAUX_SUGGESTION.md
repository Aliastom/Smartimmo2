# ✅ Feature : Régimes fiscaux - Respect du choix + Suggestion

## 🎯 **PROBLÈME IDENTIFIÉ**

L'utilisateur a remarqué que :
1. Ses biens sont définis en **régime réel** dans SmartImmo
2. Mais la simulation les calcule en **micro-foncier**
3. Il pensait que "Automatique" = respecter le régime défini sur le bien

**Confusion** : Qu'est-ce que "Automatique (recommandé)" fait exactement ?

---

## ✅ **SOLUTION IMPLÉMENTÉE**

### **1. Logique de sélection des régimes (clarifiée)**

```typescript
// Priorité : regimeForce > regimeChoisi > regimeSuggere
const regime = regimeForce || property.regimeChoisi || property.regimeSuggere;
```

| Dropdown | regimeForce | regimeChoisi (BDD) | regimeSuggere | Résultat |
|----------|-------------|-------------------|---------------|----------|
| **Automatique** | `undefined` | `'reel'` (défini) | `'micro'` (calculé) | **'reel'** ✅ |
| **Automatique** | `undefined` | `undefined` (non défini) | `'micro'` (calculé) | **'micro'** ✅ |
| **Micro-foncier** | `'micro'` | `'reel'` | `'micro'` | **'micro'** ⚠️ (force) |
| **Régime réel** | `'reel'` | `'micro'` | `'micro'` | **'reel'** ⚠️ (force) |

---

### **2. Récupération du régime depuis la BDD**

**Avant** ❌ :
```typescript
// FiscalAggregator ne récupérait pas fiscalRegimeId
return prisma.property.findMany({
  select: {
    id: true,
    name: true,
    type: true,
    // ❌ fiscalRegimeId manquant
  },
});
```

**Après** ✅ :
```typescript
return prisma.property.findMany({
  select: {
    id: true,
    name: true,
    type: true,
    fiscalRegimeId: true,  // 🆕
    FiscalRegime: {        // 🆕
      select: {
        id: true,
        code: true,
      },
    },
  },
});

// Mapper vers regimeChoisi
let regimeChoisi: RegimeFiscal | undefined;
if (property.FiscalRegime?.code) {
  const code = property.FiscalRegime.code.toLowerCase();
  if (code.includes('micro')) {
    regimeChoisi = 'micro';
  } else if (code.includes('reel') || code.includes('réel')) {
    regimeChoisi = 'reel';
  }
}

return {
  // ...
  regimeSuggere,  // Régime optimal calculé
  regimeChoisi,   // 🆕 Régime défini dans SmartImmo
};
```

---

### **3. Affichage des régimes par bien**

**Nouveau dans l'UI (section Résumé)** :

```tsx
📊 Régimes fiscaux par bien :
┌──────────────────────────────────────┐
│ 42B          [Réel] ⚠️ (suggéré: Micro) │ ← Orange (non optimal)
│ Garage 4     [Réel] ⚠️ (suggéré: Micro) │ ← Orange (non optimal)
└──────────────────────────────────────┘
```

**Code** :
```typescript
{simulation.biens.map((bien) => {
  const suggere = bien.regimeSuggere;
  const utilise = bien.regimeUtilise;
  const isOptimal = suggere === utilise;
  
  return (
    <div className="flex items-center justify-between">
      <span>{bien.nom}</span>
      <div className="flex items-center gap-2">
        <Badge className={isOptimal ? "bg-green-100" : "bg-orange-100"}>
          {utilise === 'micro' ? 'Micro' : 'Réel'}
        </Badge>
        {!isOptimal && (
          <span className="text-orange-600 text-xs">
            (suggéré: {suggere === 'micro' ? 'Micro' : 'Réel'})
          </span>
        )}
      </div>
    </div>
  );
})}
```

---

### **4. Clarification dans l'UI**

**Avant** :
```
✓ Le système choisira le régime le plus avantageux
```

**Après** :
```
✓ Utilise le régime défini sur chaque bien, ou calcule l'optimal
```

---

## 📊 **EXEMPLE AVEC VOS DONNÉES**

### **Vos 2 biens**

| Bien | Loyers | Charges | Régime défini (BDD) | Régime suggéré (calcul) | Régime utilisé (Auto) |
|------|--------|---------|---------------------|------------------------|----------------------|
| **42B** | 415 € | ~14 € | **Réel** | Micro (30% = 124,50€ > 14€) | **Réel** ✅ |
| **Garage 4** | 42 € | ~13 € | **Réel** | Micro (30% = 12,60€ ≈ 13€) | **Réel** ✅ |

**Avec "Automatique"** : Les 2 biens restent en **réel** car c'est défini dans SmartImmo ✅

**Suggestion affichée** : "⚠️ suggéré: Micro" (car micro serait légèrement plus avantageux)

---

## 🎯 **AVANTAGES**

| Avantage | Description |
|----------|-------------|
| **Respect du choix** | Le régime défini sur le bien est prioritaire |
| **Suggestion visible** | L'utilisateur voit si un autre régime serait meilleur |
| **Transparence** | Affichage clair : régime utilisé vs suggéré |
| **Flexibilité** | Possibilité de forcer micro ou réel pour tous |
| **Pédagogique** | L'utilisateur comprend l'impact du choix de régime |

---

## 🎨 **AFFICHAGE SELON LE CAS**

### **Cas 1 : Régime défini = Régime optimal**

```
📊 Régimes fiscaux par bien :
┌────────────────────────────┐
│ Bien A    [Micro] ✅       │ ← Vert (optimal)
└────────────────────────────┘
```

### **Cas 2 : Régime défini ≠ Régime optimal**

```
📊 Régimes fiscaux par bien :
┌──────────────────────────────────────┐
│ Bien B    [Réel] ⚠️ (suggéré: Micro) │ ← Orange (non optimal)
└──────────────────────────────────────┘
```

### **Cas 3 : Pas de régime défini**

```
📊 Régimes fiscaux par bien :
┌────────────────────────────┐
│ Bien C    [Micro] ✅       │ ← Vert (utilise le suggéré)
└────────────────────────────┘
```

---

## 📝 **MODIFICATIONS TECHNIQUES**

### **Fichiers modifiés** :

1. **`src/services/tax/FiscalAggregator.ts`**
   - ✅ Récupère `fiscalRegimeId` et `FiscalRegime` depuis la BDD
   - ✅ Mappe `FiscalRegime.code` vers `regimeChoisi`

2. **`src/services/tax/Simulator.ts`**
   - ✅ Passe `regimeSuggere` aux fonctions de simulation
   - ✅ Retourne `regimeUtilise` et `regimeSuggere` dans les résultats

3. **`src/types/fiscal.ts`**
   - ✅ Ajoute `regimeUtilise` et `regimeSuggere` dans `RentalPropertyResult`

4. **`src/app/impots/simulation/SimulationClient.tsx`**
   - ✅ Affiche un encart "Régimes fiscaux par bien"
   - ✅ Badge vert si optimal, orange si non optimal
   - ✅ Affiche la suggestion si différente

---

## ✅ **VALIDATION**

### **Test 1 : Bien avec régime défini**

1. Bien en BDD avec `fiscalRegimeId` → "REEL_FONCIER"
2. Loyers 415 €, Charges 14 €
3. Régime suggéré : Micro (30% = 124€ > 14€)
4. ✅ Simulation utilise **Réel** (respecte la BDD)
5. ✅ Affiche "⚠️ (suggéré: Micro)"

---

### **Test 2 : Bien sans régime défini**

1. Bien en BDD sans `fiscalRegimeId`
2. Loyers 10 000 €, Charges 5 000 €
3. Régime suggéré : Réel (5 000€ > 30% de 10k = 3 000€)
4. ✅ Simulation utilise **Réel** (optimal)
5. ✅ Affiche badge vert (optimal)

---

### **Test 3 : Forcer un régime**

1. Sélectionner "Micro-foncier" dans le dropdown
2. ✅ TOUS les biens passent en micro (même ceux en réel)
3. ✅ Affichage : "⚠️ (suggéré: Réel)" si non optimal

---

## 🎉 **RÉSULTAT FINAL**

```
✅ Régime défini sur le bien = Respecté
✅ Régime optimal = Calculé et affiché
✅ Suggestion visible si régime non optimal
✅ Dropdown clarifié
✅ Transparence totale
```

**L'utilisateur garde le contrôle ET voit les recommandations !** 🎯

---

**Date** : 08/11/2025  
**Statut** : ✅ **Implémenté**  
**UX** : ✅ **Claire et pédagogique**

