'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { SkipToContent } from '@/components/ui/SkipToContent';
import { AppVersionBadge } from './AppVersionBadge';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
  requiresAuth?: boolean;
}

export function AppShell({ children, className, requiresAuth }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Masquer la sidebar complètement sur les routes d'authentification et login
  const isAuthPage = pathname?.startsWith('/auth') || pathname === '/login';

  // Fermer la sidebar sur mobile après navigation
  useEffect(() => {
    if (sidebarOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Skip to content */}
      <SkipToContent />

      {/* Topbar - Visible sur toutes les pages sauf auth */}
      {!isAuthPage && (
        <Topbar 
          onMenuClick={toggleSidebar}
          showSearch={true}
        />
      )}

      {/* Mobile sidebar overlay - Masqué sur pages auth */}
      {!isAuthPage && sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Masquée sur pages auth */}
      {!isAuthPage && (
        <div className={cn(
          "fixed inset-y-0 left-0 z-30 lg:translate-x-0 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:top-16" // Laisser de l'espace pour la topbar sur desktop
        )}>
          <Sidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
        </div>
      )}

      {/* Main content */}
      <div className={cn(
        "flex-1 flex flex-col min-h-0",
        !isAuthPage && (sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"),
        !isAuthPage && "lg:pt-16" // Laisser de l'espace pour la topbar sur desktop
      )}
      >
        {/* Page content */}
        <main id="main-content" className={cn(
          "flex-1 p-4 sm:p-6 overflow-auto",
          className
        )}>
          {children}
        </main>
        
        {/* Footer avec version - Affiché uniquement si ce n'est pas une page d'auth */}
        {!isAuthPage && (
          <footer className="w-full flex justify-end items-center px-4 py-2 bg-gray-50 border-t border-gray-100 shrink-0">
            <AppVersionBadge />
          </footer>
        )}
      </div>
    </div>
  );
}
