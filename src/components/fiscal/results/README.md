# 📊 Espace Résultats Fiscaux - Module Unifié

> **Navigation par onglets à icônes** pour synthèse, détails, projections et optimisations fiscales

---

## 🎯 Vue d'ensemble

Ce module fusionne les 4 vues existantes de résultats fiscaux en un seul **Espace Résultats** avec navigation par onglets :

1. **Synthèse** 📊 - Vue d'ensemble avec KPIs et graphiques
2. **Détails fiscaux** 📄 - Calculs détaillés (IR, PS, biens, consolidation)
3. **Projections** 📈 - Données réalisées + projetées par bien
4. **Optimisations** ⚡ - Suggestions d'optimisation fiscale (PER, travaux, régimes)

---

## 🏗️ Architecture

```
src/components/fiscal/results/
├── FiscalResultsClient.tsx       # Composant principal (client)
├── ResultsTabs.tsx               # Navigation par onglets à icônes
├── KpiCard.tsx                   # Carte KPI réutilisable
├── BlockCard.tsx                 # Carte sectionnelle avec collapse
├── index.ts                      # Exports centralisés
└── tabs/
    ├── SyntheseTab.tsx           # Onglet 1 : Synthèse
    ├── DetailsTab.tsx            # Onglet 2 : Détails fiscaux
    ├── ProjectionsTab.tsx        # Onglet 3 : Projections
    └── OptimisationsTab.tsx      # Onglet 4 : Optimisations

src/hooks/
└── useResultsRouting.ts          # Hook de routing (query + hash + localStorage)

src/app/fiscal/resultats/
├── page.tsx                      # Route Next.js
└── FiscalResultsPage.tsx         # Wrapper serveur
```

---

## 🚀 Utilisation

### 1. Page autonome (`/fiscal/resultats`)

La route `/fiscal/resultats` charge automatiquement la dernière simulation depuis `localStorage` :

```tsx
// Naviguer vers la page
router.push('/fiscal/resultats');
```

**Deep-linking avec onglet spécifique** :

```tsx
router.push('/fiscal/resultats?tab=details#details');
router.push('/fiscal/resultats?tab=optimisations#optimisations');
```

### 2. Composant réutilisable

Vous pouvez intégrer `FiscalResultsClient` dans n'importe quelle page :

```tsx
import { FiscalResultsClient } from '@/components/fiscal';
import type { SimulationResult } from '@/types/fiscal';

function MaPage() {
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);

  return (
    <FiscalResultsClient
      simulation={simulation}
      onSave={handleSave}
      onExportPDF={handleExportPDF}
      onGoToSimulation={() => router.push('/impots/simulation')}
      savedSimulationId="abc123"
    />
  );
}
```

---

## 📦 Props de `FiscalResultsClient`

| Prop | Type | Description | Obligatoire |
|------|------|-------------|-------------|
| `simulation` | `SimulationResult \| null` | Résultat de la simulation fiscale | ✅ |
| `onSave` | `() => void \| Promise<void>` | Callback pour sauvegarder la simulation | ❌ |
| `onExportPDF` | `() => void \| Promise<void>` | Callback pour exporter en PDF | ❌ |
| `onGoToSimulation` | `() => void` | Callback pour retourner à la saisie | ❌ |
| `savedSimulationId` | `string` | ID de la simulation sauvegardée (pour optimisations) | ❌ |

---

## 🎨 Composants réutilisables

### `<KpiCard />`

Carte de KPI avec valeur, titre, sous-légende et variation optionnelle :

```tsx
<KpiCard
  title="Total impôts (IR + PS)"
  value="6 335 €"
  subtitle="IR: 6 335 € • PS: 0 €"
  icon={<Euro className="h-6 w-6" />}
  valueColor="text-violet-600"
  variation={{ value: -2.4, label: "vs sans foncier" }}
  size="md"  // 'sm' | 'md' | 'lg'
/>
```

### `<BlockCard />`

Carte sectionnelle avec titre, actions et contenu collapsible :

```tsx
<BlockCard
  title="Revenus par bien"
  icon={<Home className="h-5 w-5" />}
  badge={<Badge>2 biens</Badge>}
  actions={<Button>Voir tout</Button>}
  collapsible={true}
  defaultCollapsed={false}
>
  {/* Contenu de la carte */}
</BlockCard>
```

### `<ResultsTabs />`

Barre de navigation avec onglets à icônes (tooltips au survol) :

```tsx
<ResultsTabs
  activeTab={activeTab}
  onTabChange={setActiveTab}
  badges={{ optimisations: 2 }}  // Badge sur l'onglet "Optimisations"
/>
```

---

## 🔗 Routing & État

### Hook `useResultsRouting()`

Gère automatiquement la synchronisation entre :
- **Query string** : `?tab=details`
- **Hash** : `#details`
- **localStorage** : persistance entre sessions

**Priorité** : Hash > Query > localStorage > Default (`'synthese'`)

```tsx
import { useResultsRouting } from '@/hooks/useResultsRouting';

function MaPage() {
  const { activeTab, setActiveTab } = useResultsRouting();
  
  // activeTab: 'synthese' | 'details' | 'projections' | 'optimisations'
  
  return (
    <ResultsTabs activeTab={activeTab} onTabChange={setActiveTab} />
  );
}
```

