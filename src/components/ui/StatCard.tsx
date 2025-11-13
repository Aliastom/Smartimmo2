'use client';

import React from 'react';
import { cn } from '@/utils/cn';
import { 
  Building2, 
  Users, 
  DollarSign, 
  FileText, 
  Calendar, 
  MapPin, 
  AlertCircle, 
  CreditCard, 
  Home,
  Euro,
  TrendingUp,
  TrendingDown,
  Minus,
  Edit,
  Camera,
  Settings,
  Trash2,
  Clock,
  CheckCircle,
  Bell,
  UserCheck,
  UserX,
  Activity,
  FileX,
  FileClock,
  ChevronRight,
  Info,
  AlertTriangle
} from 'lucide-react';
import { MiniDonut } from './MiniDonut';
import { MiniRadial } from './MiniRadial';

// Mapping des icônes
const iconMap = {
  Building2,
  Users,
  DollarSign,
  FileText,
  Calendar,
  MapPin,
  AlertCircle,
  CreditCard,
  Home,
  Euro,
  TrendingUp,
  TrendingDown,
  Minus,
  Edit,
  Camera,
  Settings,
  Trash2,
  Clock,
  CheckCircle,
  Bell,
  UserCheck,
  UserX,
  Activity,
  FileX,
  FileClock,
  ChevronRight,
  Info,
  AlertTriangle,
};

export interface StatCardProps {
  title: string;
  value: string | number;
  iconName: string;
  
  // Anciennes props (compatibilité)
  trend?: {
    value: number;
    label: string;
    period: string;
  };
  
  // Nouvelles props Phase 2
  trendValue?: number;
  trendLabel?: string;
  trendDirection?: 'up' | 'down' | 'flat';
  
  rightIndicator?: 'chevron' | 'progress' | 'badge' | 'none';
  progressValue?: number; // 0-100 pour rightIndicator="progress"
  badgeContent?: string; // Contenu du badge
  
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'gray' | 'green' | 'red' | 'blue' | 'amber' | 'indigo' | 'emerald' | 'rose' | 'slate' | 'yellow';
  
  onClick?: () => void;
  isActive?: boolean;
  disabled?: boolean;
  
  className?: string;
}

