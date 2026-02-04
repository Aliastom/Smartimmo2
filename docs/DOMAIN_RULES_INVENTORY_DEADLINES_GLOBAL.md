# 📋 INVENTAIRE DES RÈGLES — PAGE GLOBALE ÉCHÉANCES (DEADLINES)

## Contexte

Ce document décrit les règles métier et différences entre :
- **Page globale** : `/app?view=echeances` (agrégée, toutes les échéances de l'organisation)
- **Tab property** : `/app?view=property&...&tab=deadlines` (échéances d'un bien spécifique)

## 1. Scope et filtrage

### Page globale (`scope: 'global'`)
- **Aucun filtre propertyId par défaut** : affiche toutes les échéances de l'organisation
- **Filtre propertyId optionnel** : l'utilisateur peut filtrer par bien via le filtre UI
- **KPI globaux** : agrégats sur toutes les échéances (ou filtrées)
- **Graphiques globaux** : visualisations agrégées sur toutes les échéances

### Tab property (`scope: 'property'`)
- **Filtre propertyId obligatoire** : affiche uniquement les échéances du bien courant
- **Filtre propertyId masqué** : le filtre "Bien" est caché dans l'UI (déjà fixé)
- **KPI du bien** : agrégats uniquement sur les échéances du bien
- **Graphiques du bien** : visualisations uniquement sur les échéances du bien

## 2. Événements de refresh

### Standardisation des événements

**Format standard :**
```typescript
window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
  detail: { 
    scope: 'global' | 'property',
    propertyId?: string, // Optionnel, requis si scope === 'property'
    reason: 'crud' | 'sync' | 'update' | 'delete' | 'update_multiple' | 'delete_multiple'
  } 
}));
```

### Règles de filtrage des événements

**Dans les hooks (`useEcheancesData`, `useEcheancesKpis`, `useEcheancesCharts`) :**

1. **Scope 'global'** :
   - Écoute uniquement les événements avec `scope === 'global'`
   - Ignore les événements avec `scope === 'property'`

2. **Scope 'property'** :
   - Écoute uniquement les événements avec `scope === 'property'` ET `propertyId` correspondant
   - Ignore les événements avec `scope === 'global'`
   - Ignore les événements avec `scope === 'property'` mais `propertyId` différent

3. **Anti-loop** :
   - Ignorer les événements identiques dans une fenêtre de 300ms
   - Utiliser un `lastRefreshRef` pour tracker le dernier événement traité

### Interdictions

- ❌ **Ne jamais émettre `sync:refresh` global** depuis les pages/tabs échéances
- ❌ **Ne jamais invalider React Query globalement** en mode app-shell
- ✅ **Utiliser uniquement `deadlines:refresh` avec scope approprié**

## 3. KPI globaux vs property

### KPI globaux (page globale)

Les KPI sont calculés sur **toutes les échéances** de l'organisation (ou filtrées) :

- **Revenus annuels** : somme des montants annuels des échéances `sens === 'CREDIT'`
- **Charges annuelles** : somme des montants annuels des échéances `sens === 'DEBIT'`
- **Total échéances** : nombre total d'échéances (actives + inactives)
- **Échéances actives** : nombre d'échéances avec `isActive === true`

### KPI property (tab property)

Les KPI sont calculés uniquement sur les échéances du bien :

- Même logique de calcul, mais filtrées par `propertyId`

### Conversion périodicité → annuel

```typescript
function toAnnual(montant: number, periodicite: string): number {
  switch (periodicite) {
    case 'MONTHLY': return montant * 12;
    case 'QUARTERLY': return montant * 4;
    case 'YEARLY': return montant;
    case 'ONCE': return montant;
    default: return montant;
  }
}
```

## 4. Graphiques globaux vs property

### Graphiques globaux (page globale)

1. **Cumulatif** : évolution des revenus/charges/solde sur la période sélectionnée
   - Mode mensuel : utilisation de `expandEcheances` pour générer les occurrences
   - Mode annuel : calcul direct des montants annuels

2. **Par type** : répartition des montants annuels par type d'échéance
   - Agrégation sur toutes les échéances

3. **Récupérables** : répartition charges récupérables vs non récupérables
   - Agrégation uniquement sur les échéances `sens === 'DEBIT'`

### Graphiques property (tab property)

- Même logique, mais filtrées par `propertyId` avant calcul

## 5. Filtres et recherche

### Filtres disponibles (page globale)

- **Recherche** : filtre par libellé (insensible à la casse)
- **Type** : filtre par type d'échéance (LOYER, CHARGE, TAXE, AUTRE)
- **Sens** : filtre par sens (CREDIT, DEBIT)
- **Périodicité** : filtre par périodicité (MONTHLY, QUARTERLY, YEARLY, ONCE)
- **Bien** : filtre par bien (SmartSelect avec toutes les propriétés)
- **Bail** : filtre par bail (filtré selon le bien sélectionné)
- **Récupérable** : filtre par charge récupérable (true/false)
- **Actif/Inactif** : filtre par statut actif (active/inactive/toutes)

### Filtres disponibles (tab property)

- Même liste, **sauf** :
  - **Bien** : masqué (déjà fixé par le contexte)

### Tri

- **Date de début** : tri par `startAt` (croissant/décroissant)
- **Montant** : tri par `montant` (croissant/décroissant)
- **Libellé** : tri alphabétique par `label`

### Pagination

- **Desktop** : 30 items par page (comme Transactions et Documents)
- **Mobile** : affichage par cards avec "Voir plus" (limite initiale : 3, +10 à chaque clic)

## 6. CRUD et Domain Services

### Règles obligatoires

- ✅ **Tout CRUD passe par `EcheanceService`** (factory `createEcheanceServiceWithMode('app-shell')`)
- ✅ **Écriture locale immédiate** : IndexedDB + pendingOp
- ✅ **Événement ciblé** : `deadlines:refresh` avec scope approprié
- ❌ **Aucun fetch `/api/echeances`** en mode app-shell
- ❌ **Aucun appel Supabase direct** en mode app-shell

### Création (page globale)

- **Bien obligatoire** : l'utilisateur **doit** choisir un bien (SmartSelect, pas de `defaultPropertyId`)
- **Bail optionnel** : peut être laissé vide ou sélectionné selon le bien

### Création (tab property)

- **Bien fixé** : `defaultPropertyId` passé à la modal, champ désactivé
- **Bail optionnel** : peut être laissé vide ou sélectionné

### Mise à jour

- Même logique pour les deux scopes
- Validation ownership via `EcheanceService`

### Suppression

- **Soft delete** : `isActive: false` + `endAt` (si non défini)
- **Hard delete** : suppression définitive (rare, pour nettoyage)
- **Suppression multiple** : même logique, appliquée en batch

## 7. UI/UX — Mobile vs Desktop

### Desktop (inchangé)

- **Tableau** : colonnes complètes (Libellé, Type, Périodicité, Montant, Sens, Bien, Bail, Dates, Actif, Actions)
- **Graphiques** : grille 2+1+1 colonnes (Cumulatif large, Par type, Récupérables)
- **Filtres** : panel collapsible avec tous les filtres

### Mobile (page globale)

- **Cards** : affichage par cards avec :
  - Libellé/titre échéance
  - Date d'échéance (`startAt` → `endAt`)
  - Montant
  - Statut (badge actif/inactif)
  - **Contexte bien/locataire** :
    - Adresse courte du bien (ex: "12 rue de la Paix, 75001 Paris")
    - Nom du locataire si bail associé (ex: "Jean Dupont")
  - Actions : toggle actif, éditer, supprimer
- **"Voir plus"** : bouton pour charger 10 items supplémentaires
- **Graphiques** : empilés verticalement, `min-w-0` pour éviter la troncature

### Mobile (tab property)

- **Cards** : même structure, **sans** contexte bien/locataire (déjà dans le contexte)
- **"Voir plus"** : même logique

## 8. Performance et stabilité

### Règles strictes

1. **Pas de remount sur filtres/tri** :
   - Utiliser `useMemo` pour les données filtrées
   - Keys stables sur les composants (pas de `key={Date.now()}`)
   - Pas de `router.push/replace` sur changement de filtre

2. **Données de référence en cache** :
   - Properties, leases, tenants : chargés une fois au mount
   - Mis en cache mémoire, pas rechargés à chaque interaction

3. **Filtrage en mémoire** :
   - Toutes les échéances chargées une fois depuis IndexedDB
   - Filtrage/tri/pagination appliqués en mémoire (useMemo)
   - Pas de relecture IndexedDB à chaque changement de filtre

4. **Événements ciblés** :
   - Uniquement `deadlines:refresh` avec scope approprié
   - Pas de refresh global de toute l'app

## 9. Sécurité et ownership

### OrganizationId

- **Toujours filtrer par `organizationId`** dans toutes les requêtes IndexedDB
- **Vérifier ownership** via `EcheanceService` avant toute modification
- **Pas de déduction depuis URL** : utiliser `useCurrentOrganization()`

### PropertyId

- **Page globale** : peut être `null` (échéance non liée à un bien)
- **Tab property** : toujours présent (contexte du bien)

## 10. État actuel de l'implémentation

### ✅ Implémenté dans `EcheancesPageCore`

- ✅ Utilise `EcheanceService` via `createEcheanceServiceWithMode('app-shell')` pour tous les CRUD
- ✅ Émet `deadlines:refresh` avec scope 'global' pour tous les événements
- ✅ Les hooks filtrent bien les événements par scope (useEcheancesData, useEcheancesKpis, useEcheancesCharts)
- ✅ Supporte le scope 'global' dans tous les hooks
- ✅ Les cards mobile affichent le contexte bien/locataire (page globale uniquement)
- ✅ La modal passe `defaultPropertyId={null}` en mode global (l'utilisateur doit choisir le bien)
- ✅ Aucun fetch `/api/echeances` en mode app-shell (uniquement en mode normal)
- ✅ Filtrage/tri/pagination en mémoire (useMemo) en mode app-shell
- ✅ Données de référence (properties, leases, tenants) chargées une fois et mises en cache

### ✅ Implémenté dans `PropertyEcheancesClient`

- ✅ Utilise `EcheanceService` via `createEcheanceServiceWithMode('app-shell')` pour tous les CRUD
- ✅ Émet `deadlines:refresh` avec scope 'property' et propertyId pour tous les événements
- ✅ Les hooks filtrent bien les événements par scope 'property'
- ✅ Les cards mobile n'affichent pas le contexte bien/locataire (déjà dans le contexte)
- ✅ La modal passe `defaultPropertyId={propertyId}` et le champ est désactivé
- ✅ Aucun fetch `/api/echeances` en mode app-shell
- ✅ Filtrage/tri/pagination en mémoire (useMemo) en mode app-shell

### Points de vérification restants

1. ⚠️ Vérifier que les cards mobile affichent bien l'adresse complète du bien (pas seulement le nom)
2. ⚠️ Vérifier que le chargement des locataires pour les cards mobile fonctionne correctement
3. ⚠️ Vérifier qu'il n'y a pas de remount lors des changements de filtres/tri
4. ⚠️ Vérifier que les données de référence (properties, leases, tenants) ne sont pas rechargées à chaque interaction

## 11. Incertitudes résolues

- ✅ **Scope global** : introduit pour différencier page globale vs tab property
- ✅ **Événements** : standardisé sur `deadlines:refresh` avec scope
- ✅ **KPI/Graphiques** : même logique de calcul, filtrés selon scope
- ✅ **Mobile cards** : contexte bien/locataire uniquement en page globale
- ✅ **CRUD** : même service, scope différent dans l'événement

## 12. Tests attendus (Playwright)

### Page globale

1. ✅ Page affichable offline (zéro requête réseau métier)
2. ✅ Filtres/tri => pas de remount
3. ✅ CRUD offline => UI immédiate + pendingOps + refresh scope global
4. ✅ Cards mobile affichent contexte bien/locataire
5. ✅ Modal création permet de choisir le bien (pas de defaultPropertyId)

### Tab property

1. ✅ Tab affichable offline
2. ✅ Filtres/tri => pas de remount
3. ✅ CRUD offline => UI immédiate + pendingOps + refresh scope property
4. ✅ Cards mobile n'affichent pas contexte bien/locataire (déjà dans le contexte)
5. ✅ Modal création a bien fixé (defaultPropertyId, champ désactivé)

