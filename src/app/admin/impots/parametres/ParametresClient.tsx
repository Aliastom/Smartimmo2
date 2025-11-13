/**
 * ParametresClient - Interface admin complète pour gérer les paramètres fiscaux
 * Avec 4 onglets: Versions, Types & Régimes, Compatibilités, Historique
 */

'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Settings, Download, Upload, BookOpen, RefreshCw, Cog, Zap, Plus, GitCompare } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';

// Import des composants d'onglets (à créer)
import { VersionsTab } from '@/components/admin/fiscal/VersionsTab';
import { TypesRegimesTab } from '@/components/admin/fiscal/TypesRegimesTab';
import { CompatibilitiesTab } from '@/components/admin/fiscal/CompatibilitiesTab';
import { HistoryTab } from '@/components/admin/fiscal/HistoryTab';
import { ImportTaxModal } from '@/components/admin/fiscal/ImportTaxModal';
import { ExportTaxModal } from '@/components/admin/fiscal/ExportTaxModal';
import { FiscalParametersHelpModal } from '@/components/admin/FiscalParametersHelpModal';
import { TaxSourceScrapeModal } from '@/components/admin/fiscal/TaxSourceScrapeModal';
import { SourceConfigModal } from '@/components/admin/fiscal/SourceConfigModal';

