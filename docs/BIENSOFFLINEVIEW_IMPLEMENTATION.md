# 📱 BiensOfflineView - Implémentation

## Vue d'ensemble

`BiensOfflineView` est une vue dédiée pour l'App Shell offline qui charge les biens depuis IndexedDB sans dépendre du routing Next.js.

## Caractéristiques

✅ **100% client-side** - Pas de Server Components  
✅ **Pas de routing Next.js** - Pas de `useRouter()` ni `useSearchParams()`  
✅ **Chargement depuis IndexedDB** - Via `PropertyRepositoryOffline`  
✅ **Filtrage/Tri/Pagination local** - Géré avec `useState` (pas de query params)  
✅ **Réutilise les composants UI** - Table, StatCard, SearchInput, etc.

## Structure

```
src/app/app/views/BiensOfflineView.tsx
```

## Fonctionnalités

### 1. Chargement des données

- Charge depuis IndexedDB via `getPropertyRepositoryOffline().getAll()`
- Gestion du loading et des erreurs
- Recharge automatique quand les filtres changent

### 2. Filtres locaux

- **Recherche** : Par nom, adresse, ville
- **Statut** : Tous, Occupés, Vacants (à améliorer avec les baux)
- **Archivés** : Inclure/exclure les biens archivés

### 3. Pagination

- Pagination côté client avec `useState`
- 10 items par page par défaut
- Navigation Précédent/Suivant

### 4. Statistiques

- Calculées localement depuis les données filtrées
- 3 cartes : Total, Occupés, Vacants

## Utilisation

```tsx
<BiensOfflineView organizationId={organizationId} />
```

## TODO / Améliorations futures

1. **Intégration des baux** : Pour déterminer correctement le statut occupé/vacant
2. **Modales d'édition/suppression** : Créer les modales pour éditer/supprimer un bien
3. **Navigation vers détail** : Implémenter la navigation vers la vue détaillée du bien dans l'App Shell
4. **Tri** : Ajouter le tri par colonnes
5. **Export** : Permettre l'export des données

## Intégration dans AppShellClient

La vue est intégrée dans `AppShellClient.tsx` :

```tsx
case 'biens':
  if (!organizationId) {
    return <MessageErreur />;
  }
  return <BiensOfflineView organizationId={organizationId} />;
```