// Classes de couleurs pour les différents thèmes
const colorClasses = {
  primary: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    icon: 'bg-blue-100 text-blue-600',
    border: 'border-blue-200',
    borderActive: 'border-blue-400',
    hoverBorder: 'hover:border-blue-300',
    ring: 'ring-blue-300',
    shadow: 'shadow-blue-100'
  },
  success: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    icon: 'bg-green-100 text-green-600',
    border: 'border-green-200',
    borderActive: 'border-green-400',
    hoverBorder: 'hover:border-green-300',
    ring: 'ring-green-300',
    shadow: 'shadow-green-100'
  },
  warning: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-600',
    icon: 'bg-yellow-100 text-yellow-600',
    border: 'border-yellow-200',
    borderActive: 'border-yellow-400',
    hoverBorder: 'hover:border-yellow-300',
    ring: 'ring-yellow-300',
    shadow: 'shadow-yellow-100'
  },
  danger: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    icon: 'bg-red-100 text-red-600',
    border: 'border-red-200',
    borderActive: 'border-red-400',
    hoverBorder: 'hover:border-red-300',
    ring: 'ring-red-300',
    shadow: 'shadow-red-100'
  },
  gray: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    icon: 'bg-gray-100 text-gray-600',
    border: 'border-gray-200',
    borderActive: 'border-gray-400',
    hoverBorder: 'hover:border-gray-300',
    ring: 'ring-gray-300',
    shadow: 'shadow-gray-100'
  },
  // Nouvelles couleurs Phase 2
  green: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    icon: 'bg-green-100 text-green-600',
    border: 'border-green-200',
    borderActive: 'border-green-400',
    hoverBorder: 'hover:border-green-300',
    ring: 'ring-green-300',
    shadow: 'shadow-green-100'
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    icon: 'bg-red-100 text-red-600',
    border: 'border-red-200',
    borderActive: 'border-red-400',
    hoverBorder: 'hover:border-red-300',
    ring: 'ring-red-300',
    shadow: 'shadow-red-100'
  },
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    icon: 'bg-blue-100 text-blue-600',
    border: 'border-blue-200',
    borderActive: 'border-blue-400',
    hoverBorder: 'hover:border-blue-300',
    ring: 'ring-blue-300',
    shadow: 'shadow-blue-100'
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    icon: 'bg-amber-100 text-amber-600',
    border: 'border-amber-200',
    borderActive: 'border-amber-400',
    hoverBorder: 'hover:border-amber-300',
    ring: 'ring-amber-300',
    shadow: 'shadow-amber-100'
  },
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
    icon: 'bg-indigo-100 text-indigo-600',
    border: 'border-indigo-200',
    borderActive: 'border-indigo-400',
    hoverBorder: 'hover:border-indigo-300',
    ring: 'ring-indigo-300',
    shadow: 'shadow-indigo-100'
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    icon: 'bg-emerald-100 text-emerald-600',
    border: 'border-emerald-200',
    borderActive: 'border-emerald-400',
    hoverBorder: 'hover:border-emerald-300',
    ring: 'ring-emerald-300',
    shadow: 'shadow-emerald-100'
  },
  rose: {
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    icon: 'bg-rose-100 text-rose-600',
    border: 'border-rose-200',
    borderActive: 'border-rose-400',
    hoverBorder: 'hover:border-rose-300',
    ring: 'ring-rose-300',
    shadow: 'shadow-rose-100'
  },
  slate: {
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    icon: 'bg-slate-100 text-slate-600',
    border: 'border-slate-200',
    borderActive: 'border-slate-400',
    hoverBorder: 'hover:border-slate-300',
    ring: 'ring-slate-300',
    shadow: 'shadow-slate-100'
  },
  yellow: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-600',
    icon: 'bg-yellow-100 text-yellow-600',
    border: 'border-yellow-200',
    borderActive: 'border-yellow-400',
    hoverBorder: 'hover:border-yellow-300',
    ring: 'ring-yellow-300',
    shadow: 'shadow-yellow-100'
  },
};

