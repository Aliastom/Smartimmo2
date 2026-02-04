'use client';

/**
 * Sidebar pour l'App Shell Offline
 * Utilise UnifiedSidebar avec mode='app-shell'
 */

import { UnifiedSidebar } from '@/features/layout/UnifiedSidebar';

interface AppShellSidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

export function AppShellSidebar({
  currentView,
  onNavigate,
  collapsed,
  onCollapsedChange,
  className,
}: AppShellSidebarProps) {
  return (
    <UnifiedSidebar
      mode="app-shell"
      currentView={currentView}
      onNavigate={onNavigate}
      className={className}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
    />
  );
}
