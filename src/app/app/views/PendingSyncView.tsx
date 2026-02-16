'use client';

/**
 * Tableau de bord de synchronisation offline-first
 * Conforme au superprompt : Centre de contrôle complet de la synchronisation
 * 
 * Affiche :
 * 1. Résumé global des données locales (cartes KPI par entité)
 * 2. État des opérations de sync (compteurs, tableau détaillé)
 * 3. Écart local vs remote (diagnostic)
 * 4. Actions (synchroniser maintenant, réinitialiser)
 * 5. Pages préchargées (HTML Ready Cache)
 * 6. Logs importants (24h)
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { getLocalDB } from '@/lib/offline/db';
import type { PendingOperation } from '@/lib/offline/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loader2, RefreshCw, AlertCircle, CheckCircle, Clock, XCircle, Trash2, Wifi, WifiOff, User, UserX, Database, FileText, Activity, Building2, Users, FileCheck, Receipt, Calendar, CreditCard, RotateCcw, DollarSign, Calculator, Tag, FolderTree, FileType, Radio, Scale, BookOpen, Link, Building, Menu, X } from 'lucide-react';
import { getGlobalSyncService } from '@/lib/offline/syncGlobal';
import { useAlert } from '@/hooks/useAlert';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useSyncStatus } from '@/hooks/offline/useSyncStatus';
import { useAppAuth } from '@/features/auth/useAppAuth';
import { useFullSync } from '@/hooks/offline/useFullSync';
import { IndexedDBTableModal } from './IndexedDBTableModal';
import { useSidebarOptional } from '@/contexts/SidebarContext';

interface PendingSyncViewProps {
  organizationId: string;
}

interface IndexedDBStats {
  table: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  lastUpdate: string | null;
  remoteCount?: number;
  diff?: number;
  fullSyncStatus?: 'ok' | 'incomplete' | 'error' | 'not-started';
}

interface PreloadedPage {
  path: string;
  status: 'cached' | 'not-cached';
}

interface SyncLog {
  event: string;
  timestamp: number;
}

export function PendingSyncView({ organizationId }: PendingSyncViewProps) {
  const [pendingOps, setPendingOps] = useState<PendingOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [preloading, setPreloading] = useState(false);
  const [runningFullSync, setRunningFullSync] = useState(false);
  const [idbStats, setIdbStats] = useState<IndexedDBStats[]>([]);
  const [preloadedPages, setPreloadedPages] = useState<PreloadedPage[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [remoteCounts, setRemoteCounts] = useState<Record<string, number>>({});
  const [serverUnavailable, setServerUnavailable] = useState(false);
  const [selectedTable, setSelectedTable] = useState<{ tableName: string; label: string } | null>(null);
  const { showAlert } = useAlert();
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef<number>(0);
  const { status, isOnline, pendingOperationsCount, errorOperationsCount, lastSyncAt, fullSyncDone, sync } = useSyncStatus(organizationId);
  const { user, localUser, isOffline } = useAppAuth();
  const { runFullSync, reset: resetFullSync, isRunning: fullSyncRunning } = useFullSync(organizationId);
  const sidebarContext = useSidebarOptional();

  // Réinitialiser serverUnavailable quand la connexion revient
  useEffect(() => {
    if (isOnline && serverUnavailable) {
      // Réessayer après 2 secondes si on est de nouveau en ligne
      const timer = setTimeout(() => {
        setServerUnavailable(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, serverUnavailable]);

  // Charger les données
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const db = await getLocalDB();
        
        // Charger les opérations en attente filtrées par organizationId
        const allOps = await db.pendingOperations
          .orderBy('createdAt')
          .reverse()
          .toArray();
        // Filtrer par organizationId et exclure les "synced" (ne doivent plus exister après push = suppression immédiate)
        const ops = allOps.filter(
          op => op.organizationId === organizationId && op.status !== 'synced'
        );
        
        // Charger les stats IndexedDB avec labels et icônes
        const stats: IndexedDBStats[] = [];
        // Liste des tables à afficher (triée par ordre alphabétique, sans Payment)
        const tables = [
          { name: 'Category', label: 'Category', icon: FolderTree, store: db.Category, isReference: true },
          { name: 'Document', label: 'Document', icon: FileText, store: db.Document },
          { name: 'DocumentType', label: 'DocumentType', icon: FileType, store: db.DocumentType, isReference: true },
          { name: 'EcheanceRecurrente', label: 'EcheanceRecurrente', icon: Calendar, store: db.EcheanceRecurrente },
          { name: 'FiscalCompatibility', label: 'FiscalCompatibility', icon: Link, store: db.FiscalCompatibility, isReference: true },
          { name: 'FiscalRegime', label: 'FiscalRegime', icon: BookOpen, store: db.FiscalRegime, isReference: true },
          { name: 'FiscalSimulation', label: 'FiscalSimulation', icon: Calculator, store: db.FiscalSimulation },
          { name: 'FiscalType', label: 'FiscalType', icon: Scale, store: db.FiscalType, isReference: true },
          { name: 'Lease', label: 'Lease', icon: FileCheck, store: db.Lease },
          { name: 'Loan', label: 'Loan', icon: CreditCard, store: db.Loan },
          { name: 'ManagementCompany', label: 'ManagementCompany', icon: Building, store: db.ManagementCompany, isReference: true },
          { name: 'NatureEntity', label: 'NatureEntity', icon: Tag, store: db.NatureEntity, isReference: true },
          { name: 'Property', label: 'Property', icon: Building2, store: db.Property },
          { name: 'Signal', label: 'Signal', icon: Radio, store: db.Signal, isReference: true },
          { name: 'Tenant', label: 'Tenant', icon: Users, store: db.Tenant },
          { name: 'Transaction', label: 'Transaction', icon: Receipt, store: (db as any).Transaction && typeof (db as any).Transaction.where === 'function' ? (db as any).Transaction : db.tables.find(t => t.name === 'Transaction') },
          { name: 'UserProfile', label: 'UserProfile', icon: User, store: db.UserProfile },
        ].sort((a, b) => a.name.localeCompare(b.name)); // Tri alphabétique final pour garantir l'ordre

        for (const { name, label, icon, store, isReference } of tables) {
          try {
            // Vérifier si la table existe dans la base de données
            // Si store est undefined ou null, la table n'existe pas
            if (!store) {
              stats.push({ 
                table: name, 
                label, 
                icon, 
                count: 0, 
                lastUpdate: null,
                fullSyncStatus: 'not-started',
              });
              continue;
            }

            // Pour les tables de référence, compter tous les items (pas de filtre organizationId)
            const count = isReference 
              ? await store.count()
              : await store.where('organizationId').equals(organizationId).count();
            const syncMeta = await db.syncMeta.get(name);
            const lastUpdate = syncMeta?.lastSyncAt || null;
            
            // Déterminer l'état du full sync
            let fullSyncStatus: 'ok' | 'incomplete' | 'error' | 'not-started' = 'not-started';
            if (syncMeta) {
              if (syncMeta.error) {
                fullSyncStatus = 'error';
              } else if (lastUpdate) {
                // Si on a une dernière sync et des données, c'est OK
                // Si on a une dernière sync mais pas de données, c'est incomplet
                fullSyncStatus = count > 0 ? 'ok' : 'incomplete';
              } else {
                fullSyncStatus = 'not-started';
              }
            }
            
            stats.push({
              table: name,
              label,
              icon,
              count,
              lastUpdate,
              fullSyncStatus,
            });
          } catch (e: any) {
            // Table peut ne pas exister (NotFoundError) ou autre erreur
            console.warn(`[PendingSyncView] Table ${name} non disponible:`, e?.message || e);
            stats.push({ 
              table: name, 
              label, 
              icon, 
              count: 0, 
              lastUpdate: null,
              fullSyncStatus: 'not-started',
            });
          }
        }

        // Charger les compteurs distants si en ligne ET que le serveur n'est pas marqué comme inaccessible
        if (isOnline && !serverUnavailable) {
          try {
            const remoteCountsMap: Record<string, number> = {};
            const statsEndpoints: Record<string, string> = {
              properties: '/api/properties/stats',
              tenants: '/api/tenants/stats',
              leases: '/api/leases/stats',
              loans: '/api/loans/stats',
              documents: '/api/documents/stats',
            };

            let successCount = 0;
            let errorCount = 0;
            
            await Promise.allSettled(
              Object.entries(statsEndpoints).map(async ([key, endpoint]) => {
                try {
                  const response = await fetch(endpoint, { 
                    credentials: 'include',
                    signal: AbortSignal.timeout(5000), // Timeout de 5 secondes
                  });
                  if (response.ok) {
                    const data = await response.json();
                    // Adapter selon le format de réponse
                    const count = data.total || data.count || data.totalLoans || data[key]?.total || 0;
                    if (count !== undefined && count !== null) {
                      remoteCountsMap[key] = count;
                      successCount++;
                    } else {
                      errorCount++;
                    }
                  } else {
                    errorCount++;
                  }
                } catch (e: any) {
                  // Erreur silencieuse pour une seule requête - ne pas bloquer les autres
                  errorCount++;
                }
              })
            );

            // Marquer le serveur comme inaccessible seulement si TOUTES les requêtes ont échoué
            if (successCount === 0 && errorCount > 0) {
              if (!cancelled) {
                setServerUnavailable(true);
              }
            } else if (successCount > 0) {
              // Si au moins une requête a réussi, le serveur est accessible
              if (!cancelled) {
                setServerUnavailable(false);
              }
            }

            // Calculer les différences seulement si on a des données
            if (Object.keys(remoteCountsMap).length > 0) {
              stats.forEach(stat => {
                const remote = remoteCountsMap[stat.table];
                if (remote !== undefined) {
                  stat.remoteCount = remote;
                  stat.diff = stat.count - remote;
                }
              });

              if (!cancelled) {
                setRemoteCounts(remoteCountsMap);
              }
            }
          } catch (e) {
            // Erreur globale - marquer le serveur comme inaccessible
            if (!cancelled) {
              setServerUnavailable(true);
            }
          }
        }

        // Vérifier les pages préchargées
        const pages: PreloadedPage[] = [];
        if (typeof window !== 'undefined' && 'caches' in window) {
          try {
            const cache = await caches.open('pages');
            const importantPages = ['/biens', '/locataires', '/baux', '/transactions', '/dashboard', '/loans', '/echeances', '/documents'];
            
            for (const pagePath of importantPages) {
              const url = new URL(pagePath, window.location.origin).href;
              const cached = await cache.match(url);
              pages.push({
                path: pagePath,
                status: cached ? 'cached' : 'not-cached',
              });
            }
          } catch (e) {
            console.warn('[PendingSyncView] Erreur vérification cache:', e);
          }
        }

        // Charger les logs (depuis localStorage pour l'instant)
        const logsStr = typeof window !== 'undefined' ? localStorage.getItem('syncLogs') : null;
        const logs: SyncLog[] = logsStr ? JSON.parse(logsStr) : [];
        // Filtrer les logs des 24 dernières heures
        const now = Date.now();
        const last24h = logs.filter(log => now - log.timestamp < 24 * 60 * 60 * 1000);
        
        if (!cancelled) {
          setPendingOps(ops);
          setIdbStats(stats);
          setPreloadedPages(pages);
          setSyncLogs(last24h);
          setLoading(false);
        }
      } catch (error: any) {
        console.error('[PendingSyncView] Erreur chargement:', error);
        if (!cancelled) {
          setLoading(false);
          // Ne pas afficher d'alerte automatique pour éviter les spams
          // L'utilisateur verra les erreurs dans les logs
        }
      }
    }

    load();
    
    // Écouter les événements de refresh pour rafraîchir immédiatement (y compris en offline)
    const handleRefresh = () => {
      if (!cancelled) {
        load();
      }
    };
    
    // Écouter les événements sync:refresh et dashboard:refresh pour rafraîchir automatiquement
    window.addEventListener('sync:refresh', handleRefresh);
    window.addEventListener('dashboard:refresh', handleRefresh);
    window.addEventListener('pendingOp:created', handleRefresh);
    
    // Polling pour mettre à jour automatiquement (toutes les 30 secondes)
    // En offline aussi pour voir les nouvelles pendingOps créées localement
    const interval = setInterval(() => {
      if (!cancelled && !loading) {
        load();
      }
    }, 30000); // 30 secondes pour éviter les boucles et réduire la charge
    
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('sync:refresh', handleRefresh);
      window.removeEventListener('dashboard:refresh', handleRefresh);
      window.removeEventListener('pendingOp:created', handleRefresh);
    };
  }, [organizationId, isOnline]); // Retirer showAlert et serverUnavailable des dépendances

  // Grouper les opérations par statut
  const groupedOps = useMemo(() => {
    const groups = {
      pending: [] as PendingOperation[],
      syncing: [] as PendingOperation[],
      synced: [] as PendingOperation[],
      error: [] as PendingOperation[],
    };

    pendingOps.forEach(op => {
      if (op.status === 'pending') {
        groups.pending.push(op);
      } else if (op.status === 'syncing') {
        groups.syncing.push(op);
      } else if (op.status === 'synced') {
        groups.synced.push(op);
      } else if (op.status === 'error') {
        groups.error.push(op);
      } else if (op.status === 'blocked_permanent') {
        groups.error.push(op); // Afficher avec les erreurs mais avec un badge distinct
      }
    });

    return groups;
  }, [pendingOps]);

  // Relancer la synchronisation complète
  const handleSync = async () => {
    try {
      setSyncing(true);
      if (sync) {
        await sync();
      } else {
        const syncService = getGlobalSyncService();
        await syncService.syncAllPendingToRemote(organizationId);
      }

      // Recharger les données (uniquement pending / error / syncing / blocked, pas synced)
      const db = await getLocalDB();
      const allOps = await db.pendingOperations
        .orderBy('createdAt')
        .reverse()
        .toArray();
      const ops = allOps.filter(
        (op: PendingOperation) => op.organizationId === organizationId && op.status !== 'synced'
      );
      setPendingOps(ops);

      await showAlert({
        type: 'success',
        title: 'Synchronisation terminée',
        message: 'La synchronisation des données est terminée. Les données ont été mises à jour.',
      });
    } catch (error: any) {
      console.error('[PendingSyncView] Erreur sync:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Erreur lors de la synchronisation.',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Réinitialiser la sync locale
  const handleResetSync = async () => {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser la synchronisation locale ? Cela supprimera toutes les métadonnées de sync et forcera une nouvelle synchronisation complète.')) {
      return;
    }

    try {
      setResetting(true);
      await resetFullSync();
      await showAlert({
        type: 'success',
        title: 'Synchronisation réinitialisée',
        message: 'La synchronisation locale a été réinitialisée. Vous pouvez maintenant lancer une nouvelle synchronisation complète.',
      });
      // Recharger la page pour forcer une nouvelle sync
      window.location.reload();
    } catch (error: any) {
      console.error('[PendingSyncView] Erreur réinitialisation:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Erreur lors de la réinitialisation.',
      });
      setResetting(false);
    }
  };

  // Lancer la full sync complète
  const handleFullSync = async () => {
    try {
      setRunningFullSync(true);
      const result = await runFullSync();
      
      await showAlert({
        type: result.success ? 'success' : 'error',
        title: result.success ? 'Synchronisation complète terminée' : 'Erreur de synchronisation',
        message: result.success 
          ? `Synchronisation complète terminée. ${Object.keys(result.tables).length} tables synchronisées.`
          : result.error || 'Erreur lors de la synchronisation complète.',
      });
      
      // Recharger les données pour mettre à jour l'affichage
      const db = await getLocalDB();
      const stats: IndexedDBStats[] = [];
      // ✅ Utiliser la même liste complète que le chargement initial (avec noms PascalCase, tri alphabétique)
      const tables = [
        { name: 'Category', label: 'Category', icon: FolderTree, store: db.Category, isReference: true },
        { name: 'Document', label: 'Document', icon: FileText, store: db.Document },
        { name: 'DocumentType', label: 'DocumentType', icon: FileType, store: db.DocumentType, isReference: true },
        { name: 'EcheanceRecurrente', label: 'EcheanceRecurrente', icon: Calendar, store: db.EcheanceRecurrente },
        { name: 'FiscalCompatibility', label: 'FiscalCompatibility', icon: Link, store: db.FiscalCompatibility, isReference: true },
        { name: 'FiscalRegime', label: 'FiscalRegime', icon: BookOpen, store: db.FiscalRegime, isReference: true },
        { name: 'FiscalSimulation', label: 'FiscalSimulation', icon: Calculator, store: db.FiscalSimulation },
        { name: 'FiscalType', label: 'FiscalType', icon: Scale, store: db.FiscalType, isReference: true },
        { name: 'Lease', label: 'Lease', icon: FileCheck, store: db.Lease },
        { name: 'Loan', label: 'Loan', icon: CreditCard, store: db.Loan },
        { name: 'ManagementCompany', label: 'ManagementCompany', icon: Building, store: db.ManagementCompany, isReference: true },
        { name: 'NatureEntity', label: 'NatureEntity', icon: Tag, store: db.NatureEntity, isReference: true },
        { name: 'Property', label: 'Property', icon: Building2, store: db.Property },
        { name: 'Signal', label: 'Signal', icon: Radio, store: db.Signal, isReference: true },
        { name: 'Tenant', label: 'Tenant', icon: Users, store: db.Tenant },
        { name: 'Transaction', label: 'Transaction', icon: Receipt, store: (db as any).Transaction && typeof (db as any).Transaction.where === 'function' ? (db as any).Transaction : db.tables.find(t => t.name === 'Transaction') },
      ].sort((a, b) => a.name.localeCompare(b.name)); // Tri alphabétique final

      for (const { name, label, icon, store, isReference } of tables) {
        try {
          // Vérifier si la table existe dans la base de données
          if (!store) {
            stats.push({ 
              table: name, 
              label, 
              icon, 
              count: 0, 
              lastUpdate: null,
              fullSyncStatus: 'not-started',
            });
            continue;
          }

          // Pour les tables de référence, compter tous les items (pas de filtre organizationId)
          const count = isReference 
            ? await store.count()
            : await store.where('organizationId').equals(organizationId).count();
          const syncMeta = await db.syncMeta.get(name);
          const lastUpdate = syncMeta?.lastSyncAt || null;
          
          let fullSyncStatus: 'ok' | 'incomplete' | 'error' | 'not-started' = 'not-started';
          if (syncMeta) {
            if (syncMeta.error) {
              fullSyncStatus = 'error';
            } else if (lastUpdate) {
              // Si on a une dernière sync et des données, c'est OK
              // Si on a une dernière sync mais pas de données, c'est incomplet
              fullSyncStatus = count > 0 ? 'ok' : 'incomplete';
            } else {
              fullSyncStatus = 'not-started';
            }
          }
          
          stats.push({
            table: name,
            label,
            icon,
            count,
            lastUpdate,
            fullSyncStatus,
          });
        } catch (e: any) {
          // Table peut ne pas exister (NotFoundError) ou autre erreur
          console.warn(`[PendingSyncView] Table ${name} non disponible:`, e?.message || e);
          stats.push({ 
            table: name, 
            label, 
            icon, 
            count: 0, 
            lastUpdate: null,
            fullSyncStatus: 'not-started',
          });
        }
      }
      setIdbStats(stats);
    } catch (error: any) {
      console.error('[PendingSyncView] Erreur full sync:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Erreur lors de la synchronisation complète.',
      });
    } finally {
      setRunningFullSync(false);
    }
  };

  // Précharger les pages importantes
  const handlePreloadPages = async () => {
    try {
      setPreloading(true);
      const { preloadImportantPages } = await import('@/lib/offline/preloadPages');
      const result = await preloadImportantPages();
      
      await showAlert({
        type: result.failed === 0 ? 'success' : 'warning',
        title: result.failed === 0 ? 'Préchargement terminé' : 'Préchargement partiel',
        message: `${result.success} pages préchargées avec succès${result.failed > 0 ? `, ${result.failed} échecs` : ''}.`,
      });
      
      // Recharger les données pour mettre à jour l'affichage des pages préchargées
      const db = await getLocalDB();
      const pages: PreloadedPage[] = [];
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const cache = await caches.open('pages');
          const importantPages = ['/app', '/biens', '/locataires', '/baux', '/transactions', '/dashboard', '/loans', '/echeances', '/documents'];
          
          for (const pagePath of importantPages) {
            const url = new URL(pagePath, window.location.origin).href;
            const cached = await cache.match(url);
            pages.push({
              path: pagePath,
              status: cached ? 'cached' : 'not-cached',
            });
          }
        } catch (e) {
          console.warn('[PendingSyncView] Erreur vérification cache:', e);
        }
      }
      setPreloadedPages(pages);
    } catch (error: any) {
      console.error('[PendingSyncView] Erreur préchargement:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Erreur lors du préchargement des pages.',
      });
    } finally {
      setPreloading(false);
    }
  };

  // Supprimer une opération
  const handleDelete = async (opId: string) => {
    try {
      const db = await getLocalDB();
      await db.pendingOperations.delete(opId);
      
      const allOps = await db.pendingOperations
        .orderBy('createdAt')
        .reverse()
        .toArray();
      const ops = allOps.filter(
        (op: PendingOperation) => op.organizationId === organizationId && op.status !== 'synced'
      );
      setPendingOps(ops);

      await showAlert({
        type: 'success',
        title: 'Opération supprimée',
        message: 'L\'opération en attente a été supprimée.',
      });
    } catch (error: any) {
      console.error('[PendingSyncView] Erreur suppression:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: 'Impossible de supprimer l\'opération.',
      });
    }
  };

  // Supprimer toutes les opérations (tous statuts)
  const handleDeleteAll = async () => {
    const totalCount = pendingOps.length;
    
    if (totalCount === 0) {
      await showAlert({
        type: 'info',
        title: 'Aucune opération',
        message: 'Il n\'y a aucune opération à supprimer.',
      });
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer TOUTES les ${totalCount} opération(s) ?\n\nCette action est irréversible et supprimera toutes les opérations, qu'elles soient en attente, synchronisées, en erreur ou en cours de synchronisation.`)) {
      return;
    }

    try {
      const db = await getLocalDB();
      
      // Supprimer toutes les pendingOps (peu importe le statut)
      await db.pendingOperations.clear();
      
      setPendingOps([]);

      await showAlert({
        type: 'success',
        title: 'Toutes les opérations supprimées',
        message: `${totalCount} opération(s) supprimée(s) avec succès.`,
      });
    } catch (error: any) {
      console.error('[PendingSyncView] Erreur suppression toutes:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: 'Impossible de supprimer toutes les opérations.',
      });
    }
  };

  // Obtenir le badge de statut
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="warning" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            En attente
          </Badge>
        );
      case 'syncing':
        return (
          <Badge variant="info" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Synchronisation...
          </Badge>
        );
      case 'blocked_permanent':
        return (
          <Badge variant="destructive" className="flex items-center gap-1 bg-red-700">
            <XCircle className="h-3 w-3" />
            Bloqué définitivement
          </Badge>
        );
      case 'synced':
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Synchronisé
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="danger" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Erreur
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Formater la date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Formater le timestamp pour les logs
  const formatLogTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
          <span className="ml-3 text-gray-600">Chargement du diagnostic...</span>
        </div>
      </div>
    );
  }

  const activeOps = groupedOps.pending.length + groupedOps.syncing.length + groupedOps.error.length;
  const totalRecords = idbStats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="mb-4 sm:mb-6 space-y-3">
        {/* Ligne 1 : Hamburger + Titre + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Bouton hamburger mobile - Discret, aligné à gauche du titre */}
            {sidebarContext && (
              <button
                onClick={sidebarContext.toggleSidebar}
                className="lg:hidden flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] flex-shrink-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label={sidebarContext.sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
              >
                {sidebarContext.sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            )}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Tableau de bord de synchronisation</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {isOnline && (
            <>
              <Button 
                onClick={handleFullSync} 
                disabled={syncing || preloading || runningFullSync || fullSyncRunning}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {runningFullSync || fullSyncRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Synchronisation complète...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    Synchronisation complète
                  </>
                )}
              </Button>
              <Button 
                onClick={handleSync} 
                disabled={syncing || preloading || runningFullSync || fullSyncRunning}
                variant="outline"
                className="flex items-center gap-2"
              >
                {syncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Synchronisation...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Synchroniser les modifications
                  </>
                )}
              </Button>
              <Button 
                onClick={handlePreloadPages} 
                disabled={syncing || preloading || runningFullSync || fullSyncRunning}
                variant="outline"
                className="flex items-center gap-2"
              >
                {preloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Préchargement...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Précharger les pages
                  </>
                )}
              </Button>
            </>
          )}
          {isOnline && fullSyncDone && (
            <Button 
              onClick={handleResetSync} 
              disabled={resetting || syncing || preloading || runningFullSync || fullSyncRunning}
              variant="outline"
              className="flex items-center gap-2 text-orange-600 hover:text-orange-700"
            >
              {resetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Réinitialisation...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Réinitialiser la sync locale
                </>
              )}
            </Button>
            )}
          </div>
        </div>
        
        {/* Ligne 2 : Description */}
        <p className="text-sm sm:text-base text-gray-600">Centre de contrôle de la synchronisation et des données locales</p>
      </div>

      {/* Résumé global - Cartes KPI par entité */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Résumé global des données locales
          </CardTitle>
          <CardDescription>
            Nombre d'éléments synchronisés dans IndexedDB par type d'entité
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {idbStats.map((stat) => {
              const Icon = stat.icon;
              const diff = stat.diff !== undefined ? stat.diff : null;
              const hasDiff = diff !== null && diff !== 0;
              
              // Badge pour l'état du full sync
              const getFullSyncBadge = () => {
                if (!stat.fullSyncStatus) return null;
                switch (stat.fullSyncStatus) {
                  case 'ok':
                    return <Badge variant="success" size="sm" className="mt-1">✓ Sync OK</Badge>;
                  case 'incomplete':
                    return <Badge variant="warning" size="sm" className="mt-1">⚠ Incomplet</Badge>;
                  case 'error':
                    return <Badge variant="danger" size="sm" className="mt-1">✗ Erreur</Badge>;
                  case 'not-started':
                    return <Badge variant="info" size="sm" className="mt-1">○ Non démarré</Badge>;
                  default:
                    return null;
                }
              };
              
              return (
                <div
                  key={stat.table}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => setSelectedTable({ tableName: stat.table, label: stat.label })}
                >
                  <div className={`p-2 rounded-lg ${hasDiff ? 'bg-orange-100' : 'bg-blue-100'}`}>
                    <Icon className={`h-5 w-5 ${hasDiff ? 'text-orange-600' : 'text-blue-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-600 truncate">{stat.label}</div>
                    <div className="font-bold text-lg">{stat.count}</div>
                    {getFullSyncBadge()}
                    {hasDiff && (
                      <div className={`text-xs ${diff > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                        {diff > 0 ? `+${diff} en local` : `${diff} vs remote`}
                      </div>
                    )}
                    {stat.lastUpdate && (
                      <div className="text-xs text-gray-400 mt-1">
                        MAJ: {formatDate(stat.lastUpdate)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* État global de synchronisation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            État global de synchronisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-600" />
              )}
              <div>
                <div className="text-sm text-gray-600">État réseau</div>
                <div className="font-semibold">{isOnline ? '🟢 Online' : '🟡 Offline'}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {status === 'idle' && pendingOperationsCount === 0 && errorOperationsCount === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : status === 'syncing' ? (
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              ) : errorOperationsCount > 0 ? (
                <XCircle className="h-5 w-5 text-red-600" />
              ) : (
                <Clock className="h-5 w-5 text-yellow-600" />
              )}
              <div>
                <div className="text-sm text-gray-600">Sync globale</div>
                <div className="font-semibold">
                  {status === 'idle' && pendingOperationsCount === 0 && errorOperationsCount === 0 ? '🟢 Synchronisé' :
                   status === 'syncing' ? '🔄 Synchronisation…' :
                   errorOperationsCount > 0 ? '🔴 Erreurs détectées' :
                   '🟡 Modifications en attente'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Clock className="h-5 w-5 text-gray-600" />
              <div>
                <div className="text-sm text-gray-600">Dernière sync réussie</div>
                <div className="font-semibold text-sm">{lastSyncAt ? formatDate(lastSyncAt) : 'Aucune'}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* État des opérations de sync */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                État des opérations de synchronisation
              </CardTitle>
              <CardDescription>
                Compteurs et détails des opérations en attente et en erreur
              </CardDescription>
            </div>
            {pendingOps.length > 0 && (
              <Button
                variant="outline"
                onClick={handleDeleteAll}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer toutes les opérations
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Compteurs : uniquement en attente et en erreur (pas de "synchronisées", push = suppression immédiate) */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">{pendingOps.length}</div>
              <div className="text-sm text-gray-600 mt-1">Total</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">{groupedOps.pending.length + groupedOps.syncing.length}</div>
              <div className="text-sm text-gray-600 mt-1">En attente</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-600">{groupedOps.error.length}</div>
              <div className="text-sm text-gray-600 mt-1">En erreur</div>
            </div>
          </div>

          {/* Tableau détaillé des opérations */}
          {pendingOps.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="Aucune opération en attente"
              description="Toutes vos données sont synchronisées avec le serveur."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Entité</TableHeaderCell>
                  <TableHeaderCell>Opération</TableHeaderCell>
                  <TableHeaderCell>Statut</TableHeaderCell>
                  <TableHeaderCell>Tentatives</TableHeaderCell>
                  <TableHeaderCell>Créée le</TableHeaderCell>
                  <TableHeaderCell>Dernière MAJ</TableHeaderCell>
                  <TableHeaderCell>Erreur</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingOps.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell>
                      <div className="font-medium capitalize">{op.entity}</div>
                      <div className="text-sm text-gray-500">ID: {op.entityId ? `${op.entityId.substring(0, 8)}...` : 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{op.operation}</span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(op.status)}
                    </TableCell>
                    <TableCell>
                      {op.retryCount > 0 ? `${op.retryCount}/3` : '0'}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDate(op.createdAt)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDate(op.updatedAt)}</div>
                    </TableCell>
                    <TableCell>
                      {op.errorMessage || op.blockReason ? (
                        <div className="flex items-start gap-1 max-w-xs">
                          <AlertCircle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${op.status === 'blocked_permanent' ? 'text-red-700' : 'text-red-600'}`} />
                          <div className="flex flex-col gap-1">
                            <span className={`text-sm break-words ${op.status === 'blocked_permanent' ? 'text-red-700 font-medium' : 'text-red-600'}`}>
                              {op.errorMessage || op.blockReason}
                          </span>
                            {op.status === 'blocked_permanent' && op.blockReason && (
                              <span className="text-xs text-gray-500 italic">
                                Détails: {op.blockReason}
                              </span>
                            )}
                            {op.blockReason && op.blockReason.includes('transaction_not_synced') && (
                              <span className="text-xs text-blue-600 italic mt-1">
                                💡 Cette opération sera automatiquement retentée après la synchronisation de la transaction.
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(op.status === 'error' || op.status === 'synced' || op.status === 'blocked_permanent') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(op.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Message si serveur inaccessible */}
      {serverUnavailable && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm font-medium">
                Le serveur est inaccessible. Les comparaisons avec les données distantes ne sont pas disponibles.
                La page fonctionne en mode offline avec les données locales uniquement.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Écart local vs remote (diagnostic) */}
      {isOnline && !serverUnavailable && Object.keys(remoteCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Écart local vs serveur (diagnostic)
            </CardTitle>
            <CardDescription>
              Comparaison entre les données locales (IndexedDB) et les données distantes (Supabase)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Entité</TableHeaderCell>
                  <TableHeaderCell>Local (IndexedDB)</TableHeaderCell>
                  <TableHeaderCell>Distant (Supabase)</TableHeaderCell>
                  <TableHeaderCell>Écart</TableHeaderCell>
                  <TableHeaderCell>Statut</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {idbStats
                  .filter(stat => stat.remoteCount !== undefined)
                  .map((stat) => {
                    const diff = stat.diff || 0;
                    const isOk = diff === 0;
                    const hasMoreLocal = diff > 0;
                    
                    return (
                      <TableRow key={stat.table}>
                        <TableCell className="font-medium">{stat.label}</TableCell>
                        <TableCell>{stat.count}</TableCell>
                        <TableCell>{stat.remoteCount}</TableCell>
                        <TableCell>
                          <span className={isOk ? 'text-green-600' : hasMoreLocal ? 'text-orange-600' : 'text-blue-600'}>
                            {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isOk ? (
                            <Badge variant="success">OK</Badge>
                          ) : hasMoreLocal ? (
                            <Badge variant="warning">+{diff} en local</Badge>
                          ) : (
                            <Badge variant="info">{diff} vs remote</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}


      {/* Pages préchargées */}
      <Card>
        <CardHeader>
          <CardTitle>Pages préchargées (HTML Ready Cache)</CardTitle>
          <CardDescription>Pages HTML mises en cache pour le mode offline</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Page</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preloadedPages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-gray-500">
                    Aucune page préchargée
                  </TableCell>
                </TableRow>
              ) : (
                preloadedPages.map((page) => (
                  <TableRow key={page.path}>
                    <TableCell className="font-mono">{page.path}</TableCell>
                    <TableCell>
                      {page.status === 'cached' ? (
                        <Badge variant="success">Préchargée</Badge>
                      ) : (
                        <Badge variant="warning">Non préchargée</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Logs importants (24h) */}
      {syncLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Logs importants (24h)</CardTitle>
            <CardDescription>Événements de synchronisation récents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {syncLogs.map((log, idx) => (
                <div key={idx} className="text-sm font-mono text-gray-700 p-2 bg-gray-50 rounded">
                  <span className="text-gray-500">[{formatLogTime(log.timestamp)}]</span>{' '}
                  {log.event}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal pour afficher les données IndexedDB */}
      {selectedTable && (
        <IndexedDBTableModal
          isOpen={!!selectedTable}
          onClose={() => setSelectedTable(null)}
          tableName={selectedTable.tableName}
          label={selectedTable.label}
          organizationId={organizationId}
        />
      )}
    </div>
  );
}
