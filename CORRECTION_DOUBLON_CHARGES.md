# 🐛 Correction du Doublon de Charges

**Date** : 2025-11-05  
**Version** : 1.0.6  
**Bug** : Les charges déductibles étaient comptées 2 fois (49,80€ au lieu de 24,90€)

---

## 🔍 Symptôme

### Ce que l'utilisateur voyait :
- **Base de données** : 1 seule commission de **-24,90€** ✅
- **Drawer fiscal** : **49,80€** de charges ❌
- **49,80€ = 2 × 24,90€** → Doublon !

---

## 🐛 Cause du Bug

### 1. Dans `FiscalAggregator.ts`

Le code mettait **la même valeur** dans 2 champs :
```typescript
charges: chargesDeductibles,      // 24,90€
autresCharges: chargesDeductibles, // 24,90€ ENCORE !
```

### 2. Dans `Simulator.ts`

Le calcul **additionnait les 2 champs** :
```typescript
const chargesDeductibles = 
  property.charges +        // 24,90€
  property.interets +
  property.assuranceEmprunt +
  property.taxeFonciere +
  property.fraisGestion +
  property.assurancePNO +
  property.chargesCopro +
  property.autresCharges +  // 24,90€ ENCORE !
  property.travaux.entretien;

// Résultat : 24,90 + 24,90 = 49,80€ ❌
```

---

## ✅ Correction Appliquée

### Dans `FiscalAggregator.ts` (2 endroits)

**Avant** ❌ :
```typescript
autresCharges: chargesDeductibles,  // Doublon !
```

**Après** ✅ :
```typescript
autresCharges: 0,  // Déjà inclus dans charges (éviter doublon)
```

### Nettoyage du Code

**Supprimé** : Première méthode `aggregateProperty` obsolète (ligne 128-242)  
**Gardé** : Deuxième méthode `aggregateProperty` mise à jour (ligne 270+)

---

## 📊 Résultat Attendu

### En Régime Réel

**Avant** :
```
Recettes : 415,00€
Charges : 49,80€  ❌ (doublées !)
Base imposable : 365,20€
PS : 62,81€
```

**Après** :
```
Recettes : 415,00€
Charges : 24,90€  ✅ (correct !)
Base imposable : 390,10€
PS : 67,10€
```

---

## 🧪 Test de Validation

1. **Rafraîchir** : `http://localhost:3000/impots/simulation`
2. **Sélectionner** : "Déclaration 2026 (revenus 2025)"
3. **Forcer** : Régime "Réel"
4. **Calculer**
5. **Ouvrir** le drawer "Détails du calcul"

**Résultat attendu** :
```
42 bis 1 :
  Régime : Réel
  Recettes brutes : 415,00€
  Charges déductibles : 24,90€  ← Corrigé !
  Résultat fiscal : 390,10€
```

---

## 📝 Fichiers Modifiés

1. ✅ `src/services/tax/FiscalAggregator.ts`
   - Ligne 230 : `autresCharges: 0` (au lieu de `chargesDeductibles`)
   - Ligne 377 : `autresCharges: 0` (au lieu de `chargesDeductibles`)
   - Suppression de la méthode `aggregateProperty` obsolète (lignes 128-242)

---

## 💡 Leçon Apprise

**Architecture des Charges** :

```
RentalPropertyInput {
  charges: number,           // Total agrégé ici
  interets: 0,              // Détail (si besoin)
  assuranceEmprunt: 0,      // Détail (si besoin)
  taxeFonciere: 0,          // Détail (si besoin)
  fraisGestion: 0,          // Détail (si besoin)
  assurancePNO: 0,          // Détail (si besoin)
  chargesCopro: 0,          // Détail (si besoin)
  autresCharges: 0,         // ❌ NE PAS dupliquer !
  travaux: {
    entretien: 0,           // Détail (si besoin)
  }
}
```

**Règle** : Si tout est agrégé dans `charges`, ne pas le répéter dans `autresCharges` !

---

## ✅ Validation

**Calcul Manuel** :
```
Commission : -24,90€
→ Charges déductibles : 24,90€ ✅

Recettes : 415,00€
Charges : 24,90€
Résultat fiscal : 390,10€
PS (17,2%) : 67,10€
```

**C'est maintenant correct !** 🎉























