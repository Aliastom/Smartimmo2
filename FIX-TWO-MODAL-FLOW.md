# ✅ Correction du Flux à 2 Modales

## 🎯 **Objectif**

Implémenter le flux correct avec **2 modales séquentielles** :

1. **1ère modale** : Détection de doublon (bandeau orange) → "Ce fichier est identique à X. Que voulez-vous faire ?"
   - Options : "Annuler", "Remplacer", "Conserver les deux"
2. **2ème modale** : Si "Conserver les deux" → "Revue de l'upload - Copie volontaire" (bandeau bleu)

---

## 🐛 **Problème Initial**

DedupFlow sautait la 1ère étape et allait directement à la 2ème modale car `userDecision: 'keep_both'` était hardcodé.

---

## 🔧 **Solutions Appliquées**

### **1. Modification de l'Appel Initial**

**Avant :**
```typescript
userDecision: 'keep_both' // Sautait la 1ère modale
```

**Après :**
```typescript
userDecision: 'pending' // Affiche d'abord la modale de détection
```

### **2. Ajout du Cas 'pending' dans DedupFlow**

```typescript
case 'pending':
  // Afficher la modale de détection avec les 3 options
  return {
    flow: 'duplicate_detection',
    duplicateStatus: 'exact_duplicate',
    userDecision: 'pending',
    ui: {
      title: 'Document en doublon détecté',
      banner: {
        type: 'warning',
        text: `Ce fichier est identique à ${existingFile?.name}...`,
        icon: '⚠️'
      },
      primaryAction: { label: 'Annuler', action: 'cancel' },
      secondaryAction: { label: 'Remplacer', action: 'replace' },
      tertiaryAction: { label: 'Conserver les deux', action: 'keep_both' }
    }
  };
```

### **3. Ajout du Bouton "Conserver les deux"**

**Dans DedupFlowModal :**
```typescript
{/* Bouton "Conserver les deux" si disponible */}
{flowOutput.ui.tertiaryAction && (
  <Button
    variant="outline"
    onClick={() => handleAction(flowOutput.ui.tertiaryAction.action)}
    disabled={isLoading || isProcessing}
  >
    {flowOutput.ui.tertiaryAction.label}
  </Button>
)}
```

### **4. Gestion du Cas 'keep_both'**

**Dans UploadReviewModal :**
```typescript
} else if (action === 'keep_both') {
  // Déclencher la 2ème modale (revue de l'upload)
  const secondFlowInput: DedupFlowInput = {
    duplicateType: 'exact_duplicate',
    existingFile: data.existingFile,
    tempFile: data.tempFile,
    userDecision: 'keep_both'
  };
  
  // Orchestrer la 2ème modale
  await orchestrateFlow(secondFlowInput, dedupFlowContext);
  
  // La modale DedupFlow restera ouverte avec le nouveau contenu
  return; // Ne pas fermer la modale
}
```

### **5. Mise à Jour des Types**

**Ajouté dans `DedupFlowInput` et `DedupFlowOutput` :**
```typescript
userDecision: 'cancel' | 'replace' | 'keep_both' | 'pending';
flow: 'upload_review' | 'replace_document' | 'cancel_upload' | 'duplicate_detection' | 'error';
```

**Ajouté dans `ui` :**
```typescript
tertiaryAction?: {
  label: string;
  action: 'keep_both';
};
```

---

## 🎯 **Résultat Attendu**

**Maintenant, quand vous uploadez un doublon :**

1. ✅ **1ère modale** : "Document en doublon détecté" avec bandeau orange
   - Boutons : "Annuler", "Remplacer", "Conserver les deux"
2. ✅ **2ème modale** : Si vous cliquez "Conserver les deux"
   - "Revue de l'upload - Copie volontaire d'un doublon" avec bandeau bleu
   - Boutons : "Annuler", "Enregistrer quand même"

---

## ✅ **Statut**

**Flux à 2 modales implémenté !**

- ✅ **1ère modale** : Détection avec 3 options
- ✅ **2ème modale** : Revue si "Conserver les deux"
- ✅ **Types mis à jour** : `pending`, `tertiaryAction`, `duplicate_detection`
- ✅ **Gestion complète** : `keep_both` → 2ème modale

**Testez maintenant - vous devriez voir les 2 modales dans l'ordre !** 🚀
