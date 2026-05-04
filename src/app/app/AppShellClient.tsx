'use client';

/**
 * App Shell Client - Version simplifiée pour navigation interne
 * Fonctionne complètement offline sans routing Next.js
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { UI2Provider } from '@/components/ui2/UI2Provider';
import { SyncStatusIndicator } from '@/components/offline/SyncStatusIndicator';
import { useFullSync } from '@/hooks/offline/useFullSync';
import { useSyncStatus } from '@/hooks/offline/useSyncStatus';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useAppSession } from '@/features/auth/useAppSession';
import { Card, CardContent } from '@/components/ui/Card';
import { logToServer } from '@/lib/utils/logger';
import { PropertiesPageCore } from '@/features/properties/PropertiesPageCore';
import { TenantsPageCore } from '@/features/tenants/TenantsPageCore';
import { LeasesPageCore } from '@/features/leases/LeasesPageCore';
import { TransactionsPageCore } from '@/features/transactions/TransactionsPageCore';
import { DashboardPageCore } from '@/features/dashboard/DashboardPageCore';
import { DocumentsPageCore } from '@/features/documents/DocumentsPageCore';
import { EcheancesPageCore } from '@/features/echeances/EcheancesPageCore';
import { LoansPageCore } from '@/features/loans/LoansPageCore';
import { FiscalPageCore } from '@/features/fiscal/FiscalPageCore';
import { PatrimoinePageCore } from '@/features/patrimoine/PatrimoinePageCore';
import { ParametresPageCore } from '@/features/parametres/ParametresPageCore';
import { ProfilPageCore } from './views/ProfilPageCore';
import { AdminPageCore } from '@/features/admin/AdminPageCore';
import { PendingSyncView } from './views/PendingSyncView';
import { PropertyDetailView } from './views/PropertyDetailView';
import { GestionDelegueePageCore } from '@/features/gestion/GestionDelegueePageCore';
import { AlertesPageCore } from '@/features/alertes/AlertesPageCore';
import { LmnpPilotagePageCore } from '@/features/lmnp/LmnpPilotagePageCore';
import { MarketPageCore } from '@/features/market/MarketPageCore';
import { AppShellSidebar } from './AppShellSidebar';
import { UI2Sidebar } from '@/components/ui2/app-shell/UI2Sidebar';
import { AppShell } from '@/components/layout/AppShell';
import { AppShellAuthGuard } from './components/AppShellAuthGuard';
import { ensureMigrationToV9 } from '@/lib/offline/db';
import { AppShellContextResolverProvider } from '@/contexts/AppShellContextResolver';
import { AppShellContent } from './components/AppShellContent';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { navigateToView, type ViewType } from '@/utils/appShellNavigation';
import { LocalDbStatusProvider, useLocalDbStatus } from '@/contexts/LocalDbStatusContext';
import { SelectedPeriodProvider } from '@/contexts/SelectedPeriodContext';
import { LocalDbUnavailableScreen } from '@/components/offline/LocalDbUnavailableScreen';
import { notify2 } from '@/lib/notify2';
import { RELEASES, getReleaseStorageKey } from '@/config/releases';
import {
  navAuditInstallFetchHook,
  navAuditInstallHistoryHook,
  navAuditLog,
  navAuditTakeSource,
} from '@/lib/dev/navAudit';

// ⚠️ GUARD DEV-ONLY : Protection anti-régression pour les onglets property offline
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  import('@/lib/dev/tabsOfflineGuard').then(({ initTabsOfflineGuard }) => {
    initTabsOfflineGuard();
  }).catch(() => {
    // Ignorer les erreurs de chargement (peut échouer en offline)
  });
}

type AppSearchParams = ReturnType<typeof useSearchParams>;

/** Query string dérivée (primitives) — ne pas mettre l’objet searchParams dans les deps useMemo. */
function readAppSearchPrimitives(searchParams: AppSearchParams) {
  const appQueryKey = searchParams.toString();
  const viewFromUrl = searchParams.get('view');
  const propertyIdParam = searchParams.get('propertyId') ?? '';
  const tabParam = searchParams.get('tab') ?? '';
  const leaseIdParam = searchParams.get('leaseId') ?? '';
  return { appQueryKey, viewFromUrl, propertyIdParam, tabParam, leaseIdParam };
}

