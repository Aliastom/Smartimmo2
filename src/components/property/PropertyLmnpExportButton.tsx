'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, FileArchive, Loader2, SearchCheck, ExternalLink, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

type LmnpAnomaly = {
  entityType: string;
  entityId: string;
  severity: 'blocking' | 'warning';
  message: string;
  resolutionSource?: string;
  lmnpBucket?: string;
  lmnpLabel?: string;
};

type LmnpManifest = {
  schemaVersion: 1;
  propertyId: string;
  propertyName: string;
  exerciseYear: number;
  organizationId: string;
  mappingVersion: string;
  generatedAt: string;
  transactionCount: number;
  documentCount: number;
  loanCount: number;
  coverageRate: number;
  anomalyCount: number;
  blockingAnomalyCount: number;
  dryRunPayloadHash: string;
  bucketCounts: Record<string, number>;
};

type LmnpRecentRun = {
  id: string;
  createdAt: string;
  status: string;
  anomalyCount: number;
};

type LmnpDryRunResponse = {
  success: boolean;
  manifest: LmnpManifest;
  anomalies: LmnpAnomaly[];
  dryRunPayloadHash: string;
  mappingVersion: string;
  recentRun: LmnpRecentRun | null;
};

interface PropertyLmnpExportButtonProps {
  propertyId: string;
  propertyName?: string;
  fiscalTypeId?: string;
  fiscalRegimeId?: string;
  compact?: boolean;
}

