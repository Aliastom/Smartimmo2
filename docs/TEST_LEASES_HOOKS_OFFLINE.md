# Tests Manuels : Hooks Baux Offline-First

## 📋 Objectif

Vérifier que les hooks `useLeasesKpis` et `useLeasesCharts` respectent strictement les règles offline-first :

1. **Mode normal (online, non app-shell)** : Utilisent l'API (`/api/leases/kpis`, `/api/leases/charts`)
2. **Mode offline ou app-shell** : N'utilisent PAS l'API, calculent depuis IndexedDB uniquement

## 🧪 Test 1 : Mode Normal (Online, Non App-Shell)

### Prérequis
- Navigateur en mode **online**
- Page en mode **normal** (pas `/app?view=...`)

### Scénario
1. Ouvrir la page `/baux` (mode normal)
2. Ouvrir DevTools > Network
3. Filtrer sur `/api/leases/`
4. Recharger la page

### Résultat attendu
✅ **Les endpoints suivants DOIVENT être appelés :**
- `GET /api/leases/kpis`
- `GET /api/leases/charts`

✅ **Pas d'erreurs console**

### Vérification
```javascript
// Dans la console du navigateur
// Vérifier que les requêtes sont bien faites
fetch('/api/leases/kpis').then(r => r.json()).then(console.log);
fetch('/api/leases/charts').then(r => r.json()).then(console.log);
```

---

## 🧪 Test 2 : Mode App-Shell (Online)

### Prérequis
- Navigateur en mode **online**
- Page en mode **app-shell** (`/app?view=baux`)

### Scénario
1. Ouvrir la page `/app?view=baux` (mode app-shell)
2. Ouvrir DevTools > Network
3. Filtrer sur `/api/leases/`
4. Recharger la page

### Résultat attendu
✅ **AUCUN endpoint `/api/leases/*` ne doit être appelé**

✅ **Pas d'erreurs console**

✅ **Les KPI et graphiques s'affichent correctement** (depuis IndexedDB)

### Vérification
```javascript
// Dans la console du navigateur
// Vérifier qu'aucune requête n'est faite
// Les données doivent venir d'IndexedDB
```

---

## 🧪 Test 3 : Mode Offline (Normal ou App-Shell)

### Prérequis
- Navigateur en mode **offline** (DevTools > Network > Offline)
- Page en mode **normal** OU **app-shell**

### Scénario
1. Activer le mode offline dans DevTools
2. Ouvrir `/baux` (mode normal) OU `/app?view=baux` (mode app-shell)
3. Ouvrir DevTools > Network
4. Filtrer sur `/api/leases/`

### Résultat attendu
✅ **AUCUN endpoint `/api/leases/*` ne doit être appelé**

✅ **Pas d'erreurs console** (pas de `Failed to fetch`, pas de `net::ERR_INTERNET_DISCONNECTED`)

✅ **Les KPI et graphiques s'affichent correctement** (depuis IndexedDB) OU affichent des valeurs vides (0, []) si IndexedDB est vide

### Vérification
```javascript
// Dans la console du navigateur
// Vérifier qu'aucune requête réseau n'est tentée
// Pas de console.error lié aux fetch
```

---

## 🧪 Test 4 : Transition Online → Offline

### Prérequis
- Page `/baux` (mode normal) ou `/app?view=baux` (mode app-shell) ouverte
- Navigateur en mode **online**

### Scénario
1. Page chargée en mode online
2. Activer le mode offline dans DevTools
3. Attendre quelques secondes
4. Ouvrir DevTools > Network

### Résultat attendu
✅ **Aucune nouvelle requête `/api/leases/*` après le passage en offline**

✅ **Pas d'erreurs console** lors du passage en offline

---

## 🧪 Test 5 : Transition Offline → Online

### Prérequis
- Page `/baux` (mode normal) ou `/app?view=baux` (mode app-shell) ouverte
- Navigateur en mode **offline**

### Scénario
1. Page chargée en mode offline
2. Activer le mode online dans DevTools
3. Observer le comportement

### Résultat attendu

**Mode normal (`/baux`) :**
- ✅ Les endpoints `/api/leases/kpis` et `/api/leases/charts` sont appelés automatiquement
- ✅ Les données sont mises à jour depuis l'API

**Mode app-shell (`/app?view=baux`) :**
- ✅ Aucun endpoint `/api/leases/*` n'est appelé (même après retour online)
- ✅ Les données restent depuis IndexedDB

---

## 📊 Checklist de Validation

### Mode Normal (Online)
- [ ] `/api/leases/kpis` est appelé
- [ ] `/api/leases/charts` est appelé
- [ ] Pas d'erreurs console
- [ ] Les KPI et graphiques s'affichent correctement

### Mode App-Shell (Online)
- [ ] Aucun `/api/leases/*` n'est appelé
- [ ] Pas d'erreurs console
- [ ] Les KPI et graphiques s'affichent correctement (depuis IndexedDB)

### Mode Offline (Normal ou App-Shell)
- [ ] Aucun `/api/leases/*` n'est appelé
- [ ] Pas d'erreurs console (pas de `Failed to fetch`)
- [ ] Les KPI et graphiques s'affichent correctement (depuis IndexedDB) ou vides

### Transition Online → Offline
- [ ] Aucune nouvelle requête après passage en offline
- [ ] Pas d'erreurs console

### Transition Offline → Online
- [ ] Mode normal : Les endpoints sont appelés
- [ ] Mode app-shell : Aucun endpoint n'est appelé

---

## 🐛 Signaux d'alerte

❌ **Si vous voyez ces erreurs, le correctif n'est pas appliqué :**
- `Failed to fetch` dans la console
- `net::ERR_INTERNET_DISCONNECTED` dans la console
- Des requêtes `/api/leases/*` en mode offline/app-shell
- Des erreurs console liées aux hooks `useLeasesKpis` ou `useLeasesCharts`

---

## 📝 Notes

- Les tests doivent être effectués avec des données existantes dans IndexedDB (au moins un bail)
- En mode offline sans données IndexedDB, les hooks doivent retourner des valeurs vides (0, []) sans erreur
- Les hooks utilisent `useState` + `useEffect`, pas React Query
