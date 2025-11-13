# 🔧 Dépannage - UI Compagnon

Guide rapide pour résoudre les problèmes d'affichage du compagnon IA.

---

## ✅ Checklist rapide

### 1. Vérifier que le serveur démarre sans erreur

```bash
npm run dev
```

**Logs attendus** :
```
✓ Ready in 2.3s
○ Local:   http://localhost:3000
```

**Si erreurs TypeScript** : Voir la console et les logs.

### 2. Ouvrir la console du navigateur

1. Ouvrir [http://localhost:3000](http://localhost:3000)
2. Appuyer sur **F12** (DevTools)
3. Onglet **Console**

**Vérifications** :
- [ ] Pas d'erreurs rouges JavaScript
- [ ] Pas d'erreurs React (hydration, etc.)
- [ ] Pas d'erreurs 404 (fichiers manquants)

### 3. Vérifier que le bouton apparaît

**Où regarder** : En bas à droite de l'écran

**Si invisible** :
- Vérifier l'onglet "Elements" (F12)
- Chercher `CompanionDock` dans le DOM
- Vérifier les styles CSS (z-index, display, etc.)

### 4. Inspecter le DOM

Dans DevTools (F12) :
1. Onglet **Elements**
2. Chercher (Ctrl+F) : `CompanionDock`
3. Vérifier que le composant est monté

**Si absent** : Problème de rendu React (voir console).

---

## 🐛 Problèmes courants

### Le bouton n'apparaît pas

**Cause 1** : Erreur JavaScript

**Solution** :
1. Ouvrir la console (F12)
2. Regarder les erreurs rouges
3. Corriger les imports manquants

**Cause 2** : CSS masque le bouton

**Solution** :
1. Inspecter l'élément (clic droit → Inspecter)
2. Vérifier `display`, `visibility`, `opacity`, `z-index`
3. Le bouton devrait avoir `z-index: 50` et `position: fixed`

**Cause 3** : Le composant ne se monte pas

**Solution** :
1. Vérifier `src/app/layout.tsx`
2. S'assurer que `<CompanionDock />` est présent
3. S'assurer que `<CompanionProvider>` entoure bien le tout

### Le bouton apparaît mais le clic ne fait rien

**Cause** : Provider non monté ou erreur dans `useCompanion()`

**Solution** :
1. Console (F12) → regarder les erreurs
2. Vérifier que `CompanionProvider` est bien dans `layout.tsx`

### Le Drawer ne s'ouvre pas

**Cause** : State `isOpen` ne se met pas à jour

**Solution** :
```javascript
// Dans la console (F12), taper :
document.querySelector('[aria-label="Ouvrir le compagnon IA"]')?.click()
```

Si rien ne se passe, erreur React (voir console).

### Le chat ne s'affiche pas dans le Drawer

**Cause** : Erreur dans `CompanionChat.tsx`

**Solution** :
1. Console (F12) → regarder les erreurs
2. Vérifier que `/api/ai/chat` est accessible :
   ```bash
   curl http://localhost:3000/api/ai/chat
   ```

---

## 🔍 Vérifications techniques

### Composants UI nécessaires

```bash
# Vérifier que tous les composants existent
ls src/components/ui/ | findstr "Button Input Separator Drawer"
```

**Attendu** :
- ✅ Button.tsx
- ✅ Input.tsx
- ✅ Separator.tsx
- ✅ Drawer.tsx

### Vérifier le build

```bash
npm run build
```

**Si erreurs** : Corriger les erreurs TypeScript affichées.

### Vérifier le Provider

Ouvrir `src/app/layout.tsx` et vérifier :

```tsx
<CompanionProvider>
  <AppShell>{children}</AppShell>
  <UnifiedUploadReviewModal />
  {/* Compagnon IA - Bouton flottant + panneau */}
  <CompanionDock />
</CompanionProvider>
```

✅ `CompanionDock` doit être **à l'intérieur** de `CompanionProvider`.

---

## 🧪 Tests manuels

### Test 1 : Bouton flottant visible

1. Ouvrir http://localhost:3000
2. Scroll en bas de la page
3. **Voir le bouton rond avec icône chat** (bottom-right)

✅ **Si visible** : OK !  
❌ **Si invisible** : Voir "Problèmes courants" ci-dessus.

### Test 2 : Ouverture du Drawer

1. Cliquer sur le bouton flottant
2. **Le panneau doit glisser depuis la droite**

✅ **Si s'ouvre** : OK !  
❌ **Si ne s'ouvre pas** : Console (F12) → erreurs ?

### Test 3 : Actions contextuelles

1. Le Drawer affiche 3 boutons d'actions (selon la page)
2. Vérifier qu'ils s'affichent

✅ **Si visibles** : OK !

### Test 4 : Input chat

1. Dans le Drawer, voir l'input "Posez votre question..."
2. Taper du texte
3. Cliquer sur le bouton Send

✅ **Si cliquable** : OK !  
❌ **Si erreur** : Vérifier que Ollama est lancé.

---

## 🚨 Erreurs fréquentes

### "useCompanion must be used within CompanionProvider"

**Cause** : Un composant utilise `useCompanion()` en dehors de `CompanionProvider`.

**Solution** : Vérifier que `CompanionProvider` entoure bien tous les composants dans `layout.tsx`.

### "Cannot read properties of null (reading 'useContext')"

**Cause** : Provider React non monté correctement.

**Solution** : Redémarrer le serveur (`npm run dev`).

### "Module not found: Can't resolve '@/components/ui/ScrollArea'"

**Cause** : ScrollArea n'existe pas (déjà corrigé normalement).

**Solution** : Vérifier que `CompanionChat.tsx` n'utilise **pas** `ScrollArea`.

---

## 📞 Aide supplémentaire

Si le problème persiste :

1. **Logs complets** :
   ```bash
   npm run dev > logs.txt 2>&1
   ```

2. **Console navigateur** : Copier toutes les erreurs rouges

3. **Screenshot** : Faire une capture d'écran de la page

4. **Vérifier les versions** :
   ```bash
   node --version    # v18+ recommandé
   npm --version     # v9+ recommandé
   ```

---

**💡 Astuce** : 90% des problèmes viennent d'imports manquants ou de composants non montés. Vérifiez d'abord la console navigateur (F12) !

