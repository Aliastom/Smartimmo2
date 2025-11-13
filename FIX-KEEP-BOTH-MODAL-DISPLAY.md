# ✅ Correction de l'Affichage de la Modal "Conserver les deux"

## 🐛 **Problème**

**Symptôme :** Quand on clique sur "Conserver les deux", la modal "Copie volontaire" ne s'affiche plus

**Cause :** Après l'appel à `orchestrateFlow`, `showDedupFlowModal` n'était pas remis à `true`

---

## 🔧 **Solution**

**Fichier :** `src/components/documents/UploadReviewModal.tsx`

**Code ajouté :**
```typescript
// Orchestrer la 2ème modale
await orchestrateFlow(secondFlowInput, context);

// ✅ S'assurer que la modal reste affichée avec le nouveau contenu
setShowDedupFlowModal(true);

// La modale DedupFlow restera ouverte avec le nouveau contenu
return;
```

---

## ✅ **Résultat**

**Flux corrigé :**
```
1. Upload d'un fichier → Doublon détecté
2. Modal "Document en doublon détecté" s'affiche
3. Utilisateur clique "Conserver les deux"
4. ✅ orchestrateFlow() met à jour flowOutput
5. ✅ setShowDedupFlowModal(true) affiche la modal
6. ✅ Modal "Copie volontaire" s'affiche avec le nouveau contenu
7. ✅ Utilisateur peut finaliser l'upload
```

---

## 🧪 **Test**

1. **Uploadez un fichier en doublon**
2. **Cliquez sur "Conserver les deux"**
3. ✅ **La modal "Copie volontaire" devrait s'afficher avec** :
   - Titre : "Revue de l'upload – Copie volontaire d'un doublon"
   - Bannière : "🟢 Vous avez choisi de conserver ce doublon..."
   - Nom suggéré : "nom_original (copie).pdf"
   - Boutons : "Enregistrer quand même" et "Annuler"

**Testez maintenant !** 🚀

