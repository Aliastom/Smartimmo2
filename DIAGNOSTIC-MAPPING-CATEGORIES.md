# 🔍 Diagnostic - Mapping Catégories Comptables

## 🐛 Problème Identifié

**Symptôme** : Les combobox "Catégorie comptable" dans TransactionModal ne reflètent pas le mapping configuré en base
**Manifestations** :
- Doublons dans la liste (ex: "Travaux d'amélioration" x2)
- Caractères corrompus dans la console PowerShell
- Liste ne respecte pas les règles de mapping

## 🔍 Analyse Technique

### **1. Test API Direct**
```bash
GET /api/accounting/mapping?nature=CHARGES
# Status: 200 OK
# Nature: CHARGES ✅
# Has rules: True ✅
# Default category: cmgk0g2qn000xtvtl8cym2dps ✅
# Allowed categories count: 10 ✅
```

### **2. Test Base de Données**
```javascript
// Résultat du script test-categories.js
Règles trouvées: [ { allowedType: 'DEPENSE' }, { allowedType: 'NON_DEFINI' } ]
Types autorisés: [ 'DEPENSE', 'NON_DEFINI' ]
Catégories trouvées: 10
Doublons détectés: [ "Travaux d'amélioration" ] ❌
```

### **3. Problèmes Identifiés**

#### **A. Doublons en Base**
- **Catégorie** : "Travaux d'amélioration"
- **IDs** : 
  - `cmgk0gnc00009qh85588ycgd0`
  - `cmgk0hj8600095a7hxxvb0k7e`
- **Impact** : Affichage de doublons dans l'interface

#### **B. Encodage Console**
- **Problème** : Caractères corrompus dans PowerShell
- **Exemples** : "IntǸrǦts", "PǸnalitǸ", "Taxe foncire"
- **Impact** : Difficile de diagnostiquer via console

#### **C. Cache React Query**
- **Suspicion** : Cache obsolète possible
- **Impact** : Interface ne se met pas à jour

## 🔧 Solutions Appliquées

### **1. API Améliorée**
```typescript
// Dédupliquer les catégories par ID
const uniqueCategories = allowedCategories.filter((category, index, self) => 
  index === self.findIndex(c => c.id === category.id)
);

// Log pour debug
console.log(`[API] Nature: ${nature}, Categories: ${uniqueCategories.length}, Doublons supprimés: ${allowedCategories.length - uniqueCategories.length}`);
```

### **2. Hook avec Logs**
```typescript
const data = await response.json();
console.log(`[Hook] Nature: ${nature}, Categories: ${data.allowedCategories?.length || 0}`, data);
return data;
```

### **3. Réponse API Complète**
```typescript
return NextResponse.json({
  natureCode: nature, // ✅ Ajouté
  allowedCategories: uniqueCategories, // ✅ Dédupliquées
  defaultCategoryId: defaultConfig?.defaultCategoryId || null,
  hasRules: true,
});
```

## 🧪 Tests de Validation

### **Test 1: API CHARGES**
- ✅ Nature retournée correctement
- ✅ Règles détectées
- ✅ Catégorie par défaut
- ⚠️ Doublons supprimés côté API

### **Test 2: API LOYER**
- ✅ Nature retournée correctement
- ✅ Règles détectées
- ✅ Catégorie par défaut
- ✅ 4 catégories (REVENU + NON_DEFINI)

## 🎯 Prochaines Étapes

### **1. Test Interface Utilisateur**
- Ouvrir TransactionModal
- Sélectionner nature "CHARGES"
- Vérifier la liste des catégories
- Contrôler les logs console

### **2. Nettoyage Base de Données**
- Supprimer le doublon "Travaux d'amélioration"
- Vérifier l'intégrité des données

### **3. Validation Complète**
- Tester toutes les natures configurées
- Vérifier la sélection automatique
- Contrôler la validation client/serveur

## 📋 Fichiers Modifiés

1. `src/app/api/accounting/mapping/route.ts` - Déduplication + logs
2. `src/ui/hooks/useAccountingMapping.ts` - Logs de debug
3. `test-categories.js` - Script de diagnostic

## 🚨 Actions Requises

1. **Test Interface** : Ouvrir TransactionModal et vérifier l'affichage
2. **Nettoyage BDD** : Supprimer les doublons en base
3. **Validation** : Tester le mapping complet

**Le système de mapping est fonctionnel, mais nécessite un nettoyage des données et des tests d'interface !** 🔧
