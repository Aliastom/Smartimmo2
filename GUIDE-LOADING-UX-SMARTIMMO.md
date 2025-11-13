# Guide d'Usage - Système de Chargement & UX Async Smartimmo

## 📋 Vue d'ensemble

Ce guide présente le système unifié de gestion des états de chargement pour Smartimmo. Tous les composants respectent les règles temporelles et d'accessibilité définies dans la règle globale.

## ⏱️ Règles Temporelles

- **< 300ms** : Ne rien afficher (éviter le flash)
- **0.3-2s** : SKELETONS (shimmer) calqués sur le layout final
- **> 2s** : Barre de progression route + micro-texte contextuel
- **> 8s** : Action utilisateur (Réessayer/Annuler) + explication

## 🧩 Composants Disponibles

### 1. Skeleton - États de chargement shimmer

```tsx
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonList } from '@/components/ui';

// Skeleton de base
<Skeleton variant="row" className="h-4" />
<Skeleton variant="card" className="h-32" />
<Skeleton variant="circle" />

// Skeleton spécialisés
<SkeletonCard />
<SkeletonTable rows={5} columns={4} />
<SkeletonList items={3} />
```

### 2. LoadingDots - Animations inline

```tsx
import { LoadingDots, LoadingButton, InlineLoading } from '@/components/ui';

// Dans les boutons
<LoadingButton 
  isLoading={submitting}
  loadingText="Enregistrement"
>
  Sauvegarder
</LoadingButton>

// Inline
<InlineLoading text="Récupération des données" />

// Personnalisé
<LoadingDots size="sm" color="primary" />
```

### 3. RouteProgress - Barre de progression globale

```tsx
// Déjà intégré dans layout.tsx
// Pour contrôle manuel :
import { useRouteProgress } from '@/components/ui';

const { start, update, finish } = useRouteProgress();

// Démarrer
start();
// Mettre à jour
update(50);
// Terminer
finish();
```

### 4. BlockingOverlay - Actions longues

```tsx
import { BlockingOverlay, UploadOverlay, ExportOverlay } from '@/components/ui';

// Overlay générique
<BlockingOverlay
  show={isProcessing}
  label="Traitement en cours..."
  progress={progress}
  canCancel={true}
  onCancel={handleCancel}
/>

// Spécialisés
<UploadOverlay
  show={isUploading}
  filesCount={files.length}
  progress={uploadProgress}
  onCancel={cancelUpload}
/>

<ExportOverlay
  show={isExporting}
  exportType="PDF"
  onCancel={cancelExport}
/>
```

### 5. StateCard - États d'erreur/empty

```tsx
import { StateCard, ErrorState, EmptyState, OfflineState } from '@/components/ui';

// États spécialisés
<ErrorState
  title="Erreur de chargement"
  description="Impossible de récupérer les données"
  onRetry={refetch}
/>

<EmptyState
  title="Aucune transaction"
  description="Commencez par ajouter votre première transaction"
  onCreate={openCreateModal}
/>

<OfflineState onRetry={retry} />
```

### 6. SectionSuspense - Wrapper Suspense

```tsx
import { 
  SectionSuspense, 
  DashboardSuspense, 
  TableSuspense, 
  ChartSuspense 
} from '@/components/ui';

// Suspense générique
<SectionSuspense fallbackType="table" skeletonProps={{ rows: 8 }}>
  <TransactionTable />
</SectionSuspense>

// Spécialisés
<DashboardSuspense>
  <KPICards />
</DashboardSuspense>

<TableSuspense rows={10} columns={6}>
  <DocumentTable />
</TableSuspense>

<ChartSuspense>
  <RevenueChart />
</ChartSuspense>
```

### 7. Hook useLoadingDelay

```tsx
import { useLoadingDelay, useLoadingStates } from '@/components/ui';

// Simple
const showLoader = useLoadingDelay(isLoading, 300);

// Avancé avec états temporels
const { showSkeleton, showProgressBar, showUserActions } = useLoadingStates(
  isLoading, 
  startTime
);
```

## 🎯 Exemples d'Intégration par Page

### Dashboard - KPI Cards

