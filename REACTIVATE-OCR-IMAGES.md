# ✅ Tentative de Réactivation de l'OCR pour Images

## 🎯 **Objectif**

**Réactiver l'OCR pour les images PNG/JPG** afin de permettre la classification automatique des documents

**Stratégie :** Approche progressive avec fallback pour éviter les crashes

---

## 🔧 **Modifications Appliquées**

### **1. Endpoint OCR (`src/app/api/ocr/route.ts`)**

**Approche progressive avec fallback :**

```typescript
try {
  // Première tentative : configuration simplifiée
  const worker = await createWorker();
  await worker.loadLanguage('fra');
  await worker.initialize('fra');
  
  const { data: ocrData } = await worker.recognize(buffer);
  raw = ensureText(ocrData?.text).trim();
  
  await worker.terminate();
  
} catch (tesseractError) {
  // Deuxième tentative : approche alternative
  if (tesseractError.message.includes('worker-script')) {
    const worker2 = await Tesseract.createWorker({
      logger: () => {}, // Logger vide
    });
    
    await worker2.loadLanguage('fra');
    await worker2.initialize('fra');
    
    const dataUrl = `data:${fileType};base64,${buffer.toString('base64')}`;
    const { data: ocrData2 } = await worker2.recognize(dataUrl);
    raw = ensureText(ocrData2?.text).trim();
    
    await worker2.terminate();
  }
}
```

### **2. Configuration Next.js (`next.config.mjs`)**

**Configuration améliorée pour Tesseract.js :**

```javascript
webpack: (config, { isServer }) => {
  if (!isServer) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      buffer: false,
    };
  }
  
  // Configuration pour les workers
  config.module.rules.push({
    test: /\.worker\.js$/,
    use: { loader: 'worker-loader' }
  });
  
  return config;
},
// Headers pour Tesseract.js
async headers() {
  return [
    {
      source: '/tesseract/:path*',
      headers: [
        {
          key: 'Cross-Origin-Embedder-Policy',
          value: 'require-corp',
        },
        {
          key: 'Cross-Origin-Opener-Policy',
          value: 'same-origin',
        },
      ],
    },
  ];
}
```

---

## 🎯 **Approche Progressive**

### **Tentative 1 : Configuration Simplifiée**
- ✅ **Worker minimal** : `createWorker()` sans options complexes
- ✅ **Langue simple** : Seulement 'fra' (français)
- ✅ **Buffer direct** : Utilisation du buffer sans data URL

### **Tentative 2 : Approche Alternative**
- ✅ **Worker avec options** : Configuration minimale
- ✅ **Logger vide** : Évite les problèmes de logging
- ✅ **Data URL** : Conversion en data URL pour éviter les problèmes de buffer

### **Fallback : Message Informatif**
- ✅ **Si les deux échouent** : Message d'erreur gracieux
- ✅ **Pas de crash** : L'application reste stable

---

## 🧪 **Test**

**Maintenant, testez :**

1. ✅ **Redémarrez le serveur** : `npm run dev`
2. ✅ **Uploadez une image PNG** → Vérifiez les logs
3. ✅ **Si OCR fonctionne** → Classification automatique
4. ✅ **Si OCR échoue** → Message informatif, pas de crash

---

## 📋 **Messages de Log Attendus**

### **Si OCR fonctionne :**
```
[OCR] Processing image with Tesseract...
[OCR] Tesseract extracted 150 chars from image
[Upload] Classification du texte extrait: 150 caractères
[Upload] Auto-suggest type: Quittance de Loyer (score: 85%)
```

### **Si première tentative échoue :**
```
[OCR] Processing image with Tesseract...
[OCR] Erreur Tesseract image: Cannot find module 'worker-script'
[OCR] Tentative avec approche alternative...
[OCR] Tesseract (alternative) extracted 150 chars from image
```

### **Si les deux échouent :**
```
[OCR] Processing image with Tesseract...
[OCR] Erreur Tesseract image: Cannot find module 'worker-script'
[OCR] Tentative avec approche alternative...
[OCR] Erreur approche alternative: Cannot find module 'worker-script'
```

---

## ⚠️ **Action Requise**

**Redémarrez le serveur** pour que la configuration Next.js prenne effet :

```bash
# Arrêter le serveur (Ctrl+C)
# Puis relancer :
npm run dev
```

---

## 🔮 **Alternatives si Tesseract.js ne fonctionne pas**

### **1. Service OCR Externe :**
- **Google Cloud Vision API**
- **Azure Computer Vision**
- **AWS Textract**

### **2. Bibliothèque OCR Alternative :**
- **node-tesseract-ocr** (wrapper pour Tesseract système)
- **pdf-parse** avec conversion image → PDF

### **3. Classification par Nom :**
- Analyser le nom du fichier pour détecter le type
- Utiliser des mots-clés dans le nom

---

## ✅ **Statut**

**OCR réactivé avec approche progressive !**

- ✅ **Deux tentatives** : Configuration simplifiée + approche alternative
- ✅ **Fallback gracieux** : Pas de crash si les deux échouent
- ✅ **Configuration améliorée** : Next.js configuré pour Tesseract.js
- ✅ **Logs détaillés** : Traçage de chaque tentative

**Redémarrez le serveur et testez l'upload d'image PNG !** 🚀
