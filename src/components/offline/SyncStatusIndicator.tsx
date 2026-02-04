/**
 * Indicateur visuel du statut de synchronisation
 * Affiche le statut online/offline, le nombre d'opérations en attente, etc.
 */

'use client';

import React, { useState } from 'react';
import { useSyncStatus } from '@/hooks/offline/useSyncStatus';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { WifiOff, Loader2, AlertCircle, CheckCircle2, RefreshCw, Download, RotateCcw, List } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { buildViewPath } from '@/utils/appShellNavigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';

interface SyncStatusIndicatorProps {
  organizationId?: string;
  className?: string;
}

export function SyncStatusIndicator({ organizationId: propOrganizationId, className }: SyncStatusIndicatorProps) {
  const { organizationId: hookOrganizationId } = useCurrentOrganization();
  const organizationId = propOrganizationId || hookOrganizationId;
  const router = useRouter();
  
  const [isPreloading, setIsPreloading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const { 
    status, 
    pendingOperationsCount, 
    errorOperationsCount,
    lastSyncAt, 
    isOnline, 
    error, 
    fullSyncDone,
    fullSyncRunning,
    sync 
  } = useSyncStatus(organizationId);
  
  const handlePreloadPages = async () => {
    if (!isOnline || isPreloading) return;
    setIsPreloading(true);
    try {
      const { preloadImportantPages } = await import('@/lib/offline/preloadPages');
      const result = await preloadImportantPages();
      console.log('[SyncStatusIndicator] Préchargement terminé:', result);
      alert(`Préchargement terminé: ${result.success} pages mises en cache, ${result.failed} échecs`);
    } catch (error: any) {
      console.error('[SyncStatusIndicator] Erreur préchargement:', error);
      alert(`Erreur lors du préchargement: ${error.message}`);
    } finally {
      setIsPreloading(false);
    }
  };
  
  const handleResetFullSync = async () => {
    if (!organizationId || !isOnline || isResetting) return;
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser la synchronisation complète ? Cela relancera une synchronisation complète au prochain chargement.')) {
      return;
    }
    setIsResetting(true);
    try {
      const { resetFullSync } = await import('@/lib/offline/fullSync');
      await resetFullSync(organizationId);
      console.log('[SyncStatusIndicator] Full sync réinitialisée');
      alert('Synchronisation complète réinitialisée. Elle se relancera automatiquement au prochain chargement.');
      window.location.reload();
    } catch (error: any) {
      console.error('[SyncStatusIndicator] Erreur réinitialisation:', error);
      alert(`Erreur lors de la réinitialisation: ${error.message}`);
      setIsResetting(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'offline':
        return <WifiOff className="h-4 w-4 text-gray-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'idle':
        if (pendingOperationsCount > 0) {
          return <RefreshCw className="h-4 w-4 text-orange-500" />;
        }
        return isOnline ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-gray-400" />
        );
      default:
        return <CheckCircle2 className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (!isOnline) {
      return 'Hors ligne';
    }

    if (fullSyncRunning) {
      return 'Synchronisation complète...';
    }

    switch (status) {
      case 'syncing':
        return 'Synchronisation...';
      case 'error':
        return error || 'Erreur de synchronisation';
      case 'offline':
        return 'Hors ligne';
      case 'idle':
        if (pendingOperationsCount > 0) {
          return `${pendingOperationsCount} opération${pendingOperationsCount > 1 ? 's' : ''} en attente`;
        }
        if (errorOperationsCount > 0) {
          return `${errorOperationsCount} erreur${errorOperationsCount > 1 ? 's' : ''}`;
        }
        return 'Synchronisé';
      default:
        return 'Prêt';
    }
  };

  const formatLastSync = () => {
    if (!lastSyncAt) return 'Jamais synchronisé';
    
    const date = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "flex items-center gap-2 text-xs",
            status === 'syncing' && "cursor-wait",
            (status === 'syncing' || !isOnline) && "opacity-50",
            className
          )}
          disabled={status === 'syncing'}
        >
          {getStatusIcon()}
          <span className="hidden sm:inline">{getStatusText()}</span>
          {pendingOperationsCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold">
              {pendingOperationsCount > 9 ? '9+' : pendingOperationsCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-semibold">{getStatusText()}</DropdownMenuLabel>
        
        <div className="px-2 py-1.5 text-xs text-gray-400">
          Dernière sync: {formatLastSync()}
        </div>
        
        {fullSyncRunning && (
          <div className="px-2 py-1.5 text-xs text-blue-500">
            Synchronisation complète en cours...
          </div>
        )}
        
        {!fullSyncDone && !fullSyncRunning && isOnline && (
          <div className="px-2 py-1.5 text-xs text-yellow-500">
            Synchronisation initiale requise
          </div>
        )}
        
        {pendingOperationsCount > 0 && (
          <div className="px-2 py-1.5 text-xs text-orange-500">
            {pendingOperationsCount} modification{pendingOperationsCount > 1 ? 's' : ''} locale{pendingOperationsCount > 1 ? 's' : ''} en attente
          </div>
        )}
        
        {errorOperationsCount > 0 && (
          <div className="px-2 py-1.5 text-xs text-red-500">
            {errorOperationsCount} erreur{errorOperationsCount > 1 ? 's' : ''} de synchronisation
          </div>
        )}
        
        {error && (
          <div className="px-2 py-1.5 text-xs text-red-500">
            {error}
          </div>
        )}
        
        {(pendingOperationsCount > 0 || errorOperationsCount > 0) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                // ✅ Utiliser buildViewPath pour nettoyer les params property-scoped
                const cleanPath = buildViewPath('sync');
                if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
                  window.location.href = cleanPath;
                } else {
                  router.push(cleanPath);
                }
              }}
            >
              <List className="h-4 w-4 mr-2" />
              Voir les opérations en attente ({pendingOperationsCount + errorOperationsCount})
            </DropdownMenuItem>
            {isOnline && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  sync();
                }}
                disabled={!isOnline}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Synchroniser maintenant
              </DropdownMenuItem>
            )}
          </>
        )}
        
        {isOnline && status === 'idle' && !fullSyncRunning && (pendingOperationsCount === 0 && errorOperationsCount === 0) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                sync();
              }}
              disabled={!isOnline}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Synchroniser maintenant
            </DropdownMenuItem>
          </>
        )}
        
        {isOnline && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                handlePreloadPages();
              }}
              disabled={isPreloading}
            >
              {isPreloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Préchargement en cours...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Précharger les pages HTML
                </>
              )}
            </DropdownMenuItem>
            
            {fullSyncDone && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  handleResetFullSync();
                }}
                disabled={isResetting}
                className="text-orange-500 focus:text-orange-600"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Réinitialisation...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Réinitialiser la sync complète
                  </>
                )}
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}



