'use client';

import React from 'react';
import { cn } from '@/utils/cn';
import { 
  AlertCircle, 
  Wifi, 
  RefreshCw,
  Search,
  FileX,
  Database,
  Shield,
  Inbox,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';

type StateKind = 'error' | 'empty' | 'offline' | 'loading' | 'success' | 'warning' | 'info' | 'forbidden' | 'notfound';

interface StateCardProps {
  kind: StateKind;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

const stateConfig: Record<StateKind, {
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  iconColor: string;
  actionVariant: string;
}> = {
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    iconColor: 'text-red-400',
    actionVariant: 'btn-error'
  },
  empty: {
    icon: Inbox,
    bgColor: 'bg-gray-50',
    iconColor: 'text-gray-400',
    actionVariant: 'btn-primary'
  },
  offline: {
    icon: Wifi,
    bgColor: 'bg-orange-50',
    iconColor: 'text-orange-400',
    actionVariant: 'btn-warning'
  },
  loading: {
    icon: RefreshCw,
    bgColor: 'bg-blue-50',
    iconColor: 'text-blue-400',
    actionVariant: 'btn-primary'
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    iconColor: 'text-green-400',
    actionVariant: 'btn-success'
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50',
    iconColor: 'text-yellow-500',
    actionVariant: 'btn-warning'
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    iconColor: 'text-blue-400',
    actionVariant: 'btn-info'
  },
  forbidden: {
    icon: Shield,
    bgColor: 'bg-red-50',
    iconColor: 'text-red-400',
    actionVariant: 'btn-error'
  },
  notfound: {
    icon: Search,
    bgColor: 'bg-gray-50',
    iconColor: 'text-gray-400',
    actionVariant: 'btn-ghost'
  }
};

export function StateCard({ 
  kind,
  title, 
  description, 
  actionLabel,
  onAction,
  icon,
  className,
  compact = false
}: StateCardProps) {
  const config = stateConfig[kind];
  const IconComponent = config.icon;

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-8 px-4' : 'py-12 px-6',
      className
    )}>
      <div className={cn(
        'rounded-full flex items-center justify-center mb-4',
        config.bgColor,
        compact ? 'w-12 h-12' : 'w-16 h-16'
      )}>
        {icon || (
          <IconComponent 
            className={cn(
              config.iconColor,
              compact ? 'h-6 w-6' : 'h-8 w-8'
            )} 
          />
        )}
      </div>

      <h3 className={cn(
        'font-semibold text-gray-900 mb-2',
        compact ? 'text-base' : 'text-lg'
      )}>
        {title}
      </h3>

      {description && (
        <p className={cn(
          'text-gray-600 mb-6 max-w-sm',
          compact ? 'text-sm mb-4' : ''
        )}>
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={cn('btn', config.actionVariant)}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// Composants spécialisés pour les cas d'usage courants
export function ErrorState({ 
  title = "Une erreur est survenue",
  description = "Un problème technique a été rencontré.",
  onRetry,
  className
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <StateCard
      kind="error"
      title={title}
      description={description}
      actionLabel={onRetry ? "Réessayer" : undefined}
      onAction={onRetry}
      className={className}
    />
  );
}

export function EmptyState({ 
  title = "Aucune donnée",
  description = "Aucun élément à afficher pour cette période.",
  onCreate,
  actionLabel = "Ajouter",
  className
}: {
  title?: string;
  description?: string;
  onCreate?: () => void;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <StateCard
      kind="empty"
      title={title}
      description={description}
      actionLabel={onCreate ? actionLabel : undefined}
      onAction={onCreate}
      className={className}
    />
  );
}

export function OfflineState({ 
  title = "Connexion interrompue",
  description = "Vérifiez votre connexion internet et réessayez.",
  onRetry,
  className
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <StateCard
      kind="offline"
      title={title}
      description={description}
      actionLabel={onRetry ? "Réessayer" : undefined}
      onAction={onRetry}
      className={className}
    />
  );
}

export function ForbiddenState({ 
  title = "Accès restreint",
  description = "Vous n'avez pas les autorisations nécessaires pour accéder à cette section.",
  className
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <StateCard
      kind="forbidden"
      title={title}
      description={description}
      className={className}
    />
  );
}

export function NotFoundState({ 
  title = "Introuvable",
  description = "L'élément recherché n'existe pas ou a été supprimé.",
  onGoBack,
  className
}: {
  title?: string;
  description?: string;
  onGoBack?: () => void;
  className?: string;
}) {
  return (
    <StateCard
      kind="notfound"
      title={title}
      description={description}
      actionLabel={onGoBack ? "Retour" : undefined}
      onAction={onGoBack}
      className={className}
    />
  );
}
