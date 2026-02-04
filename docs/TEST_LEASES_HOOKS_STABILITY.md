# Plan de Test : Stabilité Hooks Baux

## 📋 Objectif

Vérifier la stabilité totale des hooks `useLeasesKpis` et `useLeasesCharts` :
- Pas de spam de fetch
- Pas d'erreurs console en offline
- Pas de setState après unmount
- Protection contre les réponses obsolètes

## 🧪 Test 1 : Offline/Online

### Scénario A : Offline → Online (Mode Normal)

1. **Prérequis** : Page `/baux` (mode normal) ouverte
2. **Actions** :
   - Activer le mode offline dans DevTools
   - Attendre 2 secondes
   - Activer le mode online dans DevTools
3. **Vérifications** :
   - ✅ Aucune erreur console en offline
   - ✅ Aucune requête `/api/leases/*` en offline
   - ✅ Les requêtes `/api/leases/*` sont appelées après retour online
   - ✅ Pas d'erreurs console après retour online

### Scénario B : Online → Offline (Mode Normal)

1. **Prérequis** : Page `/baux` (mode normal) ouverte, mode online
2. **Actions** :
   - Vérifier que les requêtes `/api/leases/*` sont en cours
   - Activer le mode offline pendant les requêtes
3. **Vérifications** :
   - ✅ Les requêtes en cours sont abortées (pas d'erreur AbortError dans la console)
   - ✅ Pas d'erreurs console après passage en offline
   - ✅ Pas de setState après passage en offline

### Scénario C : Offline (Mode App-Shell)

1. **Prérequis** : Page `/app?view=baux` (mode app-shell) ouverte
2. **Actions** :
   - Activer le mode offline dans DevTools
   - Recharger la page
3. **Vérifications** :
   - ✅ Aucune requête `/api/leases/*`
   - ✅ Aucune erreur console (pas de `console.error`)
   - ✅ Les KPI et graphiques s'affichent depuis IndexedDB ou sont vides (0, [])
   - ✅ Si IndexedDB échoue : `console.warn` en DEV uniquement, pas de `console.error`

## 🧪 Test 2 : Changement Rapide de PropertyId

### Scénario A : Changement Rapide (Mode Normal)

1. **Prérequis** : Page `/baux` (mode normal) ouverte, mode online
2. **Actions** :
   - Cliquer rapidement sur différents biens (changement de `propertyId`)
   - Observer les requêtes dans DevTools > Network
3. **Vérifications** :
   - ✅ Les requêtes précédentes sont abortées (AbortController)
   - ✅ Seule la dernière requête aboutit
   - ✅ Pas d'état incohérent (les KPI correspondent au dernier bien sélectionné)
   - ✅ Pas d'erreurs console liées aux abort

### Scénario B : Changement Rapide (Mode App-Shell)

1. **Prérequis** : Page `/app?view=property&propertyId=XXX&tab=lease` (mode app-shell)
2. **Actions** :
   - Naviguer rapidement entre différents biens (changement de `propertyId`)
   - Observer les calculs locaux
3. **Vérifications** :
   - ✅ Les calculs locaux se terminent correctement
   - ✅ Pas de setState obsolète (les KPI correspondent au dernier bien)
   - ✅ Pas d'erreurs console

## 🧪 Test 3 : Changement Rapide d'Onglet

### Scénario A : Navigation Rapide entre Onglets (Mode App-Shell)

1. **Prérequis** : Page `/app?view=property&propertyId=XXX&tab=lease` (mode app-shell)
2. **Actions** :
   - Cliquer rapidement sur différents onglets (transactions, documents, baux, etc.)
   - Revenir rapidement sur l'onglet "baux"
3. **Vérifications** :
   - ✅ Les calculs locaux se terminent correctement
   - ✅ Pas de setState après unmount
   - ✅ Pas d'erreurs console

### Scénario B : Navigation Rapide (Mode Normal)

1. **Prérequis** : Page `/baux` (mode normal) ouverte
2. **Actions** :
   - Naviguer rapidement vers `/biens`, puis `/transactions`, puis revenir à `/baux`
3. **Vérifications** :
   - ✅ Les requêtes en cours sont abortées lors du changement de page
   - ✅ Pas de setState après unmount
   - ✅ Pas d'erreurs console liées aux abort

## 🧪 Test 4 : Stabilité des Dépendances

### Scénario : Vérification des Dépendances useEffect

1. **Actions** :
   - Ouvrir DevTools > React DevTools > Profiler
   - Enregistrer une session pendant :
     - Changement de `propertyId`
     - Passage offline/online
     - Navigation entre pages
2. **Vérifications** :
   - ✅ Le `useEffect` ne se déclenche QUE si les dépendances changent
   - ✅ Pas de re-render inutile
   - ✅ Pas de boucle infinie

## 📊 Checklist de Validation

### Stabilité
- [ ] Pas de spam de fetch (AbortController fonctionne)
- [ ] Pas d'erreurs console en offline/app-shell
- [ ] Pas de setState après unmount
- [ ] Pas de setState avec réponses obsolètes (token de requête fonctionne)

### Offline/Online
- [ ] Offline → Online (mode normal) : Les requêtes sont appelées après retour online
- [ ] Online → Offline (mode normal) : Les requêtes sont abortées sans erreur
- [ ] Offline (mode app-shell) : Aucune requête, pas d'erreur console

### Changement Rapide
- [ ] Changement rapide de `propertyId` (mode normal) : Seule la dernière requête aboutit
- [ ] Changement rapide de `propertyId` (mode app-shell) : Pas de setState obsolète
- [ ] Navigation rapide entre onglets : Pas de setState après unmount

### Dépendances
- [ ] Le `useEffect` ne se déclenche QUE si les dépendances changent
- [ ] Pas de re-render inutile
- [ ] Pas de boucle infinie

## 🐛 Signaux d'alerte

❌ **Si vous voyez ces erreurs, le correctif n'est pas appliqué :**
- `Failed to fetch` en offline/app-shell
- `AbortError` dans la console (non géré)
- Des requêtes multiples pour le même `propertyId` (spam)
- Des KPI qui correspondent à un ancien bien après changement rapide
- Des erreurs "Can't perform a React state update on an unmounted component"
- Des `console.error` en offline/app-shell

## 📝 Notes

- Les tests doivent être effectués avec des données existantes dans IndexedDB (au moins un bail)
- En mode offline sans données IndexedDB, les hooks doivent retourner des valeurs vides (0, []) sans erreur
- Les `console.warn` en DEV sont acceptables pour le debug, mais pas les `console.error` en offline/app-shell
