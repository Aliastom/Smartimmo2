# 🔍 Diagnostic - Dépôt de Garantie Reçu

## 🐛 Problème Signalé

**Nature** : "Dépôt de garantie reçu" (DEPOT_GARANTIE_RECU)
**Symptôme** : La combobox "Catégorie comptable" ne montre que "Aucune (à classer)"
**Attendu** : 4 catégories (Avoir locataire, Divers, Dépôt de garantie, Loyer)

## ✅ API Fonctionnelle

```bash
GET /api/accounting/mapping?nature=DEPOT_GARANTIE_RECU
Status: 200 OK
Nature: DEPOT_GARANTIE_RECU ✅
Has rules: True ✅
Default category: cmgk0g2qp000ytvtle5vzkb58 ✅
Allowed categories count: 4 ✅

Catégories retournées:
- Avoir locataire (REVENU)
- Divers (NON_DEFINI)  
- Dépôt de garantie (REVENU)
- Loyer (REVENU)
```

## 🔧 Corrections Appliquées

### **1. Logs de Debug Ajoutés**
```typescript
// Dans TransactionModal.tsx
console.log('[TransactionModal] Nature:', nature);
console.log('[TransactionModal] Mapping data:', mappingData);
console.log('[TransactionModal] Allowed categories:', allowedCategories);

// Dans useAccountingMapping.ts
console.log(`[useAccountingMapping] Hook called with nature: "${nature}"`);
console.log(`[Hook] Nature: ${nature}, Categories: ${data.allowedCategories?.length || 0}`, data);
```

### **2. Cache React Query Désactivé**
```typescript
staleTime: 0, // Pas de cache pour debug
refetchOnWindowFocus: true,
```

### **3. Déduplication API**
```typescript
const uniqueCategories = allowedCategories.filter((category, index, self) => 
  index === self.findIndex(c => c.id === category.id)
);
```

## 🧪 Test Requis

**Pouvez-vous maintenant :**

1. **Ouvrir TransactionModal** sur un bien
2. **Sélectionner "Dépôt de garantie reçu"** comme nature
3. **Ouvrir la console du navigateur** (F12)
4. **Me dire ce que vous voyez dans les logs** :
   - `[useAccountingMapping] Hook called with nature: "..."`
   - `[Hook] Nature: ..., Categories: ...`
   - `[TransactionModal] Nature: ...`
   - `[TransactionModal] Allowed categories: ...`

## 🎯 Hypothèses

### **Hypothèse 1 : Hook non déclenché**
- Le hook ne se déclenche pas quand la nature change
- Logs manquants dans la console

### **Hypothèse 2 : Cache React Query**
- Données en cache obsolètes
- Cache désactivé pour debug

### **Hypothèse 3 : État initial**
- `nature` vide au chargement
- Hook ne se déclenche qu'après sélection

## 📋 Actions de Debug

1. **Vérifier les logs console** lors de la sélection de nature
2. **Contrôler l'état React** avec React DevTools
3. **Tester le réseau** dans l'onglet Network
4. **Vérifier les erreurs** dans la console

**Les logs nous diront exactement où est le problème !** 🔍
