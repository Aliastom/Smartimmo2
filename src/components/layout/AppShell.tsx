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

      {/* Topbar - Masquée complètement (demande utilisateur) */}
      {false && !isAuthPage && (
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
          "lg:top-0" // Topbar masquée
        )}>
          <Sidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
        </div>
      )}

      {/* Main content */}
      <div className={cn(
        "flex-1 flex flex-col",
        !isAuthPage && (sidebarCollapsed ? "lg:pl-16" : "lg:pl-64")
        // lg:pt-16 supprimé car topbar masquée
      )}
      >
        {/* Page content */}
        <main id="main-content" className={cn(
          "flex-1 p-4 sm:p-6",
          className
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}