export const StatCard = React.memo(function StatCard({ 
  title, 
  value, 
  iconName, 
  // Anciennes props
  trend, 
  // Nouvelles props
  trendValue,
  trendLabel,
  trendDirection,
  rightIndicator = 'none',
  progressValue,
  badgeContent,
  color = 'primary',
  onClick,
  isActive = false,
  disabled = false,
  className 
}: StatCardProps) {
  const Icon = iconMap[iconName as keyof typeof iconMap];
  const colors = colorClasses[color] || colorClasses.primary;

  // Compatibilité : utiliser les nouvelles props si présentes, sinon anciennes
  const finalTrendValue = trendValue !== undefined ? trendValue : trend?.value ?? 0;
  const finalTrendLabel = trendLabel || trend?.label || '% vs mois dernier';
  const finalTrendDirection = trendDirection || (
    trend ? (trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'flat') : 'flat'
  );

  const getTrendIcon = () => {
    switch (finalTrendDirection) {
      case 'up':
        return <TrendingUp className="h-3.5 w-3.5 mr-1" />;
      case 'down':
        return <TrendingDown className="h-3.5 w-3.5 mr-1" />;
      case 'flat':
      default:
        return <Minus className="h-3.5 w-3.5 mr-1" />;
    }
  };

  const getTrendColor = () => {
    switch (finalTrendDirection) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'flat':
      default:
        return 'text-gray-500';
    }
  };

  const getRightIndicator = () => {
    switch (rightIndicator) {
      case 'chevron':
        return <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden="true" />;
      case 'progress':
        return (
          <div className="w-8 h-8">
            <MiniDonut
              percentage={progressValue || 0}
              size={32}
              strokeWidth={4}
              color={progressValue && progressValue > 80 ? 'success' : 'warning'}
            />
          </div>
        );
      case 'badge':
        return (
          <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-medium">
            {badgeContent || 'i'}
          </div>
        );
      case 'none':
      default:
        // Espace réservé pour équilibre visuel
        return <div className="w-5" aria-hidden="true" />;
    }
  };

  if (!Icon) {
    console.warn(`Icon "${iconName}" not found in iconMap`);
    return null;
  }

  const isClickable = !!onClick && !disabled;
  const Component = isClickable ? 'button' : 'div';

  return (
    <Component
      type={isClickable ? 'button' : undefined}
      onClick={isClickable ? onClick : undefined}
      disabled={disabled}
      role={isClickable ? 'button' : undefined}
      aria-pressed={isClickable && isActive ? 'true' : undefined}
      aria-label={isClickable ? `Filtrer : ${title}` : undefined}
      aria-disabled={disabled}
      className={cn(
        "bg-white rounded-xl border p-4 md:p-5 transition-all duration-150 ease-out",
        "flex flex-col gap-3",
        colors.border,
        
        // États hover/active/focus
        !disabled && [
          "hover:-translate-y-[1px] hover:shadow-sm",
          colors.hoverBorder,
        ],
        isClickable && !disabled && [
          "cursor-pointer",
          "active:scale-[0.98] active:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2",
          `focus-visible:${colors.ring}`,
        ],
        
        // État actif (filtre sélectionné)
        isActive && [
          colors.bg,
          colors.borderActive,
          `shadow-sm ${colors.shadow}`,
        ],
        
        // État désactivé
        disabled && "opacity-50 cursor-not-allowed",
        
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Contenu principal */}
        <div className="flex-1 min-w-0 text-left">
          <p className={cn("text-sm font-semibold text-left", colors.text)}>
            {title}
          </p>
          <p className="text-xl md:text-2xl font-semibold text-gray-900 mt-1 truncate text-left">
            {value}
          </p>
        </div>

        {/* Pastille icône */}
        <div className={cn(
          "flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center",
          colors.icon
        )}>
          <Icon className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
        </div>
      </div>

      {/* Ligne inférieure : trend + indicateur droit */}
      <div className="flex items-center justify-between gap-2">
        {/* Trend (TOUJOURS AFFICHE) */}
        <div className={cn("flex items-center text-xs md:text-sm", getTrendColor())}>
          {getTrendIcon()}
          <span>
            {trendLabel ? (
              finalTrendLabel
            ) : (
              <>
                {finalTrendValue > 0 ? '+' : ''}{finalTrendValue} {finalTrendLabel}
              </>
            )}
          </span>
        </div>

        {/* Indicateur droit (TOUJOURS PRÉSENT) */}
        <div className="flex-shrink-0">
          {getRightIndicator()}
        </div>
      </div>
    </Component>
  );
});

// ============================================================================
// StatCard.Info - Variante non-cliquable (InfoCard)
// ============================================================================

export interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'flat';
  size?: 'lg' | 'md';
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'gray' | 'green' | 'red' | 'blue' | 'amber' | 'indigo' | 'emerald' | 'rose' | 'slate' | 'yellow';
  className?: string;
}

const InfoCard = React.memo(function InfoCard({ 
  icon,
  title, 
  value, 
  subtext,
  trend = 'flat',
  size = 'lg',
  color = 'primary',
  className 
}: InfoCardProps) {
  const colors = colorClasses[color] || colorClasses.primary;

  const getTrendIcon = () => {
    if (!subtext) return null;
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 mr-1" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 mr-1" />;
      case 'flat':
      default:
        return <Minus className="h-3 w-3 mr-1" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'flat':
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div
      className={cn(
        "bg-white rounded-xl border p-4 md:p-5",
        "flex flex-col gap-3",
        "cursor-default",
        colors.border,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Contenu principal */}
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium", colors.text)}>
            {title}
          </p>
          <p className={cn(
            "font-semibold text-gray-900 mt-1 truncate",
            size === 'lg' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'
          )}>
            {value}
          </p>
        </div>

        {/* Pastille icône */}
        <div className={cn(
          "flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center",
          colors.icon
        )}>
          {icon}
        </div>
      </div>

      {/* Subtext avec tendance (optionnel) */}
      {subtext && (
        <div className={cn("flex items-center text-xs text-muted-foreground", getTrendColor())}>
          {getTrendIcon()}
          <span>{subtext}</span>
        </div>
      )}
    </div>
  );
});

// Exporter avec la notation pointée
StatCard.Info = InfoCard;