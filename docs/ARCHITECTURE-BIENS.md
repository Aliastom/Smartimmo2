# Architecture Unifiée des Biens

## Vue d'ensemble

L'architecture des biens a été refactorisée pour éliminer les doublons et créer une expérience cohérente entre l'aperçu rapide et la vue détaillée.

## Structure

```
/properties                    → Liste des biens (vue globale)
  └─ PropertyDrawerLight       → Slide-over: aperçu léger + lien "Voir détails"

/biens/[id]                    → Page dédiée avec onglets
  ├─ /biens/[id]/              → Overview (KPIs, infos, baux, transactions)
  ├─ /biens/[id]/transactions  → Transactions filtrées par bien
  ├─ /biens/[id]/leases        → Baux du bien
  ├─ /biens/[id]/tenants       → Locataires du bien
  ├─ /biens/[id]/documents     → Documents du bien
  ├─ /biens/[id]/photos        → Galerie photos
  ├─ /biens/[id]/loans         → Prêts associés
  ├─ /biens/[id]/profitability → Analyse rentabilité
  └─ /biens/[id]/settings      → Paramètres du bien
```

## Composants Réutilisables

### Tables

- **`TransactionsTable`** : Table de transactions avec filtres
  - Props : `payments`, `loading`, `onEdit`, `onDuplicate`, `onDelete`, `showPropertyColumn`, `showLeaseColumn`
  - Utilisée dans : `/transactions`, `/biens/[id]/transactions`

- **`LeasesTable`** : Table de baux avec actions
  - Props : `leases`, `loading`, `onGeneratePdf`, `onGenerateReceipt`, `onAddPayment`, `onUploadSignedPdf`, `onEdit`, `onDelete`, `showPropertyColumn`, `showPaymentStatus`
  - Utilisée dans : `/leases-tenants`, `/biens/[id]/leases`

- **`TenantsTable`** : Table de locataires
  - Props : `tenants`, `loading`, `onEdit`, `onDelete`, `showPropertyColumn`
  - Utilisée dans : `/leases-tenants`, `/biens/[id]/tenants`

### Modales

- **`TransactionModal`** : Création/édition/duplication de transactions
  - Contextes : `global`, `property`, `lease`
  - Pré-remplissage automatique selon contexte

- **`LeasePdfModal`** : Génération de PDF de bail + envoi email
- **`RentReceiptModal`** : Génération de quittance + envoi email + enregistrement paiement

### Layout

- **`PropertyHeader`** : Header commun pour toutes les pages `/biens/[id]/*`
  - Breadcrumbs, titre, badges de statut
  - Navigation par onglets
  - Actions principales (Transaction, Nouveau bail)

## Slide-over vs Page Dédiée

### PropertyDrawerLight (Slide-over)

**Objectif** : Aperçu rapide sans édition lourde

**Contenu** :
- KPIs (Loyers, Cash-flow, Rendement)
- Informations générales
- 3 derniers baux actifs
- 5 dernières transactions
- Bouton "Voir détails" → `/biens/[id]`

**Ne contient PAS** :
- Édition de bien (redirection vers `/biens/[id]/settings`)
- Tables complètes
- Filtres avancés

### Page Dédiée `/biens/[id]`

**Objectif** : Gestion complète du bien

**Fonctionnalités** :
- Navigation par onglets
- Filtres et recherche (transactions)
- Actions bulk
- Édition inline
- Upload de documents/photos
- Analyse de rentabilité

## Flux de Navigation

```
Page Biens (/properties)
  │
  ├─→ [Clic sur "Voir" d'un bien]
  │     └─→ PropertyDrawerLight (aperçu)
  │           └─→ [Clic "Voir détails"]
  │                 └─→ /biens/[id] (page complète)
  │
  └─→ [Clic sur nom du bien dans table]
        └─→ /biens/[id] (page complète)
```

## Cohérence des Données

### Clés de cache SWR

```typescript
// Hooks uniformes
usePayments({ propertyId, leaseId, y, m, dateFrom, dateTo, q })
useLeases({ propertyId })
useTenants({ propertyId })

// Clés : ['payments', filters], ['leases', filters], etc.
```

### Invalidation après modifications

- `mutate()` appelé après `POST`, `PATCH`, `DELETE`
- Toast informatif si la nouvelle transaction est masquée par les filtres

## État URL (Query Params)

Les filtres sont stockés dans l'URL pour :
- Deep-linking
- Partage d'URL
- Retour arrière du navigateur

**Exemple** : `/biens/[id]/transactions?category=LOYER&dateFrom=2025-01-01`

## Performance

- **Lazy loading** : Chaque onglet charge ses données à la demande
- **Pagination serveur** : API `GET /api/payments` avec `take=100` par défaut
- **Prefetch** : Données préchargées au survol des liens (Next.js)

## Styles Harmonisés

- **Espacements** : `p-4`, `p-6`, `space-y-6`
- **Ombres** : `shadow-card` (Tailwind personnalisé)
- **Badges** : Couleurs cohérentes pour statuts
- **Icônes** : Lucide, taille `16` ou `20`
- **Boutons** : Classes utilitaires uniformes

## DoD (Definition of Done)

- ✅ `/biens/[id]` accessible avec onglets fonctionnels
- ✅ Slide-over léger sans tables lourdes
- ✅ Tables réutilisées (zéro duplicat)
- ✅ Modales partagées entre sections
- ✅ Filtres dans URL persistants
- ✅ Rafraîchissement automatique après CRUD
- ✅ Pas d'erreurs de lint
- ✅ Cohérence UI/UX avec le reste de l'app

## Prochaines Améliorations

1. Virtualization pour tables > 200 lignes
2. Export Excel des transactions
3. Graphiques de rentabilité interactifs
4. Timeline d'événements (baux, travaux, incidents)
5. Alertes configurables (loyer impayé, fin de bail)

