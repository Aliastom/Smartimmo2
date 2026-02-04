'use client';

/**
 * Sidebar unifiée pour les modes normal et app-shell
 * Utilise la configuration unique sidebarConfig.ts
 */

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { ChevronLeft, ChevronRight, Loader2, Shield } from 'lucide-react';
import { AppVersionBadge } from '@/components/layout/AppVersionBadge';
import { UserDisplay } from '@/components/auth/UserDisplay';
import { AppShellUserDisplay } from '@/components/auth/AppShellUserDisplay';
import { useAuth } from '@/hooks/useAuth';
import { useAppAuth } from '@/features/auth/useAppAuth';
import { useLoading } from '@/contexts/LoadingContext';
import { sidebarConfig, getFilteredSidebarItems, type SidebarItemConfig } from './sidebarConfig';
import { buildViewPath, type ViewType } from '@/utils/appShellNavigation';
import { SidebarSyncIndicator } from '@/components/offline/SidebarSyncIndicator';
import { PropertySwitcher } from '@/components/property/PropertySwitcher';
import { PropertyContextCard } from '@/components/property/PropertyContextCard';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useSidebarOptional } from '@/contexts/SidebarContext';

// Composant stable pour le Property Context (carte + switcher)
function PropertyContextSection({ searchParams }: { searchParams: URLSearchParams | null }) {
  const { organizationId: orgId } = useCurrentOrganization();
  const [propertyData, setPropertyData] = useState<any>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  
  // Extraire propertyId et tab depuis searchParams
  const propertyId = searchParams?.get('propertyId') || '';
  const tab = searchParams?.get('tab') || 'transactions';
  
  // ✅ Charger les données du bien (PASSIF - ne modifie jamais l'URL)
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
        console.error('[PropertyContextSection] Erreur chargement bien:', error);
      }
    }
    
    loadProperty();
    
    return () => {
      cancelled = true;
    };
  }, [propertyId, orgId]);
  
  // ❌ GUARD: Ne pas rendre si propertyId est absent (évite les états intermédiaires)
  if (!propertyId) {
    return null;
  }
  
  return (
    <div className="mb-4 pb-4 border-b border-gray-200 space-y-3">
      {/* Property Context Card - Carte discrète avec les infos du bien */}
      <PropertyContextCard
        propertyId={propertyId}
        onOpenSwitcher={() => {
          // ✅ Ouvrir le switcher (100% passif, aucune navigation)
          setSwitcherOpen(true);
        }}
        mode="app-shell"
      />
      
      {/* Property Switcher - Menu dropdown (monté uniquement quand ouvert) */}
      {switcherOpen && (
        <PropertySwitcher
          currentPropertyId={propertyId}
          currentTab={tab}
          onNavigate={(newPropertyId, newTab) => {
            // ✅ Navigation atomique déjà gérée par PropertySwitcher (pushState)
            // Le parent (AppShellClient) réagira automatiquement via useSearchParams
            // Fermer le switcher après navigation
            setSwitcherOpen(false);
          }}
          mode="app-shell"
          rentalMode={propertyData?.rentalMode}
          defaultOpen={true}
          onOpenChange={(isOpen) => {
            // Fermer quand le switcher se ferme (clic extérieur, etc.)
            if (!isOpen) {
              setSwitcherOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}

interface UnifiedSidebarProps {
  // Mode de fonctionnement
  mode: 'normal' | 'app-shell';
  // Props pour le mode app-shell uniquement
  currentView?: string;
  onNavigate?: (view: string) => void;
  // Props communs
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

interface UserInfo {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'USER';
}

export function UnifiedSidebar({
  mode,
  currentView,
  onNavigate,
  className,
  collapsed: collapsedProp,
  onCollapsedChange,
}: UnifiedSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isLoading } = useLoading();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = collapsedProp ?? internalCollapsed;
  
  // Récupérer le contexte sidebar pour fermer la sidebar en mode mobile après navigation
  const sidebarContext = useSidebarOptional();

  // Auth selon le mode
  const normalAuth = useAuth();
  const appAuth = useAppAuth();

  // Récupérer les infos utilisateur selon le mode
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (mode === 'normal') {
      setUser(normalAuth.user);
      setIsAuthenticated(normalAuth.isAuthenticated);
    } else {
      // Mode app-shell
      const appUser = appAuth.user;
      const localUser = appAuth.localUser;
      
      const userInfo: UserInfo | null = appUser
        ? {
            id: 'id' in appUser ? appUser.id : appUser.id,
            email: appUser.email || localUser?.email || '',
            name: 'name' in appUser 
              ? appUser.name 
              : appUser.user_metadata?.name || appUser.user_metadata?.full_name || localUser?.name,
            role: 'role' in appUser ? (appUser.role as 'ADMIN' | 'USER') : 'USER',
          }
        : localUser
        ? {
            id: localUser.id,
            email: localUser.email,
            name: localUser.name,
            role: 'USER' as const,
          }
        : null;
      
      setUser(userInfo);
      setIsAuthenticated(!!userInfo);
    }
  }, [mode, normalAuth.user, normalAuth.isAuthenticated, appAuth.user, appAuth.localUser]);

  const toggleCollapse = () => {
    const next = !collapsed;
    if (onCollapsedChange) onCollapsedChange(next);
    if (collapsedProp === undefined) setInternalCollapsed(next);
  };

  // Filtrer les items selon le rôle
  const filteredItems = getFilteredSidebarItems(
    user?.role,
    true, // includeAdmin
    true  // includeSettings
  );

  // Séparer les items par type
  // Dans les deux modes, on met tous les items (main + settings) dans la liste principale
  // Admin est séparé avec un séparateur visuel
  const mainItems = filteredItems.filter((item) => item.type === 'main');
  const adminItems = filteredItems.filter((item) => item.type === 'admin');
  const settingsItems = filteredItems.filter((item) => item.type === 'settings');
  
  // Dans les deux modes, on inclut les settings dans la liste principale
  // pour avoir exactement la même structure visuelle
  const itemsToShowInMain = [...mainItems, ...settingsItems];

  // Déterminer si l'item est actif
  const isItemActive = (item: SidebarItemConfig): boolean => {
    if (mode === 'normal') {
      // Pour les routes avec query params (comme /app?view=sync), vérifier le query param
      if (pathname === '/app' && item.normalPath.startsWith('/app?view=')) {
        const viewParam = searchParams?.get('view');
        const expectedView = item.normalPath.split('view=')[1];
        return viewParam === expectedView;
      }
      return pathname === item.normalPath || pathname.startsWith(item.normalPath + '/');
    } else {
      // Mode app-shell
      return currentView === item.appView;
    }
  };

  // Gérer la navigation
  // Rendre un item de navigation
  const renderNavItem = (item: SidebarItemConfig) => {
    const isActive = isItemActive(item);
    const itemLoading = mode === 'normal' ? isLoading(item.normalPath) : false;

    const itemContent = (
      <>
        {itemLoading ? (
          <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin sidebar-loader-orange" />
        ) : (
          <item.icon
            className={cn(
              'h-5 w-5 flex-shrink-0',
              isActive ? 'text-primary-600' : 'text-gray-500'
            )}
          />
        )}
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            {item.badge && (
              <span className="ml-auto px-2 py-0.5 text-xs bg-danger-100 text-danger-600 rounded-full">
                {item.badge}
              </span>
            )}
          </>
        )}
      </>
    );

    const itemClassName = cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-150 w-full text-left',
      'hover:bg-gray-100 hover:text-gray-900',
      isActive
        ? 'bg-primary-50 text-primary-600 border border-primary-200'
        : 'text-gray-600',
      collapsed && 'justify-center px-2'
    );

    const href = buildViewPath(item.appView as ViewType);

    return (
      <Link
        key={item.id}
        href={href}
        className={itemClassName}
        onClick={() => {
          // ⚠️ CORRECTION: Fermer la sidebar en mode mobile après navigation
          if (sidebarContext && typeof window !== 'undefined' && window.innerWidth < 1024) {
            sidebarContext.setSidebarOpen(false);
          }
        }}
      >
        {itemContent}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        'h-full bg-white border-r border-gray-200 transition-all duration-300 flex flex-col',
        collapsed ? 'w-16' : 'w-64 max-w-[85vw] sm:max-w-none',
        className
      )}
    >
      {/* Collapse button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">Navigation</span>
            {/* Indicateur de synchronisation discret (visible en mode app-shell uniquement) */}
            {mode === 'app-shell' && (
              <SidebarSyncIndicator />
            )}
          </div>
        ) : (
          // En mode collapsed, afficher l'indicateur (visible en mobile PWA à la place de l'icône hamburger)
          mode === 'app-shell' && (
            <div className="flex justify-center w-full">
              <SidebarSyncIndicator />
            </div>
          )
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className="ml-auto hidden lg:block"
          aria-label={collapsed ? 'Étendre la sidebar' : 'Réduire la sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation - prend tout l'espace disponible */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {/* Property Context - Carte + Switcher, affiché uniquement en vue property en mode app-shell */}
        {mode === 'app-shell' && currentView === 'property' && !collapsed && (
          <PropertyContextSection 
            searchParams={searchParams}
          />
        )}
        
        {/* Navigation principale */}
        {itemsToShowInMain.map(renderNavItem)}

        {/* Séparateur Administration */}
        {adminItems.length > 0 && !collapsed && (
          <div className="pt-4 mt-4 border-t border-gray-200">
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Administration
            </div>
          </div>
        )}

        {/* Navigation Administration */}
        {adminItems.map(renderNavItem)}
      </nav>

      {/* Badge de version - Au-dessus du profil utilisateur */}
      <div className="border-t border-gray-200 px-4 py-2 flex-shrink-0">
        {!collapsed ? (
          <div className="flex justify-center">
            <AppVersionBadge />
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="text-[8px] text-slate-400 font-mono">v</span>
            </div>
          </div>
        )}
      </div>

      {/* Utilisateur connecté - Le badge Administrateur est géré par UserDisplay - Toujours en bas */}
      {isAuthenticated && (
        <div className="border-t border-gray-200 p-4 flex-shrink-0">
          {!collapsed ? (
            mode === 'normal' ? (
              <UserDisplay />
            ) : (
              <AppShellUserDisplay />
            )
          ) : (
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#ff6b35] text-white flex items-center justify-center text-sm font-semibold">
                  {user?.name
                    ? user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    : user?.email?.[0].toUpperCase() || '👤'}
                </div>
                {/* Badge Administrateur pour la version collapsed */}
                {user && user.role === 'ADMIN' && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white">
                    <Shield className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
