'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/progress';
import {
  Archive,
  Download,
  Upload,
  Clock,
  CheckCircle,
  Calendar,
  ShieldAlert,
  Layers,
  Trash2,
} from 'lucide-react';
import { notify2 } from '@/lib/notify2';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type BackupJobType = 'export' | 'import' | 'restore' | 'export-v2' | 'restore-v2-db' | 'restore-v2-full';
type ImportMode = 'validate' | 'dry-run' | 'apply';
type ImportStrategy = 'merge' | 'replace';
type BackupKind = 'admin-only' | 'v2-db-only' | 'v2-full' | 'v2-safety' | 'unknown';
type RestoreFinalState = 'success' | 'failed' | 'rolled_back' | 'rollback_failed';
type HistorySafetyFilter = 'all' | 'safety-only' | 'non-safety';
type RestoreSourceType = 'history' | 'uploaded_zip';

interface RestoreIssue {
  code?: string;
  severity?: string;
  message?: string;
}

interface BackupMetaV2 {
  backupVersion?: string;
  includes?: {
    documentsBinary?: boolean;
  };
  safetyContext?: {
    purpose?: string;
    sourceBackupId?: string;
  };
}

interface BackupRecord {
  id: string;
  createdAt: string;
  createdBy: string;
  scope: string;
  sizeBytes: number;
  checksum: string;
  note?: string;
  meta: unknown;
}