export default function ParametresClient() {
  const searchParams = useSearchParams();
  const compareCode = searchParams.get('compare');
  
  const [activeTab, setActiveTab] = useState('baremes');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [autoCompareCode, setAutoCompareCode] = useState<string | null>(null);
  const [scrapeModalOpen, setScrapeModalOpen] = useState(false);
  const [sourceConfigModalOpen, setSourceConfigModalOpen] = useState(false);
  
  // Nouveaux états pour les actions des versions
  const [createVersionOpen, setCreateVersionOpen] = useState(false);
  const [compareVersionsOpen, setCompareVersionsOpen] = useState(false);
  const [openfiscaHealthOpen, setOpenfiscaHealthOpen] = useState(false);
  
  // Détecter le paramètre compare dans l'URL
  useEffect(() => {
    if (compareCode) {
      setAutoCompareCode(compareCode);
      setActiveTab('baremes'); // S'assurer qu'on est sur l'onglet barèmes
    }
  }, [compareCode]);

  const handleImportSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };
  
  return (
    <div className="space-y-6 p-6">
      {/* ========== HEADER ========== */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Settings className="h-8 w-8 text-purple-600" />
          Paramètres fiscaux
        </h1>
        <p className="text-gray-600 mt-2">
          Gestion complète des barèmes fiscaux, types, régimes et compatibilités
        </p>
      </div>

      {/* Encart d'information */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-yellow-800">
                Configuration des paramètres fiscaux
              </h3>
              <button
                onClick={() => setShowHelpModal(true)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                Documentation complète
              </button>
            </div>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Configure ici les barèmes d'imposition (IR et prélèvements sociaux), les régimes fiscaux (Réel, Micro-foncier, LMNP) 
                et les compatibilités. Ces paramètres sont utilisés pour calculer automatiquement vos impôts et générer les déclarations fiscales.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========== BARRE D'ACTIONS (ICÔNES) ========== */}
      <TooltipProvider delayDuration={100}>
        <div className="flex items-center justify-center gap-1 bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
          {/* Configuration */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSourceConfigModalOpen(true)}
                className="p-2.5 rounded-lg hover:bg-purple-50 hover:text-purple-600 transition-colors group"
                aria-label="Configuration des sources"
              >
                <Cog className="h-6 w-6 text-gray-600 group-hover:text-purple-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Sources</p>
              <p className="text-xs text-gray-500">Configurer les sources de scraping</p>
            </TooltipContent>
          </Tooltip>

          {/* Séparateur */}
          <div className="h-8 w-px bg-gray-200 mx-1" />

          {/* Mettre à jour */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setScrapeModalOpen(true)}
                className="p-2.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors group"
                aria-label="Mettre à jour depuis sources"
              >
                <RefreshCw className="h-6 w-6 text-gray-600 group-hover:text-blue-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Mettre à jour</p>
              <p className="text-xs text-gray-500">Scraper les sources officielles</p>
            </TooltipContent>
          </Tooltip>

          {/* OpenFisca */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setOpenfiscaHealthOpen(!openfiscaHealthOpen)}
                className="p-2.5 rounded-lg hover:bg-yellow-50 hover:text-yellow-600 transition-colors group"
                aria-label="Vérifier OpenFisca"
              >
                <Zap className="h-6 w-6 text-gray-600 group-hover:text-yellow-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">OpenFisca</p>
              <p className="text-xs text-gray-500">Vérifier l'état d'OpenFisca</p>
            </TooltipContent>
          </Tooltip>

          {/* Séparateur */}
          <div className="h-8 w-px bg-gray-200 mx-1" />

          {/* Exporter */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setExportModalOpen(true)}
                className="p-2.5 rounded-lg hover:bg-green-50 hover:text-green-600 transition-colors group"
                aria-label="Exporter JSON"
              >
                <Download className="h-6 w-6 text-gray-600 group-hover:text-green-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Exporter</p>
              <p className="text-xs text-gray-500">Télécharger en JSON</p>
            </TooltipContent>
          </Tooltip>

          {/* Importer */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setImportModalOpen(true)}
                className="p-2.5 rounded-lg hover:bg-green-50 hover:text-green-600 transition-colors group"
                aria-label="Importer JSON"
              >
                <Upload className="h-6 w-6 text-gray-600 group-hover:text-green-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Importer</p>
              <p className="text-xs text-gray-500">Charger depuis JSON</p>
            </TooltipContent>
          </Tooltip>

          {/* Séparateur */}
          <div className="h-8 w-px bg-gray-200 mx-1" />

          {/* Nouvelle version */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCreateVersionOpen(true)}
                className="p-2.5 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors group"
                aria-label="Nouvelle version"
              >
                <Plus className="h-6 w-6 text-gray-600 group-hover:text-indigo-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Nouvelle version</p>
              <p className="text-xs text-gray-500">Créer une copie</p>
            </TooltipContent>
          </Tooltip>

          {/* Comparer versions */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCompareVersionsOpen(true)}
                className="p-2.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 transition-colors group"
                aria-label="Comparer versions"
              >
                <GitCompare className="h-6 w-6 text-gray-600 group-hover:text-orange-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Comparer</p>
              <p className="text-xs text-gray-500">Différences entre versions</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
      
      {/* ========== NAVIGATION PAR ONGLETS ========== */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="baremes">Barèmes fiscaux</TabsTrigger>
          <TabsTrigger value="types-regimes">Types & Régimes</TabsTrigger>
          <TabsTrigger value="compatibilites">Compatibilités</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="baremes" className="mt-6">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <VersionsTab 
              key={refreshTrigger} 
              autoCompareCode={autoCompareCode}
              onCompareComplete={() => setAutoCompareCode(null)}
              onCreateVersion={() => setCreateVersionOpen(true)}
              onCompareVersions={() => setCompareVersionsOpen(true)}
              onOpenfiscaHealth={() => setOpenfiscaHealthOpen(!openfiscaHealthOpen)}
              createVersionOpen={createVersionOpen}
              compareVersionsOpen={compareVersionsOpen}
              openfiscaHealthOpen={openfiscaHealthOpen}
              onCreateVersionClose={() => setCreateVersionOpen(false)}
              onCompareVersionsClose={() => setCompareVersionsOpen(false)}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="types-regimes" className="mt-6">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <TypesRegimesTab key={refreshTrigger} />
          </Suspense>
        </TabsContent>

        <TabsContent value="compatibilites" className="mt-6">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <CompatibilitiesTab key={refreshTrigger} />
          </Suspense>
        </TabsContent>

        <TabsContent value="historique" className="mt-6">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <HistoryTab key={refreshTrigger} />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Modals Import/Export */}
      <ImportTaxModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={handleImportSuccess}
      />
      
      <ExportTaxModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />

      {/* Modal d'aide/documentation */}
      <FiscalParametersHelpModal 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)} 
      />

      {/* Modal de scraping depuis sources officielles */}
      <TaxSourceScrapeModal
        open={scrapeModalOpen}
        onClose={() => {
          setScrapeModalOpen(false);
          setRefreshTrigger(prev => prev + 1); // Rafraîchir après scraping
        }}
        year={new Date().getFullYear()}
      />

      {/* Modal de configuration des sources */}
      <SourceConfigModal
        open={sourceConfigModalOpen}
        onClose={() => setSourceConfigModalOpen(false)}
      />
    </div>
  );
}

