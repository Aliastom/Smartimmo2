# Changelog - Architecture Unifiée des Biens

## Date : 8 octobre 2025

## Résumé

Refactorisation complète de l'architecture "Bien" pour éliminer les doublons de code et créer une expérience utilisateur cohérente entre l'aperçu rapide (slide-over) et la vue détaillée (page dédiée).

## Changements Majeurs

### 1. Nouvelle Structure de Routing

**Ajouté** :
- `/biens/[id]/` - Layout avec header unifié et navigation par onglets
- `/biens/[id]/` (page) - Overview avec KPIs et aperçus
- `/biens/[id]/transactions` - Transactions filtrées par bien
- `/biens/[id]/leases` - Baux du bien
- `/biens/[id]/tenants` - Locataires du bien
- `/biens/[id]/documents` - Documents avec drag & drop
- `/biens/[id]/photos` - Galerie photos
- `/biens/[id]/loans` - Prêts associés avec tableau d'amortissement
- `/biens/[id]/profitability` - Analyse de rentabilité
- `/biens/[id]/settings` - Paramètres et édition du bien

**Fichiers créés** :
```
src/app/biens/[id]/
  ├── layout.tsx
  ├── page.tsx
  ├── transactions/page.tsx
  ├── leases/page.tsx
  ├── tenants/page.tsx
  ├── documents/page.tsx
  ├── photos/page.tsx
  ├── loans/page.tsx
  ├── profitability/page.tsx
  └── settings/page.tsx
```

### 2. Composants Réutilisables

**Nouveaux composants de table** :
- `src/ui/tables/TransactionsTable.tsx` - Table de transactions avec actions
- `src/ui/tables/LeasesTable.tsx` - Table de baux avec statut de paiement
- `src/ui/tables/TenantsTable.tsx` - Table de locataires

**Nouveaux composants de page** :
- `src/ui/properties/PropertyHeader.tsx` - Header avec breadcrumbs et onglets
- `src/ui/properties/PropertyOverviewClient.tsx` - Vue d'ensemble
- `src/ui/properties/PropertyTransactionsClient.tsx` - Gestion des transactions
- `src/ui/properties/PropertyLeasesClient.tsx` - Gestion des baux
- `src/ui/properties/PropertyTenantsClient.tsx` - Gestion des locataires
- `src/ui/properties/PropertyDocumentsClient.tsx` - Gestion des documents
- `src/ui/properties/PropertyPhotosClient.tsx` - Galerie photos
- `src/ui/properties/PropertyLoansClient.tsx` - Wrapper pour prêts
- `src/ui/properties/PropertyProfitabilityClient.tsx` - Wrapper pour rentabilité
- `src/ui/properties/PropertySettingsClient.tsx` - Wrapper pour paramètres

### 3. Slide-over Allégé

**Nouveau composant** :
- `src/ui/components/PropertyDrawerLight.tsx` - Version allégée du drawer

**Modifié** :
- `src/app/properties/page.tsx` - Utilise maintenant `PropertyDrawerLight` au lieu de `PropertyDrawer`

**Différences avec l'ancien drawer** :
- Pas d'onglets lourds, juste un aperçu
- Affiche uniquement KPIs, infos, 3 baux, 5 transactions
- Bouton "Voir détails" redirige vers `/biens/[id]`
- Pas d'édition inline (redirige vers les pages dédiées)

### 4. Harmonisation des Styles

**Badges de statut** :
- Vacant : `bg-gray-100 text-gray-800`
- Occupé : `bg-green-100 text-green-800`
- Travaux : `bg-yellow-100 text-yellow-800`

**Statut de paiement** :
- Payé : `bg-green-100 text-green-800`
- Partiel : `bg-orange-100 text-orange-800`
- Impayé : `bg-red-100 text-red-800`

**Catégories de transaction** :
- Loyer/Charges : `bg-green-100 text-green-800`
- Dépôt rendu/Pénalité : `bg-red-100 text-red-800`
- Avoir : `bg-blue-100 text-blue-800`
- Autre : `bg-gray-100 text-gray-800`

