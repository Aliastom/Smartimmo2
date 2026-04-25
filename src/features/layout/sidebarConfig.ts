/**
 * Configuration unique de la sidebar
 * Source de vérité pour les items de navigation dans les deux modes (normal et app-shell)
 * Structure par sections : Dashboard, PORTFOLIO, FINANCES, GESTION, ANALYSE, SYSTÈME, ADMIN
 */

import {
  LayoutDashboard,
  Building,
  UsersRound,
  FileText,
  Wallet,
  Settings,
  Shield,
  PieChart,
  Calendar,
  Landmark,
  Calculator,
  FileArchive,
  RefreshCw,
  FolderOpen,
  Bell,
  TrendingDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type SidebarItemType = 'main' | 'admin' | 'settings';

/** Sections affichées dans la sidebar (ordre d'affichage) */
export const SIDEBAR_SECTION_ORDER = [
  'dashboard',
  'alerts',
  'portfolio',
  'finances',
  'gestion',
  'analyse',
  'system',
  'admin',
] as const;

/** Sections qui sont des groupes dépliants (avec en-tête cliquable) */
export const SIDEBAR_COLLAPSIBLE_SECTIONS: SidebarSectionId[] = [
  'portfolio',
  'finances',
  'gestion',
  'analyse',
  'system',
];

export type SidebarSectionId = (typeof SIDEBAR_SECTION_ORDER)[number];

/** Labels des sections (affichés en uppercase dans la sidebar) */
export const SIDEBAR_SECTION_LABELS: Record<SidebarSectionId, string> = {
  dashboard: '',
  alerts: '', // Alertes en item seul, pas de titre
  portfolio: 'PORTFOLIO',
  finances: 'FINANCES',
  gestion: 'GESTION',
  analyse: 'ANALYSE',
  system: 'SYSTÈME',
  admin: 'ADMIN',
};

/** Retourne la section contenant la vue donnée (pour ouvrir automatiquement le groupe actif) */
export function getSectionForView(view: string): SidebarSectionId | null {
  const item = sidebarConfig.find((i) => i.appView === view);
  return item ? item.section : null;
}

export interface SidebarItemConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  type: SidebarItemType;
  /** Section pour le regroupement visuel */
  section: SidebarSectionId;
  // Chemin pour le mode normal (Next.js routing)
  normalPath: string;
  // View pour le mode app-shell (query param ?view=xxx)
  appView: string;
  // Optionnel : badge à afficher
  badge?: string;
  // Optionnel : nécessite le rôle admin
  requiresAdmin?: boolean;
  // Optionnel : description (utilisé par certains rendus)
  description?: string;
  /** Style discret (texte grisé, icône légère) pour entrées peu utilisées (ex. SYSTÈME) */
  isDiscreet?: boolean;
}

/**
 * Configuration complète des items de navigation
 * Ordre et structure par sections pour les deux modes
 */
