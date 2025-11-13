# ✅ Corrections Finales - Logique Métier Correcte

**Date** : 2025-11-05  
**Version** : 1.0.3  
**Statut** : ✅ **LOGIQUE MÉTIER CORRIGÉE**

---

## 🎯 Problèmes Identifiés & Corrigés

### ❌ Avant : Logique incorrecte

1. Filtrage par nature (`RECETTE_LOYER`, `DEPENSE_LOYER`)
2. Classification manuelle (taxe_fonciere, frais_gestion, etc.)
3. Codes système utilisés pour filtrer
4. Checkboxes `deductible`/`capitalizable` manquantes dans l'admin

### ✅ Après : Logique correcte

1. **TOUTES les transactions du bien** prises en compte
2. **UNIQUEMENT `Category.deductible`** détermine la déductibilité
3. **Codes système** = informatifs uniquement
4. **Checkboxes affichées** dans l'admin catégories

---

## 📋 Corrections Appliquées

### 1. FiscalAggregator Simplifié ✅

**Fichier** : `src/services/tax/FiscalAggregator.ts`

**Ancienne logique (complexe et incorrecte)** :
```typescript
// ❌ Filtrer par nature
nature: { in: ['RECETTE_LOYER', 'loyer-charges'] }

// ❌ Classification manuelle
if (categorySlug.includes('taxe_fonciere')) {
  taxeFonciere += montant;
}
```

**Nouvelle logique (simple et correcte)** :
```typescript
// ✅ Récupérer TOUTES les transactions du bien
const transactions = await prisma.transaction.findMany({
  where: {
    propertyId,
    accounting_month: { contains: yearString },
  },
  include: { Category: true },
});

// ✅ Recettes = montants positifs
if (transaction.amount > 0) {
  recettesTotales += transaction.amount;
}

// ✅ Charges déductibles = Category.deductible === true
if (transaction.amount < 0) {
  if (transaction.Category?.deductible === true) {
    chargesDeductibles += montant;
  } else if (transaction.Category?.capitalizable === true) {
    chargesCapitalisables += montant;
  }
}
```

**Impact** :
- ✅ Toutes les recettes comptées (loyers, autres revenus, etc.)
- ✅ Toutes les dépenses classifiées selon `Category.deductible`
- ✅ Plus de filtrage par nature
- ✅ Logs ajoutés pour debug

---

### 2. Checkboxes Admin Catégories ✅

**Fichier** : `src/app/admin/natures-categories/NatureCategoryFormModal.tsx`

**Ajouts dans le formulaire** :

```tsx
{mode === 'category' && (
  <div className="border-t pt-4 space-y-3">
    <Label>Propriétés fiscales</Label>
    
    {/* Checkbox Déductible */}
    <Checkbox
      id="deductible"
      checked={formData.deductible}
      onCheckedChange={(checked) => handleInputChange('deductible', checked)}
    />
    <label htmlFor="deductible">Charge déductible</label>
    
    {/* Checkbox Capitalizable */}
    <Checkbox
      id="capitalizable"
      checked={formData.capitalizable}
      onCheckedChange={(checked) => handleInputChange('capitalizable', checked)}
    />
    <label htmlFor="capitalizable">Charge capitalisable</label>
    
    {/* Alerte si les deux sont cochées */}
    {formData.deductible && formData.capitalizable && (
      <Alert>
        ⚠️ Une charge ne peut pas être à la fois déductible ET capitalisable
      </Alert>
    )}
  </div>
)}
```

**Impact** :
- ✅ Checkboxes visibles lors création/modification catégorie
- ✅ Valeurs chargées depuis la BDD en édition
- ✅ Validation : pas les deux en même temps
- ✅ Tooltips explicatifs

---

### 3. API Backend Mise à Jour ✅

**Fichier** : `src/app/api/admin/categories/route.ts`

**GET** : Retourner `deductible` et `capitalizable`
```typescript
transformedCategories.map(category => ({
  ...category,
  deductible: category.deductible,      // ✅ Ajouté
  capitalizable: category.capitalizable  // ✅ Ajouté
}))
```

**POST** : Sauvegarder les champs
```typescript
const { key, label, type, active = true, deductible = false, capitalizable = false } = body;

await prisma.category.create({
  data: {
    slug: key,
    label,
    type,
    actif: active,
    deductible,      // ✅ Ajouté
    capitalizable    // ✅ Ajouté
  }
});
```

