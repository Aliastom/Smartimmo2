# 📋 INVENTAIRE DES RÈGLES — PAGE GLOBALE BAUX (LEASES)

## Contexte

Ce document décrit les règles métier et différences entre :
- **Page globale** : `/app?view=baux` (agrégée, tous les baux de l'organisation)
- **Tab property** : `/app?view=property&...&tab=lease` (baux d'un bien spécifique)

## 1. Scope et filtrage

### Page globale (`scope: 'global'`)

- **Aucun filtre propertyId par défaut** : affiche tous les baux de l'organisation
- **Filtre propertyId optionnel** : l'utilisateur peut filtrer par bien via le filtre UI
- **KPI globaux** : agrégats sur tous les baux (ou filtrés)
- **Graphiques globaux** : visualisations agrégées sur tous les baux

### Tab property (`scope: 'property'`)

- **Filtre propertyId obligatoire** : affiche uniquement les baux du bien courant
- **Filtre propertyId masqué** : le filtre "Bien" est caché dans l'UI (déjà fixé)
- **KPI du bien** : agrégats uniquement sur les baux du bien
- **Graphiques du bien** : visualisations uniquement sur les baux du bien

## 2. Événements de refresh

### Standardisation des événements

**Format standard :**
```typescript
window.dispatchEvent(new CustomEvent('leases:refresh', { 
  detail: { 
    scope: 'global' | 'property',
    propertyId?: string, // Optionnel, requis si scope === 'property'
    reason: 'crud' | 'sync' | 'update' | 'delete' | 'update_multiple' | 'delete_multiple'
  } 
}));
```

### Règles de filtrage des événements

**Dans les hooks (`useLeasesData`, `useLeasesKpis`, `useLeasesCharts`) :**

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

- ❌ **Ne jamais émettre `sync:refresh` global** depuis les pages/tabs baux
- ❌ **Ne jamais invalider React Query globalement** en mode app-shell
- ✅ **Utiliser uniquement `leases:refresh` avec scope approprié**

## 3. KPI globaux vs property

### KPI globaux (page globale)

Les KPI sont calculés sur **tous les baux** de l'organisation (ou filtrés) :

- **Total baux** : nombre total de baux
- **Baux actifs** : nombre de baux avec `status === 'ACTIF'`
- **Baux expirant bientôt** : nombre de baux avec `endDate` dans les 3 prochains mois
- **Loyers mensuels totaux** : somme des `rentAmount` pour les baux actifs
- **Cautions totales** : somme des `deposit` pour tous les baux

### KPI property (tab property)

Les KPI sont calculés uniquement sur les baux du bien :

- Même logique de calcul, mais filtrées par `propertyId`

## 4. Graphiques globaux vs property

### Graphiques globaux (page globale)

1. **Évolution des loyers** : évolution des loyers moyens sur la période sélectionnée
2. **Répartition meublé/vide** : répartition des baux par type de meublé
3. **Cautions vs loyers** : comparaison des montants de caution vs loyers

### Graphiques property (tab property)

- Même logique, mais filtrées par `propertyId` avant calcul

## 5. Filtres et recherche

### Filtres disponibles (page globale)

- **Recherche** : filtre par nom du bien ou nom du locataire (insensible à la casse)
- **Bien** : filtre par bien (SmartSelect avec toutes les propriétés)
- **Locataire** : filtre par locataire (SmartSelect avec tous les locataires)
- **Type** : filtre par type (residential, commercial, garage)
- **Meublé** : filtre par type de meublé (vide, meublé, garage)
- **Statut** : filtre par statut (BROUILLON, ENVOYÉ, SIGNÉ, ACTIF, RÉSILIÉ)
- **Date de début** : filtre par période de début
- **Date de fin** : filtre par période de fin
- **Indexation** : filtre par type d'indexation (none, insee, manual)
- **Loyer** : filtre par montant de loyer (min/max)
- **Dépôt** : filtre par montant de dépôt (min/max)

### Filtres disponibles (tab property)

- Même liste, **sauf** :
  - **Bien** : masqué (déjà fixé par le contexte)

### Tri

- **Date de début** : tri par `startDate` (croissant/décroissant)
- **Date de fin** : tri par `endDate` (croissant/décroissant)
- **Loyer** : tri par `rentAmount` (croissant/décroissant)

### Pagination

- **Desktop** : 30 items par page (comme Transactions et Documents)
- **Mobile** : affichage par cards avec "Voir plus" (limite initiale : 3, +10 à chaque clic)

## 6. CRUD et Domain Services

### Règles obligatoires

- ✅ **Tout CRUD passe par `LeaseService`** (factory `createLeaseServiceWithMode('app-shell')`)
- ✅ **Écriture locale immédiate** : IndexedDB + pendingOp
- ✅ **Événement ciblé** : `leases:refresh` avec scope approprié
- ❌ **Aucun fetch `/api/leases`** en mode app-shell
- ❌ **Aucun appel Supabase direct** en mode app-shell

### Création (page globale)

- **Bien obligatoire** : l'utilisateur **doit** choisir un bien (SmartSelect, pas de `defaultPropertyId`)
- **Locataire obligatoire** : l'utilisateur **doit** choisir un locataire

### Création (tab property)

- **Bien fixé** : `defaultPropertyId` passé à la modal, champ désactivé
- **Locataire obligatoire** : l'utilisateur **doit** choisir un locataire

### Mise à jour

- Même logique pour les deux scopes
- Validation ownership via `LeaseService`

### Suppression

- **Soft delete** : `status: 'RÉSILIÉ'` (résiliation)
- **Hard delete** : suppression définitive (rare, pour nettoyage)
- **Suppression multiple** : même logique, appliquée en batch

## 7. UI/UX — Mobile vs Desktop

### Desktop (inchangé)

- **Tableau** : colonnes complètes (Bien, Locataire, Période, Loyer, Statut, Actions)
- **Graphiques** : grille 2+1+1 colonnes (Évolution large, Meublé, Cautions)
- **Filtres** : panel collapsible avec tous les filtres

### Mobile (page globale)

- **Cards** : affichage par cards avec :
  - Nom du bien + adresse courte
  - Nom du locataire
  - Période (dates de début/fin)
  - Loyer
  - Statut (badge)
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
   - Properties, tenants : chargés une fois au mount
   - Mis en cache mémoire, pas rechargés à chaque interaction

3. **Filtrage en mémoire** :
   - Tous les baux chargés une fois depuis IndexedDB
   - Filtrage/tri/pagination appliqués en mémoire (useMemo)
   - Pas de relecture IndexedDB à chaque changement de filtre

4. **Événements ciblés** :
   - Uniquement `leases:refresh` avec scope approprié
   - Pas de refresh global de toute l'app

## 9. Sécurité et ownership

### OrganizationId

- **Toujours filtrer par `organizationId`** dans toutes les requêtes IndexedDB
- **Vérifier ownership** via `LeaseService` avant toute modification
- **Pas de déduction depuis URL** : utiliser `useCurrentOrganization()`

### PropertyId

- **Page globale** : peut être `null` (bail non lié à un bien - rare mais possible)
- **Tab property** : toujours présent (contexte du bien)

## 10. État actuel de l'implémentation

### ✅ Déjà implémenté dans `LeasesPageCore`

- ✅ Utilise `LeaseService` via `createLeaseServiceWithMode('app-shell')` pour tous les CRUD
- ✅ Lit uniquement depuis IndexedDB en mode app-shell (via `useLeasesData`)
- ✅ Filtrage/tri/pagination en mémoire (useMemo)
- ✅ Aucun fetch `/api/leases` en mode app-shell (uniquement en mode normal)

### ⚠️ À corriger

1. **Événements** : Standardiser `leases:refresh` avec scope 'global' vs 'property'
2. **Hook useLeasesData** : Filtrer les événements par scope
3. **Modal création** : Vérifier que `defaultPropertyId` n'est pas passé en mode global
4. **Cards mobile** : Vérifier l'affichage du contexte bien/locataire en page globale

## 11. Tests attendus (Playwright)

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
4. ✅ Cards mobile n'affichent pas contexte bien (déjà dans le contexte)
5. ✅ Modal création a bien fixé (defaultPropertyId, champ désactivé)

