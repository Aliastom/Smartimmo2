# 📱 App Shell Offline - BiensOfflineView Implémentée

## ✅ Ce qui a été créé

### 1. Vue BiensOfflineView

**Fichier :** `src/app/app/views/BiensOfflineView.tsx`

**Caractéristiques :**
- ✅ 100% client-side (`'use client'`)
- ✅ Pas de dépendance au routing Next.js (pas de `useRouter()`, `useSearchParams()`)
- ✅ Charge depuis IndexedDB via `PropertyRepositoryOffline`
- ✅ Filtrage/Tri/Pagination avec `useState` local (pas de query params)
- ✅ Réutilise les composants UI existants (Table, StatCard, SearchInput, etc.)

### 2. Intégration dans AppShellClient

**Fichier :** `src/app/app/AppShellClient.tsx`

**Modifications :**
- Import de `BiensOfflineView`
- Utilisation dans le switch case pour la vue 'biens'
- Gestion du cas où `organizationId` n'est pas disponible

## 🎯 Fonctionnalités

### Chargement des données

```tsx
const repo = getPropertyRepositoryOffline();
const filters = {
  search: search || undefined,
  includeArchived,
};
const data = await repo.getAll(organizationId, filters, { autoSync: false });
```

### Filtres locaux

- **Recherche** : Par nom, adresse, ville (via le repository)
- **Statut** : Tous, Occupés, Vacants (filtrage en local, à améliorer avec les baux)
- **Archivés** : Toggle pour inclure/exclure les biens archivés

### Pagination

- Pagination côté client
- 10 items par page par défaut
- Navigation Précédent/Suivant

### Statistiques

- Calculées localement depuis les données filtrées
- 3 cartes cliquables : Total, Occupés, Vacants

## 📋 Structure du code

```tsx
export function BiensOfflineView({ organizationId }: BiensOfflineViewProps) {
  // États locaux
  const [properties, setProperties] = useState<LocalProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'occupied' | 'vacant'>('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Chargement depuis IndexedDB
  useEffect(() => {
    // Charge via PropertyRepositoryOffline
  }, [organizationId, search, includeArchived]);

  // Filtrage et pagination locaux
  const filteredProperties = useMemo(() => { /* ... */ }, [properties, statusFilter, search]);
  const paginatedProperties = useMemo(() => { /* ... */ }, [filteredProperties, currentPage]);

  // Rendu
  return (
    <div>
      {/* Cartes de statistiques */}
      {/* Liste des biens avec table */}
      {/* Pagination */}
    </div>
  );
}
```

## 🔧 Différences avec BiensClient

| Aspect | BiensClient | BiensOfflineView |
|--------|-------------|------------------|
| Routing | `useRouter()`, `useSearchParams()` | Aucun, tout en local |
| Filtres | Query params dans l'URL | `useState` local |
| Navigation | Routing Next.js | Callbacks (TODO: navigation interne) |
| Données | Serveur + IndexedDB fallback | IndexedDB uniquement |
| Pagination | Serveur | Client |

## 🎯 Prochaines étapes / TODO

1. **Intégration des baux** : Charger les baux depuis IndexedDB pour déterminer correctement le statut occupé/vacant
2. **Modales d'édition/suppression** : Créer les modales pour éditer/supprimer un bien dans l'App Shell
3. **Navigation vers détail** : Implémenter la navigation vers la vue détaillée du bien dans l'App Shell (sans routing Next.js)
4. **Tri** : Ajouter le tri par colonnes
5. **Export** : Permettre l'export des données

## ✅ Résultat

La vue Biens fonctionne maintenant **100% offline** dans l'App Shell, sans dépendance au routing Next.js. Les données sont chargées depuis IndexedDB et toute la logique de filtrage/pagination est gérée côté client.
