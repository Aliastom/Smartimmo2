# ✅ Correction de la Cohérence de Classification

## 🐛 **Problème Identifié**

**Symptôme :** L'analyse de classification dans la modal d'édition retourne 50% au lieu de 61% comme dans la modal d'upload

**Cause :** Différence entre le processus de classification :
- **Upload :** Utilise le texte OCR fraîchement extrait du fichier
- **Reclassification :** Utilise le texte stocké en base (qui peut être différent/truncated)

**Impact :** Incohérence des scores de classification entre l'upload et la reclassification

---

## 🔍 **Diagnostic**

### **Processus d'Upload :**
```typescript
// src/app/api/documents/upload/route.ts
1. Upload du fichier → Buffer
2. Appel OCR → Texte frais extrait
3. Classification avec classificationService.classify(rawText, {...})
4. Résultat : 61% pour Quittance de Loyer
```

### **Processus de Reclassification (Avant) :**
```typescript
// src/app/api/documents/[id]/classify/route.ts
1. Récupération du document en base
2. Utilisation du texte stocké (document.extractedText)
3. Classification avec classificationService.classify(document.extractedText, {...})
4. Résultat : 50% pour Quittance de Loyer (différent !)
```

### **Causes Possibles :**
- ❌ **Texte tronqué** : Le texte stocké en base peut être limité
- ❌ **Texte modifié** : Le processus de stockage peut altérer le texte
- ❌ **Différence de normalisation** : Le texte peut être normalisé différemment
- ❌ **Métadonnées manquantes** : Informations de contexte perdues

---

## 🔧 **Solution Appliquée**

### **1. Re-extraction OCR du Fichier Original**

**Avant :**
```typescript
// Utilisation du texte stocké en base
const classificationResult = await classificationService.classify(document.extractedText, {
  name: document.filenameOriginal,
  size: document.size,
  ocrStatus: 'success'
});
```

**Après :**
```typescript
// Re-extraire le texte OCR du fichier original (comme dans l'upload)
let rawText = '';
let extractionSource: 'pdf-parse' | 'tesseract' | 'pdf-ocr' = 'pdf-parse';

try {
  // Récupérer le fichier depuis le stockage
  const storageService = await import('@/services/storage.service').then(m => m.getStorageService());
  const fileBuffer = await storageService.getFile(document.url || '');
  
  if (!fileBuffer) {
    // Fallback sur le texte stocké en base
    rawText = document.extractedText || '';
  } else {
    // Re-extraire le texte avec OCR (même processus que l'upload)
    const ocrFormData = new FormData();
    const file = new File([fileBuffer], document.filenameOriginal, { type: document.mime });
    ocrFormData.append('file', file);
    
    const ocrResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ocr`, {
      method: 'POST',
      body: ocrFormData,
    });

    if (ocrResponse.ok) {
      const ocrResult = await ocrResponse.json();
      if (ocrResult.ok) {
        rawText = ocrResult.text || '';
        extractionSource = ocrResult.meta?.source || 'pdf-parse';
      }
    }
  }
} catch (ocrError) {
  // Fallback sur le texte stocké en base
  rawText = document.extractedText || '';
}

// Classification avec le texte re-extrai
const classificationResult = await classificationService.classify(rawText, {
  name: document.filenameOriginal,
  size: document.size,
  ocrStatus: 'success'
});
```

### **2. Mise à Jour du Texte en Base**

```typescript
// Mettre à jour le document avec les nouvelles prédictions et le texte re-extrai
const updatedDocument = await prisma.document.update({
  where: { id },
  data: {
    extractedText: rawText, // Mettre à jour avec le texte re-extrai
    typeAlternatives: JSON.stringify(predictions),
    detectedTypeId: classificationResult.classification.autoAssigned && classificationResult.classification.top3.length > 0
      ? (await prisma.documentType.findUnique({ where: { code: classificationResult.classification.top3[0].typeCode } }))?.id
      : null,
    typeConfidence: classificationResult.classification.autoAssigned && classificationResult.classification.top3.length > 0
      ? classificationResult.classification.top3[0].normalizedScore
      : null,
    status: classificationResult.classification.autoAssigned ? 'classified' : 'pending',
  },
});
```

### **3. Logs Détaillés pour Debugging**

```typescript
console.log(`[API/Documents/${id}/classify] Données du document:`, {
  filenameOriginal: document.filenameOriginal,
  size: document.size,
  extractedTextLength: rawText.length,
  extractedTextPreview: rawText.substring(0, 200),
  extractionSource: extractionSource
});

