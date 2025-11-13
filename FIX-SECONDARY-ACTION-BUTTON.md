# ✅ Correction du Bouton "Conserver les deux"

## 🐛 **Problème Identifié**

**Symptôme :** Quand on clique sur "Conserver les deux", rien ne se passe - la modal "Copie volontaire" ne s'affiche pas

**Cause :** Le `onClick` du `secondaryAction` était hardcodé à `'cancel'` au lieu d'utiliser l'action dynamique du bouton

**Impact :** Le bouton "Conserver les deux" appelait l'action "cancel" au lieu de "keep_both"

---

## 🔍 **Diagnostic**

### **Problème dans le Code**

**Fichier :** `src/components/DedupFlowModal.tsx`

**Avant (Cassé) :**
```typescript
{flowOutput.ui.secondaryAction && (
  <Button
    variant="outline"
    onClick={() => handleAction('cancel')}  // ❌ Toujours 'cancel' !
    disabled={isLoading || isProcessing}
  >
    {flowOutput.ui.secondaryAction.label}  // Affiche "Conserver les deux"
  </Button>
)}
```

**Résultat :**
- Le bouton affiche "Conserver les deux"
- Mais quand on clique, il appelle l'action `'cancel'` au lieu de `'keep_both'`
- La modal se ferme au lieu de passer à l'étape suivante

---

## 🔧 **Solution Appliquée**

**Avant :**
```typescript
onClick={() => handleAction('cancel')}  // ❌ Hardcodé
```

**Après :**
```typescript
onClick={() => handleAction(flowOutput.ui.secondaryAction.action)}  // ✅ Dynamique
```

**Explication :**
- Maintenant, le `onClick` utilise l'action définie dans `flowOutput.ui.secondaryAction.action`
- Pour le bouton "Conserver les deux", `action` = `'keep_both'`
- Le bon handler est appelé et la modal "Copie volontaire" s'affiche

---

## ✅ **Résultats Attendus**

### **Flux Corrigé :**
```
1. Upload d'un fichier → Doublon détecté
2. Modal "Document en doublon détecté" s'affiche
3. Interface :
   - Bouton "Annuler" (primaryAction → action: 'cancel')
   - Bouton "Conserver les deux" (secondaryAction → action: 'keep_both')
4. Utilisateur clique "Conserver les deux"
5. ✅ handleAction('keep_both') est appelé
6. ✅ orchestrateFlow() avec userDecision: 'keep_both'
7. ✅ flowOutput mis à jour avec la modal "Copie volontaire"
8. ✅ setShowDedupFlowModal(true)
9. ✅ Modal "Copie volontaire" s'affiche
```

### **Flux pour "Annuler" :**
```
1. Modal "Document en doublon détecté" s'affiche
2. Utilisateur clique "Annuler"
3. ✅ handleAction('cancel') est appelé
4. ✅ Suppression du fichier temporaire
5. ✅ Fermeture complète des modales
6. ✅ Retour à la liste des documents
```

---

## 🧪 **Tests à Effectuer**

### **Test 1 : Conserver les deux**
1. Uploadez un fichier en doublon
2. Cliquez sur "Conserver les deux"
3. ✅ Vérifiez que la modal "Copie volontaire" s'affiche
4. ✅ Vérifiez le contenu :
   - Titre : "Revue de l'upload – Copie volontaire d'un doublon"
   - Bannière : "🟢 Vous avez choisi de conserver ce doublon..."
   - Nom suggéré : "nom_original (copie).pdf"
   - Boutons : "Enregistrer quand même" et "Annuler"

### **Test 2 : Annuler**
1. Uploadez un fichier en doublon
2. Cliquez sur "Annuler"
3. ✅ Vérifiez que tout se ferme
4. ✅ Vérifiez le retour à la liste des documents

---

## 📝 **Fichier Modifié**

**`src/components/DedupFlowModal.tsx`**
- Ligne 168 : Changement de `handleAction('cancel')` à `handleAction(flowOutput.ui.secondaryAction.action)`

---

## ✅ **Statut**

**Correction du bouton "Conserver les deux" terminée !**

- ✅ Le `onClick` utilise maintenant l'action dynamique du bouton
- ✅ Le bouton "Conserver les deux" appelle la bonne action (`'keep_both'`)
- ✅ La modal "Copie volontaire" devrait s'afficher correctement
- ✅ Le flux de déduplication est restauré

**Testez maintenant - le bouton "Conserver les deux" devrait fonctionner !** 🚀

