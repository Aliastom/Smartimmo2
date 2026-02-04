/**
 * Configuration unique de la sidebar
 * Source de vérité pour les items de navigation dans les deux modes (normal et app-shell)
 */

import {
  LayoutDashboard,
  Building,
  UsersRound,
  FileText,
  Wallet,
  Settings,
  Shield,
  Home,
  Calendar,
  Landmark,
  Calculator,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type SidebarItemType = 'main' | 'admin' | 'settings';

export interface SidebarItemConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  type: SidebarItemType;
  // Chemin pour le mode normal (Next.js routing)
  normalPath: string;
  // View pour le mode app-shell (query param ?view=xxx)
  appView: string;
  // Optionnel : badge à afficher
  badge?: string;
  // Optionnel : nécessite le rôle admin
  requiresAdmin?: boolean;
}

/**
 * Configuration complète des items de navigation
 * Ordre et structure identiques pour les deux modes
 */
export const sidebarConfig: SidebarItemConfig[] = [
  // Navigation principale
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    type: 'main',
    normalPath: '/dashboard',
    appView: 'dashboard',
  },
  {
    id: 'patrimoine',
    label: 'Patrimoine',
    icon: Home,
    type: 'main',
    normalPath: '/dashboard/patrimoine',
    appView: 'patrimoine',
  },
  {
    id: 'biens',
    label: 'Biens',
    icon: Building,
    type: 'main',
    normalPath: '/biens',
    appView: 'biens',
  },
  {
    id: 'locataires',
    label: 'Locataires',
    icon: UsersRound,
    type: 'main',
    normalPath: '/locataires',
    appView: 'locataires',
  },
  {
    id: 'baux',
    label: 'Baux',
    icon: FileText,
    type: 'main',
    normalPath: '/baux',
    appView: 'baux',
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: Wallet,
    type: 'main',
    normalPath: '/transactions',
    appView: 'transactions',
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: FolderOpen,
    type: 'main',
    normalPath: '/documents',
    appView: 'documents',
  },
  {
    id: 'echeances',
    label: 'Échéances',
    icon: Calendar,
    type: 'main',
    normalPath: '/echeances',
    appView: 'echeances',
  },
  {
    id: 'loans',
    label: 'Prêts',
    icon: Landmark,
    type: 'main',
    normalPath: '/loans',
    appView: 'loans',
  },
  {
    id: 'fiscal',
    label: 'Simulation Fiscale',
    icon: Calculator,
    type: 'main',
    normalPath: '/fiscal',
    appView: 'fiscal',
  },
  {
    id: 'sync',
    label: 'Synchronisation',
    icon: RefreshCw,
    type: 'main',
    normalPath: '/app?view=sync',
    appView: 'sync',
  },
  // Administration (nécessite le rôle admin)
  {
    id: 'admin',
    label: 'Administration',
    icon: Shield,
    type: 'admin',
    normalPath: '/admin',
    appView: 'admin',
    requiresAdmin: true,
  },
  // Paramètres
  {
    id: 'parametres',
    label: 'Paramètres',
    icon: Settings,
    type: 'settings',
    normalPath: '/parametres',
    appView: 'parametres',
  },
];

/**
 * Récupère les items filtrés selon le type et le rôle utilisateur
 */
export function getFilteredSidebarItems(
  userRole?: string | null,
  includeAdmin: boolean = true,
  includeSettings: boolean = true
): SidebarItemConfig[] {
  return sidebarConfig.filter((item) => {
    // Filtrer selon le type
    if (item.type === 'admin' && !includeAdmin) return false;
    if (item.type === 'settings' && !includeSettings) return false;

    // Filtrer selon le rôle admin
    if (item.requiresAdmin) {
      const isAdmin = userRole === 'ADMIN' || userRole === 'admin';
      return isAdmin === true;
    }

    return true;
  });
}

/**
 * Trouve un item par son chemin normal ou son view app-shell
 */
export function findSidebarItemByPath(path: string): SidebarItemConfig | undefined {
  return sidebarConfig.find((item) => item.normalPath === path || item.normalPath.startsWith(path + '/'));
}

export function findSidebarItemByView(view: string): SidebarItemConfig | undefined {
  return sidebarConfig.find((item) => item.appView === view);
}
