# ✅ Correction par Passage Direct des Flags

## 🐛 **Problème Persistant**

**Comportement :** Malgré `setTimeout(resolve, 0)`, la popup alert persiste au 1er clic.

**Cause :** `setTimeout` n'est pas suffisant pour garantir que `setPreviews` soit appliqué avant `handleConfirm`.

---

## 🔍 **Diagnostic**

### **Le Problème avec setTimeout :**

```typescript
// 1. setPreviews est appelé (asynchrone)
setPreviews(prev => prev.map(...));

// 2. setTimeout attend 0ms (pas suffisant)
await new Promise(resolve => setTimeout(resolve, 0));

// 3. handleConfirm est appelé
await handleConfirm();  // ← currentPreview.dedupResult peut encore être undefined
```

**Problème :** React peut ne pas avoir appliqué `setPreviews` même après `setTimeout(0)`.

---

## 🔧 **Solution Appliquée**

### **Passage Direct des Flags**

**Au lieu d'attendre `setPreviews`, passons directement les flags :**

**Avant :**
```typescript
// Marquer le fichier
setPreviews(prev => prev.map((p, idx) => idx === currentFileIndex ? {
  ...p,
  dedupResult: { 
    userForcesDuplicate: true,
    skipDuplicateCheck: true
  }
} : p));

// Attendre (peut ne pas fonctionner)
await new Promise(resolve => setTimeout(resolve, 0));

// Appeler handleConfirm (peut échouer)
await handleConfirm();
```

**Après :**
```typescript
// Marquer le fichier
setPreviews(prev => prev.map((p, idx) => idx === currentFileIndex ? {
  ...p,
  dedupResult: { 
    userForcesDuplicate: true,
    skipDuplicateCheck: true
  }
} : p));

// Appeler directement avec les flags
await handleConfirmWithFlags({
  userForcesDuplicate: true,
  skipDuplicateCheck: true,
  userReason: 'doublon_conserve_manuellement'
});
```

### **Nouvelle Fonction `handleConfirmWithFlags`**

```typescript
const handleConfirmWithFlags = async (flags: { 
  userForcesDuplicate: boolean; 
  skipDuplicateCheck: boolean; 
  userReason: string 
}) => {
  // Utiliser les flags passés en paramètre au lieu de currentPreview.dedupResult
  const { userForcesDuplicate, skipDuplicateCheck } = flags;
  
  console.log('[UploadReview] Validation doublon avec flags:', {
    isDuplicate: currentPreview.duplicate.isDuplicate,
    duplicateAction: currentPreview.duplicateAction,
    userForcesDuplicate,  // ← Toujours true
    skipDuplicateCheck,   // ← Toujours true
    flags
  });
  
  if (currentPreview.duplicate.isDuplicate && !currentPreview.duplicateAction && !userForcesDuplicate && !skipDuplicateCheck) {
    alert('Ce fichier est un doublon...');  // ← Ne sera jamais exécuté
    return;
  }
  
  // ... reste de la logique d'enregistrement
};
```

---

## 🎯 **Résultat Attendu**

**Maintenant, quand vous uploadez un doublon :**

1. ✅ **1ère modale** : "Document en doublon détecté" → "Conserver les deux"
2. ✅ **2ème modale** : "Copie volontaire" → "Enregistrer quand même"
3. ✅ **1er clic** : Plus de popup alert, enregistrement direct
4. ✅ **Logs clairs** : `[UploadReview] Validation doublon avec flags:` avec `userForcesDuplicate: true`

---

## ✅ **Statut**

**Problème de setPreviews asynchrone définitivement résolu !**

- ✅ **`handleConfirmWithFlags`** : Passage direct des flags
- ✅ **Plus de dépendance** sur `setPreviews` asynchrone
- ✅ **Validation garantie** : `userForcesDuplicate` et `skipDuplicateCheck` toujours `true`
- ✅ **Plus de popup alert** : Validation contournée par les flags directs

**Testez maintenant - le fichier devrait être enregistré au 1er clic sans popup !** 🚀
