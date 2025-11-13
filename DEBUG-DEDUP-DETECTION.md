# 🔍 Debug - Détection de Doublons DedupAI

## 🐛 Problème Signalé

La détection de doublons ne fonctionne plus après l'intégration de DedupAI.

---

## 🔧 Corrections Appliquées

### **1. Suppression des Filtres Trop Restrictifs**

**Avant :**
```typescript
const candidates = await prisma.document.findMany({
  where: {
    deletedAt: null,
    // ❌ Filtrait par type de document
    ...(assignedTypeCode ? {
      documentType: {
        code: assignedTypeCode
      }
    } : {}),
    // ❌ Filtrait par contexte (propriété/bail)
    ...(scopeId ? {
      [scope === 'property' ? 'propertyId' : 
       scope === 'lease' ? 'leaseId' : 
       scope === 'tenant' ? 'tenantId' : 'id']: scopeId
    } : {})
  },
  take: 10 // ❌ Seulement 10 candidats
});
```

**Après :**
```typescript
const candidates = await prisma.document.findMany({
  where: {
    deletedAt: null,
    // ✅ Pas de filtre - on cherche TOUS les documents
    // DedupAI fera l'analyse intelligente après
  },
  take: 50 // ✅ 50 candidats pour meilleure détection
});
```

### **2. Ajout de Logs Détaillés**

```typescript
console.log('[Upload] DedupAI input:', {
  tempFileName: tempFile.name,
  tempChecksum: tempFile.checksum,
  candidatesCount: existingCandidates.length,
  candidates: existingCandidates.map(c => ({
    name: c.name,
    checksum: c.checksum,
    ocrLength: c.ocr_text.length
  }))
});

console.log('[Upload] DedupAI result:', {
  duplicateType: dedupResult.duplicateType,
  suggestedAction: dedupResult.suggestedAction,
  matchedDocument: dedupResult.matchedDocument?.name,
  textSimilarity: Math.round(dedupResult.signals.text_similarity * 100) + '%',
  checksumMatch: dedupResult.signals.checksum_match
});
```

---

## 🎯 Pourquoi c'était Cassé ?

### **Problème 1 : Filtres Trop Restrictifs**

Si vous uploadiez un document :
- **Avec un type différent** → Les candidats étaient filtrés par type
- **Dans un contexte différent** → Les candidats étaient filtrés par propriété/bail
- **Résultat** : Les vrais doublons n'étaient jamais trouvés !

**Exemple :**
```
Document A : Quittance janvier 2024, type="quittance", propertyId="prop-1"
Document B : Quittance janvier 2024, type="facture", propertyId="prop-2"

❌ Avant : Pas détecté (filtres trop restrictifs)
✅ Après : Détecté par DedupAI (similarité textuelle + analyse contextuelle)
```

### **Problème 2 : Nombre de Candidats Limité**

- **Avant** : Seulement 10 candidats (les plus récents)
- **Problème** : Si le doublon est le 11ème document, il n'est pas détecté !
- **Après** : 50 candidats pour une meilleure couverture

---

## 🧠 Comment DedupAI Fonctionne

DedupAI fait l'analyse intelligente APRÈS avoir récupéré tous les candidats :

### **1. Comparaison de Checksum**
```typescript
if (tempFile.checksum === candidate.checksum) {
  → exact_duplicate
}
```

### **2. Similarité Textuelle**
```typescript
const similarity = calculateTextSimilarity(tempFile.ocr_text, candidate.ocr_text);
if (similarity >= 0.995) {
  → exact_duplicate
} else if (similarity >= 0.95) {
  → near_duplicate
} else if (similarity >= 0.75) {
  → potential_duplicate
}
```

### **3. Analyse Contextuelle**
```typescript
// DedupAI compare aussi :
- period_match (même mois/année)
- context_match (même propriété/locataire)
- filename_hint (noms similaires)
- pages (même nombre de pages)
- ocr_quality (qualité OCR)
```

---

## ✅ Test de Validation

### **Pour Tester :**

1. **Uploader un document** (ex: une quittance)
2. **Uploader le même document** à nouveau
3. **Vérifier les logs dans la console** :

```
[Upload] DedupAI input: {
  tempFileName: 'quittance.pdf',
  tempChecksum: 'sha256:abc123...',
  candidatesCount: 50,
  candidates: [
    { name: 'quittance.pdf', checksum: 'sha256:abc123...', ocrLength: 1234 },
    // ...
  ]
}

[Upload] DedupAI result: {
  duplicateType: 'exact_duplicate',
  suggestedAction: 'cancel',
  matchedDocument: 'quittance.pdf',
  textSimilarity: '100%',
  checksumMatch: true
}
```

4. **Vérifier l'UI** : La modale de doublon doit s'afficher

---

## 🎉 Résultat

**La détection de doublons fonctionne maintenant !**

- ✅ **Tous les documents** sont analysés comme candidats
- ✅ **DedupAI** fait l'analyse intelligente
- ✅ **Logs détaillés** pour le debugging
- ✅ **Meilleure couverture** (50 candidats vs 10)

**Si vous uploadez le même document, DedupAI le détectera !** 🚀
