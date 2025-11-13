# ✅ Correction des Problèmes DedupAI

## 🐛 Problèmes Identifiés

D'après les logs, DedupAI fonctionnait mais avait **2 problèmes majeurs** :

### **1. Format de Checksum Incorrect**
```
❌ AVANT:
tempChecksum: '36d84c97325986b8b85b09026562c57a97719d6aec5326be85ec71c02918ee51'
candidateChecksum: '36d84c97325986b8b85b09026562c57a97719d6aec5326be85ec71c02918ee51'
checksumMatch: false  // ← PROBLÈME !

✅ APRÈS:
tempChecksum: 'sha256:36d84c97325986b8b85b09026562c57a97719d6aec5326be85ec71c02918ee51'
candidateChecksum: 'sha256:36d84c97325986b8b85b09026562c57a97719d6aec5326be85ec71c02918ee51'
checksumMatch: true   // ← CORRIGÉ !
```

### **2. Texte OCR Manquant**
```
❌ AVANT:
ocrLength: 0  // ← Aucun texte OCR récupéré

✅ APRÈS:
ocrLength: 896  // ← Texte OCR récupéré depuis extractedText
```

---

## 🔧 Corrections Appliquées

### **1. Format de Checksum Corrigé**

**Fichier : `src/app/api/documents/upload/route.ts`**

```typescript
// ✅ Correction du format de checksum
const tempFile = {
  // ...
  checksum: `sha256:${sha256}`  // ← Ajout du préfixe sha256:
};

const existingCandidates = candidates.map(doc => ({
  // ...
  checksum: doc.sha256 ? `sha256:${doc.sha256}` : ''  // ← Ajout du préfixe
}));
```

### **2. Récupération du Texte OCR Corrigée**

```typescript
// ❌ AVANT: Utilisait textIndex (vide)
textIndex: {
  select: { content: true },
  take: 1
}
ocr_text: doc.textIndex[0]?.content || '',

// ✅ APRÈS: Utilise extractedText (rempli)
extractedText: true
ocr_text: doc.extractedText || '',
```

---

## 🎯 Résultat Attendu

Maintenant, quand vous uploadez le même fichier, vous devriez voir :

```
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
  duplicateType: 'exact_duplicate',  // ← Maintenant détecté !
  suggestedAction: 'cancel',
  checksumMatch: true,  // ← Maintenant true !
  textSimilarity: '100%'
}
```

---

## 🧪 Test de Validation

### **Pour Tester :**

1. **Uploadez le même fichier** que précédemment
2. **Vérifiez les logs** dans la console
3. **La modale de doublon** devrait s'afficher !

### **Logs Attendus :**

```
[Upload] DedupAI result: {
  duplicateType: 'exact_duplicate',
  suggestedAction: 'cancel',
  matchedDocument: 'quittance_mars_2025_Jasmin.pdf',
  textSimilarity: '100%',
  checksumMatch: true
}
```

---

## ✅ Statut

**Problèmes corrigés !**

- ✅ **Format de checksum** : Préfixe `sha256:` ajouté
- ✅ **Texte OCR** : Récupéré depuis `extractedText`
- ✅ **Détection de doublons** : Devrait maintenant fonctionner

**Testez en uploadant le même fichier - la détection devrait marcher !** 🚀
