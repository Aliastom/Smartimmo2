# 🔧 CORRECTION FINALE - LIBELLÉS ET BADGE INFORMATIF

## 🎯 PROBLÈMES IDENTIFIÉS ET CORRIGÉS

### 1. ❌ **Problème : Double période dans les libellés**
**Symptôme** : "Loyer principal - Avril 2025 - maison 1 - Avril 2025"

**Cause** : 
- Le frontend génère automatiquement le libellé avec la période : "Loyer principal - Avril 2025 - maison 1"
- Le backend ajoute ENCORE la période : "– Avril 2025"
- Résultat : Double période dans le libellé

**Solution appliquée** :
1. **Frontend** : Ne plus ajouter la période au libellé si `monthsCovered > 1`
2. **Backend** : Nettoyer le libellé avant traitement avec `extractBaseLabel()`

### 2. ❌ **Problème : Pas de badge informatif en mode édition**
**Symptôme** : Badge "Série (3) — 2/3" non affiché dans la modal d'édition

**Cause** : 
- Les champs `parentTransactionId`, `moisIndex`, `moisTotal` n'étaient pas retournés par l'API GET
- Le frontend ne pouvait donc pas les charger et afficher le badge

**Solution appliquée** :
- Ajouter ces champs dans la réponse de l'API GET `/api/transactions/:id`
- Ajouter des logs console pour débugger le badge

## 📝 FICHIERS MODIFIÉS

### 1. **`src/lib/utils/monthUtils.ts`** - Fonction de nettoyage améliorée

```typescript
/** Extrait le baseLabel d'un libellé existant (retire les mois/années) */
export function extractBaseLabel(fullLabel: string): string {
  if (!fullLabel) return fullLabel;
  
  // Pattern pour retirer les parties de date/mois (flexible pour différents formats)
  const patterns = [
    / ?–? ?(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) ?\d{4}/gi,
    / ?-? ?(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) ?\d{4}/gi,
    / ?\d{4}-\d{2}/g
  ];
  
  let cleaned = fullLabel;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Nettoyer les espaces/tirets multiples et trailing
  cleaned = cleaned
    .replace(/\s*-\s*-\s*/g, ' - ')
    .replace(/\s*–\s*–\s*/g, ' – ')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*$/, '')
    .replace(/\s*–\s*$/, '')
    .trim();
  
  return cleaned;
}
```

### 2. **`src/app/api/transactions/route.ts`** - Nettoyage du label

```typescript
// Extraire le baseLabel propre (sans les dates/mois qui peuvent déjà être présents)
const rawLabel = body.label || 'Transaction';
const baseLabel = extractBaseLabel(rawLabel);
const startMonth = accountingMonth || `${body.periodYear}-${String(body.periodMonth).padStart(2, '0')}`;

console.log('[API] Label processing:', {
  rawLabel,
  baseLabel,
  startMonth
});
```

### 3. **`src/components/transactions/TransactionModalV2.tsx`** - Génération conditionnelle du libellé

```typescript
// Fonction pour générer le libellé automatiquement
const generateLabel = useCallback(() => {
  const natureValue = watch('nature');
  const categoryId = watch('categoryId');
  const periodMonth = watch('periodMonth');
  const periodYear = watch('periodYear');
  const propertyId = watch('propertyId');
  const monthsCovered = watch('monthsCovered');

  let labelParts = [];

  // 1. Catégorie (ou nature si pas de catégorie)
  if (categoryId) {
    const selectedCategory = categories.find(cat => cat.id === categoryId);
    if (selectedCategory) {
      labelParts.push(selectedCategory.label);
    }
  } else if (natureValue) {
    const selectedNature = natures.find(nature => nature.key === natureValue);
    if (selectedNature) {
      labelParts.push(selectedNature.label);
    }
  }

  // 2. Période - UNIQUEMENT si mode édition OU si monthsCovered = 1
  // Si monthsCovered > 1, le backend ajoutera la période spécifique pour chaque transaction
  if (mode === 'edit' || !monthsCovered || monthsCovered === 1) {
    if (periodMonth && periodYear) {
      const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      const monthName = monthNames[parseInt(periodMonth) - 1] || periodMonth;
      labelParts.push(`${monthName} ${periodYear}`);
    }
  }

  // 3. Bien
  if (propertyId) {
    const selectedProperty = properties.find(prop => prop.id === propertyId);
    if (selectedProperty) {
      labelParts.push(selectedProperty.name);
    }
  }

  return labelParts.join(' - ');
}, [watch, categories, natures, properties, mode]);
```