**PATCH** : Mettre à jour les champs
```typescript
const { key, label, type, active, deductible, capitalizable } = body;

await prisma.category.update({
  where: { slug: key },
  data: { 
    label, 
    type, 
    actif: active,
    deductible,      // ✅ Ajouté
    capitalizable    // ✅ Ajouté
  }
});
```

**Impact** :
- ✅ Les checkboxes sont sauvegardées en BDD
- ✅ Les valeurs sont rechargées en édition
- ✅ Le module fiscal utilise ces valeurs

---

## 🎯 Nouvelle Logique Fiscale

### Schéma Simple

```
Pour chaque bien :
  
  1. Récupérer TOUTES les transactions de l'année
     WHERE accounting_month CONTAINS 'year'
  
  2. Calculer recettes
     Recettes = Somme(amount WHERE amount > 0)
  
  3. Calculer charges déductibles
     Charges déductibles = Somme(|amount| WHERE amount < 0 AND Category.deductible = true)
  
  4. Calculer charges capitalisables
     Charges capitalisables = Somme(|amount| WHERE amount < 0 AND Category.capitalizable = true)
  
  5. Résultat fiscal
     Résultat = Recettes - Charges déductibles - Amortissements (si LMNP/LMP)
```

### Rôle des Codes Système

**Dans `/parametres/gestion-deleguee`** :
- `RECETTE_LOYER` : Permet d'identifier quelle catégorie est le "loyer principal"
- `DEPENSE_LOYER` : Permet d'identifier quelle catégorie est "frais de gestion"

**Utilisation** :
- 📊 Affichage : Savoir si une transaction est un loyer ou pas
- 🏷️ Labeling : Générer des labels automatiques
- 📈 Statistiques : Grouper par type de recette/dépense
- ⚠️ **PAS pour filtrer** dans les calculs fiscaux !

---

## 📊 Exemple Concret : "42 bis 1"

### Vos Transactions (Octobre 2025)

| Transaction | Amount | Nature | Catégorie | Deductible | Impact Fiscal |
|-------------|--------|--------|-----------|------------|---------------|
| Loyer | +415€ | LOYER | Loyer + charges | - | **Recette** |
| Commission | -24,90€ | DEPENSE_LOYER | Frais de gestion | ✅ true | **Charge déductible** |

### Calcul Fiscal

```
Recettes totales = 415€
Charges déductibles = 24,90€ (car Category.deductible = true)
Résultat fiscal = 415€ - 24,90€ = 390,10€
```

### En Micro-Foncier (si éligible)

```
Abattement 30% = 390,10€ × 0.30 = 117,03€
Base imposable = 390,10€ - 117,03€ = 273,07€
PS = 273,07€ × 17.2% = 46,97€
```

---

## 🧪 Tests à Refaire

### Test 1 : Vérifier les catégories

1. Ouvrir : `http://localhost:3000/admin/natures-categories`
2. Cliquer "Créer une catégorie"
3. Vérifier que les checkboxes apparaissent :
   - [ ] ✅ "Charge déductible"
   - [ ] ✅ "Charge capitalisable"
4. Modifier une catégorie existante (ex: "Frais de gestion")
5. Vérifier que les checkboxes sont cochées selon les valeurs BDD

### Test 2 : Simulation fiscale

1. Ouvrir : `http://localhost:3000/impots/simulation`
2. Sélectionner : **"Déclaration 2026 (revenus 2025)"**
3. Cliquer "Calculer"
4. Vérifier dans le drawer :
   - [ ] "42 bis 1" : Recettes 415€
   - [ ] "42 bis 1" : Charges 24,90€
   - [ ] Résultat ~390€

---

## 📝 Résumé des Fichiers Modifiés

1. ✅ `src/services/tax/FiscalAggregator.ts` - Simplifié, utilise Category.deductible
2. ✅ `src/app/admin/natures-categories/NatureCategoryFormModal.tsx` - Checkboxes ajoutées
3. ✅ `src/app/api/admin/categories/route.ts` - GET/POST/PATCH avec deductible/capitalizable
4. ✅ `src/app/impots/simulation/SimulationClient.tsx` - Section PER + logique N-1

---

## 🚀 Prochaines Étapes

1. **Rafraîchir** : `http://localhost:3000/impots/simulation`
2. **Sélectionner** : "Déclaration 2026 (revenus 2025)"
3. **Calculer** : Vérifier que "42 bis 1" apparaît avec 415€ et 24,90€
4. **Vérifier admin** : Checkboxes visibles dans `/admin/natures-categories`

---

**Version** : 1.0.3  
**Logique métier** : ✅ Correcte  
**Prêt à tester** : 🚀

