'use client';

/**
 * Sidebar pour le mode normal
 * Utilise UnifiedSidebar avec mode='normal'
 */

import { UnifiedSidebar } from '@/features/layout/UnifiedSidebar';

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ className, collapsed, onCollapsedChange }: SidebarProps) {
  return (
    <UnifiedSidebar
      mode="normal"
      className={className}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
    />
  );
}
