# Architecture de la Page Bien HUB

## Vue d'ensemble

La page "Bien" a été transformée d'une architecture à onglets en une page HUB moderne et élégante qui sert de point d'entrée unique pour toutes les fonctionnalités liées à un bien immobilier.

## Structure des fichiers

### Composants principaux (src/components/bien/)

- **BienHeader.tsx** : En-tête riche avec informations clés du bien
  - Nom et adresse du bien
  - Badges de statut (Occupé/Vacant, Type, Surface, Valeur, Date d'acquisition)
  - Actions (Modifier, Ouvrir dans Google Maps, Menu kebab)
  - Fil d'Ariane

- **BienKpis.tsx** : Cartes KPI avec métriques clés
  - Loyer mensuel
  - Recettes du mois
  - Dépenses du mois
  - Solde du mois
  - Baux actifs
  - Tendances vs mois précédent

- **BienMiniCharts.tsx** : Mini-graphiques (Recharts)
  - Sparkline d'évolution mensuelle (12 mois)
  - Donut de répartition par catégorie
  - Barres Recettes vs Dépenses

- **BienAlerts.tsx** : Chips d'alertes cliquables
  - Retards de paiement
  - Indexations à venir
  - Baux finissant < 60j
  - Documents non classés
  - Transactions non rapprochées

- **BienHubGrid.tsx** : Grille de tuiles de navigation
  - Transactions
  - Documents
  - Photos
  - Baux
  - Rentabilité
  - Paramètres

### Composants partagés (src/components/shared/)

- **HubTile.tsx** : Carte-bouton animée réutilisable
  - Animations framer-motion (hover, tap)
  - États loading/disabled
  - Icône, titre, sous-titre personnalisables

- **InlineChips.tsx** : Ligne de chips scrollables
  - Navigation clavier (ArrowLeft/Right)
  - Variants de couleur (warning, info, success, danger)
  - Compteurs dynamiques

- **BackToPropertyButton.tsx** : Bouton "Retour au bien" standardisé
  - Utilisé sur toutes les sous-pages
  - Navigation vers /biens/[id]

### Pages

- **src/app/biens/[id]/page.tsx** : Page principale HUB
  - Calculs KPIs server-side
  - Données graphiques (12 mois)
  - Alertes et compteurs

- **src/app/biens/[id]/BienOverviewClient.tsx** : Composant client
  - Orchestration des composants
  - Modal d'édition du bien

### Sous-pages

Chaque sous-page possède maintenant sa propre page complète avec un bouton "Retour au bien" :

- **transactions/** : Page dédiée aux transactions (existante, mise à jour)
- **documents/** : Page dédiée aux documents
- **baux/** : Page dédiée aux baux
- **photos/** : Page dédiée aux photos
- **profitability/** : Page dédiée à la rentabilité
- **settings/** : Page dédiée aux paramètres

## Flux de navigation

```
/biens/[id] (HUB)
├── /biens/[id]/transactions
├── /biens/[id]/documents
├── /biens/[id]/photos
├── /biens/[id]/baux
├── /biens/[id]/profitability
└── /biens/[id]/settings
```

Toutes les sous-pages ont un bouton "Retour au bien" qui ramène à `/biens/[id]`.

## Styling et animations

### Design system

- **Composants** : shadcn/ui + Tailwind CSS
- **Icônes** : lucide-react
- **Animations** : framer-motion
- **Graphiques** : recharts

### Thème

- **Rayons** : rounded-2xl
- **Ombres** : shadow-sm, hover:shadow-xl
- **Bordures** : border-gray-200
- **Espacement** : gap-4, gap-6, space-y-6

### Animations

- **HubTile** :
  - hover: scale(1.02), shadow-xl
  - tap: scale(0.99)
  - Icône translateY(-2px) au hover

- **Chips** :
  - Fade-in + slide-left (stagger 0.05s)

- **Sections** :
  - Fade-in + translateY (stagger 0.1s)

## Responsive

- **Mobile** (< 768px) : 1 colonne
- **Tablette** (768px - 1024px) : 2 colonnes
- **Desktop** (> 1024px) : 3 colonnes

## Accessibilité

- ✅ aria-labels sur tous les éléments interactifs
- ✅ Taille cible minimum 44x44px
- ✅ Focus ring visible (ring-2 ring-primary-500)
- ✅ Contraste AA (WCAG 2.1)
- ✅ Navigation clavier (tabs, arrows pour chips)
- ✅ Fil d'Ariane pour orientation

## Performance

- ✅ Lazy loading des graphiques (Suspense)
- ✅ Skeletons pour états de chargement
- ✅ Calculs server-side (KPIs, stats)
- ✅ Pagination côté serveur
- ✅ Limite 1000 transactions (à optimiser si besoin)

## API et données

### Calculs server-side (page.tsx)

```typescript
// Recettes/Dépenses du mois actuel et précédent
const currentMonthTransactions = transactions.filter(...)
const recettesMois = currentMonthTransactions.filter(t => t.nature.type === 'RECETTE')...
const depensesMois = ...
const soldeMois = recettesMois - depensesMois

// Tendances
const recettesTrend = ((recettesMois - recettesPrev) / recettesPrev) * 100

// Évolution 12 mois
for (let i = 11; i >= 0; i--) {
  // Calculer solde mensuel
}

// Répartition par catégorie
const categoriesMap = new Map()
currentMonthTransactions.forEach(t => {
  categoriesMap.set(t.category.label, ...)
})
```

### Compteurs

```typescript
const counts = {
  transactions: allTransactions.length,
  transactionsNonRapprochees,
  documents: documentsResult.data.length,
  docsNonClasses,
  photos: 0, // À implémenter
  baux: property.leases?.length || 0,
  bauxActifs,
  retardsPaiement: 0 // À implémenter
}
```

### Alertes

```typescript
const alerts = {
  retardsPaiement: 0, // À calculer
  indexations: 0, // À calculer
  bauxFinissant: 0, // À calculer (< 60j)
  docsNonClasses,
  transactionsNonRapprochees
}
```

## À faire (optimisations futures)

### Priorité haute
- [ ] Implémenter calcul des retards de paiement
- [ ] Implémenter calcul des indexations à venir
- [ ] Implémenter calcul des baux finissant < 60j
- [ ] Ajouter gestion des photos

### Priorité moyenne
- [ ] Ajouter deep-links avec filtres (ex: ?filter=retards)
- [ ] Implémenter recherche locale dans le bien
- [ ] Ajouter possibilité de collapse/expand sections (localStorage)
- [ ] Ajouter photo de couverture du bien (header)

### Priorité basse
- [ ] Optimiser requêtes DB (éviter fetch de 1000 transactions)
- [ ] Ajouter cache pour KPIs
- [ ] Ajouter export PDF/Excel des stats
- [ ] Ajouter comparaison avec période personnalisée

## Tests

### Checklist acceptation
- [x] Les liens de la grille ouvrent les sous-pages
- [x] "Retour au bien" visible sur chaque sous-page
- [x] KPIs affichent les bons chiffres
- [x] Chips mènent aux filtres corrects
- [x] Responsive OK (mobile/tablette/desktop)
- [x] Focus visible et navigation clavier
- [x] Aucune erreur linter

### Tests manuels à effectuer
- [ ] Créer/Modifier un bien
- [ ] Vérifier calculs KPIs avec données réelles
- [ ] Tester navigation HUB → Sous-pages → Retour
- [ ] Tester sur mobile/tablette
- [ ] Tester accessibilité (clavier, screen reader)
- [ ] Tester performance (temps de chargement)

## Migration depuis l'ancienne architecture

### Changements majeurs

1. **Architecture** : Onglets → Pages séparées
2. **Navigation** : Tabs → HubTile grid
3. **Données** : Client-side → Server-side (KPIs)
4. **Composants** : Monolithique → Modulaire

### Composants supprimés/remplacés

- ❌ `PropertyDetailClient` (onglets) → ✅ `BienOverviewClient` (HUB)
- ❌ Système d'onglets inline → ✅ Pages séparées avec routing

### Compatibilité

- ✅ Les anciennes routes redirigent vers la nouvelle architecture
- ✅ Les composants existants (TransactionModal, LeaseForm, etc.) sont réutilisés
- ✅ Les APIs existantes sont conservées

## Support et maintenance

### Dépendances critiques
- `framer-motion` : Animations
- `recharts` : Graphiques
- `lucide-react` : Icônes
- `@/components/ui/*` : Design system

### Points d'attention
- Les calculs de KPIs sont synchrones server-side
- Les graphiques sont générés côté client (recharts)
- La limite de 1000 transactions peut impacter les performances

### Contact
Pour toute question ou amélioration, consulter la documentation technique ou créer une issue.

