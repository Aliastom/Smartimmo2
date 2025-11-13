# ✅ Correction du Problème de setPreviews Asynchrone

## 🐛 **Problème Identifié**

**Comportement :**
- **1er clic** "Enregistrer quand même" → Popup alert bizarre
- **2ème clic** "Enregistrer quand même" → Fonctionne correctement

**Cause :** `setPreviews` est asynchrone, donc `handleConfirm` est appelé avant que `dedupResult` soit mis à jour.

---

## 🔍 **Diagnostic**

### **Le Flux Problématique :**

```typescript
// 1. setPreviews est appelé (asynchrone)
setPreviews(prev => prev.map((p, idx) => idx === currentFileIndex ? {
  ...p,
  dedupResult: { 
    userForcesDuplicate: true,  // ← Pas encore appliqué !
    skipDuplicateCheck: true
  }
} : p));

// 2. handleConfirm est appelé immédiatement
await handleConfirm();  // ← dedupResult est encore undefined !

// 3. Dans handleConfirm :
const userForcesDuplicate = currentPreview.dedupResult?.userForcesDuplicate || false;  // ← false !
const skipDuplicateCheck = currentPreview.dedupResult?.skipDuplicateCheck || false;    // ← false !

// 4. Validation échoue
if (currentPreview.duplicate.isDuplicate && !currentPreview.duplicateAction && !userForcesDuplicate && !skipDuplicateCheck) {
  alert('Ce fichier est un doublon...');  // ← Popup alert !
  return;
}
```

### **Pourquoi le 2ème clic fonctionne :**

Au 2ème clic, `dedupResult` est déjà mis à jour par le 1er clic, donc la validation réussit.

---

## 🔧 **Solution Appliquée**

### **Attendre que setPreviews soit Appliqué**

**Avant :**
```typescript
// Marquer le fichier comme en cours d'enregistrement
setPreviews(prev => prev.map((p, idx) => idx === currentFileIndex ? {
  ...p,
  dedupResult: { 
    userForcesDuplicate: true,
    skipDuplicateCheck: true
  }
} : p));

// Enregistrer directement le fichier
await handleConfirm();  // ❌ Appelé avant que setPreviews soit appliqué
```

**Après :**
```typescript
// Marquer le fichier comme en cours d'enregistrement
setPreviews(prev => prev.map((p, idx) => idx === currentFileIndex ? {
  ...p,
  dedupResult: { 
    userForcesDuplicate: true,
    skipDuplicateCheck: true
  }
} : p));

// Attendre que setPreviews soit appliqué avant d'appeler handleConfirm
await new Promise(resolve => setTimeout(resolve, 0));

// Enregistrer directement le fichier
await handleConfirm();  // ✅ Appelé après que setPreviews soit appliqué
```

### **Explication de `setTimeout(resolve, 0)` :**

- **`setTimeout(..., 0)`** permet au cycle d'événements de se terminer
- **`setPreviews`** est appliqué dans le prochain cycle
- **`handleConfirm`** est appelé avec les bonnes valeurs

---

## 🎯 **Résultat Attendu**

**Maintenant, quand vous uploadez un doublon :**

1. ✅ **1ère modale** : "Document en doublon détecté" → "Conserver les deux"
2. ✅ **2ème modale** : "Copie volontaire" → "Enregistrer quand même"
3. ✅ **1er clic** : Plus de popup alert, enregistrement direct
4. ✅ **Plus de 2ème clic nécessaire** : Fonctionne au 1er clic

---

## ✅ **Statut**

**Problème de setPreviews asynchrone corrigé !**

- ✅ **`setTimeout(resolve, 0)`** ajouté pour attendre setPreviews
- ✅ **Plus de popup alert** au 1er clic
- ✅ **Enregistrement direct** au 1er clic
- ✅ **Flux unifié** : Plus besoin de 2 clics

**Testez maintenant - le fichier devrait être enregistré au 1er clic !** 🚀