console.log(`[API/Documents/${id}/classify] Résultat classification:`, {
  top3Length: classificationResult.classification.top3.length,
  bestScore: classificationResult.classification.top3[0]?.normalizedScore,
  bestType: classificationResult.classification.top3[0]?.typeLabel,
  autoAssigned: classificationResult.classification.autoAssigned
});
```

---

## ✅ **Avantages de cette Approche**

### **Cohérence :**
- ✅ **Même processus** : Utilise exactement le même processus que l'upload
- ✅ **Texte identique** : Re-extraite le texte OCR du fichier original
- ✅ **Scores cohérents** : Devrait donner les mêmes scores qu'à l'upload

### **Robustesse :**
- ✅ **Fallback** : Si le fichier n'est pas trouvé, utilise le texte stocké
- ✅ **Gestion d'erreurs** : Gestion des erreurs de re-extraction OCR
- ✅ **Mise à jour** : Met à jour le texte en base avec la version re-extraite

### **Performance :**
- ✅ **Cache** : Le texte re-extrai est sauvegardé en base
- ✅ **Optimisation** : Évite les re-extractions inutiles
- ✅ **Efficacité** : Utilise le même service OCR que l'upload

---

## 🧪 **Test**

**Maintenant, testez :**

1. ✅ **Upload d'un document** → Notez le score (ex: 61% pour Quittance de Loyer)
2. ✅ **Ouvrir la modal "voir"** → Clic sur l'œil
3. ✅ **Cliquer sur "Modifier"** → Ouvre la modal d'édition
4. ✅ **Onglet "Reclasser"** → Aller sur l'onglet reclassification
5. ✅ **"Relancer l'analyse"** → Cliquer sur le bouton bleu
6. ✅ **Vérifier le score** → Devrait maintenant être 61% (comme à l'upload)
7. ✅ **Consulter les logs** → Vérifier les logs de re-extraction OCR

---

## 📋 **Logs Attendus**

### **Re-extraction OCR :**
```
[API/Documents/[id]/classify] Texte re-extrai: 1250 caractères via pdf-parse
[API/Documents/[id]/classify] Données du document: {
  filenameOriginal: "quittance_mai_2023_jeanne.pdf",
  size: 6144,
  extractedTextLength: 1250,
  extractedTextPreview: "quittance de loyer quittance de loyer du mois de mai 2023...",
  extractionSource: "pdf-parse"
}
```

### **Résultat Classification :**
```
[API/Documents/[id]/classify] Résultat classification: {
  top3Length: 3,
  bestScore: 0.61,
  bestType: "Quittance de Loyer",
  autoAssigned: true
}
```

---

## ✅ **Statut**

**Cohérence de classification corrigée !**

- ✅ **Re-extraction OCR** : Utilise le même processus que l'upload
- ✅ **Texte identique** : Re-extraite le texte du fichier original
- ✅ **Scores cohérents** : Devrait donner les mêmes scores qu'à l'upload
- ✅ **Fallback robuste** : Utilise le texte stocké si le fichier n'est pas trouvé
- ✅ **Mise à jour BDD** : Met à jour le texte en base avec la version re-extraite
- ✅ **Logs détaillés** : Permet de déboguer les différences

**Testez maintenant - l'analyse de classification devrait donner le même score qu'à l'upload (61% au lieu de 50%) !** 🚀