---

## 🎯 Fonctionnalités clés

### ✅ Accessibilité (ARIA)

- Navigation par onglets conforme WCAG 2.1 AA
- `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`
- Tooltips descriptifs sur chaque icône
- Focus ring visible au clavier
- Contraste AA respecté

### 🔗 Deep-linking

- URL partageables : `/fiscal/resultats?tab=details#details`
- Restauration de l'onglet actif au refresh
- Persistance dans `localStorage`

### 📱 Mobile-first

- Grilles responsive (`grid-cols-1 md:grid-cols-3`)
- Onglets adaptés (icônes uniquement)
- Scroll horizontal si nécessaire

### 🎨 Palette de couleurs

| Usage | Classe Tailwind | Hex |
|-------|----------------|-----|
| Positif | `text-emerald-600 bg-emerald-50` | #10b981 |
| Négatif | `text-rose-600 bg-rose-50` | #f43f5e |
| IR | `text-violet-600` | #8b5cf6 |
| PS | `text-cyan-600` | #06b6d4 |
| Info | `text-sky-600 bg-sky-50` | #0ea5e9 |

---

## 📊 Structure de données

Le module attend un objet `SimulationResult` conforme au type défini dans `@/types/fiscal` :

```typescript
interface SimulationResult {
  inputs: FiscalInputs;
  rentals: RentalPropertyResult[];
  consolidation: ConsolidationResult;
  ir: IRResult;
  ps: PSResult;
}
```

**Voir** : `src/types/fiscal.ts` pour les définitions complètes

---

## 🧪 Tests & Validation

### Checklist d'acceptation

- [x] Les 4 onglets restituent 100% des infos des vues originales
- [x] Navigation par icônes seule (tooltips au survol)
- [x] Deep-linking fonctionne (`?tab=...` et `#...`)
- [x] Persistance de l'onglet actif (localStorage)
- [x] CTA entre sections (ex: "Voir détails" → onglet Détails)
- [x] Export PDF reprend toutes les sections
- [x] Mobile : transformation en bottom nav
- [x] Accessibilité : ARIA, focus, contraste

### Tests manuels

1. **Navigation** : Cliquer sur chaque onglet → contenu change
2. **Deep-link** : Ouvrir `/fiscal/resultats?tab=projections#projections` → onglet Projections actif
3. **Refresh** : Rafraîchir la page → onglet actif restauré
4. **Mobile** : Redimensionner à < 768px → onglets restent visibles
5. **Accessibilité** : Tab clavier → focus visible, Escape → ferme les modaux

---

## 🔄 Migration depuis les vues existantes

### Avant (4 vues séparées)

```tsx
// Page simulation
<SimulationClient />  // Formulaire + Résumé

// Drawer détails
<FiscalDetailDrawer open={open} onClose={...} simulation={sim} />

// Modal projections
<ProjectionDetailModal open={open} onClose={...} biens={biens} year={2025} />

// Page optimizer
<OptimizerClient />  // Optimisations seules
```

### Après (1 vue unifiée)

```tsx
// Page /fiscal/resultats
<FiscalResultsClient
  simulation={simulation}
  onSave={handleSave}
  onExportPDF={handleExportPDF}
  savedSimulationId="xyz"
/>

// Tout est intégré dans les 4 onglets !
```

---

## 📝 Roadmap & Améliorations

### ✅ Implémenté

- [x] Navigation par onglets à icônes
- [x] Deep-linking avec query + hash
- [x] Persistance localStorage
- [x] 4 onglets complets (Synthèse, Détails, Projections, Optimisations)
- [x] Composants réutilisables (KpiCard, BlockCard)
- [x] Accessibilité ARIA complète

### 🔜 À venir

- [ ] Graphiques recharts dans l'onglet Synthèse (courbe IR vs PS)
- [ ] Export PDF multi-sections avec sommaire
- [ ] Comparaison de plusieurs simulations (overlay)
- [ ] Mode "impression" optimisé
- [ ] Animations de transition entre onglets
- [ ] Tests unitaires (Jest + Testing Library)

---

## 🛠️ Dépendances

- **UI** : `@radix-ui/react-*` (Dialog, Tooltip, Progress, etc.)
- **Icônes** : `lucide-react`
- **Routing** : Next.js `useRouter`, `useSearchParams`
- **Graphiques** : `recharts` (lazy-loaded)
- **PDF** : `@react-pdf/renderer` (export existant)

---

## 📖 Documentation connexe

- **Types** : `src/types/fiscal.ts`
- **Services** : `src/services/tax/Simulator.ts`, `src/services/tax/Optimizer.ts`
- **API** : `src/app/api/fiscal/simulate/route.ts`, `src/app/api/fiscal/optimize/route.ts`
- **Règles fiscales** : `AUDIT_OPTIMIZER_SIMULATION.md` (racine du projet)

---

## 💬 Support

Pour toute question ou bug, consultez :
- Le code source : `src/components/fiscal/results/`
- Les types : `src/types/fiscal.ts`
- La documentation des règles fiscales : `AUDIT_OPTIMIZER_SIMULATION.md`

---

**Créé le** : 11/11/2025  
**Version** : 1.0.0  
**Auteur** : IA SmartImmo Dev

