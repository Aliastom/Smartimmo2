/**
 * Système global de couleurs basé sur la gravité — Dashboard cockpit
 * Utilisé partout : bandeau, KPI, badges, graphiques, boutons d'action
 */

export type SeverityLevel = 'critical' | 'warning' | 'success' | 'neutral';

export interface SeverityTheme {
  /** Classe bg (fond) */
  bg: string;
  /** Classe texte principal */
  text: string;
  /** Classe bordure */
  border: string;
  /** Classe pour icône / accent */
  accent: string;
  /** Animation CSS optionnelle (pulse léger si critique) */
  animate?: string;
  /** Badge / pill */
  badge: string;
}

export const SEVERITY_THEMES: Record<SeverityLevel, SeverityTheme> = {
  critical: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    accent: 'text-red-600',
    animate: 'animate-pulse-subtle',
    badge: 'bg-red-500 text-white border-red-600',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    accent: 'text-amber-600',
    badge: 'bg-amber-500 text-white border-amber-600',
  },
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    accent: 'text-emerald-600',
    badge: 'bg-emerald-500 text-white border-emerald-600',
  },
  neutral: {
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    border: 'border-slate-200',
    accent: 'text-slate-500',
    badge: 'bg-slate-400 text-white border-slate-500',
  },
};

/** Couleurs pour graphiques / sparklines (hex ou noms Tailwind cohérents) */
export const SEVERITY_CHART_COLORS: Record<SeverityLevel, string> = {
  critical: '#ef4444',   // red-500
  warning: '#f59e0b',   // amber-500
  success: '#10b981',   // emerald-500
  neutral: '#64748b',   // slate-500
};

/** Retourne le thème selon le niveau de gravité du dashboard */
export function getSeverityTheme(level: SeverityLevel): SeverityTheme {
  return SEVERITY_THEMES[level];
}