export const sidebarConfig: SidebarItemConfig[] = [
  // ——— Dashboard (item seul, pas de titre de section) ———
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    type: 'main',
    section: 'dashboard',
    normalPath: '/dashboard',
    appView: 'dashboard',
  },
  // ——— PORTFOLIO ———
  {
    id: 'patrimoine',
    label: 'Portfolio',
    icon: PieChart,
    type: 'main',
    section: 'portfolio',
    normalPath: '/dashboard/patrimoine',
    appView: 'patrimoine',
  },
  {
    id: 'biens',
    label: 'Biens',
    icon: Building,
    type: 'main',
    section: 'portfolio',
    normalPath: '/biens',
    appView: 'biens',
  },
  {
    id: 'baux',
    label: 'Baux',
    icon: FileText,
    type: 'main',
    section: 'portfolio',
    normalPath: '/baux',
    appView: 'baux',
  },
  {
    id: 'locataires',
    label: 'Locataires',
    icon: UsersRound,
    type: 'main',
    section: 'portfolio',
    normalPath: '/locataires',
    appView: 'locataires',
  },
  // ——— FINANCES ———
  {
    id: 'transactions',
    label: 'Transactions',
    icon: Wallet,
    type: 'main',
    section: 'finances',
    normalPath: '/transactions',
    appView: 'transactions',
  },
  {
    id: 'loans',
    label: 'Prêts',
    icon: Landmark,
    type: 'main',
    section: 'finances',
    normalPath: '/loans',
    appView: 'loans',
  },
  // ——— GESTION ———
  {
    id: 'echeances',
    label: 'Échéances',
    icon: Calendar,
    type: 'main',
    section: 'gestion',
    normalPath: '/echeances',
    appView: 'echeances',
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: FolderOpen,
    type: 'main',
    section: 'gestion',
    normalPath: '/documents',
    appView: 'documents',
  },
  // ——— ALERTES (item seul entre Dashboard et PORTFOLIO) ———
  {
    id: 'alertes',
    label: 'Alertes',
    icon: Bell,
    type: 'main',
    section: 'alerts',
    normalPath: '/app?view=alertes',
    appView: 'alertes',
  },
  // ——— ANALYSE ———
  {
    id: 'fiscal',
    label: 'Simulation fiscale',
    icon: Calculator,
    type: 'main',
    section: 'analyse',
    normalPath: '/fiscal',
    appView: 'fiscal',
  },
  {
    id: 'lmnp-pilotage',
    label: 'Pilotage LMNP',
    icon: FileArchive,
    type: 'main',
    section: 'analyse',
    normalPath: '/app?view=lmnp',
    appView: 'lmnp',
  },
  {
    id: 'market',
    label: 'Marché',
    icon: TrendingDown,
    type: 'main',
    section: 'analyse',
    normalPath: '/app?view=market',
    appView: 'market',
  },
  // ——— SYSTÈME (style discret) ———
  {
    id: 'sync',
    label: 'Synchronisation',
    icon: RefreshCw,
    type: 'main',
    section: 'system',
    normalPath: '/app?view=sync',
    appView: 'sync',
    isDiscreet: true,
  },
  {
    id: 'parametres',
    label: 'Paramètres',
    icon: Settings,
    type: 'settings',
    section: 'system',
    normalPath: '/parametres',
    appView: 'parametres',
    isDiscreet: true,
  },
  // ——— ADMIN ———
  {
    id: 'admin',
    label: 'Administration',
    icon: Shield,
    type: 'admin',
    section: 'admin',
    normalPath: '/admin',
    appView: 'admin',
    requiresAdmin: true,
  },
];

/**
 * Récupère les items regroupés par section (ordre SIDEBAR_SECTION_ORDER)
 * pour l'affichage dans la sidebar.
 */
export function getSidebarItemsBySection(
  userRole?: string | null,
  includeAdmin: boolean = true,
  includeSettings: boolean = true
): { sectionId: SidebarSectionId; sectionLabel: string; items: SidebarItemConfig[] }[] {
  const filtered = sidebarConfig.filter((item) => {
    if (item.type === 'admin' && !includeAdmin) return false;
    if (item.type === 'settings' && !includeSettings) return false;
    if (item.requiresAdmin) {
      const isAdmin = userRole === 'ADMIN' || userRole === 'admin';
      return isAdmin === true;
    }
    return true;
  });

  const bySection = new Map<SidebarSectionId, SidebarItemConfig[]>();
  for (const id of SIDEBAR_SECTION_ORDER) {
    bySection.set(id, []);
  }
  for (const item of filtered) {
    const list = bySection.get(item.section);
    if (list) list.push(item);
  }

  return SIDEBAR_SECTION_ORDER.filter((id) => bySection.get(id)!.length > 0).map((sectionId) => ({
    sectionId,
    sectionLabel: SIDEBAR_SECTION_LABELS[sectionId],
    items: bySection.get(sectionId)!,
  }));
}

/**
 * Récupère les items filtrés selon le type et le rôle utilisateur (liste plate, rétrocompat)
 */
export function getFilteredSidebarItems(
  userRole?: string | null,
  includeAdmin: boolean = true,
  includeSettings: boolean = true
): SidebarItemConfig[] {
  return sidebarConfig.filter((item) => {
    if (item.type === 'admin' && !includeAdmin) return false;
    if (item.type === 'settings' && !includeSettings) return false;
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
