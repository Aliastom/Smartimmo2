# 🔧 Corrections appliquées - Compagnon IA

**Date** : 2025-11-03

---

## ✅ Problèmes corrigés

### 1. **Champ texte trop bas dans le Drawer**

**Problème** : L'input était en bas du Drawer, obligeant à scroll.

**Solution** : Ajusté la hauteur du conteneur du chat dans `CompanionDock.tsx` :
```tsx
// Avant
<div className="flex-1 flex flex-col h-[calc(100vh-180px)]">

// Après  
<div className="flex-1 flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 280px)' }}>
```

✅ L'input est maintenant visible sans scroll.

---

### 2. **Erreur ONNX Runtime (Module parse failed)**

**Problème** : `@xenova/transformers` essayait de charger des bindings natifs côté client, causant l'erreur :
```
Module parse failed: Unexpected character '�' (1:0)
./node_modules/onnxruntime-node/bin/napi-v3/...
```

**Cause** : `@xenova/transformers` et `onnxruntime-node` sont des modules **serveur uniquement** mais Next.js essayait de les bundler côté client.

**Solution** : Modifié `next.config.mjs` pour :

1. **Ignorer les modules IA côté client** :
```js
config.resolve.alias = {
  ...config.resolve.alias,
  'onnxruntime-node': false,
  '@xenova/transformers': false,
  'sharp': false,
};
```

2. **Externaliser côté serveur** :
```js
serverComponentsExternalPackages: ['onnxruntime-node', '@xenova/transformers', 'sharp']
```

✅ Les modules IA sont maintenant utilisés **uniquement côté serveur** (API Routes).

---

### 3. **Bouton flottant repositionné**

**Problème** : Le bouton du compagnon cachait le bouton TanStack Query DevTools.

**Solution** : Déplacé le bouton plus haut dans `CompanionDock.tsx` :
```tsx
// Avant
className="fixed bottom-6 right-6 z-50"

// Après
className="fixed bottom-20 right-6 z-50"
```

✅ Les deux boutons sont maintenant visibles et séparés.

---

## 🚀 Redémarrage requis

**IMPORTANT** : Vous devez **redémarrer le serveur** pour que les changements de `next.config.mjs` prennent effet.

```bash
# Arrêter le serveur (Ctrl+C)
# Puis relancer
npm run dev
```

---

## 🧪 Test après corrections

1. **Vérifier le Drawer** :
   - Cliquer sur le bouton flottant
   - L'input doit être visible immédiatement (pas de scroll)

2. **Tester le chat** :
   - Taper "Bonjour"
   - Envoyer
   - Vérifier qu'il n'y a **plus d'erreur ONNX** dans la console

3. **Vérifier les boutons** :
   - Bouton TanStack (île tropicale) : en bas
   - Bouton Compagnon IA (cercle bleu) : un peu plus haut

---

## 📊 Fichiers modifiés

1. ✅ `src/ui/companion/CompanionDock.tsx` - Hauteur du chat ajustée
2. ✅ `src/ui/companion/CompanionDock.tsx` - Position du bouton ajustée
3. ✅ `next.config.mjs` - Configuration webpack pour modules IA

---

## 🐛 Si problèmes persistent

### Erreur ONNX toujours présente

**Solution** : 
1. Supprimer `.next/` : `rm -rf .next` (ou `rmdir /s .next` sur Windows)
2. Redémarrer : `npm run dev`

### Chat ne répond toujours pas

**Vérifier** :
```bash
# Ollama est bien lancé ?
curl http://localhost:11434/api/tags

# Qdrant est bien lancé ?
curl http://localhost:6333/collections
```

### Input toujours trop bas

**Solution** : Augmenter encore plus la marge dans `CompanionDock.tsx` :
```tsx
style={{ height: 'calc(100vh - 320px)' }}  // Au lieu de 280px
```

---

**💡 Astuce** : Après avoir redémarré le serveur, videz le cache du navigateur (Ctrl+Shift+R ou Cmd+Shift+R) pour être sûr que les changements sont bien appliqués.

