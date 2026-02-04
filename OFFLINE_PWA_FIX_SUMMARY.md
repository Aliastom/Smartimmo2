# 🔧 Corrections Mode Offline-First PWA

## Problèmes identifiés et corrigés

### 1. ❌ Problème : Page d'erreur Chrome en mode offline

**Symptôme :** Quand on navigue vers une page non visitée en mode offline, Chrome affiche sa page d'erreur "ERR_INTERNET_DISCONNECTED".

**Cause :** La stratégie PWA `NetworkFirst` avec un timeout de 10 secondes était trop long. En mode offline, ça tentait de charger depuis le réseau trop longtemps.

**Solution :**
- ✅ Réduction du `networkTimeoutSeconds` à **1 seconde** pour basculer rapidement sur le cache
- ✅ Augmentation de `maxEntries` à **100 pages** et `maxAgeSeconds` à **24 heures** pour garder plus de pages en cache
- ✅ Ajout d'une page de fallback `/offline.html` pour les cas où aucune page n'est en cache

### 2. ❌ Problème : Suppression de biens ne fonctionnait pas en offline

**Correction :**
- ✅ `handleConfirmDelete` dans `BiensClient.tsx` utilise maintenant le repository offline en mode offline
- ✅ Fallback automatique sur IndexedDB si l'API échoue même en ligne

### 3. ❌ Problème : Modification de biens (PropertyInfoTab) ne fonctionnait pas en offline

**Correction :**
- ✅ `handleSave` dans `PropertyInfoTab.tsx` utilise maintenant le repository offline en mode offline
- ✅ Fallback automatique sur IndexedDB si l'API échoue même en ligne

### 4. ✅ Déjà corrigé : Création de biens

- ✅ `handlePropertySubmit` dans `BiensClient.tsx` utilise déjà le repository offline

## Fichiers modifiés

1. **`next.config.mjs`**
   - Réduction du timeout réseau à 1 seconde
   - Augmentation de la taille du cache
   - Ajout du fallback `/offline.html`

2. **`src/app/biens/BiensClient.tsx`**
   - `handleConfirmDelete` : Support offline-first

3. **`src/ui/components/PropertyInfoTab.tsx`**
   - `handleSave` : Support offline-first

4. **`public/offline.html`** (nouveau)
   - Page de fallback pour le mode offline

## Tests à effectuer en PWA

### Prérequis

1. **Build de production :**
   ```bash
   npm run build
   npm start
   ```

2. **Installer la PWA :**
   - Ouvrir l'app dans Chrome/Edge
   - Cliquer sur l'icône d'installation dans la barre d'adresse
   - Ou : Menu → "Installer Smartimmo"

3. **Précharger les pages importantes :**
   - Visiter `/biens` (liste des biens)
   - Visiter `/dashboard`
   - Visiter `/biens/[id]/transactions` (au moins un bien)
   - Attendre quelques secondes pour que les pages soient mises en cache

### Scénarios de test

#### Test 1 : Navigation en mode offline

1. Ouvrir la PWA installée
2. Activer le mode offline (Désactiver Wi-Fi ou DevTools → Network → Offline)
3. Naviguer entre les pages visitées précédemment
4. ✅ **Attendu :** Les pages doivent se charger depuis le cache, pas d'erreur Chrome

#### Test 2 : Création de bien en offline

1. Être en mode offline
2. Aller sur `/biens`
3. Cliquer sur "Nouveau bien"
4. Remplir le formulaire (adresse : "8 rue test 75001 Paris")
5. Cliquer sur "Enregistrer"
6. ✅ **Attendu :** Message "Bien enregistré localement", pas d'erreur "Failed to fetch"

#### Test 3 : Modification de bien en offline

1. Être en mode offline
2. Aller sur `/biens/[id]` (page d'un bien)
3. Onglet "Informations"
4. Cliquer sur "Modifier"
5. Modifier un champ (ex: nom)
6. Cliquer sur "Enregistrer"
7. ✅ **Attendu :** Message "Bien sauvegardé localement", modifications visibles immédiatement

#### Test 4 : Suppression/Archivage en offline

1. Être en mode offline
2. Aller sur `/biens`
3. Cliquer sur le bouton de suppression d'un bien
4. Choisir "Archiver"
5. Confirmer
6. ✅ **Attendu :** Message "Bien archivé localement", bien disparaît de la liste

#### Test 5 : Synchronisation automatique

1. Faire plusieurs modifications en offline (créer, modifier, archiver)
2. Vérifier l'indicateur de sync (en haut à droite) : doit afficher "X opérations en attente"
3. Réactiver le réseau
4. ✅ **Attendu :** L'indicateur doit automatiquement synchroniser et afficher "Synchronisé"
5. Vérifier dans Supabase que les données sont bien synchronisées

## Notes importantes

⚠️ **Pour que les pages fonctionnent en offline, il faut d'abord les visiter en ligne pour qu'elles soient mises en cache.**

Le service worker utilise `NetworkFirst` avec un timeout de 1 seconde, donc :
- Si la page est en cache → Charge immédiatement depuis le cache
- Si la page n'est pas en cache → Essaie le réseau pendant 1 seconde, puis affiche `/offline.html` si échec

**Recommandation :** Dans une vraie PWA, on pourrait précharger les pages importantes au démarrage, mais pour l'instant, l'utilisateur doit visiter les pages une fois en ligne.

## Après les tests

Une fois les tests validés, **remettre la configuration PWA normale** dans `next.config.mjs` :

```javascript
disable: process.env.NODE_ENV === 'development', // Désactiver en dev
```