function isLmnpRealEligible(fiscalTypeId?: string, fiscalRegimeId?: string): boolean {
  const type = (fiscalTypeId || '').trim().toUpperCase();
  const regime = (fiscalRegimeId || '').trim().toUpperCase();
  const isLmnpType = type.includes('LMNP') || type.includes('LMP') || type.includes('MEUBLE');
  const isRealRegime = regime.includes('REEL') || regime.includes('RÉEL');
  return isLmnpType && isRealRegime;
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function resolutionSourceLabel(source: string | undefined): string {
  switch (source) {
    case 'override':
      return 'Override LMNP';
    case 'rule_property':
      return 'Règle bien';
    case 'rule_global':
      return 'Règle globale';
    case 'fallback':
      return 'Aucune règle (fallback)';
    default:
      return source ? String(source) : '—';
  }
}

export function PropertyLmnpExportButton({
  propertyId,
  propertyName,
  fiscalTypeId,
  fiscalRegimeId,
  compact = false,
}: PropertyLmnpExportButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [exerciseYear, setExerciseYear] = useState<number>(new Date().getFullYear() - 1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [dryRun, setDryRun] = useState<LmnpDryRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<'hash_mismatch' | 'blocking' | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [finalSuccess, setFinalSuccess] = useState<{ runId: string; anomalyCount: number } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const canShowLmnp = useMemo(
    () => isLmnpRealEligible(fiscalTypeId, fiscalRegimeId),
    [fiscalTypeId, fiscalRegimeId],
  );

  const blockingAnomalies = useMemo(
    () => (dryRun?.anomalies || []).filter((a) => a.severity === 'blocking'),
    [dryRun],
  );
  const warningAnomalies = useMemo(
    () => (dryRun?.anomalies || []).filter((a) => a.severity === 'warning'),
    [dryRun],
  );

  const isDryRunValid = !!dryRun && blockingAnomalies.length === 0 && !!dryRun.dryRunPayloadHash;
  const classifiedCount = Math.max(
    0,
    (dryRun?.manifest.transactionCount || 0) - (dryRun?.manifest.blockingAnomalyCount || 0),
  );

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => now - i);
  }, []);

  useEffect(() => {
    setDryRun(null);
    setError(null);
    setErrorAction(null);
    setSuccess(null);
    setFinalSuccess(null);
  }, [exerciseYear, propertyId]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setIsAdmin(d?.role === 'ADMIN');
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const resetMessages = () => {
    setError(null);
    setErrorAction(null);
    setSuccess(null);
    setFinalSuccess(null);
  };

  const handleDryRun = async () => {
    resetMessages();
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/lmnp/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          exerciseYear,
          mode: 'dryRun',
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || payload?.message || 'Erreur lors du dry run LMNP.');
      }

      setDryRun(payload as LmnpDryRunResponse);
      const nBlock = (payload.anomalies || []).filter((a: LmnpAnomaly) => a.severity === 'blocking').length;
      const nWarn = (payload.anomalies || []).filter((a: LmnpAnomaly) => a.severity === 'warning').length;
      setSuccess(
        nBlock > 0
          ? `Analyse terminée : ${nBlock} point(s) bloquant(s) et ${nWarn} avertissement(s). Corrigez les blocants avant l’export ZIP.`
          : `Analyse terminée : export possible. Couverture ${formatPercent(payload.manifest?.coverageRate ?? 0)} sur ${payload.manifest?.transactionCount ?? 0} transaction(s).`,
      );
    } catch (e) {
      setDryRun(null);
      setError(e instanceof Error ? e.message : 'Erreur inattendue pendant le dry run.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyRunId = useCallback((id: string) => {
    void navigator.clipboard.writeText(id);
  }, []);

  const handleDownloadZip = async () => {
    if (!dryRun?.dryRunPayloadHash) return;
    resetMessages();
    setIsDownloading(true);
    try {
      const response = await fetch('/api/lmnp/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          exerciseYear,
          mode: 'final',
          dryRunPayloadHash: dryRun.dryRunPayloadHash,
        }),
      });

      const runIdHeader = response.headers.get('x-lmnp-run-id') || response.headers.get('X-LMNP-Run-Id');

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const code = payload?.code as string | undefined;
        if (response.status === 409 || code === 'DRY_RUN_HASH_MISMATCH') {
          setErrorAction('hash_mismatch');
          setError(
            payload?.message ||
              payload?.error ||
              'Le contexte a changé depuis l’analyse. Relancez un dry run pour recalculer le hash.',
          );
          return;
        }
        if (response.status === 422 || code === 'BLOCKING_ANOMALIES') {
          setErrorAction('blocking');
          setError(
            payload?.message ||
              payload?.error ||
              'Des anomalies bloquantes empêchent l’export final.',
          );
          return;
        }
        throw new Error(payload?.error || payload?.message || 'Export final impossible.');
      }

      const blob = await response.blob();
      const defaultFilename = `LMNP_${propertyName || propertyId}_${exerciseYear}.zip`;
      const contentDisposition = response.headers.get('content-disposition') || '';
      const match = contentDisposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || defaultFilename;
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);

      const runId = runIdHeader || '';
      const ac = dryRun.manifest.anomalyCount ?? 0;
      setFinalSuccess({ runId, anomalyCount: ac });
      setSuccess(
        runId
          ? `Export ZIP enregistré. Run d’audit : ${runId.slice(0, 12)}… — ${ac} anomalie(s) ou avertissement(s) listé(s) dans le dossier.`
          : `Export ZIP téléchargé. ${ac} anomalie(s) ou avertissement(s) listé(s) dans le dossier.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue pendant l’export final.');
    } finally {
      setIsDownloading(false);
    }
  };

  const renderAnomalyCard = (a: LmnpAnomaly, idx: number) => (
    <li
      key={`${a.entityType}-${a.entityId}-${idx}`}
      className="rounded-md border border-gray-200 bg-white p-2 text-sm text-gray-800"
    >
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="font-medium capitalize">{a.entityType}</span>
        <span className="font-mono text-xs text-gray-600 break-all">{a.entityId}</span>
      </div>
      <p className="text-gray-800 leading-snug">{a.message}</p>
      {(a.resolutionSource || a.lmnpBucket || a.lmnpLabel) && (
        <p className="mt-2 text-xs text-gray-600 border-t border-gray-100 pt-2">
          <span className="font-medium text-gray-700">Classification LMNP :</span>{' '}
          {resolutionSourceLabel(a.resolutionSource)}
          {a.lmnpBucket != null && (
            <>
              {' '}
              · bucket <code className="bg-gray-100 px-1 rounded">{a.lmnpBucket}</code>
            </>
          )}
          {a.lmnpLabel != null && (
            <>
              {' '}
              · <span className="italic">{a.lmnpLabel}</span>
            </>
          )}
        </p>
      )}
    </li>
  );

  if (!canShowLmnp) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size={compact ? 'sm' : 'md'}
          onClick={() => {
            const url = `/app?view=lmnp&propertyId=${encodeURIComponent(propertyId)}`;
            router.push(url);
          }}
          className="whitespace-nowrap"
        >
          <FileArchive className="h-4 w-4 mr-2" />
          Ouvrir le pilotage LMNP
        </Button>
        <Button
          variant="ghost"
          size={compact ? 'sm' : 'md'}
          onClick={() => setIsOpen(true)}
          className="whitespace-nowrap"
          title="Ancien export rapide (transition)"
        >
          Export rapide
        </Button>
      </div>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`Export LMNP${propertyName ? ` - ${propertyName}` : ''}`}
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Fermer
            </Button>
            <Button variant="outline" onClick={handleDryRun} disabled={isAnalyzing || isDownloading}>
              {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SearchCheck className="h-4 w-4 mr-2" />}
              Analyser (dry run)
            </Button>
            <Button onClick={handleDownloadZip} disabled={!isDryRunValid || isAnalyzing || isDownloading}>
              {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Télécharger le ZIP
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="lmnp-exercise-year" className="block text-sm font-medium text-gray-700 mb-1">
                Exercice
              </label>
              <select
                id="lmnp-exercise-year"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={exerciseYear}
                onChange={(e) => setExerciseYear(Number(e.target.value))}
                disabled={isAnalyzing || isDownloading}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              {dryRun ? (
                <Badge variant={isDryRunValid ? 'success' : 'warning'}>
                  {isDryRunValid ? 'Dry run valide' : 'Dry run avec blocants'}
                </Badge>
              ) : (
                <Badge variant="secondary">Aucune analyse</Badge>
              )}
            </div>
          </div>

          {dryRun?.recentRun && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-medium flex items-center gap-2">
                <FileArchive className="h-4 w-4 shrink-0" />
                Export déjà enregistré pour cet exercice
              </p>
              <p className="mt-1 text-blue-800">
                Dernier run : le {new Date(dryRun.recentRun.createdAt).toLocaleString('fr-FR')} — statut{' '}
                <code className="bg-blue-100 px-1 rounded">{dryRun.recentRun.status}</code>,{' '}
                {dryRun.recentRun.anomalyCount} anomalie(s) en base. Vous pouvez refaire un export : un nouveau run sera
                créé.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 space-y-3">
              <p>{error}</p>
              {errorAction === 'hash_mismatch' && (
                <div className="flex flex-wrap gap-2 items-center">
                  <Button type="button" size="sm" variant="outline" onClick={handleDryRun} disabled={isAnalyzing}>
                    Relancer l’analyse (dry run)
                  </Button>
                  <span className="text-xs text-red-800">Recalcule le hash après toute modification des données.</span>
                </div>
              )}
              {errorAction === 'blocking' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-red-900 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Corrigez d’abord les points bloquants ci-dessous (règles / overrides LMNP en administration).
                  </p>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href="/admin/lmnp/mapping-rules">
                          Règles LMNP <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href="/admin/lmnp/overrides">
                          Overrides <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900 space-y-2">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{success}</span>
              </p>
              {finalSuccess?.runId && (
                <div className="border-t border-green-200 pt-3 mt-2 space-y-2">
                  <p className="text-xs text-green-800 font-medium">Identifiant du run (audit / support)</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-xs bg-white border border-green-200 rounded px-2 py-1 break-all max-w-full">
                      {finalSuccess.runId}
                    </code>
                    <Button type="button" size="sm" variant="outline" onClick={() => copyRunId(finalSuccess.runId)}>
                      <Copy className="h-3 w-3 mr-1" />
                      Copier
                    </Button>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={`/admin/lmnp/runs?openRun=${encodeURIComponent(finalSuccess.runId)}`}>
                          Détail du run <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={`/admin/lmnp/anomalies?runId=${encodeURIComponent(finalSuccess.runId)}`}>
                          Anomalies du run
                          {finalSuccess.anomalyCount > 0 ? ` (${finalSuccess.anomalyCount})` : ''}{' '}
                          <ExternalLink className="h-3 w-3 ml-1 inline" />
                        </Link>
                      </Button>
                    </div>
                  )}
                  {!isAdmin && (
                    <p className="text-xs text-green-800">
                      Partagez cet identifiant avec votre administrateur pour consulter le run ou les anomalies dans
                      l’espace admin.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {dryRun && blockingAnomalies.length > 0 && !error && (
            <div className="rounded-lg border-2 border-red-200 bg-red-50/80 p-3 text-sm text-red-950">
              <p className="font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Action requise avant le ZIP : {blockingAnomalies.length} anomalie(s) bloquante(s)
              </p>
              <p className="mt-1 text-red-900 text-xs">
                Le bouton « Télécharger le ZIP » reste désactivé tant qu’au moins une transaction n’est pas couverte par
                une règle ou un override LMNP.
              </p>
              {isAdmin && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link href="/admin/lmnp/mapping-rules">Ouvrir les règles</Link>
                  </Button>
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link href="/admin/lmnp/overrides">Ouvrir les overrides</Link>
                  </Button>
                </div>
              )}
            </div>
          )}

          {dryRun && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500">Transactions classées</p>
                  <p className="text-lg font-semibold">
                    {classifiedCount} / {dryRun.manifest.transactionCount}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500">Couverture</p>
                  <p className="text-lg font-semibold">{formatPercent(dryRun.manifest.coverageRate)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500">Anomalies (total)</p>
                  <p className="text-lg font-semibold">{dryRun.manifest.anomalyCount}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500">Version mapping</p>
                  <p className="text-sm font-semibold">{dryRun.manifest.mappingVersion}</p>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500 mb-1">dryRunPayloadHash</p>
                <p className="text-xs font-mono break-all">{dryRun.dryRunPayloadHash}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Le hash lie l’export final à cette analyse. Toute évolution des données impose un nouveau dry run.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border-2 border-red-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="danger">Bloquant · {blockingAnomalies.length}</Badge>
                  </div>
                  <p className="text-xs text-red-900">
                    Ces points empêchent l’export final tant qu’ils ne sont pas résolus (règles ou overrides).
                  </p>
                  <ul className="space-y-2 max-h-56 overflow-y-auto">
                    {blockingAnomalies.map((a, idx) => renderAnomalyCard(a, idx))}
                  </ul>
                  {blockingAnomalies.length === 0 && (
                    <p className="text-sm text-gray-600">Aucune anomalie bloquante.</p>
                  )}
                </div>

                <div className="rounded-lg border-2 border-amber-200 bg-amber-50/40 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">Avertissement · {warningAnomalies.length}</Badge>
                  </div>
                  <p className="text-xs text-amber-950">
                    L’export peut quand même être généré ; vérifiez ces points dans le ZIP (fichiers manquants,
                    prêt…).
                  </p>
                  <ul className="space-y-2 max-h-56 overflow-y-auto">
                    {warningAnomalies.map((a, idx) => renderAnomalyCard(a, idx))}
                  </ul>
                  {warningAnomalies.length === 0 && (
                    <p className="text-sm text-gray-600">Aucun avertissement.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
