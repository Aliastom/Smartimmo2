# 🔍 Debug Step-by-Step - Détection de Doublons

## 📋 Checklist de Vérification

### **Étape 1 : Vérifier que DedupAI est Appelé**

Quand vous uploadez un document, vous devriez voir dans la console :

```
[Upload] Début de l'analyse DedupAI...
[Upload] SHA256 calculé: sha256:abc123...
[Upload] Texte OCR extrait: 896 caractères
[Upload] Candidats trouvés en base: X
```

**Si vous ne voyez PAS ces logs** → DedupAI n'est pas appelé du tout !

---

### **Étape 2 : Vérifier les Candidats**

```
[Upload] Candidats trouvés en base: 2
[Upload] DedupAI input: {
  tempFileName: 'quittance_mars_2025_Jasmin.pdf',
  tempChecksum: 'sha256:abc123...',
  candidatesCount: 2,
  candidates: [
    { name: 'quittance_mai_2025_Jasmin.pdf', checksum: 'sha256:def456...', ocrLength: 1234 },
    { name: 'autre_document.pdf', checksum: 'sha256:ghi789...', ocrLength: 567 }
  ]
}
```

**Si `candidatesCount: 0`** → Aucun document en base ou problème de requête Prisma

---

### **Étape 3 : Vérifier le Résultat DedupAI**

```
[Upload] DedupAI result: {
  duplicateType: 'exact_duplicate',
  suggestedAction: 'cancel',
  matchedDocument: 'quittance_mai_2025_Jasmin.pdf',
  textSimilarity: '95%',
  checksumMatch: false
}
```

**Si `duplicateType: 'none'`** → Problème dans la logique de DedupAI

---

## 🐛 Problèmes Possibles

### **Problème 1 : DedupAI n'est pas appelé**

**Symptômes :**
- Aucun log `[Upload] Début de l'analyse DedupAI...`
- L'upload se fait normalement sans détection

**Causes possibles :**
- Erreur dans l'import de DedupAI
- Erreur dans le bloc try/catch qui empêche l'exécution
- Le code n'atteint pas cette section

**Solution :**
Vérifiez les logs d'erreur dans la console

---

### **Problème 2 : Aucun candidat trouvé**

**Symptômes :**
```
[Upload] Candidats trouvés en base: 0
[Upload] DedupAI input: { candidatesCount: 0 }
```

**Causes possibles :**
- Aucun document en base de données
- Tous les documents ont `deletedAt` non null
- Problème de connexion à la base

**Solution :**
Vérifiez la base de données avec Prisma Studio

---

### **Problème 3 : DedupAI ne détecte pas les doublons**

**Symptômes :**
```
[Upload] DedupAI result: {
  duplicateType: 'none',
  suggestedAction: 'proceed'
}
```

**Causes possibles :**
- Checksums différents (fichiers modifiés)
- Texte OCR trop différent
- Bug dans la logique de similarité

**Solution :**
Vérifiez les checksums et le texte OCR

---

## 🧪 Test Simple

### **Pour Tester Maintenant :**

1. **Ouvrez la console du navigateur** (F12)
2. **Uploadez un document** (ex: une quittance)
3. **Regardez les logs** dans la console
4. **Uploadez le même document** à nouveau
5. **Vérifiez si DedupAI détecte le doublon**

### **Logs Attendus :**

**Premier upload :**
```
[Upload] Début de l'analyse DedupAI...
[Upload] Candidats trouvés en base: 0
[Upload] DedupAI result: { duplicateType: 'none' }
```

**Deuxième upload (même fichier) :**
```
[Upload] Début de l'analyse DedupAI...
[Upload] Candidats trouvés en base: 1
[Upload] DedupAI result: { 
  duplicateType: 'exact_duplicate',
  checksumMatch: true 
}
```

---

## 🔧 Actions Correctives

### **Si DedupAI n'est pas appelé :**
1. Vérifiez les imports
2. Vérifiez les erreurs dans la console
3. Vérifiez que le code atteint cette section

### **Si aucun candidat :**
1. Vérifiez la base de données
2. Vérifiez la requête Prisma
3. Vérifiez les filtres

### **Si DedupAI ne détecte pas :**
1. Vérifiez les checksums
2. Vérifiez le texte OCR
3. Vérifiez la logique de similarité

**Faites le test et dites-moi quels logs vous voyez !** 🎯
