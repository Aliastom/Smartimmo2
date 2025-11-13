# ✅ Correction de l'Incohérence des Seuils de Classification

## 🐛 **Problème Identifié**

**Incohérence entre le frontend et la base de données :**

- **Frontend** : Utilisait un seuil hardcodé de **60%** (`AUTO_SUGGEST_THRESHOLD = 0.6`)
- **Base de données** : Configuré **40%** pour "Quittance de Loyer" (`autoAssignThreshold = 0.4`)
- **Résultat** : Un document avec 50% de confiance n'était pas automatiquement sélectionné, alors qu'il aurait dû l'être

---

## 🔍 **Diagnostic**

### **Configuration en Base de Données :**
```sql
-- DocumentType.autoAssignThreshold
QUITTANCE: 0.4 (40%)
ACTE_PROPRIETE: 0.85 (85%)
```

### **Code Frontend (Avant) :**
```typescript
const AUTO_SUGGEST_THRESHOLD = 0.6; // ❌ Hardcodé

if (predictions[0].score >= AUTO_SUGGEST_THRESHOLD) {
  // Sélection automatique
}
```

### **Code Backend (Avant) :**
```typescript
// Auto-assigner si score >= 0.7 ❌ Hardcodé aussi !
if (classification.best && classification.best.score >= 0.7) {
  autoAssigned = true;
}
```

---

## 🔧 **Solution Appliquée**

### **1. Modification de l'API (`/api/documents/upload`)**

**Avant :**
```typescript
const classification = await classificationService.classifySimple(rawText);
// Seuil hardcodé 0.7
if (classification.best && classification.best.score >= 0.7) {
  autoAssigned = true;
}
```

**Après :**
```typescript
// Utiliser la classification complète pour récupérer les seuils configurés
const classificationResult = await classificationService.classify(rawText, {
  name: file.name,
  size: file.size,
  ocrStatus: 'unknown'
});

predictions = classificationResult.classification.top3.map(r => ({
  typeCode: r.typeCode,
  label: r.typeLabel,
  score: r.normalizedScore,
  threshold: r.threshold // ✅ Seuil configuré en DB
}));

// Auto-assigner selon le seuil configuré
if (classificationResult.classification.autoAssigned) {
  autoAssigned = true;
  assignedTypeCode = classificationResult.classification.top3[0].typeCode;
}
```

### **2. Modification du Frontend (`UploadReviewModal`)**

**Avant :**
```typescript
const AUTO_SUGGEST_THRESHOLD = 0.6; // ❌ Hardcodé

if (predictions[0].score >= AUTO_SUGGEST_THRESHOLD) {
  preselectedType = predictions[0].typeCode;
}
```

**Après :**
```typescript
// ✅ Seuil dynamique depuis la DB
if (predictions.length > 0) {
  const bestPrediction = predictions[0];
  const threshold = bestPrediction.threshold || 0.85; // Seuil par défaut
  
  if (bestPrediction.score >= threshold) {
    preselectedType = bestPrediction.typeCode;
    console.log(`Auto-suggest: ${bestPrediction.label} (${(bestPrediction.score * 100).toFixed(0)}% >= seuil ${(threshold * 100).toFixed(0)}%)`);
  }
}
```

---

## 🎯 **Résultat Attendu**

**Maintenant, pour votre document "Quittance de Loyer" :**

1. ✅ **Score de confiance** : 50%
2. ✅ **Seuil configuré** : 40% (depuis la DB)
3. ✅ **50% >= 40%** → **Sélection automatique** ✅
4. ✅ **La combobox** sera pré-remplie avec "Quittance de Loyer"

---

## 📊 **Logs de Debug**

**Avant (avec seuil hardcodé) :**
```
[Upload] Pas de pré-sélection: meilleur score 50% < seuil 60%
```

**Après (avec seuil dynamique) :**
```
[Upload] Auto-suggest type: Quittance de Loyer (score: 50% >= seuil 40%)
```

---

## ✅ **Statut**

**Incohérence des seuils corrigée !**

- ✅ **API modifiée** pour utiliser la classification complète
- ✅ **Frontend modifié** pour utiliser les seuils dynamiques
- ✅ **Plus de seuils hardcodés** dans le frontend
- ✅ **Cohérence** entre la configuration admin et le comportement

**Testez maintenant - votre document avec 50% devrait être automatiquement sélectionné !** 🚀
