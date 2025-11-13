# ✅ Correction de l'Erreur API 409 Conflict

## 🐛 **Problème Identifié**

**Erreur :** `POST http://localhost:3000/api/documents/finalize 409 (Conflict)`
**Message :** "Erreur: Document en doublon"

**Cause :** L'API `/api/documents/finalize` rejette le fichier même quand `userForcesDuplicate: true`.

---

## 🔍 **Diagnostic**

### **Le Flux :**

1. **Frontend** : `handleConfirmWithFlags` avec `userForcesDuplicate: true`
2. **API** : `/api/documents/finalize` reçoit `keepDespiteDuplicate: false`
3. **Validation API** : `if (!keepDespiteDuplicate && !replaceDuplicateId && meta.isDuplicate)`
4. **Résultat** : 409 Conflict "Document en doublon"

### **Le Problème :**

Dans `handleConfirmWithFlags`, `keepDespiteDuplicate` était défini comme :
```typescript
keepDespiteDuplicate: currentPreview.duplicateAction === 'keep'
```

Mais `currentPreview.duplicateAction` n'était pas correctement défini, donc `keepDespiteDuplicate` était `false`.

---

## 🔧 **Solution Appliquée**

### **Forcer `keepDespiteDuplicate: true`**

**Avant :**
```typescript
keepDespiteDuplicate: currentPreview.duplicateAction === 'keep',
```

**Après :**
```typescript
keepDespiteDuplicate: flags.userForcesDuplicate || currentPreview.duplicateAction === 'keep',
```

### **Logique de la Solution :**

- **Si `flags.userForcesDuplicate = true`** → `keepDespiteDuplicate = true` (force la conservation)
- **Sinon** → Utilise l'ancienne logique `currentPreview.duplicateAction === 'keep'`

### **Validation API :**

```typescript
// Dans /api/documents/finalize/route.ts
if (!keepDespiteDuplicate && !replaceDuplicateId && meta.isDuplicate) {
  // Vérifier les doublons
  return NextResponse.json({
    success: false,
    error: 'Document en doublon',
    // ...
  }, { status: 409 });
}
```

**Avec `keepDespiteDuplicate: true`** → Cette validation est **contournée**.

---

## 🎯 **Résultat Attendu**

**Maintenant, quand vous uploadez un doublon :**

1. ✅ **1ère modale** : "Document en doublon détecté" → "Conserver les deux"
2. ✅ **2ème modale** : "Copie volontaire" → "Enregistrer quand même"
3. ✅ **Plus d'erreur 409** : `keepDespiteDuplicate: true` contourne la validation API
4. ✅ **Enregistrement direct** : Le fichier est enregistré avec `userReason: 'doublon_conserve_manuellement'`

---

## ✅ **Statut**

**Erreur API 409 Conflict corrigée !**

- ✅ **`keepDespiteDuplicate` forcé** : `flags.userForcesDuplicate || currentPreview.duplicateAction === 'keep'`
- ✅ **Validation API contournée** : Plus de rejet par l'API
- ✅ **Enregistrement direct** : Le fichier est accepté par l'API
- ✅ **Flags respectés** : `userForcesDuplicate` est pris en compte

**Testez maintenant - le fichier devrait être enregistré sans erreur 409 !** 🚀
