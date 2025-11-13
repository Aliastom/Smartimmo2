# ✅ Correction de l'Erreur textIndex

## 🐛 Erreur Identifiée

```
TypeError: Cannot read properties of undefined (reading '0')
at eval (webpack-internal:///(rsc)/./src/app/api/documents/upload/route.ts:171:51)
```

**Cause :** Il restait une référence à l'ancien `textIndex[0]` dans le mapping des candidats.

---

## 🔧 Correction Appliquée

### **Ligne 181 - Avant :**
```typescript
ocr: {
  quality: 0.8,
  textPreview: doc.textIndex[0]?.content?.slice(0, 500) || ''  // ❌ ERREUR
},
```

### **Ligne 181 - Après :**
```typescript
ocr: {
  quality: 0.8,
  textPreview: doc.extractedText?.slice(0, 500) || ''  // ✅ CORRIGÉ
},
```

### **Ligne 178 - Format de checksum :**
```typescript
// ✅ Ajout du préfixe sha256:
checksum: doc.sha256 ? `sha256:${doc.sha256}` : '',
```

---

## 🎯 Résultat Attendu

Maintenant, quand vous uploadez le même fichier, vous devriez voir :

```
[Upload] Début de l'analyse DedupAI...
[Upload] Candidats trouvés en base: 1
[Upload] DedupAI input: {
  tempChecksum: 'sha256:36d84c97325986b8b85b09026562c57a97719d6aec5326be85ec71c02918ee51',
  candidates: [
    {
      name: 'quittance_mars_2025_Jasmin.pdf',
      checksum: 'sha256:36d84c97325986b8b85b09026562c57a97719d6aec5326be85ec71c02918ee51',
      ocrLength: 896  // ← Maintenant rempli !
    }
  ]
}

[Upload] DedupAI result: {
  duplicateType: 'exact_duplicate',  // ← Détection réussie !
  suggestedAction: 'cancel',
  matchedDocument: 'quittance_mars_2025_Jasmin.pdf',
  textSimilarity: '100%',
  checksumMatch: true
}
```

---

## ✅ Statut

**Erreur corrigée !**

- ✅ **Référence textIndex** supprimée
- ✅ **Format de checksum** corrigé
- ✅ **Texte OCR** récupéré depuis `extractedText`

**Testez maintenant - la détection de doublons devrait fonctionner !** 🚀
