'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  FileText, 
  CreditCard, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Home,
  Calendar,
  Landmark,
  Calculator,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { UserDisplay } from '@/components/auth/UserDisplay';

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Patrimoine',
    href: '/dashboard/patrimoine',
    icon: Home,
  },
  {
    label: 'Biens',
    href: '/biens',
    icon: Building2,
  },
  {
    label: 'Locataires',
    href: '/locataires',
    icon: Users,
  },
  {
    label: 'Baux',
    href: '/baux',
    icon: FileText,
  },
  {
    label: 'Transactions',
    href: '/transactions',
    icon: CreditCard,
  },
  {
    label: 'Documents',
    href: '/documents',
    icon: FileText,
  },
  {
    label: 'Échéances',
    href: '/echeances',
    icon: Calendar,
  },
  {
    label: 'Prêts',
    href: '/loans',
    icon: Landmark,
  },
  {
    label: 'Simulation Fiscale',
    href: '/impots/simulation',
    icon: Calculator,
  },
  {
    label: 'Optimiseur Fiscal',
    href: '/impots/optimizer',
    icon: TrendingUp,
  },
  {
    label: 'Administration',
    href: '/admin',
    icon: Shield,
  },
  {
    label: 'Paramètres',
    href: '/parametres',
    icon: Settings,
  },
];

// Menu "Gestion déléguée" supprimé - maintenant accessible via Paramètres
const gestionItems: NavItem[] = [];

export function Sidebar({ className, collapsed: collapsedProp, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = collapsedProp ?? internalCollapsed;

  const toggleCollapse = () => {
    const next = !collapsed;
    if (onCollapsedChange) onCollapsedChange(next);
    if (collapsedProp === undefined) setInternalCollapsed(next);
  };

  return (
    <aside className={cn(
      "h-full bg-white border-r border-gray-200 transition-all duration-300",
      collapsed ? "w-16" : "w-64",
      "lg:relative lg:translate-x-0",
      "fixed inset-y-0 left-0 z-30 translate-x-0", // Mobile toujours visible
      className
    )}>
      {/* Collapse button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!collapsed && (
          <span className="font-semibold text-gray-900">Navigation</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className="ml-auto lg:block hidden"
          aria-label={collapsed ? "Étendre la sidebar" : "Réduire la sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-150",
                "hover:bg-gray-100 hover:text-gray-900",
                isActive 
                  ? "bg-primary-50 text-primary-600 border border-primary-200" 
                  : "text-gray-600",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 flex-shrink-0",
                isActive ? "text-primary-600" : "text-gray-500"
              )} />
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
            </Link>
          );
        })}

      </nav>

      {/* Utilisateur connecté */}
      <div className="mt-auto border-t border-gray-200 p-4">
        {!collapsed && <UserDisplay />}
        {collapsed && (
          <div className="flex justify-center">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-semibold">
              👤
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