```tsx
function Dashboard() {
  return (
    <div>
      <DashboardSuspense className="grid grid-cols-4 gap-4">
        <KPICards />
      </DashboardSuspense>
      
      <ChartSuspense className="mt-8">
        <RevenueChart />
      </ChartSuspense>
    </div>
  );
}
```

### Page Transactions

```tsx
function TransactionsPage() {
  const { data, isLoading, error, refetch } = useTransactions();
  const showLoader = useLoadingDelay(isLoading);

  if (error) {
    return <ErrorState onRetry={refetch} />;
  }

  if (!data?.length && !isLoading) {
    return <EmptyState title="Aucune transaction" onCreate={openModal} />;
  }

  return (
    <div>
      <TableSuspense rows={8} columns={6}>
        <TransactionTable data={data} />
      </TableSuspense>
    </div>
  );
}
```

### Formulaire avec Actions

```tsx
function TransactionForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form onSubmit={handleSubmit}>
      {/* Champs du formulaire */}
      
      <LoadingButton
        type="submit"
        isLoading={isSubmitting}
        loadingText="Enregistrement"
      >
        Sauvegarder
      </LoadingButton>
    </form>
  );
}
```

### Upload de Documents

```tsx
function DocumentUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  return (
    <>
      <UploadDropzone onUpload={handleUpload} />
      
      <UploadOverlay
        show={isUploading}
        filesCount={selectedFiles.length}
        progress={progress}
        onCancel={cancelUpload}
      />
    </>
  );
}
```

## ♿ Accessibilité

Tous les composants incluent :

- `aria-busy`, `role="progressbar"`, `aria-live`
- Support de `prefers-reduced-motion`
- Navigation clavier
- Textes explicites pour les lecteurs d'écran

## 🎨 Personnalisation

### Couleurs via DaisyUI

```tsx
// Utilise automatiquement les tokens DaisyUI
<Skeleton className="bg-base-200" />
<LoadingDots color="primary" />
```

### Animations réduites

```css
/* Automatiquement géré via prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .animate-shimmer {
    animation: none;
  }
}
```

## 🔧 Migration des Composants Existants

### Avant
```tsx
// ❌ Ancien spinner simple
{isLoading && <div className="spinner">Loading...</div>}
```

### Après
```tsx
// ✅ Nouveau système avec règles temporelles
const showLoader = useLoadingDelay(isLoading);
return showLoader ? <Skeleton variant="card" /> : <Content />;
```

## 📊 Exemples Pratiques par Contexte

### Listes & Tableaux
```tsx
<TableSuspense rows={6} columns={5}>
  <BauxTable />
</TableSuspense>
```

### Cartes & Tuiles
```tsx
<CardGridSuspense columns={3} items={6}>
  <PropertyCards />
</CardGridSuspense>
```

### Actions Bouton
```tsx
<LoadingButton isLoading={processing} loadingText="Traitement OCR">
  Lancer l'analyse
</LoadingButton>
```

### Requêtes Longues
```tsx
<BlockingOverlay
  show={isGeneratingReport}
  label="Génération du rapport..."
  progress={reportProgress}
  canCancel={true}
  onCancel={cancelReport}
/>
```

## ✅ Checklist de Validation

- [ ] Pas de flash < 300ms
- [ ] Skeletons miment la taille finale (pas de CLS)
- [ ] Barre de progression pour > 2s
- [ ] Actions utilisateur pour > 8s
- [ ] États d'erreur avec retry
- [ ] Support prefers-reduced-motion
- [ ] ARIA labels corrects
- [ ] Couleurs DaisyUI utilisées

## 🚀 Utilisation Recommandée

1. **Nouvelles pages** : Utilisez `SectionSuspense` par défaut
2. **Formulaires** : `LoadingButton` pour toutes les soumissions
3. **Tables** : `TableSuspense` avec lignes appropriées
4. **Uploads** : `UploadOverlay` obligatoire
5. **Erreurs** : `ErrorState` avec retry systématique

Cette règle est **PRIORITAIRE et PERSISTANTE** - elle doit être appliquée à tous les nouveaux développements sans qu'on ait besoin de la redemander.
