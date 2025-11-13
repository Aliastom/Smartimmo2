'use client';

import React, { useState } from 'react';
import { 
  Skeleton, 
  SkeletonCard, 
  SkeletonTable, 
  SkeletonList,
  LoadingDots, 
  LoadingButton,
  BlockingOverlay,
  UploadOverlay,
  StateCard,
  ErrorState,
  EmptyState,
  SectionSuspense,
  TableSuspense,
  DashboardSuspense,
  useLoadingDelay 
} from '@/components/ui';

/**
 * Composant de démonstration pour tester tous les nouveaux composants
 * de loading et UX async selon la règle globale Smartimmo
 */
export function LoadingUXExamples() {
  const [isLoading, setIsLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showUploadOverlay, setShowUploadOverlay] = useState(false);
  const [progress, setProgress] = useState(0);

  const simulateLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  const simulateOverlay = () => {
    setShowOverlay(true);
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setShowOverlay(false);
          return 0;
        }
        return prev + 10;
      });
    }, 200);
  };

  const simulateUpload = () => {
    setShowUploadOverlay(true);
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setShowUploadOverlay(false);
          return 0;
        }
        return prev + 5;
      });
    }, 150);
  };

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Tests Loading UX - Smartimmo
        </h1>
        <p className="text-gray-600">
          Démonstration des composants de chargement selon la règle globale
        </p>
      </div>

      {/* Section 1: Skeletons */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">1. Composants Skeleton</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-medium">Skeleton de base</h3>
            <Skeleton variant="row" />
            <Skeleton variant="text" className="w-3/4" />
            <Skeleton variant="circle" />
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Skeleton Card</h3>
            <SkeletonCard />
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-2">Skeleton Table</h3>
          <SkeletonTable rows={4} columns={5} />
        </div>

        <div>
          <h3 className="font-medium mb-2">Skeleton List</h3>
          <SkeletonList items={3} />
        </div>
      </section>

      {/* Section 2: Loading Dots & Buttons */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">2. LoadingDots & Boutons</h2>
        
        <div className="flex gap-4 items-center flex-wrap">
          <LoadingDots size="sm" />
          <LoadingDots size="md" />
          <LoadingDots size="lg" />
        </div>

        <div className="flex gap-4 flex-wrap">
          <LoadingButton 
            isLoading={isLoading}
            onClick={simulateLoading}
            loadingText="Traitement"
          >
            Simuler chargement
          </LoadingButton>
          
          <LoadingButton 
            isLoading={false}
            className="btn-primary"
          >
            Bouton normal
          </LoadingButton>
        </div>
      </section>

      {/* Section 3: Overlays */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">3. Overlays Bloquants</h2>
        
        <div className="flex gap-4 flex-wrap">
          <button 
            className="btn btn-outline"
            onClick={simulateOverlay}
          >
            Tester BlockingOverlay
          </button>
          
          <button 
            className="btn btn-outline"
            onClick={simulateUpload}
          >
            Tester UploadOverlay
          </button>
        </div>
      </section>

      {/* Section 4: États */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">4. États d'Erreur & Vides</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <ErrorState 
              title="Erreur de test"
              description="Ceci est un exemple d'état d'erreur"
              onRetry={() => alert('Retry clicked!')}
            />
          </div>
          
          <div className="border rounded-lg p-4">
            <EmptyState 
              title="Pas de données"
              description="Exemple d'état vide"
              onCreate={() => alert('Create clicked!')}
              actionLabel="Créer"
            />
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <StateCard
            kind="info"
            title="Information"
            description="Ceci est un état informatif personnalisé"
            actionLabel="D'accord"
            onAction={() => alert('Info action!')}
          />
        </div>
      </section>

      {/* Section 5: Suspense Wrappers */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">5. Suspense Wrappers</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Dashboard Suspense</h3>
            <DashboardSuspense>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border">KPI 1</div>
                <div className="bg-white p-4 rounded-lg border">KPI 2</div>
                <div className="bg-white p-4 rounded-lg border">KPI 3</div>
                <div className="bg-white p-4 rounded-lg border">KPI 4</div>
              </div>
            </DashboardSuspense>
          </div>

          <div>
            <h3 className="font-medium mb-2">Table Suspense</h3>
            <TableSuspense>
              <div className="bg-white p-4 rounded-lg border">
                Contenu de table chargé
              </div>
            </TableSuspense>
          </div>
        </div>
      </section>

      {/* Overlays */}
      <BlockingOverlay
        show={showOverlay}
        label="Traitement en cours..."
        description="Veuillez patienter"
        progress={progress}
        canCancel={true}
        onCancel={() => setShowOverlay(false)}
      />

      <UploadOverlay
        show={showUploadOverlay}
        filesCount={3}
        currentFile="document.pdf"
        progress={progress}
        onCancel={() => setShowUploadOverlay(false)}
      />
    </div>
  );
}