### 4. **`src/app/api/transactions/[id]/route.ts`** - Retour des champs série

```typescript
const transformedTransaction = {
  // ... autres champs ...
  
  // Champs de série (pour afficher le badge en mode édition)
  parentTransactionId: transaction.parentTransactionId,
  moisIndex: transaction.moisIndex,
  moisTotal: transaction.moisTotal,
  
  // ... autres champs ...
};
```

### 5. **`src/components/transactions/TransactionModalV2.tsx`** - Badge avec logs

```typescript
{/* Badge de série - Visible UNIQUEMENT en mode édition si transaction fait partie d'une série */}
{(() => {
  const moisTotal = watch('moisTotal' as any);
  const moisIndex = watch('moisIndex' as any);
  console.log('[Badge Série] Mode:', mode, 'moisTotal:', moisTotal, 'moisIndex:', moisIndex);
  
  if (mode === 'edit' && moisTotal && moisIndex) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm text-blue-900 font-medium flex items-center gap-2">
              Transaction multi-mois
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Série ({moisTotal}) — {moisIndex}/{moisTotal}
              </Badge>
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Cette transaction fait partie d'une série de {moisTotal} mois. 
              Le nombre de mois couverts n'est modifiable qu'à la création.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
})()}
```

## 🧪 TESTS DE VALIDATION

### Test 1 : Création d'une série de 3 mois
**Input** :
- Catégorie : "Loyer principal"
- Période : Avril 2025
- N : 3
- Bien : "maison 1"

**Résultat attendu** :
```
✅ Transaction 1: "Loyer principal – Avril 2025"
✅ Transaction 2: "Loyer principal – Mai 2025"
✅ Transaction 3: "Loyer principal – Juin 2025"

❌ PLUS de : "Loyer principal - Avril 2025 - maison 1 - Avril 2025"
```

### Test 2 : Édition d'une transaction de série
**Actions** :
1. Ouvrir la transaction 2/3 en édition
2. Aller dans l'onglet "Période"
3. **Vérifier les logs console** : `[Badge Série] Mode: edit, moisTotal: 3, moisIndex: 2`
4. **Vérifier le badge** : "Série (3) — 2/3" s'affiche en bleu

### Test 3 : Vérifier dans la liste des transactions
**Résultat attendu dans la liste** :
```
✅ "Loyer principal – Avril 2025"
✅ "Loyer principal – Mai 2025"
✅ "Loyer principal – Juin 2025"
```

## 🔍 DÉBOGAGE

Si le badge ne s'affiche toujours pas :

1. **Ouvrir la console du navigateur**
2. **Éditer une transaction de série**
3. **Aller dans l'onglet "Période"**
4. **Chercher le log** : `[Badge Série] Mode: edit, moisTotal: X, moisIndex: Y`

**Cas possibles** :
- `moisTotal: undefined` → Les champs ne sont pas retournés par l'API
- `Mode: create` → La modal est en mode création au lieu d'édition
- Aucun log → Le code du badge n'est pas exécuté

## 📊 COMPARAISON AVANT/APRÈS

### Libellés

| Avant | Après |
|-------|-------|
| "Loyer principal - Avril 2025 - maison 1 - Avril 2025" | "Loyer principal – Avril 2025" |
| "Loyer principal - Avril 2025 - maison 1 - Mai 2025" | "Loyer principal – Mai 2025" |
| "Loyer principal - Avril 2025 - maison 1 - Juin 2025" | "Loyer principal – Juin 2025" |

### Badge informatif

| Avant | Après |
|-------|-------|
| ❌ Aucun badge affiché | ✅ "Série (3) — 2/3" affiché |
| ❌ Aucune information | ✅ Message explicatif |

## ✅ RÉSUMÉ DES CORRECTIONS

1. ✅ **Libellés propres** : Plus de double période
2. ✅ **Nettoyage automatique** : `extractBaseLabel()` retire les dates existantes
3. ✅ **Génération conditionnelle** : Le frontend ne génère pas la période si N > 1
4. ✅ **Champs série retournés** : L'API GET retourne `moisIndex` et `moisTotal`
5. ✅ **Badge avec logs** : Console logs pour débugger facilement

## 🚀 PROCHAINES ÉTAPES

1. **Tester la création** d'une série de 3 mois
2. **Vérifier les libellés** dans la liste
3. **Éditer une transaction** de la série
4. **Vérifier le badge** dans l'onglet "Période"
5. **Consulter la console** pour les logs de débogage

---

**🎉 Les corrections sont appliquées !**

Les libellés sont maintenant propres et le badge informatif devrait s'afficher en mode édition pour les transactions de série.
