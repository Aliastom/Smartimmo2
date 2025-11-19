'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { SkipToContent } from '@/components/ui/SkipToContent';
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
        <>
          {/* Sidebar mobile - Overlay fixed */}
          <div className={cn(
            "fixed inset-y-0 left-0 z-30 transition-transform duration-300 lg:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "top-16" // Laisser de l'espace pour la topbar
          )}>
            <Sidebar
              collapsed={sidebarCollapsed}
              onCollapsedChange={setSidebarCollapsed}
            />
          </div>

          {/* Sidebar desktop - Relative dans le flow */}
          <div className={cn(
            "hidden lg:block lg:relative lg:top-16 lg:h-[calc(100vh-4rem)]",
            sidebarCollapsed ? "lg:w-16" : "lg:w-64"
          )}>
            <Sidebar
              collapsed={sidebarCollapsed}
              onCollapsedChange={setSidebarCollapsed}
            />
          </div>
        </>
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
      </div>
    </div>
  );
}
