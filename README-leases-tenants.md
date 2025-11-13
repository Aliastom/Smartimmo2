# Page Baux & Locataires

## Vue d'ensemble

La page `/leases-tenants` est une interface complète pour gérer les baux et locataires de manière centralisée. Elle utilise TanStack Query pour la gestion des données, avec un cache intelligent et des mises à jour optimistes.

## Architecture

### Composants principaux

- **`src/app/leases-tenants/page.tsx`** - Page principale avec tabs
- **`src/ui/leases-tenants/LeasesTable.tsx`** - Table des baux avec pagination
- **`src/ui/leases-tenants/TenantsTable.tsx`** - Table des locataires avec pagination
- **`src/ui/leases-tenants/LeaseFormModal.tsx`** - Modal de création/édition de bail
- **`src/ui/leases-tenants/TenantFormModal.tsx`** - Modal de création/édition de locataire
- **`src/ui/leases-tenants/FiltersBar.tsx`** - Barre de filtres et recherche

### Hooks TanStack Query

- **`src/ui/hooks/useLeases.ts`** - Hooks pour les baux (CRUD + cache)
- **`src/ui/hooks/useTenants.ts`** - Hooks pour les locataires (CRUD + cache)

### API Routes

- **`src/app/api/leases/route.ts`** - GET/POST des baux
- **`src/app/api/leases/[id]/route.ts`** - GET/PATCH/DELETE d'un bail
- **`src/app/api/tenants/route.ts`** - GET/POST des locataires
- **`src/app/api/tenants/[id]/route.ts`** - GET/PATCH/DELETE d'un locataire

## Fonctionnalités

### Onglet Baux
- ✅ Affichage des baux avec tri par date de début DESC
- ✅ Filtres : Bien, Type, Statut, Année, Mois
- ✅ Recherche textuelle
- ✅ Pagination
- ✅ Création/édition/suppression de baux
- ✅ Colonnes : Bien, Locataire, Type, Période, Loyer HC, Charges, Dépôt, Actions

### Onglet Locataires
- ✅ Affichage des locataires avec tri par nom
- ✅ Filtre : "A au moins un bail actif"
- ✅ Recherche textuelle
- ✅ Pagination
- ✅ Création/édition/suppression de locataires
- ✅ Colonnes : Nom, Email, Téléphone, Baux actifs, Actions
- ✅ Protection contre la suppression si baux actifs (409)

### Gestion des erreurs
- ✅ Toasts pour succès/erreur
- ✅ Gestion des erreurs 409 pour suppression de locataire avec baux
- ✅ Messages d'erreur clairs
- ✅ Rollback optimiste en cas d'erreur

### Performance
- ✅ Cache TanStack Query (5 minutes)
- ✅ Mises à jour optimistes
- ✅ Invalidation sélective des caches
- ✅ Pas de rechargement global

## Scénarios de test

### Test 1 : Création d'un locataire
1. Aller sur l'onglet "Locataires"
2. Cliquer sur "Nouveau locataire"
3. Remplir le formulaire (prénom, nom, email requis)
4. Cliquer sur "Enregistrer"
5. ✅ Le locataire apparaît dans la table
6. ✅ Toast de succès affiché
7. ✅ Pas de rechargement global

### Test 2 : Édition d'un locataire
1. Cliquer sur l'icône ✏️ d'un locataire
2. Modifier les informations
3. Cliquer sur "Enregistrer"
4. ✅ La ligne est mise à jour
5. ✅ Toast de succès affiché

### Test 3 : Suppression d'un locataire sans bail
1. Cliquer sur l'icône 🗑 d'un locataire sans bail
2. Confirmer la suppression
3. ✅ Le locataire disparaît de la table
4. ✅ Toast de succès affiché

### Test 4 : Suppression d'un locataire avec bail actif
1. Cliquer sur l'icône 🗑 d'un locataire avec bail actif
2. Confirmer la suppression
3. ✅ Toast d'erreur : "Impossible de supprimer : locataire lié à des baux actifs"
4. ✅ Le locataire reste dans la table
5. ✅ Bouton "Voir ses baux" disponible

### Test 5 : Création d'un bail
1. Aller sur l'onglet "Baux"
2. Cliquer sur "Nouveau bail"
3. Sélectionner une propriété et un locataire existants
4. Remplir les informations du bail
5. Cliquer sur "Enregistrer"
6. ✅ Le bail apparaît dans la table
7. ✅ Tri par date de début DESC respecté
8. ✅ Toast de succès affiché

### Test 6 : Édition d'un bail
1. Cliquer sur l'icône ✏️ d'un bail
2. Modifier les informations
3. Cliquer sur "Enregistrer"
4. ✅ La ligne est mise à jour
5. ✅ Pagination/filtres restent stables
6. ✅ Toast de succès affiché

### Test 7 : Suppression d'un bail
1. Cliquer sur l'icône 🗑 d'un bail
2. Confirmer la suppression
3. ✅ Le bail disparaît de la table
4. ✅ Pas de rechargement général
5. ✅ Toast de succès affiché

### Test 8 : Filtres et recherche
1. Utiliser les filtres (Bien, Type, Statut, etc.)
2. Utiliser la recherche textuelle
3. ✅ Les résultats sont filtrés correctement
4. ✅ La pagination se met à jour
5. ✅ Bouton "Effacer les filtres" fonctionne

### Test 9 : Navigation entre onglets
1. Basculer entre "Baux" et "Locataires"
2. ✅ Chaque onglet garde son état (filtres, page)
3. ✅ Pas de rechargement des données déjà en cache

### Test 10 : "Voir ses baux" depuis un locataire
1. Cliquer sur "Voir ses baux" d'un locataire
2. ✅ Bascule automatiquement sur l'onglet "Baux"
3. ✅ Filtre automatiquement sur ce locataire
4. ✅ Affiche uniquement les baux de ce locataire

## Commandes de test

```bash
# Démarrer le serveur de développement
npm run dev

# Accéder à la page
http://localhost:3000/leases-tenants
```

## Notes techniques

- **Pas de modification du PropertyDrawer** : Cette page est complètement indépendante
- **TanStack Query** : Gestion du cache et des mutations
- **Suppression en cascade** : Les baux sont supprimés automatiquement si le locataire est supprimé (grâce à `onDelete: Cascade` dans Prisma)
- **Validation côté API** : Schémas Zod pour valider les données
- **UI cohérente** : Réutilise les composants existants (ActionButtons, toasts)
- **Performance** : Pas de rechargement global, cache intelligent
