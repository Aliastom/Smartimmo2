'use client';

/**
 * Sidebar UI V2 pour l'App Shell
 * Même interface que AppShellSidebar, style visuel différent
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getSidebarItemsBySection,
  SIDEBAR_COLLAPSIBLE_SECTIONS,
  SIDEBAR_DEFAULT_OPEN_DESKTOP,
  getSectionForView,
  type SidebarItemConfig,
  type SidebarSectionId,
} from '@/features/layout/sidebarConfig';
import { SidebarSyncIndicator } from '@/components/offline/SidebarSyncIndicator';
import { LogoWithSyncStatus } from '@/components/offline/LogoWithSyncStatus';
import { PropertySwitcher } from '@/components/property/PropertySwitcher';
import { PropertyContextCard } from '@/components/property/PropertyContextCard';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useSearchParams } from 'next/navigation';
import { AppShellUserDisplay } from '@/components/auth/AppShellUserDisplay';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import { buildViewPath, type ViewType } from '@/utils/appShellNavigation';
import { useAppSession } from '@/features/auth/useAppSession';

// Composant Property Context (identique à UnifiedSidebar, juste le style change)
function UI2PropertyContextSection({ searchParams }: { searchParams: URLSearchParams | null }) {
  const { organizationId: orgId } = useCurrentOrganization();
  const [propertyData, setPropertyData] = useState<any>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  
  const propertyId = searchParams?.get('propertyId') || '';
  const tab = searchParams?.get('tab') || 'transactions';
  
  useEffect(() => {
    if (!propertyId || !orgId) {
      setPropertyData(null);
      return;
    }
    
    let cancelled = false;
    
    async function loadProperty() {
      try {
        const propRepo = getPropertyRepositoryOffline();
        const prop = await propRepo.getById(propertyId, orgId);
        if (!cancelled && prop) {
          setPropertyData(prop);
        }
      } catch (error) {
        console.error('[UI2PropertyContextSection] Erreur chargement bien:', error);
      }
    }
    
    loadProperty();
    
    return () => {
      cancelled = true;
    };
  }, [propertyId, orgId]);
  
  if (!propertyId) {
    return null;
  }
  
  return (
    <div className="mb-4 pb-4 border-b border-gray-200 space-y-3">
      <PropertyContextCard
        propertyId={propertyId}
        onOpenSwitcher={() => setSwitcherOpen(true)}
        mode="app-shell"
      />
      
      {switcherOpen && (
        <PropertySwitcher
          currentPropertyId={propertyId}
          currentTab={tab}
          onNavigate={(newPropertyId, newTab) => {
            setSwitcherOpen(false);
          }}
          mode="app-shell"
          rentalMode={propertyData?.rentalMode}
          defaultOpen={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setSwitcherOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}

interface UI2SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

export function UI2Sidebar({
  currentView,
  onNavigate,
  collapsed: collapsedProp,
  onCollapsedChange,
  className,
}: UI2SidebarProps) {
  const router = useRouter();
  const sidebarContext = useSidebarOptional();
  const searchParams = useSearchParams();

  const STORAGE_KEY = 'smartimmo.sidebar.section';

  /** Ferme les autres groupes et n'ouvre que celui de l'item cliqué */
  const openOnlySection = useCallback((sectionId: SidebarSectionId | null) => {
    if (!sectionId || !SIDEBAR_COLLAPSIBLE_SECTIONS.includes(sectionId)) return;
    setSectionOpen((prev) => {
      const nextState: Record<string, boolean> = {};
      for (const id of SIDEBAR_COLLAPSIBLE_SECTIONS) {
        nextState[id] = id === sectionId;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      } catch {}
      return nextState;
    });
  }, []);

  const handleNavClick = (view: ViewType, e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const path = buildViewPath(view);
    router.push(path, { scroll: false });
    onNavigate(view);
    const sectionId = getSectionForView(view);
    openOnlySection(sectionId);
    if (sidebarContext && typeof window !== 'undefined' && window.innerWidth < 1024) {
      sidebarContext.setSidebarOpen(false);
    }
  };
  const { role } = useAppSession();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = collapsedProp ?? internalCollapsed;

  const toggleCollapse = () => {
    const next = !collapsed;
    if (collapsedProp === undefined) setInternalCollapsed(next);
    onCollapsedChange?.(next);
  };

  const sections = getSidebarItemsBySection(role || 'USER', true, true);

  const isItemActive = (item: SidebarItemConfig): boolean => {
    return currentView === item.appView;
  };

  const getStoredOpen = useCallback((): Record<string, boolean> => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      return {};
    }
  }, []);
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setSectionOpen(getStoredOpen());
  }, [getStoredOpen]);
  const isSectionOpen = (sectionId: SidebarSectionId): boolean => {
    if (!SIDEBAR_COLLAPSIBLE_SECTIONS.includes(sectionId)) return true;
    return sectionOpen[sectionId] !== false;
  };
  const toggleSection = (sectionId: SidebarSectionId) => {
    const next = !isSectionOpen(sectionId);
    setSectionOpen((prev) => {
      const nextState = { ...prev, [sectionId]: next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      } catch {}
      return nextState;
    });
  };


  return (
    <aside
      className={cn(
        'h-full bg-white border-r border-gray-200 transition-all duration-300 flex flex-col',
        collapsed ? 'w-16' : 'w-64 max-w-[85vw] sm:max-w-none',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <LogoWithSyncStatus size="md" />
            <span className="font-semibold text-gray-900 text-base">Smartimmo</span>
          </div>
        ) : (
          <div className="flex justify-center w-full">
            <LogoWithSyncStatus size="md" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className="ml-auto hidden lg:block hover:bg-gray-100 transition-colors duration-200"
          aria-label={collapsed ? 'Étendre la sidebar' : 'Réduire la sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-600" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden ui2-nav-container">
        {/* Property Context - affiché uniquement en vue property */}
        {currentView === 'property' && !collapsed && (
          <div className="p-4">
            <UI2PropertyContextSection searchParams={searchParams} />
          </div>
        )}
        
        {/* Navigation par sections : Dashboard + séparateur, puis Alertes, puis groupes dépliants */}
        <ul className={cn('mcd-menu', collapsed && 'collapsed')}>
          {sections.map(({ sectionId, sectionLabel, items }, sectionIndex) => {
            const isCollapsible = SIDEBAR_COLLAPSIBLE_SECTIONS.includes(sectionId);
            const open = isSectionOpen(sectionId);
            const isFirstBlock = sectionIndex === 0;
            const showSeparatorBeforePortfolio = !collapsed && sectionId === 'portfolio';
            return (
              <React.Fragment key={sectionId}>
                {/* Séparateur visuel entre Dashboard/Alertes et PORTFOLIO */}
                {showSeparatorBeforePortfolio && (
                  <li className="border-t-2 border-gray-300 my-3" style={{ listStyle: 'none' }} aria-hidden />
                )}
                {/* En-tête de section dépliable (PORTFOLIO, FINANCES, etc.) */}
                {sectionLabel && !collapsed && isCollapsible && (
                  <li style={{ listStyle: 'none' }} className={cn(!isFirstBlock && 'pt-2 mt-1 border-t border-gray-100')}>
                    <button
                      type="button"
                      onClick={() => toggleSection(sectionId)}
                      className="flex items-center gap-2 w-full px-4 py-1.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                      aria-expanded={open}
                    >
                      {sectionLabel}
                      {open ? <ChevronDown className="h-3.5 w-3.5 ml-auto" /> : <ChevronUp className="h-3.5 w-3.5 ml-auto" />}
                    </button>
                  </li>
                )}
                {/* Titre de section non dépliable (ex. dashboard sans label, admin) */}
                {sectionLabel && !collapsed && !isCollapsible && sectionId !== 'dashboard' && sectionId !== 'alerts' && (
                  <li className="pt-2 mt-1 border-t border-gray-100" style={{ listStyle: 'none' }}>
                    <div className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      {sectionLabel}
                    </div>
                  </li>
                )}
                {/* Items de la section (masqués si section repliée) */}
                {(!isCollapsible || open || collapsed) &&
                  items.map((item) => {
                    const isActive = isItemActive(item);
                    const IconComponent = item.icon;
                    const view = item.appView as ViewType;
                    const path = buildViewPath(view);
                    const discreet = item.isDiscreet;
                    return (
                      <li key={item.id}>
                        <a
                          href={path}
                          onClick={(e) => handleNavClick(view, e)}
                          className={cn(
                            isActive ? 'active' : '',
                            discreet && 'opacity-80'
                          )}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <IconComponent
                            className={cn('ui2-nav-icon', discreet && 'opacity-70')}
                            size={20}
                            strokeWidth={discreet ? 1.8 : 2}
                          />
                          <strong className={discreet ? 'text-gray-500 font-normal' : undefined}>{item.label}</strong>
                          <small>{item.description || 'Navigation'}</small>
                        </a>
                      </li>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </ul>
      </nav>

      {/* Footer - User display (réutilise AppShellUserDisplay) */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0">
        <AppShellUserDisplay />
      </div>
    </aside>
  );
}

