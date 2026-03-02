'use client';

/**
 * Sidebar UI V2 pour l'App Shell
 * Même interface que AppShellSidebar, style visuel différent
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { sidebarConfig, getFilteredSidebarItems, type SidebarItemConfig } from '@/features/layout/sidebarConfig';
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

  // Navigation SPA pure (router.push) pour éviter reload en PWA standalone
  const handleNavClick = (view: ViewType, e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const path = buildViewPath(view);
    router.push(path, { scroll: false });
    onNavigate(view);
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

  // Filtrer les items (même logique que UnifiedSidebar)
  const filteredItems = getFilteredSidebarItems(
    role || 'USER',
    true,
    true
  );

  const mainItems = filteredItems.filter((item) => item.type === 'main');
  const adminItems = filteredItems.filter((item) => item.type === 'admin');
  const settingsItems = filteredItems.filter((item) => item.type === 'settings');
  const itemsToShowInMain = [...mainItems, ...settingsItems];

  // Déterminer si l'item est actif (même logique que UnifiedSidebar)
  const isItemActive = (item: SidebarItemConfig): boolean => {
    return currentView === item.appView;
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
        
        {/* Navigation principale - Structure comme l'exemple */}
        <ul className={cn('mcd-menu', collapsed && 'collapsed')}>
          {itemsToShowInMain.map((item) => {
            const isActive = isItemActive(item);
            const IconComponent = item.icon;
            const view = item.appView as ViewType;
            const path = buildViewPath(view);
            return (
              <li key={item.id}>
                <a
                  href={path}
                  onClick={(e) => handleNavClick(view, e)}
                  className={isActive ? 'active' : ''}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <IconComponent className="ui2-nav-icon" size={20} strokeWidth={2} />
                  <strong>{item.label}</strong>
                  <small>{item.description || 'Navigation'}</small>
                </a>
              </li>
            );
          })}

          {/* Séparateur Administration */}
          {adminItems.length > 0 && !collapsed && (
            <>
              <li className="pt-4 mt-4 border-t border-gray-200" style={{ listStyle: 'none', paddingTop: '1rem', marginTop: '1rem', borderTop: '1px solid #EEE' }}>
                <div className="px-5 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Administration
                </div>
              </li>
              {adminItems.map((item) => {
                const isActive = isItemActive(item);
                const IconComponent = item.icon;
                const view = item.appView as ViewType;
                const path = buildViewPath(view);
                return (
                  <li key={item.id}>
                    <a
                      href={path}
                      onClick={(e) => handleNavClick(view, e)}
                      className={isActive ? 'active' : ''}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <IconComponent className="ui2-nav-icon" size={20} strokeWidth={2} />
                      <strong>{item.label}</strong>
                      <small>{item.description || 'Navigation'}</small>
                    </a>
                  </li>
                );
              })}
            </>
          )}
        </ul>
      </nav>

      {/* Footer - User display (réutilise AppShellUserDisplay) */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0">
        <AppShellUserDisplay />
      </div>
    </aside>
  );
}

