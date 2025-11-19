'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLoading } from '@/contexts/LoadingContext';
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
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { UserDisplay } from '@/components/auth/UserDisplay';

interface UserInfo {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'USER';
}

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
    href: '/fiscal',
    icon: Calculator,
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
  const { isLoading } = useLoading();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const collapsed = collapsedProp ?? internalCollapsed;

  // Récupérer les informations utilisateur avec React Query (hook centralisé)
  const { user: authUser, isAuthenticated: authIsAuthenticated } = useAuth();
  
  useEffect(() => {
    setUser(authUser);
    setIsAuthenticated(authIsAuthenticated);
  }, [authUser, authIsAuthenticated]);

  const toggleCollapse = () => {
    const next = !collapsed;
    if (onCollapsedChange) onCollapsedChange(next);
    if (collapsedProp === undefined) setInternalCollapsed(next);
  };

  // Filtrer les items de navigation selon le rôle
  const filteredNavItems = navItems.filter(item => {
    // Cacher "Administration" si l'utilisateur n'est pas admin
    if (item.href === '/admin') {
      return user?.role === 'ADMIN';
    }
    return true;
  });

  return (
    <aside className={cn(
      "h-full bg-white border-r border-gray-200 transition-all duration-300 flex flex-col",
      collapsed ? "w-16" : "w-64 max-w-[85vw] sm:max-w-none", // Limiter à 85% de la largeur d'écran sur mobile
      "lg:relative lg:translate-x-0",
      "fixed inset-y-0 left-0 z-30",
      className
    )}>
      {/* Collapse button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
        {!collapsed && (
          <span className="font-semibold text-gray-900">Navigation</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className="ml-auto hidden lg:block"
          aria-label={collapsed ? "Étendre la sidebar" : "Réduire la sidebar"}
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
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const itemLoading = isLoading(item.href);
          
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
              {itemLoading ? (
                <Loader2 
                  className="h-5 w-5 flex-shrink-0 animate-spin sidebar-loader-orange" 
                />
              ) : (
                <item.icon className={cn(
                  "h-5 w-5 flex-shrink-0",
                  isActive ? "text-primary-600" : "text-gray-500"
                )} />
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
            </Link>
          );
        })}
      </nav>

      {/* Utilisateur connecté - Le badge Administrateur est géré par UserDisplay - Toujours en bas */}
      {isAuthenticated && (
        <div className="border-t border-gray-200 p-4 flex-shrink-0">
          {!collapsed && <UserDisplay />}
          {collapsed && (
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-semibold">
                  👤
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
