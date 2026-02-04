'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePropertyHeaderActions, useHeaderActionsStatic } from './PropertyHeaderActionsContext';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { PropertyTabs } from '@/components/property/PropertyTabs';
import Link from 'next/link';
import { Menu, X, ArrowRight, ChevronRight, Home } from 'lucide-react';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import { navigateToView } from '@/utils/appShellNavigation';

interface PropertyHeaderProps {
  propertyId: string;
  propertyName: string;
  rentalMode?: string;
  mode?: 'normal' | 'app-shell';
  activeTab?: string;
  onTabChange?: (tabId: string) => void; // ✅ Callback pour changement d'onglet (app-shell uniquement)
  propertyAddress?: string;
  propertyPostalCode?: string;
  propertyCity?: string;
}

// Configuration des titres et descriptions pour chaque sous-page
const pageConfig: Record<string, { title: string; description: string; shortDescription?: string }> = {
  '/transactions': {
    title: 'Transactions',
    description: 'Suivi de vos revenus et dépenses immobilières',
    shortDescription: 'Revenus & dépenses',
  },
  '/documents': {
    title: 'Documents',
    description: 'Tous les documents liés à ce bien immobilier',
    shortDescription: 'Documents du bien',
  },
  '/photos': {
    title: 'Photos',
    description: 'Galerie photos de ce bien immobilier',
  },
  '/leases': {
    title: 'Baux',
    description: 'Gestion des baux de ce bien immobilier',
  },
  '/baux': {
    title: 'Baux',
    description: 'Gestion des baux de ce bien immobilier',
  },
  '/lease': {
    title: 'Baux',
    description: 'Gestion des baux de ce bien immobilier',
    shortDescription: 'Baux',
  },
  '/echeances': {
    title: 'Échéances',
    description: 'Charges et revenus récurrents pour ce bien',
    shortDescription: 'Récurrences',
  },
  '/deadlines': {
    title: 'Échéances',
    description: 'Charges et revenus récurrents pour ce bien',
    shortDescription: 'Récurrences',
  },
  '/loans': {
    title: 'Prêts',
    description: 'Gestion des prêts immobiliers de ce bien',
    shortDescription: 'Financement',
  },
};

// Composant séparé pour les actions qui se re-rend indépendamment
// Utilise useHeaderActionsStatic pour éviter les re-renders du header parent
const HeaderActions = React.memo(function HeaderActions() {
  const actions = useHeaderActionsStatic();
  return <>{actions && actions}</>;
});

// Mémoriser PropertyTabs pour éviter les re-renders inutiles
const MemoizedPropertyTabs = React.memo(PropertyTabs);

