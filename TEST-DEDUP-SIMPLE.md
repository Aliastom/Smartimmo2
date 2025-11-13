# 🧪 Test Simple de Détection de Doublons

## 📋 Procédure de Test

### **Étape 1 : Préparer un Fichier Test**
1. Créez un fichier PDF simple (ou utilisez un document existant)
2. Notez le nom du fichier : `test-doublon.pdf`

### **Étape 2 : Premier Upload**
1. Uploadez le fichier dans Smartimmo
2. Vérifiez dans la console les logs :
   ```
   [Upload] DedupAI input: {
     tempFileName: 'test-doublon.pdf',
     tempChecksum: 'sha256:...',
     candidatesCount: X
   }
   ```
3. Le fichier devrait être uploadé normalement (aucun doublon)

### **Étape 3 : Deuxième Upload (même fichier)**
1. Uploadez **exactement le même fichier** à nouveau
2. Vérifiez dans la console :
   ```
   [Upload] DedupAI input: {
     tempFileName: 'test-doublon.pdf',
     tempChecksum: 'sha256:ABC123...', // ← Même checksum
     candidatesCount: 1 ou plus,
     candidates: [
       { 
         name: 'test-doublon.pdf', 
         checksum: 'sha256:ABC123...', // ← Même checksum !
         ocrLength: XXX 
       }
     ]
   }
   
   [Upload] DedupAI result: {
     duplicateType: 'exact_duplicate', // ← Devrait être exact_duplicate
     suggestedAction: 'cancel',
     matchedDocument: 'test-doublon.pdf',
     textSimilarity: '100%',
     checksumMatch: true // ← Devrait être true
   }
   ```

### **Résultat Attendu**
- ✅ La modale DedupFlow doit s'afficher
- ✅ Le titre doit être : "Doublon exact détecté"
- ✅ Le sous-titre doit mentionner le fichier existant
- ✅ Les actions proposées : Annuler, Remplacer, Conserver les deux

---

## 🔍 Si la Détection Ne Fonctionne Pas

### **Vérification 1 : Logs d'Entrée**

Regardez dans la console si `candidatesCount` est > 0 :
```
[Upload] DedupAI input: {
  candidatesCount: 0  // ❌ Problème : aucun candidat trouvé !
}
```

**Si candidatesCount = 0** :
- Vérifiez que des documents existent en base
- Vérifiez que `deletedAt` est null pour ces documents

### **Vérification 2 : Checksums**

Comparez les checksums :
```javascript
tempChecksum: 'sha256:ABC123...'
candidates: [
  { checksum: 'sha256:ABC123...' } // ← Doit être identique !
]
```

**Si les checksums sont différents** :
- Le fichier a été modifié entre les uploads
- La fonction de hash ne fonctionne pas correctement

### **Vérification 3 : Résultat DedupAI**

Regardez le `duplicateType` :
```javascript
duplicateType: 'none' // ❌ Pas de doublon détecté
```

**Si duplicateType = 'none' malgré un checksum identique** :
- Il y a un bug dans DedupAI
- Vérifiez la logique de comparaison des checksums

---

## 🐛 Debugging Avancé

### **Activer les Logs DedupAI**

Ajoutez des logs dans `src/services/dedup-ai.service.ts` :

```typescript
analyze(tempFile: TempFile, existingCandidates: ExistingCandidate[]): DedupAIResult {
  console.log('[DedupAI] Analyse:', {
    tempFile: {
      name: tempFile.name,
      checksum: tempFile.checksum,
      ocrLength: tempFile.ocr_text?.length || 0
    },
    candidatesCount: existingCandidates.length
  });

  if (!existingCandidates || existingCandidates.length === 0) {
    console.log('[DedupAI] Aucun candidat, retour "none"');
    return this.createNoneResult(tempFile);
  }

  // ... reste du code ...
  
  for (const candidate of existingCandidates) {
    const similarity = this.calculateTextSimilarity(normalizedTempText, normalizedCandidateText);
    const checksumMatch = tempFile.checksum && candidate.checksum && tempFile.checksum === candidate.checksum;
    
    console.log('[DedupAI] Candidat:', {
      name: candidate.name,
      checksumMatch,
      similarity,
      tempChecksum: tempFile.checksum,
      candidateChecksum: candidate.checksum
    });
  }
}
```

---

## ✅ Checklist de Validation

- [ ] Le fichier est bien uploadé la première fois
- [ ] Le SHA256 est calculé et stocké en base
- [ ] La deuxième upload trouve au moins 1 candidat
- [ ] Les checksums sont identiques
- [ ] DedupAI retourne `duplicateType: 'exact_duplicate'`
- [ ] La modale DedupFlow s'affiche
- [ ] L'utilisateur peut choisir une action

**Si tous les points sont validés, la détection de doublons fonctionne !** 🎯
