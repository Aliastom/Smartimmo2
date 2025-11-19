'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { SkipToContent } from '@/components/ui/SkipToContent';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Skip to content */}
      <SkipToContent />

      {/* Bouton hamburger flottant sur mobile - Masqué sur pages auth */}
      {!isAuthPage && (
        <Button
          variant="default"
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
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Masquée sur pages auth */}
      {!isAuthPage && (
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

      {/* Main content */}
      <div className={cn(
        "flex-1 flex flex-col min-h-0 w-full",
        !isAuthPage && (sidebarCollapsed ? "lg:pl-16" : "lg:pl-64")
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
