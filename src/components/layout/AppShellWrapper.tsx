'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AppShell } from './AppShell';
import { UI2Sidebar } from '@/components/ui2/app-shell/UI2Sidebar';
import { sidebarConfig, findSidebarItemByPath, type ViewType } from '@/features/layout/sidebarConfig';

/**
 * Wrapper intelligent pour AppShell
 * 
 * Ne wrappe dans AppShell que si on n'est pas sur /app
 * (car AppShellClient gère déjà son propre AppShell)
 * 
 * Utilise UI2Sidebar pour toutes les pages normales (nouvelle sidebar)
 */
export default function AppShellWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Si on est sur /app, ne pas wrapper dans AppShell car AppShellClient le fait déjà
  if (pathname?.startsWith('/app')) {
    return <>{children}</>;
  }
  
  // Déterminer currentView depuis le pathname pour UI2Sidebar
  const currentView = useMemo(() => {
    if (!pathname) return 'dashboard';
    
    // Trouver l'item de sidebar correspondant au pathname
    const item = sidebarConfig.find((item) => {
      // Match exact
      if (item.normalPath === pathname) return true;
      // Match avec sous-routes (ex: /biens/123)
      if (pathname.startsWith(item.normalPath + '/')) return true;
      return false;
    });
    
    return item?.appView || 'dashboard';
  }, [pathname]);
  
  // Gérer la navigation : convertir appView → normalPath
  const handleNavigate = (view: ViewType) => {
    const item = sidebarConfig.find((item) => item.appView === view);
    if (item?.normalPath) {
      // Si le chemin contient des query params (ex: /app?view=sync), utiliser window.location
      if (item.normalPath.includes('?')) {
        window.location.href = item.normalPath;
      } else {
        router.push(item.normalPath);
      }
    }
  };
  
  // Utiliser UI2Sidebar pour toutes les pages normales
  const customSidebar = (
    <UI2Sidebar
      currentView={currentView}
      onNavigate={handleNavigate}
      collapsed={sidebarCollapsed}
      onCollapsedChange={setSidebarCollapsed}
    />
  );
  
  // Wrapper dans AppShell avec la nouvelle sidebar
  return (
    <AppShell customSidebar={customSidebar} initialSidebarCollapsed={sidebarCollapsed}>
      {children}
    </AppShell>
  );
}