interface BackupSchedule {
  id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  hour: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  retentionDays: number;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

interface BackupJob {
  id: string;
  type: BackupJobType;
  state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string | null;
  progressPercent: number;
  logs?: Array<{ at: string; message: string } | string> | null;
  result?: Record<string, unknown> | null;
  error?: { message?: string; context?: string } | null;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export default function BackupManagementCard() {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingV2, setIsExportingV2] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCriticalRestoreModal, setShowCriticalRestoreModal] = useState(false);
  const [showZipRestoreModal, setShowZipRestoreModal] = useState(false);
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null);
  const [schedule] = useState<BackupSchedule | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('validate');
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>('merge');
  const [jobResult, setJobResult] = useState<Record<string, unknown> | null>(null);
  const [jobResultType, setJobResultType] = useState<BackupJobType | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<BackupJob | null>(null);
  const [currentJobSourceHint, setCurrentJobSourceHint] = useState<RestoreSourceType | null>(null);
  const [criticalRestoreBackupId, setCriticalRestoreBackupId] = useState<string | null>(null);
  const [criticalConfirmInput, setCriticalConfirmInput] = useState('');
  const [zipRestoreFile, setZipRestoreFile] = useState<File | null>(null);
  const [historySafetyFilter, setHistorySafetyFilter] = useState<HistorySafetyFilter>('all');
  const [historySourceBackupFilter, setHistorySourceBackupFilter] = useState('');

  const isBusy = !!currentJobId || isExporting || isExportingV2 || isImporting;

  const getBackupMetaV2 = (meta: unknown): BackupMetaV2 | null => {
    if (!meta || typeof meta !== 'object') return null;
    const candidate = meta as Record<string, unknown>;
    const includes = candidate.includes;
    const parsedIncludes =
      includes && typeof includes === 'object'
        ? { documentsBinary: Boolean((includes as Record<string, unknown>).documentsBinary) }
        : undefined;
    return {
      backupVersion: typeof candidate.backupVersion === 'string' ? candidate.backupVersion : undefined,
      includes: parsedIncludes,
      safetyContext:
        candidate.safetyContext && typeof candidate.safetyContext === 'object'
          ? {
              purpose: String((candidate.safetyContext as Record<string, unknown>).purpose || ''),
              sourceBackupId: String((candidate.safetyContext as Record<string, unknown>).sourceBackupId || ''),
            }
          : undefined,
    };
  };

  const resolveBackupKind = (backup: BackupRecord): BackupKind => {
    const meta = getBackupMetaV2(backup.meta);
    const hasV2Version = Boolean(meta?.backupVersion && meta.backupVersion.startsWith('2.'));
    if (backup.scope === 'full-v2-safety') return 'v2-safety';
    if (backup.scope === 'admin') return 'admin-only';
    if (meta?.includes?.documentsBinary) return 'v2-full';
    if (backup.scope === 'full-v2' || hasV2Version) return 'v2-db-only';
    return 'unknown';
  };

  const backupKindLabel = (kind: BackupKind): string => {
    if (kind === 'admin-only') return 'Admin-only';
    if (kind === 'v2-db-only') return 'V2 DB-only';
    if (kind === 'v2-full') return 'V2 complet (DB+objets)';
    if (kind === 'v2-safety') return 'V2 safety backup';
    return 'Type inconnu';
  };

  const backupKindBadgeClass = (kind: BackupKind): string => {
    if (kind === 'admin-only') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (kind === 'v2-db-only') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (kind === 'v2-full') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (kind === 'v2-safety') return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getSourceBackupIdFromRecord = (backup: BackupRecord): string | null => {
    const meta = getBackupMetaV2(backup.meta);
    const sourceId = meta?.safetyContext?.sourceBackupId;
    if (!sourceId) return null;
    const normalized = sourceId.trim();
    return normalized.length > 0 ? normalized : null;
  };

  const isSafetyBackupProtected = (backup: BackupRecord): boolean => {
    if (backup.scope !== 'full-v2-safety') return false;
    const createdAtMs = Date.parse(backup.createdAt);
    if (Number.isNaN(createdAtMs)) return false;
    const ageMs = Date.now() - createdAtMs;
    return ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000;
  };

  const filteredHistory = history.filter((backup) => {
    const kind = resolveBackupKind(backup);
    const isSafety = kind === 'v2-safety';

    if (historySafetyFilter === 'safety-only' && !isSafety) return false;
    if (historySafetyFilter === 'non-safety' && isSafety) return false;

    const sourceFilter = historySourceBackupFilter.trim().toLowerCase();
    if (!sourceFilter) return true;
    const sourceId = getSourceBackupIdFromRecord(backup)?.toLowerCase() || '';
    return sourceId.includes(sourceFilter);
  });
  const visibleSafetyBackupsCount = filteredHistory.filter(
    (backup) => resolveBackupKind(backup) === 'v2-safety'
  ).length;
  const visibleProtectedSafetyBackupsCount = filteredHistory.filter(
    (backup) => resolveBackupKind(backup) === 'v2-safety' && isSafetyBackupProtected(backup)
  ).length;

  const jobTypeLabel = (type: BackupJobType): string => {
    if (type === 'export') return 'Export admin';
    if (type === 'import') return 'Import admin';
    if (type === 'restore') return 'Restore admin';
    if (type === 'export-v2') return 'Export V2';
    if (type === 'restore-v2-db') return 'Restore V2 DB-only';
    return 'Restore V2 complet';
  };

  const getRestoreFinalState = (
    payload: Record<string, unknown> | null
  ): RestoreFinalState | null => {
    if (!payload) return null;
    const value = payload.finalState;
    if (
      value === 'success' ||
      value === 'failed' ||
      value === 'rolled_back' ||
      value === 'rollback_failed'
    ) {
      return value;
    }
    return null;
  };

  const getRestoreFinalStateUi = (
    state: RestoreFinalState | null
  ): { label: string; className: string } => {
    if (state === 'success') {
      return {
        label: 'Restauration complète réussie',
        className: 'bg-green-100 text-green-800 border-green-200',
      };
    }
    if (state === 'failed') {
      return {
        label: 'Restauration échouée',
        className: 'bg-red-100 text-red-800 border-red-200',
      };
    }
    if (state === 'rolled_back') {
      return {
        label: 'Échec de la restauration, rollback automatique réussi',
        className: 'bg-amber-100 text-amber-900 border-amber-200',
      };
    }
    if (state === 'rollback_failed') {
      return {
        label: 'Échec de la restauration et du rollback',
        className: 'bg-red-200 text-red-900 border-red-300',
      };
    }
    return {
      label: 'État final non communiqué',
      className: 'bg-gray-100 text-gray-700 border-gray-200',
    };
  };

  const getRestoreSource = (
    payload: Record<string, unknown> | null,
    type?: BackupJobType | null,
    hint?: RestoreSourceType | null
  ): RestoreSourceType | null => {
    const sourceType = payload?.sourceType;
    if (sourceType === 'history' || sourceType === 'uploaded_zip') {
      return sourceType;
    }
    if (hint) return hint;
    if (type === 'restore-v2-db') return 'history';
    return null;
  };

  const getRestoreSourceUi = (
    source: RestoreSourceType | null
  ): { label: string; className: string } => {
    if (source === 'history') {
      return {
        label: 'Source : Historique',
        className: 'bg-gray-100 text-gray-800 border-gray-200',
      };
    }
    if (source === 'uploaded_zip') {
      return {
        label: 'Source : ZIP importé',
        className: 'bg-blue-100 text-blue-900 border-blue-200',
      };
    }
    return {
      label: 'Source : non précisée',
      className: 'bg-gray-50 text-gray-600 border-gray-200',
    };
  };

  const parseIssues = (raw: unknown): RestoreIssue[] => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const candidate = item as Record<string, unknown>;
        return {
          code: typeof candidate.code === 'string' ? candidate.code : undefined,
          severity: typeof candidate.severity === 'string' ? candidate.severity : undefined,
          message: typeof candidate.message === 'string' ? candidate.message : undefined,
        } satisfies RestoreIssue;
      })
      .filter((item): item is RestoreIssue => Boolean(item));
  };

  const isImportantWarning = (issue: RestoreIssue): boolean => {
    if (!issue.code) return false;
    return [
      'ROLLBACK_OBJECTS_POTENTIAL_ORPHANS',
      'RESTORE_ROW_COUNT_MISMATCH',
      'RESTORE_OBJECT_COUNT_MISMATCH',
      'RESTORE_PLAN_MISSING_DATASETS',
    ].includes(issue.code);
  };

  const shouldDisplayCriticalBanner = (payload: Record<string, unknown> | null): boolean => {
    const state = getRestoreFinalState(payload);
    if (state === 'rollback_failed') return true;
    const warnings = parseIssues(payload?.warnings);
    const errors = parseIssues(payload?.errors);
    return errors.length > 0 || warnings.some((warning) => isImportantWarning(warning));
  };

  useEffect(() => {
    if (!currentJobId) return;

    const poll = async () => {
      try {
        const response = await fetch(`/api/admin/backup/jobs/${currentJobId}`);
        const data = await response.json();
        if (!response.ok || !data.success) {
          return;
        }

        const job = data.data as BackupJob;
        setCurrentJob(job);

        if (job.state === 'completed') {
          setCurrentJobId(null);
          setCurrentJobSourceHint(null);
          setIsExporting(false);
          setIsExportingV2(false);
          setIsImporting(false);
          setJobResult(job.result || null);
          setJobResultType(job.type);
          const actionLabel = jobTypeLabel(job.type);
          const restoreState =
            job.type === 'restore-v2-full' ? getRestoreFinalState(job.result || null) : null;
          if (restoreState === 'rolled_back') {
            notify2.info(`${actionLabel} compensé`, 'Rollback automatique exécuté avec succès.');
          } else {
            notify2.success(`${actionLabel} terminé`);
          }
          const downloadUrl = typeof job.result?.downloadUrl === 'string' ? job.result.downloadUrl : null;
          if ((job.type === 'export' || job.type === 'export-v2') && downloadUrl) {
            window.location.href = downloadUrl;
          }
          loadHistory();
        } else if (job.state === 'failed' || job.state === 'cancelled') {
          setCurrentJobId(null);
          setCurrentJobSourceHint(null);
          setIsExporting(false);
          setIsExportingV2(false);
          setIsImporting(false);
          const errorMessage = job.error?.message || 'Le job a échoué';
          const actionLabel = jobTypeLabel(job.type);
          notify2.error(`Échec du ${actionLabel}`, errorMessage);
          setJobResult({
            ...(job.result || {}),
            error: errorMessage,
            details: job.error?.context,
            logs: normalizeJobLogs(job.logs),
          });
          setJobResultType(job.type);
        }
      } catch {
        // Polling best effort
      }
    };

    poll();
    const intervalId = setInterval(poll, 2000);
    return () => clearInterval(intervalId);
  }, [currentJobId]);

  const normalizeJobLogs = (logs?: BackupJob['logs']): string[] => {
    if (!logs || !Array.isArray(logs)) return [];
    return logs.map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object' && 'at' in entry && 'message' in entry) {
        const at = String(entry.at ?? '');
        const message = String(entry.message ?? '');
        return `[${at}] ${message}`;
      }
      return JSON.stringify(entry);
    });
  };

  const startJobTracking = (
    jobId: string,
    type: BackupJobType,
    sourceHint?: RestoreSourceType
  ) => {
    setCurrentJobId(jobId);
    setCurrentJobSourceHint(sourceHint || null);
    setCurrentJob({
      id: jobId,
      type,
      state: 'pending',
      currentStep: 'Préparation',
      progressPercent: 0,
      logs: [],
    });
    setJobResult(null);
    setJobResultType(null);
  };

  // Ne plus charger automatiquement au montage pour éviter les erreurs 401
  // Les données seront chargées quand l'utilisateur clique sur les boutons
  // useEffect(() => {
  //   loadHistory();
  //   loadSchedule();
  // }, []);

  const loadHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const response = await fetch('/api/admin/backup/history');
      if (!response.ok) {
        // Ignore silencieusement les erreurs d'auth au chargement initial
        if (response.status === 401 || response.status === 403) {
          return;
        }
      }
      const data = await response.json();
      if (data.success) {
        setHistory(data.data);
      }
    } catch {
      // Erreur silencieuse, pas critique au chargement
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const extractApiError = async (
    response: Response,
    fallbackMessage: string
  ): Promise<{ title: string; details: string }> => {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    const backendMessage = payload.error || fallbackMessage;
    if (response.status === 409) {
      return {
        title: 'Opération bloquée par un job en cours',
        details: backendMessage,
      };
    }
    return {
      title: 'Erreur serveur',
      details: backendMessage,
    };
  };

  // Export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/admin/backup/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'export',
          scope: 'admin',
          includeSensitive: false,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        const apiError = await extractApiError(response, 'Erreur lors du lancement de l’export');
        throw new Error(`${apiError.title}: ${apiError.details}`);
      }

      startJobTracking(data.data.jobId, 'export');
      notify2.info('Export lancé', 'Le traitement est exécuté en arrière-plan.');
    } catch (error) {
      notify2.error('Erreur lors de l’export', error instanceof Error ? error.message : undefined);
      setIsExporting(false);
    }
  };

  const handleExportV2 = async () => {
    setIsExportingV2(true);
    try {
      const response = await fetch('/api/admin/backup/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'export-v2',
        }),
      });
      if (!response.ok) {
        const apiError = await extractApiError(response, 'Erreur lors du lancement de l’export V2');
        throw new Error(`${apiError.title}: ${apiError.details}`);
      }
      const data = (await response.json()) as { success: boolean; data?: { jobId: string }; error?: string };
      if (!data.success || !data.data?.jobId) {
        throw new Error(data.error || 'Réponse invalide lors du lancement de l’export V2');
      }
      startJobTracking(data.data.jobId, 'export-v2');
      notify2.info('Export V2 lancé', 'Le traitement est exécuté en arrière-plan.');
    } catch (error) {
      notify2.error(
        'Erreur export V2',
        error instanceof Error ? error.message : 'Erreur inconnue'
      );
      setIsExportingV2(false);
    }
  };

  // Import
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        notify2.error('Fichier trop volumineux (max 25 Mo)');
        return;
      }
      setSelectedFile(file);
      setJobResult(null);
      setJobResultType(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      notify2.error('Veuillez sélectionner un fichier');
      return;
    }

    setIsImporting(true);
    setJobResult(null);
    
    try {
      const formData = new FormData();
      formData.append('type', 'import');
      formData.append('mode', importMode);
      formData.append('strategy', importStrategy);
      formData.append('file', selectedFile);
      const response = await fetch('/api/admin/backup/jobs', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        const apiError = await extractApiError(response, `Erreur HTTP ${response.status}`);
        throw new Error(`${apiError.title}: ${apiError.details}`);
      }

      startJobTracking(data.data.jobId, 'import');
      notify2.info('Import lancé', 'Le traitement est exécuté en arrière-plan.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      notify2.error('Erreur lors de l’import', errorMessage);
      setJobResult({ error: 'Erreur réseau ou serveur', details: errorMessage, logs: [`❌ ${errorMessage}`] });
      setJobResultType('import');
      setIsImporting(false);
    } finally {
      // L'état isImporting est géré à la fin du job en polling
    }
  };

  const handleDownloadBackup = (backupId: string) => {
    window.location.href = `/api/admin/backup/download/${backupId}`;
  };

  const handleDownloadDocumentsMap = (backupId: string) => {
    window.location.href = `/api/admin/backup/download/${backupId}/documents-map`;
  };

  const handleDeleteBackup = async (backup: BackupRecord) => {
    if (deletingBackupId) return;
    const confirmed = window.confirm(
      `Supprimer cette sauvegarde ?\n\n- Entrée historique: ${backup.id}\n- Archive ZIP associée: sera aussi supprimée\n\nCette action est irréversible.`
    );
    if (!confirmed) return;

    setDeletingBackupId(backup.id);
    try {
      const response = await fetch(`/api/admin/backup/history/${backup.id}`, {
        method: 'DELETE',
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        data?: { archiveMissing?: boolean; warning?: string | null };
      };
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Suppression impossible');
      }

      if (data.data?.archiveMissing) {
        notify2.info(
          'Suppression partielle maîtrisée',
          data.data.warning || 'Archive absente, historique nettoyé'
        );
      } else {
        notify2.success('Sauvegarde supprimée');
      }
      await loadHistory();
    } catch (error) {
      notify2.error(
        'Échec de la suppression',
        error instanceof Error ? error.message : 'Erreur inconnue'
      );
    } finally {
      setDeletingBackupId(null);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    const confirmed = window.confirm(
      'Confirmer la restauration ADMIN ?\n\nCette opération peut écraser les référentiels existants.\nAucune donnée métier/documents n’est restaurée dans cette version.'
    );
    if (!confirmed) return;

    try {
      const response = await fetch('/api/admin/backup/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'restore',
          backupId,
          mode: 'apply',
          strategy: 'replace',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        const apiError = await extractApiError(response, 'Erreur de restauration');
        throw new Error(`${apiError.title}: ${apiError.details}`);
      }
      startJobTracking(data.data.jobId, 'restore');
      notify2.info('Restauration lancée', 'Le traitement est exécuté en arrière-plan.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      notify2.error('Échec de la restauration', message);
    }
  };

  const handleRestoreV2DbOnly = async (backupId: string) => {
    const confirmed = window.confirm(
      'Confirmer la restauration V2 DB-only ?\n\nMode full-replace: les données DB actuelles seront remplacées.\nLes objets/binaires ne seront pas restaurés.'
    );
    if (!confirmed) return;
    try {
      const response = await fetch('/api/admin/backup/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'restore-v2-db',
          backupId,
          mode: 'full-replace',
        }),
      });
      if (!response.ok) {
        const apiError = await extractApiError(response, 'Erreur de restauration V2 DB-only');
        throw new Error(`${apiError.title}: ${apiError.details}`);
      }
      const data = (await response.json()) as { success: boolean; data?: { jobId: string }; error?: string };
      if (!data.success || !data.data?.jobId) {
        throw new Error(data.error || 'Réponse invalide lors du lancement du restore V2 DB-only');
      }
      startJobTracking(data.data.jobId, 'restore-v2-db', 'history');
      notify2.info('Restore V2 DB-only lancé', 'Le traitement est exécuté en arrière-plan.');
    } catch (error) {
      notify2.error(
        'Échec du restore V2 DB-only',
        error instanceof Error ? error.message : 'Erreur inconnue'
      );
    }
  };

  const openCriticalRestoreModal = (backup: BackupRecord) => {
    setCriticalRestoreBackupId(backup.id);
    setCriticalConfirmInput('');
    setShowCriticalRestoreModal(true);
  };

  const criticalRestoreBackup =
    criticalRestoreBackupId ? history.find((item) => item.id === criticalRestoreBackupId) ?? null : null;

  const handleConfirmRestoreV2Full = async () => {
    if (!criticalRestoreBackupId) return;
    try {
      const response = await fetch('/api/admin/backup/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'restore-v2-full',
          backupId: criticalRestoreBackupId,
          mode: 'full-replace',
        }),
      });
      if (!response.ok) {
        const apiError = await extractApiError(response, 'Erreur de restauration V2 complète');
        throw new Error(`${apiError.title}: ${apiError.details}`);
      }
      const data = (await response.json()) as { success: boolean; data?: { jobId: string }; error?: string };
      if (!data.success || !data.data?.jobId) {
        throw new Error(data.error || 'Réponse invalide lors du lancement du restore V2 complet');
      }

      setShowCriticalRestoreModal(false);
      setCriticalRestoreBackupId(null);
      setCriticalConfirmInput('');
      startJobTracking(data.data.jobId, 'restore-v2-full', 'history');
      notify2.info('Restore V2 complet lancé', 'Opération critique en cours, suivez la progression.');
    } catch (error) {
      notify2.error(
        'Échec du restore V2 complet',
        error instanceof Error ? error.message : 'Erreur inconnue'
      );
    }
  };

  const handleZipRestoreFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      notify2.error('Fichier invalide', 'Sélectionnez une archive ZIP.');
      return;
    }
    const MAX_SIZE = 250 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      notify2.error('Fichier trop volumineux', 'Taille max 250 Mo pour une restauration V2 ZIP.');
      return;
    }
    setZipRestoreFile(file);
  };

  const handleConfirmZipRestore = async () => {
    if (!zipRestoreFile) {
      notify2.error('Archive manquante', 'Sélectionnez un fichier ZIP.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('type', 'restore-v2-full-upload');
      formData.append('mode', 'full-replace');
      formData.append('file', zipRestoreFile);

      const response = await fetch('/api/admin/backup/jobs', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erreur de lancement restore ZIP');
      }

      setShowZipRestoreModal(false);
      setZipRestoreFile(null);
      startJobTracking(data.data.jobId, 'restore-v2-full', 'uploaded_zip');
      notify2.info(
        'Restore V2 depuis ZIP lancé',
        'Smartimmo va pré-valider le ZIP puis restaurer en mode full-replace.'
      );
    } catch (error) {
      notify2.error(
        'Échec du restore depuis ZIP',
        error instanceof Error ? error.message : 'Erreur inconnue'
      );
    }
  };

  // Format taille fichier
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  };

  const renderResultSummary = () => {
    if (!jobResult || !jobResultType) return null;
    const hasError = typeof jobResult.error === 'string' && jobResult.error.length > 0;
    if (hasError) {
      return (
        <div className="space-y-1 text-xs text-red-700">
          <p>{String(jobResult.error)}</p>
          {jobResult.details && <p>Détails: {String(jobResult.details)}</p>}
        </div>
      );
    }

    const lines: string[] = [];
    const finalState = getRestoreFinalState(jobResult);
    const finalStateUi = getRestoreFinalStateUi(finalState);
    const rollbackAttempted = jobResult.rollbackAttempted === true;
    const rollbackSucceeded = jobResult.rollbackSucceeded === true;
    const safetyBackupId =
      typeof jobResult.safetyBackupId === 'string' && jobResult.safetyBackupId.length > 0
        ? jobResult.safetyBackupId
        : null;
    const sourceBackupId =
      typeof jobResult.sourceBackupId === 'string' && jobResult.sourceBackupId.length > 0
        ? jobResult.sourceBackupId
        : null;
    const sourceBackupVersion =
      typeof jobResult.sourceBackupVersion === 'string' ? jobResult.sourceBackupVersion : null;
    const sourceType =
      typeof jobResult.sourceType === 'string' ? jobResult.sourceType : null;
    const sourceFileName =
      typeof jobResult.sourceFileName === 'string' ? jobResult.sourceFileName : null;
    const restoreSource = getRestoreSource(
      jobResult,
      jobResultType,
      currentJobSourceHint
    );
    const exportV2BackupRecordId =
      typeof jobResult.backupRecordId === 'string' ? jobResult.backupRecordId : null;
    const rowCount = typeof jobResult.rowCount === 'number' ? jobResult.rowCount : null;
    const purgeCount = typeof jobResult.purgeCount === 'number' ? jobResult.purgeCount : null;
    const objectsRestored =
      typeof jobResult.objectsRestored === 'number' ? jobResult.objectsRestored : null;
    const bytesObjectsRestored =
      typeof jobResult.bytesObjectsRestored === 'number' ? jobResult.bytesObjectsRestored : null;
    const backupVersion =
      typeof jobResult.backupVersion === 'string' ? jobResult.backupVersion : null;
    const restoreMode = typeof jobResult.mode === 'string' ? jobResult.mode : null;
    const warnings = parseIssues(jobResult.warnings);
    const errors = parseIssues(jobResult.errors);
    const importantWarnings = warnings.filter((warning) => isImportantWarning(warning));

    if (Array.isArray(jobResult.tablesRestored)) {
      lines.push(`Tables restaurées: ${jobResult.tablesRestored.length}`);
    }
    if (rowCount !== null) lines.push(`Lignes restaurées: ${rowCount}`);
    if (purgeCount !== null) lines.push(`Lignes purgées: ${purgeCount}`);
    if (objectsRestored !== null) lines.push(`Objets restaurés: ${objectsRestored}`);
    if (bytesObjectsRestored !== null) {
      lines.push(`Volume objets restaurés: ${formatSize(bytesObjectsRestored)}`);
    }
    if (backupVersion) lines.push(`Version backup: ${backupVersion}`);
    if (restoreMode) lines.push(`Mode: ${restoreMode}`);
    if (sourceType === 'uploaded_zip' && sourceFileName) {
      lines.push(`Source ZIP importée: ${sourceFileName}`);
    }
    if (typeof jobResult.objectCount === 'number') {
      lines.push(`Objets exportés: ${jobResult.objectCount}`);
    }
    if (typeof jobResult.bytesObjects === 'number') {
      lines.push(`Volume objets exportés: ${formatSize(jobResult.bytesObjects)}`);
    }
    if (warnings.length > 0) lines.push(`Warnings: ${warnings.length}`);
    if (errors.length > 0) lines.push(`Erreurs structurées: ${errors.length}`);

    return (
      <div className="space-y-2">
        {(jobResultType === 'restore-v2-full' || jobResultType === 'restore-v2-db') && (
          <span
            className={`inline-flex px-2 py-1 rounded border text-xs font-medium ${
              getRestoreSourceUi(restoreSource).className
            }`}
          >
            {getRestoreSourceUi(restoreSource).label}
          </span>
        )}
        {jobResultType === 'restore-v2-full' && (
          <div className="space-y-2">
            <span className={`inline-flex px-2 py-1 rounded border text-xs font-medium ${finalStateUi.className}`}>
              {finalStateUi.label}
            </span>

            {shouldDisplayCriticalBanner(jobResult) && (
              <div className="p-3 rounded border border-red-300 bg-red-50 text-xs text-red-900 space-y-1">
                <p className="font-semibold">Alerte sécurité post-restore</p>
                <p>
                  L’environnement peut être partiellement incohérent. Vérifiez immédiatement les diagnostics,
                  téléchargez les logs et relancez si nécessaire depuis le backup de sécurité.
                </p>
              </div>
            )}
          </div>
        )}

        {jobResultType === 'export-v2' && (
          <div className="space-y-2">
            <div className="p-2 rounded border border-blue-200 bg-blue-50 text-xs text-blue-900">
              Le backup contient un fichier <code>documents-map.csv</code> pour retrouver facilement
              les documents dans l&apos;archive.
            </div>
            <div className="flex flex-wrap gap-2">
              {exportV2BackupRecordId && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => handleDownloadDocumentsMap(exportV2BackupRecordId)}
                  >
                    Télécharger le plan des documents
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => handleDownloadBackup(exportV2BackupRecordId)}
                  >
                    Télécharger le backup ZIP
                  </Button>
                </>
              )}
            </div>
            <p className="text-[11px] text-gray-600">
              Dans l&apos;archive ZIP, ouvrez le dossier <code>reports/</code> pour retrouver le mapping.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-green-800">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        {jobResultType === 'restore-v2-full' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-700">
            <p>
              Rollback: {!rollbackAttempted
                ? 'non nécessaire'
                : rollbackSucceeded
                  ? 'tenté et réussi'
                  : 'tenté mais échoué'}
            </p>
            <p>
              Backup safety: {safetyBackupId ? `créé (${safetyBackupId})` : 'non communiqué'}
            </p>
            <p>Backup source: {sourceBackupId || 'non communiqué'}</p>
            <p>Version source: {sourceBackupVersion || 'non communiquée'}</p>
            {safetyBackupId && (
              <div className="md:col-span-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => handleDownloadBackup(safetyBackupId)}
                >
                  Télécharger le backup de sécurité
                </Button>
              </div>
            )}
          </div>
        )}

        {(warnings.length > 0 || errors.length > 0) && (
          <details className="rounded border bg-gray-50 p-2 text-xs">
            <summary className="cursor-pointer font-medium text-gray-700">
              Diagnostic ({warnings.length} warning(s), {errors.length} erreur(s))
            </summary>
            <div className="mt-2 space-y-2">
              {errors.slice(0, 5).map((issue, idx) => (
                <div key={`error-${idx}`} className="p-2 rounded border border-red-200 bg-red-50 text-red-800">
                  <p className="font-medium">{issue.code || 'ERROR'}</p>
                  <p>{issue.message || 'Erreur sans message'}</p>
                </div>
              ))}
              {warnings.slice(0, 8).map((issue, idx) => {
                const important = isImportantWarning(issue);
                return (
                  <div
                    key={`warning-${idx}`}
                    className={`p-2 rounded border ${
                      important
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-yellow-200 bg-yellow-50 text-yellow-800'
                    }`}
                  >
                    <p className="font-medium">{issue.code || 'WARNING'}</p>
                    <p>{issue.message || 'Warning sans message'}</p>
                  </div>
                );
              })}
              {importantWarnings.length > 0 && (
                <p className="text-[11px] text-amber-900">
                  Warnings importants détectés: {importantWarnings.map((warning) => warning.code).filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </details>
        )}
      </div>
    );
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-all duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-100 text-purple-600">
                <Archive className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg">Sauvegarde & Restauration Admin</CardTitle>
                <CardDescription className="text-sm">
                  Gestion des sauvegardes admin historiques et des backups V2 complets
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-red-700 mt-0.5" />
              <div className="space-y-1 text-red-900">
                <p className="font-medium">Zone critique de restauration</p>
                <p>
                  Le rollback robuste global n’est pas encore disponible. En cas d’échec pendant un restore
                  V2 complet, l’environnement peut rester dans un état intermédiaire.
                </p>
              </div>
            </div>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
            <p className="font-medium">Comment Smartimmo stocke vos sauvegardes</p>
            <p className="mt-1">
              Les métadonnées (date, type, checksum, portée) sont conservées en base de données.
              Les archives ZIP sont stockées sur le disque/storage de l&apos;application.
            </p>
            <p className="mt-1">
              Vous pouvez restaurer depuis l&apos;historique Smartimmo (sans réupload) ou depuis un
              fichier ZIP local importé manuellement.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="p-3 border rounded-lg space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Bloc A — Sauvegarde admin historique</p>
                <p className="text-xs text-gray-600">
                  Configuration admin uniquement (paramètres, référentiels, barèmes).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleExport}
                  disabled={isBusy}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Export...' : 'Exporter admin'}
                </Button>
                <Button
                  onClick={() => setShowImportModal(true)}
                  disabled={isBusy}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  <Upload className="h-4 w-4" />
                  Importer admin
                </Button>
              </div>
              <div className="p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
                Backup admin historique: n’inclut pas les données métier ni les objets binaires.
              </div>
            </div>

            <div className="p-3 border rounded-lg space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Bloc B — Sauvegarde V2</p>
                <p className="text-xs text-gray-600">
                  Export complet V2 (DB + objets). Deux modes de restauration:
                  historique Smartimmo ou fichier ZIP importé.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={handleExportV2}
                  disabled={isBusy}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  <Layers className="h-4 w-4" />
                  {isExportingV2 ? 'Export V2...' : 'Exporter V2 complet'}
                </Button>
                <Button
                  onClick={() => {
                    setZipRestoreFile(null);
                    setShowZipRestoreModal(true);
                  }}
                  disabled={isBusy}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  <Upload className="h-4 w-4" />
                  Restaurer depuis un fichier ZIP
                </Button>
              </div>
              <div className="p-2 rounded bg-blue-50 border border-blue-200 text-xs text-blue-800">
                Depuis l&apos;historique: restauration directe d&apos;une archive déjà stockée.
                Depuis ZIP: import manuel d&apos;une archive locale.
              </div>
            </div>
          </div>

          {currentJob && (
            <div className="p-3 bg-gray-50 border rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {jobTypeLabel(currentJob.type)} : {currentJob.currentStep || 'Traitement en cours'}
                </span>
                <span>{Math.max(0, Math.min(100, currentJob.progressPercent || 0))}%</span>
              </div>
              <Progress value={Math.max(0, Math.min(100, currentJob.progressPercent || 0))} />
              <p className="text-xs text-gray-600">
                Statut: {currentJob.state}
              </p>
              {(currentJob.type === 'restore-v2-full' || currentJob.type === 'restore-v2-db') && (
                <span
                  className={`inline-flex px-2 py-0.5 rounded border text-[11px] ${
                    getRestoreSourceUi(
                      getRestoreSource(
                        currentJob.result || null,
                        currentJob.type,
                        currentJobSourceHint
                      )
                    ).className
                  }`}
                >
                  {
                    getRestoreSourceUi(
                      getRestoreSource(
                        currentJob.result || null,
                        currentJob.type,
                        currentJobSourceHint
                      )
                    ).label
                  }
                </span>
              )}
              {normalizeJobLogs(currentJob.logs).length > 0 && (
                <div className="bg-gray-900 text-gray-100 rounded p-3 max-h-40 overflow-y-auto font-mono text-xs space-y-1">
                  {normalizeJobLogs(currentJob.logs).slice(-8).map((line, idx) => (
                    <div key={`${idx}-${line}`}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!currentJob && jobResult && (
            <div className={`p-3 border rounded-lg space-y-2 ${jobResult.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className={`text-sm font-medium ${jobResult.error ? 'text-red-800' : 'text-green-800'}`}>
                {jobResult.error ? 'Traitement terminé en erreur' : 'Traitement terminé avec succès'}
              </p>
              {renderResultSummary()}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => {
                setShowScheduleModal(true);
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Planifier
            </Button>

            <Button
              onClick={() => {
                loadHistory();
                setShowHistoryModal(true);
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Historique (Bloc C)
            </Button>
          </div>

          {/* Info planification */}
          {schedule && schedule.isActive && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">
                    Planification active : {schedule.frequency === 'daily' && 'Quotidienne'}
                    {schedule.frequency === 'weekly' && 'Hebdomadaire'}
                    {schedule.frequency === 'monthly' && 'Mensuelle'}
                  </p>
                  <p className="text-blue-700 text-xs mt-1">
                    Prochaine exécution : {schedule.nextRunAt && format(new Date(schedule.nextRunAt), 'PPP à HH:mm', { locale: fr })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Import */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Importer une sauvegarde
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Étape 1: Sélection fichier */}
              <div>
                <label className="block text-sm font-medium mb-2">1. Sélectionner le fichier .zip</label>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {selectedFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Fichier sélectionné : {selectedFile.name} ({formatSize(selectedFile.size)})
                  </p>
                )}
              </div>

              {/* Étape 2: Options */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">2. Options d’import</label>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mode</label>
                  <select
                    value={importMode}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'validate' || value === 'dry-run' || value === 'apply') {
                        setImportMode(value);
                      }
                    }}
                    className="w-full p-2 border rounded-lg text-sm"
                  >
                    <option value="validate">Valider uniquement (sans modification)</option>
                    <option value="dry-run">Dry-run (prévisualisation complète)</option>
                    <option value="apply">Appliquer les changements</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stratégie</label>
                  <select
                    value={importStrategy}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'merge' || value === 'replace') {
                        setImportStrategy(value);
                      }
                    }}
                    className="w-full p-2 border rounded-lg text-sm"
                  >
                    <option value="merge">Fusion (conserver l’existant, ajouter le nouveau)</option>
                    <option value="replace">Remplacement (écraser l’existant)</option>
                  </select>
                </div>
              </div>

              {/* Journal des logs */}
              {(isImporting || currentJob?.type === 'import') && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium mb-2">Journal d’exécution :</label>
                  <div className="bg-gray-900 text-gray-100 rounded p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
                    <div className="text-gray-400">
                      ⏳ Import en cours... {currentJob?.currentStep ? `(${currentJob.currentStep})` : ''}
                    </div>
                    {normalizeJobLogs(currentJob?.logs).slice(-10).map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Étape 3: Résultat */}
              {jobResult && jobResultType === 'import' && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium mb-2">3. Résultat</label>
                  
                  {/* Journal des logs */}
                  {Array.isArray(jobResult.logs) && jobResult.logs.length > 0 && (
                    <div className="mb-4">
                      <div className="font-medium text-sm text-gray-700 mb-2">
                        Journal d’exécution :
                      </div>
                      <div className="bg-gray-900 text-gray-100 rounded p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
                        {jobResult.logs.map((log, i) => (
                          <div key={i}>{String(log)}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {jobResult.error ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-800 font-medium">{jobResult.error}</p>
                      {jobResult.details && (
                        <p className="text-red-700 text-sm mt-1">{JSON.stringify(jobResult.details)}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {jobResult.diff && typeof jobResult.diff === 'object' && (
                        <div className="p-3 bg-gray-50 border rounded-lg text-sm">
                          <p className="font-medium mb-2">Aperçu des changements :</p>
                          <ul className="space-y-1">
                            <li className="text-green-700">✅ Ajouts : {String((jobResult.diff as Record<string, unknown>).adds ?? 0)}</li>
                            <li className="text-blue-700">🔄 Mises à jour : {String((jobResult.diff as Record<string, unknown>).updates ?? 0)}</li>
                            <li className="text-orange-700">🗑️ Suppressions : {String((jobResult.diff as Record<string, unknown>).deletes ?? 0)}</li>
                          </ul>
                        </div>
                      )}

                      {jobResult.applied && typeof jobResult.applied === 'object' && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                          <p className="font-medium text-green-800">Traitement appliqué avec succès !</p>
                          <ul className="text-green-700 mt-1 space-y-1">
                            <li>✅ {String((jobResult.applied as Record<string, unknown>).adds ?? 0)} ajouts</li>
                            <li>🔄 {String((jobResult.applied as Record<string, unknown>).updates ?? 0)} mises à jour</li>
                            <li>🗑️ {String((jobResult.applied as Record<string, unknown>).deletes ?? 0)} suppressions</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedFile(null);
                  setJobResult(null);
                  setJobResultType(null);
                }}
              >
                Fermer
              </Button>
              {!jobResult && (
                <Button
                  onClick={handleImport}
                  disabled={!selectedFile || isImporting || !!currentJobId}
                >
                  {isImporting ? 'Import en cours...' : 'Importer'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Historique */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historique des sauvegardes
              </h3>
            </div>

            <div className="p-6">
              {isHistoryLoading ? (
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg bg-gray-50 text-sm text-gray-600">
                    Chargement de l&apos;historique des sauvegardes...
                  </div>
                  {[1, 2, 3].map((idx) => (
                    <div key={idx} className="p-4 border rounded-lg animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-2/3" />
                    </div>
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucune sauvegarde enregistrée</p>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg bg-gray-50 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-gray-700">
                          Type d&apos;historique
                        </label>
                        <select
                          value={historySafetyFilter}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (value === 'all' || value === 'safety-only' || value === 'non-safety') {
                              setHistorySafetyFilter(value);
                            }
                          }}
                          className="w-full p-2 border rounded text-xs bg-white"
                        >
                          <option value="all">Tous</option>
                          <option value="safety-only">Backups safety uniquement</option>
                          <option value="non-safety">Backups non-safety</option>
                        </select>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="block text-[11px] font-medium text-gray-700">
                          Filtrer par sourceBackupId
                        </label>
                        <input
                          value={historySourceBackupFilter}
                          onChange={(event) => setHistorySourceBackupFilter(event.target.value)}
                          placeholder="ex: cmabc123..."
                          className="w-full p-2 border rounded text-xs bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="text-[11px] text-gray-600">
                          Filtre actif : {historySafetyFilter === 'all'
                            ? 'Tous'
                            : historySafetyFilter === 'safety-only'
                              ? 'Backups safety uniquement'
                              : 'Backups non-safety'}
                          {historySourceBackupFilter.trim()
                            ? ` • sourceBackupId contient "${historySourceBackupFilter.trim()}"`
                            : ''}
                        </p>
                        {history.length > 0 && (
                          <div className="text-[11px] text-gray-500 space-y-0.5">
                            <p>
                              {filteredHistory.length} / {history.length}{' '}
                              {filteredHistory.length === 1 ? 'résultat' : 'résultats'}
                            </p>
                            <p>
                              Backups safety visibles : {visibleSafetyBackupsCount} • Protégés 24h :{' '}
                              {visibleProtectedSafetyBackupsCount}
                            </p>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[11px]"
                        disabled={isHistoryLoading || !!deletingBackupId}
                        onClick={() => {
                          setHistorySafetyFilter('all');
                          setHistorySourceBackupFilter('');
                        }}
                      >
                        Réinitialiser
                      </Button>
                    </div>
                  </div>

                  {filteredHistory.length === 0 && (
                    <div className="p-4 border rounded-lg bg-amber-50 border-amber-200 text-sm text-amber-900">
                      Aucun backup ne correspond aux filtres actifs. Ajustez le type d&apos;historique
                      ou le `sourceBackupId`.
                    </div>
                  )}

                  {filteredHistory.map((backup) => (
                    <div key={backup.id} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{format(new Date(backup.createdAt), 'PPP à HH:mm', { locale: fr })}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            Par {backup.createdBy} • {formatSize(backup.sizeBytes)}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded border text-[11px] ${backupKindBadgeClass(resolveBackupKind(backup))}`}>
                              {backupKindLabel(resolveBackupKind(backup))}
                            </span>
                            <span className="text-[11px] text-gray-600">
                              Scope: {backup.scope}
                            </span>
                            <span className="text-[11px] text-gray-600">
                              Version: {getBackupMetaV2(backup.meta)?.backupVersion || 'n/a'}
                            </span>
                            <span className="text-[11px] text-gray-600">
                              Objets: {getBackupMetaV2(backup.meta)?.includes?.documentsBinary ? 'oui' : 'non'}
                            </span>
                            {resolveBackupKind(backup) === 'v2-safety' && (
                              <span className="text-[11px] text-purple-700">
                                Filet de sécurité pré-restore
                              </span>
                            )}
                            {isSafetyBackupProtected(backup) && (
                              <span
                                className="px-2 py-0.5 rounded border text-[11px] bg-amber-100 text-amber-900 border-amber-200"
                                title="Suppression temporairement bloquée car ce backup safety est récent"
                              >
                                Protégé 24h
                              </span>
                            )}
                          </div>
                          {resolveBackupKind(backup) === 'v2-safety' && (
                            <p className="text-[11px] text-purple-700 mt-1">
                              Source: {getSourceBackupIdFromRecord(backup) || 'n/a'}
                            </p>
                          )}
                          {resolveBackupKind(backup) === 'v2-safety' && (
                            <p className="text-[11px] text-gray-600 mt-1">
                              {getSourceBackupIdFromRecord(backup) === 'uploaded-zip'
                                ? 'Source restore : ZIP importé'
                                : getSourceBackupIdFromRecord(backup)
                                  ? 'Source restore : Historique'
                                  : 'Source restore : non précisée'}
                            </p>
                          )}
                          {isSafetyBackupProtected(backup) && (
                            <p className="text-[11px] text-amber-800 mt-1">
                              Suppression temporairement bloquée car ce backup safety est récent.
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1 font-mono">{backup.checksum.slice(0, 16)}...</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            disabled={isBusy || !!deletingBackupId}
                            onClick={() => handleDownloadBackup(backup.id)}
                          >
                            Télécharger
                          </Button>
                          {resolveBackupKind(backup) === 'admin-only' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs"
                              disabled={isBusy || !!deletingBackupId}
                              onClick={() => handleRestoreBackup(backup.id)}
                            >
                              Restaurer admin
                            </Button>
                          )}
                          {(resolveBackupKind(backup) === 'v2-db-only' || resolveBackupKind(backup) === 'v2-full') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              disabled={isBusy || !!deletingBackupId}
                              onClick={() => handleRestoreV2DbOnly(backup.id)}
                            >
                              Restaurer V2 DB-only
                            </Button>
                          )}
                          {resolveBackupKind(backup) === 'v2-full' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                              disabled={isBusy || !!deletingBackupId}
                              onClick={() => openCriticalRestoreModal(backup)}
                            >
                              <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                              Restaurer V2 complet
                            </Button>
                          )}
                          {resolveBackupKind(backup) === 'v2-full' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              disabled={isBusy || !!deletingBackupId}
                              onClick={() => handleDownloadDocumentsMap(backup.id)}
                            >
                              Plan des documents
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-red-700 hover:text-red-800"
                            disabled={isBusy || !!deletingBackupId || isSafetyBackupProtected(backup)}
                            title={
                              isSafetyBackupProtected(backup)
                                ? 'Suppression bloquée pendant 24h pour les backups safety récents'
                                : undefined
                            }
                            onClick={() => handleDeleteBackup(backup)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            {deletingBackupId === backup.id ? 'Suppression...' : 'Supprimer'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end">
              <Button variant="ghost" onClick={() => setShowHistoryModal(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCriticalRestoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold flex items-center gap-2 text-red-700">
                <ShieldAlert className="h-5 w-5" />
                Confirmation critique — Restore V2 complet
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-900 space-y-2">
                <p className="font-semibold">Archive source déjà sélectionnée depuis l&apos;historique.</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Smartimmo restaurera automatiquement la sauvegarde déjà stockée pour ce backup.</li>
                  <li>Aucun upload manuel de fichier ZIP ne sera demandé dans ce flux.</li>
                  <li>Le restore s&apos;appuie sur le <span className="font-mono">backupId</span> de l&apos;élément sélectionné.</li>
                </ul>
              </div>

              {criticalRestoreBackup && (
                <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 space-y-2">
                  <p className="font-semibold">Archive source sélectionnée</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <p>
                      <span className="font-medium">Nom du backup :</span>{' '}
                      {criticalRestoreBackup.note?.trim() || `backup-${criticalRestoreBackup.id.slice(0, 8)}`}
                    </p>
                    <p>
                      <span className="font-medium">Date :</span>{' '}
                      {format(new Date(criticalRestoreBackup.createdAt), 'PPP à HH:mm', { locale: fr })}
                    </p>
                    <p>
                      <span className="font-medium">Version :</span>{' '}
                      {getBackupMetaV2(criticalRestoreBackup.meta)?.backupVersion || 'n/a'}
                    </p>
                    <p>
                      <span className="font-medium">Taille :</span> {formatSize(criticalRestoreBackup.sizeBytes)}
                    </p>
                    <p className="md:col-span-2">
                      <span className="font-medium">Type / scope :</span>{' '}
                      {backupKindLabel(resolveBackupKind(criticalRestoreBackup))} ({criticalRestoreBackup.scope})
                    </p>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-900 space-y-2">
                <p className="font-semibold">Cette opération est en full-replace.</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Les données DB actuelles seront remplacées.</li>
                  <li>Les objets/binaires de l’archive seront restaurés.</li>
                  <li>Le traitement peut être long et sensible.</li>
                  <li>
                    En cas d’échec pendant l’exécution, l’environnement peut rester dans un état intermédiaire
                    (rollback robuste global non disponible à ce stade).
                  </li>
                </ul>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Tapez <span className="font-mono">RESTORE V2 FULL</span> pour confirmer
                </label>
                <input
                  value={criticalConfirmInput}
                  onChange={(event) => setCriticalConfirmInput(event.target.value)}
                  className="w-full p-2 border rounded-lg text-sm"
                  placeholder="RESTORE V2 FULL"
                />
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCriticalRestoreModal(false);
                  setCriticalRestoreBackupId(null);
                  setCriticalConfirmInput('');
                }}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                disabled={criticalConfirmInput.trim() !== 'RESTORE V2 FULL' || isBusy}
                onClick={handleConfirmRestoreV2Full}
              >
                Lancer le restore V2 complet
              </Button>
            </div>
          </div>
        </div>
      )}

      {showZipRestoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Restaurer depuis un fichier ZIP
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 rounded border bg-blue-50 border-blue-200 text-sm text-blue-900">
                <p className="font-medium">Mode restauration depuis archive locale</p>
                <p className="mt-1">
                  Ce flux importe un ZIP V2 local, le pré-valide strictement, puis lance un restore
                  complet (full-replace) avec backup safety automatique.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Sélectionner une archive ZIP V2</label>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleZipRestoreFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {zipRestoreFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Fichier: {zipRestoreFile.name} ({formatSize(zipRestoreFile.size)})
                  </p>
                )}
              </div>
              <div className="p-3 rounded border bg-amber-50 border-amber-200 text-xs text-amber-900">
                Restauration critique : les données actuelles seront remplacées. Utilisez ce mode pour
                restaurer depuis un backup local ou un autre environnement.
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowZipRestoreModal(false);
                  setZipRestoreFile(null);
                }}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                disabled={!zipRestoreFile || isBusy}
                onClick={handleConfirmZipRestore}
              >
                Lancer la restauration depuis ZIP
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Planification - TODO: Implémenter formulaire complet */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">Planifier les sauvegardes automatiques</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600">Fonctionnalité à implémenter avec formulaire complet</p>
            </div>
            <div className="p-6 border-t flex justify-end">
              <Button variant="ghost" onClick={() => setShowScheduleModal(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