const KNOWN_APP_VIEWS = new Set([
  'dashboard',
  'patrimoine',
  'biens',
  'locataires',
  'baux',
  'transactions',
  'lmnp',
  'lmnp-activities',
  'market',
  'documents',
  'echeances',
  'loans',
  'fiscal',
  'admin',
  'parametres',
  'sync',
  'property',
  'profil',
  'gestion-deleguee',
  'alertes',
]);

// Composant interne qui utilise le contexte
function AppShellClientContent() {
  // ⚠️ CRITIQUE: TOUS les hooks doivent être appelés AVANT tout return conditionnel
  // ⚠️ OPTIMISÉ : Précharger la session au boot (un seul appel /api/auth/me via React Query)
  useAppSession();
  
  // ⚠️ CRITIQUE: Vérifier le statut de la DB et afficher l'écran d'erreur si nécessaire
  const { status: dbStatus, setStatus } = useLocalDbStatus();
  
  const searchParams = useSearchParams();
  const { appQueryKey, viewFromUrl, propertyIdParam, tabParam, leaseIdParam } =
    readAppSearchPrimitives(searchParams);

  const currentView = useMemo<ViewType>(() => {
    const viewParam = viewFromUrl;
    if (viewParam === 'lmnp') {
      return 'lmnp-activities';
    }
    if (viewParam && KNOWN_APP_VIEWS.has(viewParam)) {
      return viewParam as ViewType;
    }
    return 'dashboard';
  }, [viewFromUrl]);

  const lastGoodViewRef = useRef<ViewType>('dashboard');
  const prevAuditViewRef = useRef<ViewType | null>(null);

  const safeCurrentView = useMemo(() => {
    if (viewFromUrl === 'property' && !propertyIdParam) {
      return lastGoodViewRef.current;
    }
    return currentView;
  }, [viewFromUrl, propertyIdParam, currentView]);

  useEffect(() => {
    if (viewFromUrl === 'property' && !propertyIdParam) {
      return;
    }
    lastGoodViewRef.current = safeCurrentView;
  }, [viewFromUrl, propertyIdParam, safeCurrentView]);

  useEffect(() => {
    if (viewFromUrl !== 'lmnp' || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'lmnp-activities');
    window.history.replaceState({ view: 'lmnp-activities' }, '', url.toString());
  }, [viewFromUrl]);

  useEffect(() => {
    if (prevAuditViewRef.current !== safeCurrentView) {
      navAuditLog(
        'view changed',
        prevAuditViewRef.current,
        '→',
        safeCurrentView,
        { query: appQueryKey, source: navAuditTakeSource() ?? '(next/router or init)' }
      );
      prevAuditViewRef.current = safeCurrentView;
    }
  }, [safeCurrentView, appQueryKey]);

  useEffect(() => {
    navAuditInstallFetchHook();
    navAuditInstallHistoryHook();
  }, []);
  
  const { organizationId } = useCurrentOrganization();
  // DÉSACTIVÉ : La full sync se fait uniquement depuis la page /app?view=sync
  // const { runFullSync, isDone, isRunning } = useFullSync(organizationId);
  const { status, isOnline, sync } = useSyncStatus(organizationId);
  
  // Écouter les événements de DB (indisponible, récupérée, OK)
  // ⚠️ CRITIQUE: Ce hook doit être appelé APRÈS tous les autres hooks
  useEffect(() => {
    const handleDbUnavailable = (event: CustomEvent) => {
      setStatus('UNAVAILABLE', event.detail?.error);
    };
    
    const handleDbRecovered = () => {
      setStatus('RECOVERED', null);
    };
    
    const handleDbOk = () => {
      setStatus('OK', null);
    };
    
    window.addEventListener('localdb:unavailable', handleDbUnavailable as EventListener);
    window.addEventListener('localdb:recovered', handleDbRecovered);
    window.addEventListener('localdb:ok', handleDbOk);
    
    return () => {
      window.removeEventListener('localdb:unavailable', handleDbUnavailable as EventListener);
      window.removeEventListener('localdb:recovered', handleDbRecovered);
      window.removeEventListener('localdb:ok', handleDbOk);
    };
  }, [setStatus]);
  
  // PHASE 5 — Si online → synchronisation silencieuse au chargement (et au refresh)
  // syncTriggeredRef évite de lancer plusieurs sync dans le même montage (re-renders).
  // Chaque refresh = nouveau montage => ref réinitialisée => sync se déclenche.
  const syncTriggeredRef = React.useRef(false);
  
  // Forcer la migration vers la version 9 au démarrage
  // ⚠️ CRITIQUE: Ce hook doit être appelé AVANT le return conditionnel
  useEffect(() => {
    ensureMigrationToV9().catch((error) => {
      console.error('[AppShellClient] Erreur lors de la migration:', error);
    });
  }, []); // Exécuter une seule fois au montage

  // Message produit one-shot après déploiement des correctifs de stabilité.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    for (const release of RELEASES) {
      const storageKey = getReleaseStorageKey(release);
      const alreadyShown = window.localStorage.getItem(storageKey) === '1';
      if (alreadyShown) continue;
      // Marquer avant affichage pour éviter le double toast en React Strict Mode.
      window.localStorage.setItem(storageKey, '1');
      // Laisser le Toaster (monté au niveau layout) s'hydrater avant d'émettre le toast.
      window.setTimeout(() => {
        notify2.info(release.toast);
      }, 250);
      break;
    }
  }, []);

  // ✅ Sync automatique au retour online (peu importe la page)
  // ⚠️ CRITIQUE: Ce hook doit être appelé AVANT le return conditionnel
  useEffect(() => {
    if (
      organizationId &&
      isOnline &&
      status === 'idle' &&
      !syncTriggeredRef.current &&
      sync
    ) {
      syncTriggeredRef.current = true;
      const phase5StartTime = performance.now();
      logToServer('[PHASE 5] 🔄 Synchronisation silencieuse - Démarrage (online détecté)');
      logToServer('[PHASE 5] 📤 Sync des opérations en attente (pendingOps → Supabase)');
      logToServer('[PHASE 5] 📥 Sync des nouvelles données de Supabase → IndexedDB');
      
      // Déclencher la sync silencieuse en arrière-plan (non bloquant)
      sync().then((results) => {
        // ⚠️ CRITIQUE: S'assurer que le statut est bien remis à 'idle' après la sync
        // (géré par useSyncStatus, mais on vérifie pour être sûr)
        const phase5EndTime = performance.now();
        const phase5Duration = Math.round(phase5EndTime - phase5StartTime);
        
        // Afficher le récapitulatif détaillé
        logToServer(`[PHASE 5] ✅ Synchronisation silencieuse terminée en ${phase5Duration}ms`);
        logToServer('[PHASE 5] 📊 Récapitulatif détaillé par table:');
        
        if (results && typeof results === 'object') {
          // Si results contient fromRemoteResults et toRemoteResults
          if ('fromRemoteResults' in results && 'toRemoteResults' in results) {
            const fromRemote = results.fromRemoteResults as Record<string, any>;
            const toRemote = results.toRemoteResults as Record<string, any>;
            
            // Afficher les résultats de sync depuis Supabase → IndexedDB
            logToServer('  📥 Sync Supabase → IndexedDB:');
            const fromRemoteEntries = Object.entries(fromRemote).sort(([a], [b]) => a.localeCompare(b));
            for (const [entity, result] of fromRemoteEntries) {
              if (result && typeof result === 'object' && 'synced' in result) {
                const synced = result.synced || 0;
                const errors = result.errors || 0;
                const status = errors > 0 ? '⚠️' : (synced > 0 ? '✅' : '⚪');
                const tableName = entity === 'lease' ? 'Lease' :
                                 entity === 'tenant' ? 'Tenant' :
                                 entity === 'loan' ? 'Loan' :
                                 // entity === 'payment' ? 'Payment' : // Payment removed - replaced by Transaction
                                 entity === 'transaction' ? 'Transaction' :
                                 entity === 'echeance' ? 'EcheanceRecurrente' :
                                 entity === 'nature' ? 'NatureEntity' :
                                 entity === 'category' ? 'Category' :
                                 entity === 'signal' ? 'Signal' :
                                 entity === 'documentType' ? 'DocumentType' :
                                 entity === 'fiscalType' ? 'FiscalType' :
                                 entity === 'fiscalRegime' ? 'FiscalRegime' :
                                 entity === 'fiscalCompatibility' ? 'FiscalCompatibility' :
                                 entity === 'managementCompany' ? 'ManagementCompany' :
                                 entity === 'property' ? 'Property' :
                                 entity === 'document' ? 'Document' :
                                 entity === 'documentLink' ? 'DocumentLink' :
                                 entity === 'fiscalSimulation' ? 'FiscalSimulation' :
                                 entity;
                logToServer(`    ${status} ${tableName}: ${synced} enregistrement(s) synchronisé(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}`);
              }
            }
            
            // Afficher les résultats de sync depuis IndexedDB → Supabase (pendingOps)
            const toRemoteTotal = Object.values(toRemote).reduce((sum, r: any) => sum + (r?.synced || 0), 0);
            if (toRemoteTotal > 0) {
              logToServer('  📤 Sync IndexedDB → Supabase (pendingOps):');
              const toRemoteEntries = Object.entries(toRemote).sort(([a], [b]) => a.localeCompare(b));
              for (const [entity, result] of toRemoteEntries) {
                if (result && typeof result === 'object' && 'synced' in result) {
                  const synced = result.synced || 0;
                  const errors = result.errors || 0;
                  if (synced > 0 || errors > 0) {
                    const status = errors > 0 ? '⚠️' : '✅';
                    logToServer(`    ${status} ${entity}: ${synced} opération(s) synchronisée(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}`);
                  }
                }
              }
            } else {
              logToServer('  📤 Sync IndexedDB → Supabase (pendingOps): Aucune opération en attente');
            }
          } else {
            // Format alternatif : results est directement un objet avec les entités
            for (const [entity, result] of Object.entries(results)) {
              if (result && typeof result === 'object' && 'synced' in result) {
                const synced = result.synced || 0;
                const errors = result.errors || 0;
                const status = errors > 0 ? '⚠️' : (synced > 0 ? '✅' : '⚪');
                logToServer(`    ${status} ${entity}: ${synced} enregistrement(s) synchronisé(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}`);
              }
            }
          }
        }
        
        logToServer('[PHASE 5] 🔔 Émission événement sync:refresh pour mise à jour UI');
      }).catch((err) => {
        // ⚠️ CRITIQUE: Si DB_UNAVAILABLE, ne pas logger d'erreur (l'écran de recovery est déjà affiché)
        const isDbUnavailable = err?.message?.includes('DB_UNAVAILABLE') || 
                                err?.name === 'DbUnavailableError';
        
        if (!isDbUnavailable) {
          logToServer(`[PHASE 5] ❌ Erreur lors de la synchronisation silencieuse: ${err?.message || String(err)}`, 'error');
        }
        syncTriggeredRef.current = false; // Permettre de réessayer en cas d'erreur
      });
    }
  }, [organizationId, isOnline, status, sync]); // Retirer currentView pour permettre sync sur toutes les pages

  // Réinitialiser quand offline pour permettre re-sync au retour online
  useEffect(() => {
    if (!isOnline) {
      syncTriggeredRef.current = false;
    }
  }, [isOnline]);

  const handleNavigation = useCallback((view: ViewType) => {
    navigateToView(view);
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const useUI2 = searchParams.get('ui2') !== 'false';

  const customSidebar = useMemo(
    () =>
      useUI2 ? (
        <UI2Sidebar
          currentView={currentView}
          onNavigate={(view) => {
            handleNavigation(view as ViewType);
          }}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      ) : (
        <AppShellSidebar
          currentView={currentView}
          onNavigate={(view) => {
            handleNavigation(view as ViewType);
          }}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      ),
    [useUI2, currentView, sidebarCollapsed, handleNavigation]
  );

  // Calculer la pageKey pour les animations (basée sur view/propertyId, SANS tab pour éviter remount)
  // ⚙️ OPTIMISATION: Ne pas inclure tab dans pageKey pour property view
  // -> Le header reste stable, seul le contenu de l'onglet change
  // ⚠️ CRITIQUE: Ce hook doit être appelé AVANT le return conditionnel
  const pageKey = useMemo(() => {
    const view = safeCurrentView;
    const propertyId = propertyIdParam;

    if (view === 'property' && propertyId) {
      return `${view}:${propertyId}`;
    }
    return `${view}:${propertyId || ''}`;
  }, [safeCurrentView, propertyIdParam]);

  // Rendre la vue active
  // ✅ Utiliser safeCurrentView pour éviter les remounts sur URL incomplète
  // ⚠️ CRITIQUE: Ce hook doit être appelé AVANT le return conditionnel
  const renderView = useMemo(() => {
    // ⚠️ CRITIQUE: Si DB est indisponible, ne pas monter les vues data-heavy
    // Elles déclencheraient des queries qui échoueraient silencieusement
    if (dbStatus === 'UNAVAILABLE') {
      // Retourner null car LocalDbUnavailableScreen sera affiché par le return conditionnel
      return null;
    }
    
    switch (safeCurrentView) {
      case 'dashboard':
        if (!organizationId) {
          return (
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="text-center text-gray-600">
                  Veuillez sélectionner une organisation pour afficher le dashboard.
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <DashboardPageCore
            mode="app-shell"
          />
        );
      case 'patrimoine':
        if (!organizationId) {
          return (
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="text-center text-gray-600">
                  Veuillez sélectionner une organisation pour afficher le patrimoine.
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <PatrimoinePageCore
            mode="app-shell"
          />
        );
      case 'biens':
        if (!organizationId) {
          return (
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="text-center text-gray-600">
                  Veuillez sélectionner une organisation pour afficher les biens.
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <PropertiesPageCore
            mode="app-shell"
          />
        );
      case 'locataires':
        if (!organizationId) {
          return (
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="text-center text-gray-600">
                  Veuillez sélectionner une organisation pour afficher les locataires.
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <TenantsPageCore
            mode="app-shell"
          />
        );
      case 'baux':
        if (!organizationId) {
          return (
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="text-center text-gray-600">
                  Veuillez sélectionner une organisation pour afficher les baux.
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <LeasesPageCore
            mode="app-shell"
          />
        );
      case 'transactions': {
        if (!organizationId) {
          return (
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="text-center text-gray-600">
                  Veuillez sélectionner une organisation pour afficher les transactions.
                </div>
              </CardContent>
            </Card>
          );
        }
        // ⚠️ CRITIQUE: Lire les paramètres de l'URL pour les passer à TransactionsPageCore
        const transactionPropertyId = propertyIdParam;
        
        return (
          <TransactionsPageCore
            mode="app-shell"
            initialPropertyId={transactionPropertyId}
          />
        );
      }
      case 'documents':
        if (!organizationId) {
          return (
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="text-center text-gray-600">
                  Veuillez sélectionner une organisation pour afficher les documents.
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <DocumentsPageCore
            mode="app-shell"
          />
        );
      case 'echeances':
        if (!organizationId) {
          return (
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="text-center text-gray-600">
                  Veuillez sélectionner une organisation pour afficher les échéances.
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <EcheancesPageCore
            mode="app-shell"
          />
        );
      case 'loans':
        if (!organizationId) {
          return (
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="text-center text-gray-600">
                  Veuillez sélectionner une organisation pour afficher les prêts.
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <LoansPageCore
            mode="app-shell"
          />
        );
      case 'fiscal':
        return (
          <FiscalPageCore
            mode="app-shell"
          />
        );
      case 'lmnp':
        return <LmnpPilotagePageCore />;
      case 'lmnp-activities':
        return <LmnpPilotagePageCore />;
      case 'market':
        return <MarketPageCore mode="app-shell" />;
      case 'admin':
        return (
          <AdminPageCore
            mode="app-shell"
            enablePrismaStudio={false}
          />
        );
      case 'parametres':
        return (
          <ParametresPageCore
            mode="app-shell"
          />
        );
      case 'profil':
        return (
          <ProfilPageCore
            mode="app-shell"
          />
        );
      case 'gestion-deleguee':
        if (!organizationId) {
          return (
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="text-center text-gray-600">
                  Veuillez sélectionner une organisation pour afficher la gestion déléguée.
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <GestionDelegueePageCore
            mode="app-shell"
          />
        );
      case 'alertes':
        return <AlertesPageCore mode="app-shell" />;
      case 'sync':
        if (!organizationId) {
          return (
            <div className="w-full">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-gray-600">
                    Veuillez sélectionner une organisation pour afficher les opérations en attente.
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        }
        return <PendingSyncView organizationId={organizationId} />;
      case 'property': {
        // ✅ GUARD 1: Vérifier organizationId
        if (!organizationId) {
          return (
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="text-center text-gray-600">
                  Veuillez sélectionner une organisation pour afficher le bien.
                </div>
              </CardContent>
            </Card>
          );
        }
        
        // ✅ GUARD 2: Lire les paramètres de l'URL pour le propertyId
        const propertyId = propertyIdParam;
        const propertyTab = tabParam || 'transactions';
        
        // ✅ GUARD 3: Si propertyId est absent, ne PAS démonter la vue précédente
        // (évite les écrans blancs lors de changements d'URL intermédiaires)
        if (!propertyId) {
          // Ne pas retourner null ou un écran vide qui causerait un remount
          // On garde la vue précédente ou on affiche un message stable
          return (
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="text-center text-gray-600">
                  Aucun bien sélectionné.
                </div>
              </CardContent>
            </Card>
          );
        }
        
        // ✅ GUARD 4: Normaliser les noms de tabs (anciens → nouveaux) et valider
        let normalizedTab = propertyTab;
        if (propertyTab === 'echeances') normalizedTab = 'deadlines';
        if (propertyTab === 'baux') normalizedTab = 'lease';
        
        const validTabs = ['transactions', 'documents', 'deadlines', 'lease', 'loans'];
        const validTab = validTabs.includes(normalizedTab) ? normalizedTab : 'transactions';
        
        // ✅ Key stable pour éviter les remounts inutiles
        const initialLeaseId = leaseIdParam || undefined;

        return (
          <PropertyDetailView 
            key="app-shell-property"
            propertyId={propertyId}
            organizationId={organizationId}
            tab={validTab}
            initialLeaseId={initialLeaseId}
          />
        );
      }
      default:
        return (
          <div className="w-full">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>
            <Card>
              <CardContent className="pt-6">
                <p className="text-gray-600">Dashboard (à implémenter)</p>
              </CardContent>
            </Card>
          </div>
        );
    }
  }, [safeCurrentView, organizationId, dbStatus, appQueryKey]);

  // ⚠️ CRITIQUE: Le rendu conditionnel se fait APRÈS tous les hooks
  // Si la DB est indisponible, afficher l'écran d'erreur ET ne pas monter les vues data-heavy
  if (dbStatus === 'UNAVAILABLE') {
    return <LocalDbUnavailableScreen />;
  }

  // ⚠️ GARDE: Si renderView est null (DB KO détectée dans useMemo), afficher l'écran de recovery
  if (!renderView) {
    return <LocalDbUnavailableScreen />;
  }

  return (
    <UI2Provider>
    <AppShellContextResolverProvider>
      <SidebarProvider>
        <SelectedPeriodProvider>
        <AppShellAuthGuard>
          <AppShell
            customSidebar={customSidebar}
            initialSidebarCollapsed={sidebarCollapsed}
          >
            {/* Contenu de la vue active avec animation */}
            <AppShellContent pageKey={pageKey}>
            {renderView}
            </AppShellContent>
          </AppShell>
        </AppShellAuthGuard>
        </SelectedPeriodProvider>
      </SidebarProvider>
    </AppShellContextResolverProvider>
    </UI2Provider>
  );
}

// Composant exporté qui enveloppe avec le contexte
export default function AppShellClient() {
  return <AppShellClientContent />;
}


