'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { SkipToContent } from '@/components/ui/SkipToContent';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/utils/cn';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SyncStatusIndicator } from '@/components/offline/SyncStatusIndicator';
import { SidebarProvider, useSidebarOptional } from '@/contexts/SidebarContext';

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
  requiresAuth?: boolean;
  // Permet d'utiliser une sidebar personnalisée (pour app-shell)
  customSidebar?: React.ReactNode;
  // État initial de la sidebar personnalisée (collapsed uniquement, open est géré automatiquement)
  initialSidebarCollapsed?: boolean;
}

export function AppShell({ 
  children, 
  className, 
  requiresAuth,
  customSidebar,
  initialSidebarCollapsed = false,
}: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sidebarContext = useSidebarOptional();
  
  // Utiliser le contexte si disponible, sinon état local
  const [localSidebarOpen, setLocalSidebarOpen] = useState(false);
  const sidebarOpen = sidebarContext?.sidebarOpen ?? localSidebarOpen;
  const setSidebarOpen = sidebarContext?.setSidebarOpen ?? setLocalSidebarOpen;
  const toggleSidebar = sidebarContext?.toggleSidebar ?? (() => setLocalSidebarOpen(prev => !prev));
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed);
  
  // Masquer la sidebar complètement sur les routes d'authentification et login
  const isAuthPage = pathname?.startsWith('/auth') || pathname === '/login';
  
  // Détecter si on est sur la page property (pour masquer le bouton flottant)
  const isPropertyPage = searchParams?.get('view') === 'property';
  
  // Détecter si on est sur la page transactions (pour masquer le bouton flottant, géré par TransactionsPageCore)
  const isTransactionsPage = searchParams?.get('view') === 'transactions';
  
  // Détecter si on est sur la page documents (pour masquer le bouton flottant, géré par DocumentsPageCore)
  const isDocumentsPage = searchParams?.get('view') === 'documents';
  
  // Détecter si on est sur la page locataires (pour masquer le bouton flottant, géré par TenantsPageCore)
  const isLocatairesPage = searchParams?.get('view') === 'locataires';
  
  // Détecter si on est sur la page dashboard (pour masquer le bouton flottant, géré par DashboardPageCore)
  // /app sans view = dashboard par défaut, donc on doit aussi masquer le bouton flottant
  const viewParam = searchParams?.get('view');
  const isDashboardPage = viewParam === 'dashboard' || (!viewParam && pathname === '/app');
  
  // Détecter si on est sur la page patrimoine (pour masquer le bouton flottant, géré par PatrimoinePageCore)
  const isPatrimoinePage = searchParams?.get('view') === 'patrimoine';
  
  // Détecter si on est sur la page biens (pour masquer le bouton flottant, géré par PropertiesPageCore)
  const isBiensPage = searchParams?.get('view') === 'biens';
  
  // Détecter si on est sur la page baux (pour masquer le bouton flottant, géré par LeasesPageCore)
  const isBauxPage = searchParams?.get('view') === 'baux';
  
  // Détecter si on est sur la page échéances (pour masquer le bouton flottant, géré par EcheancesPageCore)
  const isEcheancesPage = searchParams?.get('view') === 'echeances';
  
  // Détecter si on est sur la page prêts (pour masquer le bouton flottant, géré par LoansPageCore)
  const isLoansPage = searchParams?.get('view') === 'loans';
  
  // Détecter si on est sur la page fiscal (pour masquer le bouton flottant, géré par FiscalPageCore)
  const isFiscalPage = searchParams?.get('view') === 'fiscal';
  
  // Détecter si on est sur la page synchronisation (pour masquer le bouton flottant, géré par PendingSyncView)
  const isSyncPage = searchParams?.get('view') === 'sync';
  
  // Détecter si on est sur la page paramètres (pour masquer le bouton flottant, géré par ParametresPageCore)
  const isParametresPage = searchParams?.get('view') === 'parametres';
  
  // Détecter si on est sur la page gestion déléguée (pour masquer le bouton flottant, géré par GestionDelegueePageCore)
  const isGestionDelegueePage = searchParams?.get('view') === 'gestion-deleguee';
  
  // Détecter si on est sur la page profil (pour masquer le bouton flottant, géré par ProfilPageCore)
  const isProfilPage = searchParams?.get('view') === 'profil';

  // Fermer la sidebar sur mobile après navigation (uniquement en mode normal avec pathname)
  useEffect(() => {
    if (!customSidebar && sidebarOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [pathname, customSidebar, sidebarOpen, setSidebarOpen]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Skip to content */}
      <SkipToContent />

      {/* Bouton hamburger flottant sur mobile - Masqué sur pages auth, property, transactions, documents, locataires, dashboard, patrimoine, biens, baux, échéances, prêts, fiscal, synchronisation, paramètres, gestion déléguée et profil (géré par PropertyHeader/TransactionsPageCore/DocumentsPageCore/TenantsPageCore/DashboardPageCore/PatrimoinePageCore/PropertiesPageCore/LeasesPageCore/EcheancesPageCore/LoansPageCore/FiscalPageCore/PendingSyncView/ParametresPageCore/GestionDelegueePageCore/ProfilPageCore) */}
      {!isAuthPage && !isPropertyPage && !isTransactionsPage && !isDocumentsPage && !isLocatairesPage && !isDashboardPage && !isPatrimoinePage && !isBiensPage && !isBauxPage && !isEcheancesPage && !isLoansPage && !isFiscalPage && !isSyncPage && !isParametresPage && !isGestionDelegueePage && !isProfilPage && (
        <Button
          variant="primary"
          size="icon"
          className={cn(
            "fixed top-4 left-4 z-50 lg:hidden",
            "h-12 w-12 rounded-full shadow-lg",
            "bg-sky-400 hover:bg-sky-500 text-white"
          )}
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {sidebarOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </Button>
      )}

      {/* Mobile sidebar overlay - Masqué sur pages auth */}
      {!isAuthPage && sidebarOpen && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 w-full h-screen z-[39] bg-black/20 backdrop-blur-sm lg:hidden"
          style={{ minHeight: '100vh', minHeight: '-webkit-fill-available' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Masquée sur pages auth */}
      {!isAuthPage && (
        <>
          {customSidebar ? (
            <>
              {/* Sidebar mobile - Overlay fixed */}
              <div className={cn(
                "fixed inset-y-0 left-0 z-40 transition-transform duration-300 lg:hidden",
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              )}>
                {customSidebar}
              </div>

              {/* Sidebar desktop - Fixed à gauche */}
              <div className={cn(
                "hidden lg:block lg:fixed lg:inset-y-0 lg:left-0 lg:z-30",
                sidebarCollapsed ? "lg:w-16" : "lg:w-64"
              )}>
                {customSidebar}
              </div>
            </>
          ) : (
            <>
              {/* Sidebar mobile - Overlay fixed */}
              <div className={cn(
                "fixed inset-y-0 left-0 z-40 transition-transform duration-300 lg:hidden",
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              )}>
                <Sidebar
                  collapsed={sidebarCollapsed}
                  onCollapsedChange={setSidebarCollapsed}
                />
              </div>

              {/* Sidebar desktop - Fixed à gauche */}
              <div className={cn(
                "hidden lg:block lg:fixed lg:inset-y-0 lg:left-0 lg:z-30",
                sidebarCollapsed ? "lg:w-16" : "lg:w-64"
              )}>
                <Sidebar
                  collapsed={sidebarCollapsed}
                  onCollapsedChange={setSidebarCollapsed}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* Main content */}
      <div className={cn(
        "flex-1 flex flex-col min-h-0 w-full",
        !isAuthPage && (sidebarCollapsed ? "lg:pl-16" : "lg:pl-64")
      )}
      >
        {/* Indicateur de synchronisation - Top right (masqué sur /app car géré par AppShellClient) */}
        {!isAuthPage && !pathname?.startsWith('/app') && (
          <div className="fixed top-4 right-4 z-50">
            <SyncStatusIndicator />
          </div>
        )}
        
        {/* Page content */}
        <main id="main-content" className={cn(
          "flex-1 p-4 sm:p-6 overflow-auto",
          className
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}