export const PropertyHeader = React.memo(function PropertyHeader({ propertyId, propertyName, rentalMode, mode = 'normal', activeTab, onTabChange, propertyAddress, propertyPostalCode, propertyCity }: PropertyHeaderProps) {
  // ✅ DEV-ONLY: Log de mount/unmount pour détecter les remounts
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PropertyHeader] 🟢 MOUNT (propertyId: ${propertyId}, activeTab: ${activeTab})`);
      return () => {
        console.log(`[PropertyHeader] 🔴 UNMOUNT (propertyId: ${propertyId}, activeTab: ${activeTab})`);
      };
    }
  }, []); // Empty deps = seulement mount/unmount, pas de re-render

  const pathname = usePathname();
  const sidebarContext = useSidebarOptional();
  
  // Déterminer la page active et son config
  let activePage = '/transactions';
  if (mode === 'app-shell' && activeTab) {
    activePage = `/${activeTab}`;
  } else {
    activePage = pathname?.replace(`/biens/${propertyId}`, '') || '/transactions';
  }
  const config = pageConfig[activePage] || pageConfig['/transactions'];
  
  // En mode app-shell, créer un header personnalisé avec titre + bouton, puis description + onglets
  if (mode === 'app-shell') {
    // Afficher le lien "Voir toutes les..." selon l'onglet actif
    const showAllTransactionsLink = activeTab === 'transactions';
    const showAllDocumentsLink = activeTab === 'documents';
    const showAllEcheancesLink = activeTab === 'deadlines' || activeTab === 'echeances';
    const showAllLeasesLink = activeTab === 'lease' || activeTab === 'baux';
    const showAllLoansLink = activeTab === 'loans';
    
    // Déterminer le lien et le texte selon l'onglet
    let allLinkHref = '';
    let allLinkText = '';
    let allLinkAriaLabel = '';
    if (showAllTransactionsLink) {
      allLinkHref = '/app?view=transactions';
      allLinkText = '← Voir toutes les transactions';
      allLinkAriaLabel = 'Voir toutes les transactions';
    } else if (showAllDocumentsLink) {
      allLinkHref = '/app?view=documents';
      allLinkText = '← Voir tous les documents';
      allLinkAriaLabel = 'Voir tous les documents';
    } else if (showAllEcheancesLink) {
      allLinkHref = '/app?view=echeances';
      allLinkText = '← Voir toutes les échéances';
      allLinkAriaLabel = 'Voir toutes les échéances';
    } else if (showAllLeasesLink) {
      allLinkHref = '/app?view=baux';
      allLinkText = '← Voir tous les baux';
      allLinkAriaLabel = 'Voir tous les baux';
    } else if (showAllLoansLink) {
      allLinkHref = '/app?view=loans';
      allLinkText = '← Voir tous les prêts';
      allLinkAriaLabel = 'Voir tous les prêts';
    }
    
    // Construire l'adresse complète pour le chip mobile
    const fullAddress = propertyAddress 
      ? [propertyAddress, propertyPostalCode, propertyCity].filter(Boolean).join(', ')
      : undefined;

    return (
      <div className="mb-4 sm:mb-6 space-y-3">
        {/* Ligne 1 : Titre + bouton à gauche, lien retour à droite */}
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Bouton hamburger mobile - Discret, aligné à gauche du titre */}
            {sidebarContext && (
              <button
                onClick={sidebarContext.toggleSidebar}
                className="lg:hidden flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] flex-shrink-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label={sidebarContext.sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
              >
                {sidebarContext.sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            )}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate min-w-0">{config.title}</h1>
            <div className="flex-shrink-0">
            <HeaderActions />
            </div>
          </div>
          {(showAllTransactionsLink || showAllDocumentsLink || showAllEcheancesLink || showAllLeasesLink || showAllLoansLink) && (
            mode === 'app-shell' ? (
              <button
                onClick={() => {
                  // ✅ APP-SHELL: Utiliser navigateToView pour éviter le prefetching Next.js
                  if (showAllTransactionsLink) navigateToView('transactions');
                  else if (showAllDocumentsLink) navigateToView('documents');
                  else if (showAllEcheancesLink) navigateToView('echeances');
                  else if (showAllLeasesLink) navigateToView('baux');
                  else if (showAllLoansLink) navigateToView('loans');
                }}
                className="text-xs sm:text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg px-2 sm:px-3 py-1.5 transition-colors inline-flex items-center gap-1 sm:gap-1.5 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 min-w-[40px] min-h-[40px] justify-center whitespace-nowrap"
                aria-label={allLinkAriaLabel}
              >
                {/* Desktop (sm et plus) : texte complet */}
                <span className="hidden sm:inline">{allLinkText}</span>
                {/* Mobile < sm: "Tout voir" + icône, ou icône seule sur très petites largeurs */}
                <span className="sm:hidden flex items-center gap-1">
                  <span className="hidden min-[360px]:inline">Tout voir</span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                </span>
              </button>
            ) : (
              <Link 
                href={allLinkHref} 
                className="text-xs sm:text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg px-2 sm:px-3 py-1.5 transition-colors inline-flex items-center gap-1 sm:gap-1.5 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 min-w-[40px] min-h-[40px] justify-center whitespace-nowrap"
                aria-label={allLinkAriaLabel}
              >
                {/* Desktop (sm et plus) : texte complet */}
                <span className="hidden sm:inline">{allLinkText}</span>
                {/* Mobile < sm: "Tout voir" + icône, ou icône seule sur très petites largeurs */}
                <span className="sm:hidden flex items-center gap-1">
                  <span className="hidden min-[360px]:inline">Tout voir</span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                </span>
              </Link>
            )
          )}
        </div>

        {/* Chip de contexte mobile - Visible uniquement sur mobile */}
        {propertyName && (
          <div className="sm:hidden">
            <div className="rounded-xl border border-base-200 bg-base-100/80 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Home className="h-4 w-4 text-gray-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {propertyName}
                  </div>
                  {fullAddress && (
                    <div className="text-xs opacity-70 text-gray-600 truncate mt-0.5">
                      {fullAddress}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Ligne 2 : Description avec 146A + onglets centrés sur la largeur totale de la page */}
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center w-full gap-3 lg:gap-0">
          {/* Description à gauche avec 146A - Visible uniquement sur sm+ (desktop) */}
          {(config.shortDescription || config.description) && (
            <p className="hidden sm:block text-sm sm:text-base text-gray-600 flex-shrink-0 z-10">
              {config.shortDescription || config.description} - {propertyName}
            </p>
          )}
          
          {/* Onglets - Mobile: pleine largeur, Desktop: centrés */}
          <div className="w-full lg:absolute lg:left-0 lg:right-0 lg:flex lg:items-center lg:justify-center lg:pointer-events-none">
            <div className="pointer-events-auto w-full lg:w-auto">
              <MemoizedPropertyTabs 
                propertyId={propertyId}
                activeTab={activeTab || 'transactions'}
                onTabChange={onTabChange}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Mode normal : utiliser SectionTitle classique
  const { actions } = usePropertyHeaderActions();
  return (
    <SectionTitle
      title={config.title}
      description={config.description}
      actions={actions}
    />
  );
}, (prevProps, nextProps) => {
  // Fonction de comparaison personnalisée pour React.memo
  // Le header ne doit se re-rendre que si les props importantes changent
  // On ignore les changements d'actions (qui viennent du contexte et changent souvent)
  return (
    prevProps.propertyId === nextProps.propertyId &&
    prevProps.propertyName === nextProps.propertyName &&
    prevProps.rentalMode === nextProps.rentalMode &&
    prevProps.mode === nextProps.mode &&
    prevProps.activeTab === nextProps.activeTab &&
    prevProps.onTabChange === nextProps.onTabChange &&
    prevProps.propertyAddress === nextProps.propertyAddress &&
    prevProps.propertyPostalCode === nextProps.propertyPostalCode &&
    prevProps.propertyCity === nextProps.propertyCity
  );
});

