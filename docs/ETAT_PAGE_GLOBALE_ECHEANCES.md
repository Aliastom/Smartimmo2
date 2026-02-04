# 📊 ÉTAT ACTUEL — PAGE GLOBALE ÉCHÉANCES (`/app?view=echeances`)

**Date de vérification :** 2025-01-XX  
**Statut :** ✅ **DÉJÀ CONFORME** aux exigences offline-first App Shell

---

## ✅ Vérifications effectuées

### 1. Lecture des données (IndexedDB only)

- ✅ **Hook `useEcheancesData`** : Lit uniquement depuis IndexedDB en mode app-shell
- ✅ **Aucun fetch `/api/echeances`** en mode app-shell (uniquement en mode normal)
- ✅ **Aucun appel Supabase direct** en mode app-shell
- ✅ **Filtrage/tri/pagination en mémoire** via `useMemo` (pas de relecture IndexedDB)

### 2. Scope et événements

- ✅ **Scope 'global'** : Utilisé correctement dans `EcheancesPageCore`
- ✅ **Événements `deadlines:refresh`** : Émis avec `scope: 'global'` pour tous les CRUD
- ✅ **Filtrage des événements** : Les hooks (`useEcheancesData`, `useEcheancesKpis`, `useEcheancesCharts`) filtrent bien par scope
  - Scope 'global' : écoute uniquement les événements `scope === 'global'`
  - Scope 'property' : ignoré en page globale

### 3. CRUD via Domain Services

- ✅ **EcheanceService** : Utilisé via `createEcheanceServiceWithMode('app-shell')` pour tous les CRUD
- ✅ **Écriture locale immédiate** : IndexedDB + pendingOp
- ✅ **Événement ciblé** : `deadlines:refresh` avec scope 'global' après chaque opération
- ✅ **Aucune invalidation React Query globale** en mode app-shell

### 4. Modal de création

- ✅ **defaultPropertyId={null}** : L'utilisateur doit choisir le bien (pas de pré-remplissage)
- ✅ **SmartSelect** : Permet de choisir parmi toutes les propriétés de l'organisation

### 5. Cards mobile (page globale)

- ✅ **Contexte bien/locataire affiché** :
  - Nom du bien + adresse complète (address, postalCode, city)
  - Nom du locataire si bail associé
- ✅ **Structure identique au tab property** : Réutilise les mêmes composants

### 6. Performance et stabilité

- ✅ **Pas de remount sur filtres/tri** : Utilisation de `useMemo` pour les données filtrées
- ✅ **Keys stables** : Pas de `key={Date.now()}` ou similaire
- ✅ **Données de référence en cache** : Properties, leases, tenants chargés une fois au mount
- ✅ **Pas de relecture IndexedDB** : Filtrage/tri/pagination appliqués en mémoire

---

## 📋 Comparaison avec PropertyEcheancesClient

| Aspect | Page globale (`EcheancesPageCore`) | Tab property (`PropertyEcheancesClient`) |
|--------|-----------------------------------|------------------------------------------|
| **Scope** | `'global'` | `'property'` |
| **Filtre propertyId** | Optionnel (via UI) | Obligatoire (fixé, masqué dans UI) |
| **Événements** | `deadlines:refresh` scope 'global' | `deadlines:refresh` scope 'property' + propertyId |
| **Modal defaultPropertyId** | `null` (doit choisir) | `propertyId` (fixé, champ désactivé) |
| **Cards mobile contexte** | Affiche bien/locataire | N'affiche pas (déjà dans contexte) |
| **KPI/Graphiques** | Toutes les échéances | Échéances du bien uniquement |
| **Service** | `EcheanceService` app-shell | `EcheanceService` app-shell |
| **Source données** | IndexedDB uniquement | IndexedDB uniquement |

---

## ⚠️ Points à vérifier (tests manuels)

1. **Cards mobile** : Vérifier que l'adresse complète s'affiche correctement (nom + adresse + code postal + ville)
2. **Chargement locataires** : Vérifier que les locataires sont bien chargés et affichés dans les cards
3. **Pas de remount** : Vérifier qu'il n'y a pas de remount lors des changements de filtres/tri
4. **Performance** : Vérifier que les données de référence ne sont pas rechargées à chaque interaction

---

## 🎯 Conclusion

La page globale `/app?view=echeances` est **déjà conforme** aux exigences offline-first App Shell :

- ✅ Lecture uniquement depuis IndexedDB
- ✅ CRUD via EcheanceService
- ✅ Événements ciblés avec scope 'global'
- ✅ Cards mobile avec contexte bien/locataire
- ✅ Modal sans defaultPropertyId
- ✅ Filtrage/tri/pagination en mémoire
- ✅ Pas de remount sur interactions

**Aucune modification majeure nécessaire.** Seuls des tests manuels sont recommandés pour valider le comportement en conditions réelles.

---

## 📝 Note sur `/app?view=baux`

L'utilisateur a mentionné `/app?view=baux` dans sa demande, mais cette page concerne les **baux (leases)**, pas les échéances. Les échéances sont sur `/app?view=echeances`.

Si l'utilisateur souhaite transformer `/app?view=baux` pour les échéances, il faudrait clarifier l'intention. Sinon, la page `/app?view=echeances` est déjà conforme.