### 5. Gestion des Filtres

**État URL** :
- Les filtres (catégorie, date, recherche) sont stockés dans l'URL
- Permet le deep-linking et le partage d'URL
- Exemple : `/biens/[id]/transactions?category=LOYER&dateFrom=2025-01-01`

**Synchronisation** :
- `useSearchParams()` pour lire l'URL
- `useRouter().push()` pour mettre à jour l'URL
- Pas de perte d'état au rafraîchissement

### 6. Cohérence des Données

**Hook `usePayments`** :
- Accepte les filtres : `{ propertyId, leaseId, y, m, dateFrom, dateTo, q }`
- Retourne : `{ payments, total, count, isLoading, isError, mutate }`
- Clé de cache : `['payments', filters]`

**Invalidation** :
- Après `POST/PATCH/DELETE`, appel à `mutate()` pour rafraîchir
- Toast informatif si la nouvelle transaction est masquée par les filtres

### 7. Corrections de Bugs

**Bug de modification de transaction** :
- **Problème** : L'API validait systématiquement la cohérence `leaseId/propertyId` même quand ces valeurs n'avaient pas changé
- **Solution** : Validation conditionnelle uniquement si `propertyId` ou `leaseId` a changé
- **Fichier** : `src/app/api/payments/[id]/route.ts`

## Migration

### Pour les développeurs

**Ancienne approche** :
```tsx
// Avant : Drawer lourd avec tous les onglets
<PropertyDrawer property={property} isOpen={true} onClose={...} />
```

**Nouvelle approche** :
```tsx
// Maintenant : Drawer léger pour aperçu
<PropertyDrawerLight property={property} isOpen={true} onClose={...} />

// Ou : Lien direct vers page dédiée
<Link href={`/biens/${property.id}`}>Voir détails</Link>
```

### Pour les utilisateurs

**Navigation** :
1. Page `/properties` → Liste des biens
2. Clic sur "Voir" → Slide-over (aperçu rapide)
3. Clic sur "Voir détails" → Page complète `/biens/[id]`
4. Navigation par onglets dans la page complète

## Impact

### Performance
- ✅ Lazy loading par onglet (données chargées à la demande)
- ✅ Pagination serveur (100 dernières transactions par défaut)
- ✅ Prefetch Next.js au survol des liens

### Maintenabilité
- ✅ Zéro duplication de code (tables, modales, formulaires)
- ✅ Composants réutilisés dans toute l'app
- ✅ Single source of truth pour les statuts et catégories

### UX/UI
- ✅ Navigation cohérente avec breadcrumbs
- ✅ Actions contextuelles (Transaction, Nouveau bail)
- ✅ Filtres persistants dans l'URL
- ✅ Rafraîchissement automatique après modifications

## Tests Effectués

- ✅ Navigation entre onglets fonctionnelle
- ✅ Filtres de transactions enregistrés dans l'URL
- ✅ Modification de transaction (bug corrigé)
- ✅ Slide-over léger s'ouvre et redirige correctement
- ✅ Aucune erreur de lint
- ✅ Aucune erreur de build

## Prochaines Étapes (Optionnelles)

1. **Virtualization** : Pour tables > 200 lignes (react-window)
2. **Export Excel** : Bouton d'export des transactions
3. **Graphiques interactifs** : Charts.js pour rentabilité
4. **Timeline** : Historique des événements (baux, travaux)
5. **Alertes** : Notifications configurables (loyer impayé, fin de bail)
6. **Mobile** : Optimisation responsive des onglets

## Documentation

- 📄 `docs/ARCHITECTURE-BIENS.md` - Documentation complète de l'architecture
- 📄 `docs/CHANGELOG-ARCHITECTURE-BIENS.md` - Ce fichier

## Contributeurs

- Assistant AI (Implémentation complète)
- User (Spécifications et validation)

