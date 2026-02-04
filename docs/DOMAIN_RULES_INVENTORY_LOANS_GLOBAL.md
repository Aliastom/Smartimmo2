# 📋 INVENTAIRE DES RÈGLES — PAGE GLOBALE PRÊTS (LOANS)

## Contexte

Ce document décrit les règles métier et différences entre :
- **Page globale** : `/app?view=loans` (agrégée, tous les prêts de l'organisation)
- **Tab property** : `/app?view=property&...&tab=loans` (prêts d'un bien spécifique)

## 1. Scope et filtrage

### Page globale (`scope: 'global'`)

- **Aucun filtre propertyId par défaut** : affiche tous les prêts de l'organisation
- **Filtre propertyId optionnel** : l'utilisateur peut filtrer par bien via le filtre UI
- **KPI globaux** : agrégats sur tous les prêts (ou filtrés)
- **Graphiques globaux** : visualisations agrégées sur tous les prêts

### Tab property (`scope: 'property'`)

- **Filtre propertyId obligatoire** : affiche uniquement les prêts du bien courant
- **Filtre propertyId masqué** : le filtre "Bien" est caché dans l'UI (déjà fixé)
- **KPI du bien** : agrégats uniquement sur les prêts du bien
- **Graphiques du bien** : visualisations uniquement sur les prêts du bien

## 2. Événements de refresh

### Standardisation des événements

**Format standard :**
```typescript
window.dispatchEvent(new CustomEvent('loans:refresh', { 
  detail: { 
    scope: 'global' | 'property',
    propertyId?: string, // Optionnel, requis si scope === 'property'
    reason: 'crud' | 'sync' | 'update' | 'delete' | 'delete_multiple'
  } 
}));
```

### Règles de filtrage des événements

**Dans les hooks (`useLoansData`, `useLoansCharts`) :**

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

- ❌ **Ne jamais émettre `sync:refresh` global** depuis les pages/tabs prêts
- ❌ **Ne jamais invalider React Query globalement** en mode app-shell
- ✅ **Utiliser uniquement `loans:refresh` avec scope approprié**

## 3. KPI globaux vs property

### KPI globaux (page globale)

Les KPI sont calculés sur **tous les prêts** de l'organisation (ou filtrés) :

- **Capital initial total** : somme des `principal` pour les prêts actifs
- **CRD total** : somme du Capital Restant Dû pour les prêts actifs
- **Mensualité moyenne** : moyenne des `monthlyPayment` pour les prêts actifs
- **Nombre de prêts actifs** : nombre de prêts avec `isActive === true`

### KPI property (tab property)

Les KPI sont calculés uniquement sur les prêts du bien :

- Même logique de calcul, mais filtrées par `propertyId`

## 4. Graphiques globaux vs property

### Graphiques globaux (page globale)

1. **Évolution du CRD** : évolution du Capital Restant Dû sur la période sélectionnée (tous les prêts)
2. **Répartition par bien** : répartition du CRD par bien
3. **Top prêts coûteux** : les prêts avec les mensualités les plus élevées

### Graphiques property (tab property)

- Même logique, mais filtrées par `propertyId` avant calcul

## 5. Filtres et recherche

### Filtres disponibles (page globale)

- **Recherche** : filtre par libellé du prêt ou nom du bien (insensible à la casse)
- **Bien** : filtre par bien (SmartSelect avec toutes les propriétés)
- **Actif/Inactif** : filtre par statut (`isActive === true/false`)
- **Période** : filtre par période (from/to en format YYYY-MM)

### Filtres disponibles (tab property)

- Même liste, **sauf** :
  - **Bien** : masqué (déjà fixé par le contexte)

### Tri

- **Libellé** : tri par `label` (alphabétique)
- **Capital initial** : tri par `principal` (croissant/décroissant)
- **Mensualité** : tri par `monthlyPayment` (croissant/décroissant)
- **Date de début** : tri par `startDate` (croissant/décroissant)

### Pagination

- **Desktop** : affichage complet dans un tableau
- **Mobile** : affichage par cards avec "Voir plus" (limite initiale : 3, +10 à chaque clic)

## 6. CRUD et Domain Services

### Règles obligatoires

- ✅ **Tout CRUD passe par `LoanRepositoryOffline`** en mode app-shell
- ✅ **Écriture locale immédiate** : IndexedDB + pendingOp
- ✅ **Événement ciblé** : `loans:refresh` avec scope approprié
- ❌ **Aucun fetch `/api/loans`** en mode app-shell
- ❌ **Aucun appel Supabase direct** en mode app-shell

### Création (page globale)

- **Bien obligatoire** : l'utilisateur **doit** choisir un bien (SmartSelect, pas de `defaultPropertyId`)
- **Modal** : `LoanModalV2` avec `lockPropertyId={false}`

### Création (tab property)

- **Bien fixé** : `defaultPropertyId` passé à la modal, champ désactivé (`lockPropertyId={true}`)
- **Modal** : `LoanModalV2` avec `lockPropertyId={true}`

### Mise à jour

- Même logique pour les deux scopes
- Validation ownership via `organizationId` (filtrage IndexedDB)

### Suppression

- **Soft delete** : `isActive: false` (désactivation)
- **Hard delete** : suppression définitive dans IndexedDB + pendingOp
- **Suppression multiple** : même logique, appliquée en batch

## 7. UI/UX — Mobile vs Desktop

### Desktop (inchangé)

- **Tableau** : colonnes complètes (Libellé, Bien, Capital Initial, Mensualité, Taux, Durée, Date de fin, Assurance, Actif, Actions)
- **Graphiques** : grille 2+1+1 colonnes (Évolution CRD large, Répartition par bien, Top coûteux)
- **Filtres** : panel avec tous les filtres

### Mobile (page globale)

- **Cards** : affichage par cards avec :
  - Libellé du prêt
  - Nom du bien
  - Capital initial
  - Mensualité
  - Taux
  - Durée
  - Date de fin (si disponible)
  - Assurance (si disponible)
  - Switch Actif/Inactif
  - Actions : voir, éditer, supprimer
- **"Voir plus"** : bouton pour charger 10 items supplémentaires
- **Graphiques** : empilés verticalement, `min-w-0` pour éviter la troncature

### Mobile (tab property)

- **Cards** : même structure, **sans** nom du bien (déjà dans le contexte)
- **"Voir plus"** : même logique

## 8. Performance et stabilité

### Règles strictes

1. **Pas de remount sur filtres/tri** :
   - Utiliser `useMemo` pour les données filtrées
   - Keys stables sur les composants (pas de `key={Date.now()}`)
   - Pas de `router.push/replace` sur changement de filtre

2. **Données de référence en cache** :
   - Properties : chargées une fois au mount
   - Mis en cache mémoire, pas rechargées à chaque interaction

3. **Filtrage en mémoire** :
   - Tous les prêts chargés une fois depuis IndexedDB
   - Filtrage/tri/pagination appliqués en mémoire (useMemo)
   - Pas de relecture IndexedDB à chaque changement de filtre

4. **Événements ciblés** :
   - Uniquement `loans:refresh` avec scope approprié
   - Pas de refresh global de toute l'app

## 9. Sécurité et ownership

### OrganizationId

- **Toujours filtrer par `organizationId`** dans toutes les requêtes IndexedDB
- **Vérifier ownership** via `organizationId` avant toute modification
- **Pas de déduction depuis URL** : utiliser `useCurrentOrganization()`

### PropertyId

- **Page globale** : peut être vide (filtre optionnel)
- **Tab property** : toujours présent (contexte du bien)

## 10. État actuel de l'implémentation

### ✅ Déjà implémenté dans `PropertyLoansClient`

- ✅ Utilise `LoanRepositoryOffline` pour tous les CRUD
- ✅ Lit uniquement depuis IndexedDB en mode app-shell (via `useLoansData`)
- ✅ Filtrage/tri en mémoire (useMemo)
- ✅ Aucun fetch `/api/loans` en mode app-shell
- ✅ Cards mobile avec "Voir plus"
- ✅ Événements `loans:refresh` avec scope 'property'

### ⚠️ À adapter dans `LoansPageCore`

1. **Événements** : Standardiser `loans:refresh` avec scope 'global' vs 'property'
2. **Hook useLoansData** : Filtrer les événements par scope (global vs property)
3. **Modal création** : Vérifier que `lockPropertyId={false}` en mode global
4. **Cards mobile** : Ajouter l'affichage mobile comme dans PropertyLoansClient
5. **Hook useLoansCharts** : Adapter pour supporter le scope global vs property

## 11. Tests attendus (Playwright)

### Page globale

1. ✅ Page affichable offline (zéro requête réseau métier)
2. ✅ Filtres/tri => pas de remount
3. ✅ CRUD offline => UI immédiate + pendingOps + refresh scope global
4. ✅ Cards mobile affichent contexte bien
5. ✅ Modal création permet de choisir le bien (pas de defaultPropertyId)

### Tab property

1. ✅ Tab affichable offline
2. ✅ Filtres/tri => pas de remount
3. ✅ CRUD offline => UI immédiate + pendingOps + refresh scope property
4. ✅ Cards mobile n'affichent pas contexte bien (déjà dans le contexte)
5. ✅ Modal création a bien fixé (defaultPropertyId, champ désactivé)

