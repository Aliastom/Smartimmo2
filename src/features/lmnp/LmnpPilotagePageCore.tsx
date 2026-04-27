'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Loader2, FileArchive, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

type Property = { id: string; name: string };
type LmnpActivity = {
  id: string;
  name: string;
  siret: string;
  fiscalRegime: 'micro_bic' | 'reel_simplifie';
  Properties?: Array<{
    id: string;
    name: string;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
  }>;
};

type DryRunAnomaly = {
  entityType: string;
  entityId: string;
  severity: 'blocking' | 'warning';
  message: string;
  resolutionSource?: string;
  lmnpBucket?: string;
  lmnpLabel?: string;
};

type EcriturePreview = {
  transaction_id: string;
  /** Libellé transaction (domaine), prioritaire sur transaction_label si exposé par l’API. */
  label?: string;
  accounting_month: string;
  transaction_label?: string;
  amount: number;
  nature_code?: string;
  category_id?: string;
  category_slug?: string;
  category_label?: string;
  lmnp_bucket: string;
  lmnp_label: string;
  resolution_source: string;
  linkedDocuments?: Array<{
    id: string;
    filename: string;
    documentTypeCode?: string;
    documentTypeLabel?: string;
    ocrTextPreview?: string;
    confidence?: number;
  }>;
  suggestion?: {
    suggestedBucket: string;
    suggestedLabel: string;
    suggestedNatureCode?: string;
    suggestedCategoryId?: string;
    confidence: number;
    reason: string;
    source: 'learning' | 'document_type' | 'ocr' | 'transaction_category' | 'transaction_label' | 'filename' | 'fallback';
  };
};

type DryRunPayload = {
  success: boolean;
  manifest: {
    propertyId: string;
    propertyName: string;
    exerciseYear: number;
    mappingVersion: string;
    transactionCount: number;
    coverageRate: number;
    anomalyCount: number;
    blockingAnomalyCount: number;
    bucketCounts: Record<string, number>;
    dryRunPayloadHash: string;
  };
  anomalies: DryRunAnomaly[];
  ecrituresPreview: EcriturePreview[];
  recentRun: { id: string; createdAt: string; status: string; anomalyCount: number } | null;
  dryRunPayloadHash: string;
};


function euro(v: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v || 0);
}

function pct(v: number): string {
  return `${Math.round((v || 0) * 100)}%`;
}

function sourceLabel(source: NonNullable<EcriturePreview['suggestion']>['source']): string {
  switch (source) {
    case 'learning':
      return 'apprentissage Smartimmo';
    case 'document_type':
      return 'document_type';
    case 'ocr':
      return 'ocr';
    case 'transaction_category':
      return 'transaction_category';
    case 'transaction_label':
      return 'transaction_label';
    case 'filename':
      return 'filename';
    case 'fallback':
      return 'fallback';
    default:
      return source;
  }
}

function confidenceBadge(confidence: number): { label: string; variant: 'success' | 'warning' | 'gray' } {
  if (confidence >= 0.85) return { label: 'Confiance forte', variant: 'success' };
  if (confidence >= 0.6) return { label: 'À vérifier', variant: 'warning' };
  return { label: 'Faible confiance', variant: 'gray' };
}

function looksLikeOpaqueTechnicalId(s: string): boolean {
  const t = s.trim();
  if (t.length === 0) return false;
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(t)) return true;
  if (t.length >= 20 && /^c[a-z0-9]{20,}$/i.test(t)) return true;
  return false;
}

/** Libellé lisible : ne pas utiliser un id technique (cuid, UUID) comme titre principal. */
function rowDisplayName(row: EcriturePreview): string {
  const fromLabel = (row.label || '').trim();
  if (fromLabel && !looksLikeOpaqueTechnicalId(fromLabel)) return fromLabel;
  const raw = (row.transaction_label || '').trim();
  if (raw && !looksLikeOpaqueTechnicalId(raw)) return raw;
  const cat = (row.category_label || row.category_slug || '').trim();
  const month = (row.accounting_month || '').trim();
  if (cat && month) return `${cat} · ${month}`;
  if (cat) return cat;
  const docName = (row.linkedDocuments?.[0]?.filename || '').trim();
  if (docName) return docName;
  if (raw) return raw;
  return 'Transaction à vérifier';
}

/** Prépare le libellé pour la détection métier (dates, fournisseur récurrent, ponctuation). */
function preprocessForBusinessKey(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\d{4}-\d{2}/g, ' ')
    .replace(/quentimmo/gi, ' ')
    .replace(/[-_:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLmnpBusinessKey(input: string): string {
  const s = preprocessForBusinessKey(input);
  if (/(commission|frais).{0,40}gestion/.test(s)) return 'gestion';
  if (/\bassurance\b/.test(s) || /assurances?\b/.test(s)) return 'assurance';
  if (/(taxe|impot|fonciere|foncière|habitation)/.test(s)) return 'fiscal';
  if (/(interet|intérêt|emprunt|banque)/.test(s)) return 'financier';
  if (/(travaux|reparation|réparation|entretien)/.test(s)) return 'travaux';
  return 'other';
}

const DISPLAY_LABELS: Record<string, string | null> = {
  gestion: 'Frais de gestion / commissions',
  assurance: 'Assurances',
  fiscal: 'Taxes et impôts',
  financier: 'Charges financières',
  travaux: 'Travaux et entretien',
  other: null,
};

function correctionGroupDisplayTitle(displayName: string, businessKey: string): string {
  const mapped = DISPLAY_LABELS[businessKey];
  return mapped ?? displayName;
}

/** Regroupe les corrections par bucket+label LMNP et sens métier du libellé (fusion des quasi-doublons). */
type LmnpCorrectionGroup = {
  groupKey: string;
  title: string;
  lmnpBucket: string;
  lmnpLabel: string;
  count: number;
  totalAmount: number;
};

function groupLmnpCorrections(corrections: EcriturePreview[]): LmnpCorrectionGroup[] {
  const m = new Map<
    string,
    { title: string; lmnpBucket: string; lmnpLabel: string; count: number; totalAmount: number }
  >();

  for (const r of corrections) {
    const displayName = rowDisplayName(r);
    const businessKey = normalizeLmnpBusinessKey(displayName);
    const bucket = String(r.lmnp_bucket || '—');
    const label = String(r.lmnp_label || '—');
    const key = `${bucket}\u0000${label}\u0000${businessKey}`;
    const title = correctionGroupDisplayTitle(displayName, businessKey);
    const amt = Number(r.amount) || 0;
    const prev = m.get(key);
    if (prev) {
      prev.count += 1;
      prev.totalAmount += amt;
    } else {
      m.set(key, { title, lmnpBucket: bucket, lmnpLabel: label, count: 1, totalAmount: amt });
    }
  }

  return [...m.entries()]
    .map(([groupKey, v]) => ({ groupKey, ...v }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'fr'));
}

type TxOverride = { transactionId: string; lmnpBucket: string; lmnpLabel: string };

type SessionOverrideValue = { lmnpBucket: string; lmnpLabel: string } | null | undefined;

function isValidSessionOverride(v: SessionOverrideValue): v is { lmnpBucket: string; lmnpLabel: string } {
  return !!v && typeof v.lmnpBucket === 'string' && typeof v.lmnpLabel === 'string';
}

function sessionRecordToSessionArr(record: Record<string, SessionOverrideValue>): TxOverride[] {
  return Object.entries(record)
    .filter(([, v]) => isValidSessionOverride(v))
    .map(([transactionId, v]) => ({
      transactionId,
      lmnpBucket: v.lmnpBucket,
      lmnpLabel: v.lmnpLabel,
    }));
}

function mergeSessionAndAutoTransients(session: TxOverride[], auto: TxOverride[]): TxOverride[] {
  const m = new Map<string, TxOverride>();
  for (const x of auto) {
    m.set(String(x.transactionId), x);
  }
  for (const x of session) {
    m.set(String(x.transactionId), x);
  }
  return [...m.values()];
}

export function LmnpPilotagePageCore() {
  const sp = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [activities, setActivities] = useState<LmnpActivity[]>([]);
  const [isLoadingProps, setIsLoadingProps] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [lmnpActivityId, setLmnpActivityId] = useState(sp.get('lmnpActivityId') || '');
  const [propertyId, setPropertyId] = useState(sp.get('propertyId') || '');
  const [scopeView, setScopeView] = useState<'activity' | 'property'>('property');
  const [exerciseYear, setExerciseYear] = useState(new Date().getFullYear() - 1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [dryRun, setDryRun] = useState<DryRunPayload | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [autoApplyConfident, setAutoApplyConfident] = useState(true);
  const [autoFeedback, setAutoFeedback] = useState<{ applied: number; toReview: number } | null>(null);
  const [autoAppliedTxIds, setAutoAppliedTxIds] = useState<Set<string>>(new Set());
  /** Corrections mémoire pour l'analyse courante (stateless), fusionnées à chaque dry run. */
  const [sessionTransientByTxId, setSessionTransientByTxId] = useState<Record<string, SessionOverrideValue>>({});
  const isAutoMode = autoApplyConfident;

  React.useEffect(() => {
    setSessionTransientByTxId({});
    setAutoAppliedTxIds(new Set());
    setAutoFeedback(null);
  }, [propertyId, lmnpActivityId, exerciseYear]);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoadingProps(true);
    fetch('/api/properties?limit=200&sortBy=name&sortOrder=asc')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const list = (json?.data || json?.items || []) as any[];
        const mapped = list.map((x) => ({ id: x.id, name: x.name })) as Property[];
        setProperties(mapped);
        if (!propertyId && mapped.length > 0) {
          setPropertyId(mapped[0].id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingProps(false);
      });

    setIsLoadingActivities(true);
    fetch('/api/lmnp/activities?includeProperties=true')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const list = (json?.data || []) as LmnpActivity[];
        setActivities(list);
        if (!lmnpActivityId && list.length > 0) {
          setLmnpActivityId(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingActivities(false);
      });

    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        setIsAdmin(d?.role === 'ADMIN');
        setOrganizationId(typeof d?.organizationId === 'string' ? d.organizationId : null);
      })
      .catch(() => {
        setIsAdmin(false);
        setOrganizationId(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (isLoadingActivities) return;
    if (activities.length > 0) {
      setScopeView('activity');
      if (!lmnpActivityId) setLmnpActivityId(activities[0].id);
      return;
    }
    setScopeView('property');
  }, [activities, isLoadingActivities, lmnpActivityId]);

  const selectedProperty = useMemo(() => properties.find((p) => p.id === propertyId) || null, [properties, propertyId]);
  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === lmnpActivityId) || null,
    [activities, lmnpActivityId],
  );
  const effectivePropertyId = useMemo(
    () => (scopeView === 'activity' ? selectedActivity?.Properties?.[0]?.id || '' : propertyId),
    [scopeView, selectedActivity, propertyId],
  );
  const isActivityView = scopeView === 'activity' && activities.length > 0;

  const correctedThisAnalysisRows = useMemo(() => {
    if (!dryRun) return [] as EcriturePreview[];
    return (dryRun.ecrituresPreview || []).filter((r) => autoAppliedTxIds.has(String(r.transaction_id)));
  }, [dryRun, autoAppliedTxIds]);

  const correctedThisAnalysisGroups = useMemo(
    () => groupLmnpCorrections(correctedThisAnalysisRows),
    [correctedThisAnalysisRows],
  );

  const persistLmnpLearning = async (
    row: EcriturePreview,
    appliedBucket: string,
    appliedLabel: string,
    guidanceConfidence: number,
  ) => {
    if (!organizationId) return;
    const firstDoc = row.linkedDocuments?.[0];
    try {
      await fetch('/api/lmnp/learning-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: effectivePropertyId || null,
          documentTypeCode: firstDoc?.documentTypeCode ?? null,
          categoryId: row.category_id || null,
          natureCode: row.nature_code || null,
          transactionLabel:
            [row.label, row.transaction_label].find((x) => {
              const t = (x || '').trim();
              return t.length > 0 && !looksLikeOpaqueTechnicalId(t);
            }) ||
            row.transaction_label ||
            row.label ||
            null,
          ocrText: firstDoc?.ocrTextPreview ?? null,
          lmnpBucket: appliedBucket,
          lmnpLabel: appliedLabel,
          guidanceConfidence,
        }),
      });
    } catch {
      /* apprentissage best-effort */
    }
  };

  const kpis = useMemo(() => {
    if (!dryRun) return null;
    const rows = dryRun.ecrituresPreview || [];
    const sumBy = (pred: (r: EcriturePreview) => boolean) => rows.filter(pred).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const recettes = sumBy((r) => (r.lmnp_bucket || '').includes('RECETTE') || (r.lmnp_bucket || '').includes('LOYER'));
    const chargesExploitation = sumBy((r) => (r.lmnp_bucket || '').includes('EXPLOITATION'));
    const chargesFiscales = sumBy((r) => (r.lmnp_bucket || '').includes('FISCALES'));
    const interets = sumBy((r) => (r.lmnp_bucket || '').includes('FINANCIER'));
    const assurance = sumBy((r) => (r.lmnp_bucket || '').includes('ASSURANCE'));
    const aClasser = rows.filter((r) => r.lmnp_bucket === 'A_CLASSER').length;
    return {
      recettes,
      chargesExploitation,
      chargesFiscales,
      interets,
      assurance,
      aClasser,
      resultatEstime: recettes - (chargesExploitation + chargesFiscales + interets + assurance),
    };
  }, [dryRun]);

  const status = useMemo(() => {
    if (!dryRun) return { label: 'Non analysé', variant: 'gray' as const };
    if (dryRun.manifest.blockingAnomalyCount > 0) return { label: 'À corriger', variant: 'warning' as const };
    return { label: 'Prêt comptable', variant: 'success' as const };
  }, [dryRun]);

  const toFixRows = useMemo(() => {
    if (!dryRun) return [] as EcriturePreview[];
    return (dryRun.ecrituresPreview || []).filter((r) => {
      const id = String(r.transaction_id);
      return (
        (r.resolution_source === 'fallback' || r.lmnp_bucket === 'A_CLASSER') &&
        !autoAppliedTxIds.has(id) &&
        !isValidSessionOverride(sessionTransientByTxId[id])
      );
    });
  }, [dryRun, autoAppliedTxIds, sessionTransientByTxId]);

  const suggestions = useMemo(
    () =>
      toFixRows
        .filter((row) => row.suggestion && row.suggestion.source !== 'fallback')
        .slice(0, 12)
        .map((row) => ({ row, suggestion: row.suggestion! })),
    [toFixRows],
  );

  const computeTransientOverrides = (payload: DryRunPayload | null, threshold: number) => {
    if (!payload) return [] as Array<{ transactionId: string; lmnpBucket: string; lmnpLabel: string }>;
    const byTx = new Map<string, { transactionId: string; lmnpBucket: string; lmnpLabel: string }>();
    for (const r of payload.ecrituresPreview || []) {
      const s = r.suggestion;
      if (!s || s.source === 'fallback') continue;

      const isStrongDocumentType = s.source === 'document_type' && s.confidence >= 0.9;
      const isStrongLearning = s.source === 'learning' && s.confidence >= 0.85;
      const isStandardAutoCandidate =
        (r.resolution_source === 'fallback' || r.lmnp_bucket === 'A_CLASSER') && s.confidence >= threshold;

      if (!isStrongDocumentType && !isStrongLearning && !isStandardAutoCandidate) continue;
      byTx.set(String(r.transaction_id), {
        transactionId: String(r.transaction_id),
        lmnpBucket: String(s.suggestedBucket),
        lmnpLabel: String(s.suggestedLabel),
      });
    }
    return [...byTx.values()];
  };

  const runDryRun = async (
    sessionOverride?: Record<string, SessionOverrideValue>,
    opts?: { suppressSuccessToast?: boolean },
  ): Promise<DryRunPayload | null> => {
    if (isActivityView && !lmnpActivityId) {
      toast.error('Sélectionnez une activité LMNP');
      return null;
    }
    if (!isActivityView && !effectivePropertyId) {
      toast.error('Sélectionnez une activité LMNP ou un bien');
      return null;
    }
    const postDryRun = async (transient: TxOverride[]): Promise<DryRunPayload | null> => {
      const res = await fetch('/api/lmnp/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isActivityView ? { lmnpActivityId } : { propertyId: effectivePropertyId }),
          exerciseYear,
          mode: 'dryRun',
          ...(transient.length > 0 ? { transientTxOverrides: transient } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Dry run impossible');
        return null;
      }
      return json as DryRunPayload;
    };

    const sessionRecord = sessionOverride ?? sessionTransientByTxId;
    const sessionArr: TxOverride[] = sessionRecordToSessionArr(sessionRecord);

    try {
      setIsAnalyzing(true);
      let payload = await postDryRun(sessionArr);
      if (!payload) return null;

      if (isAutoMode) {
        const autoTransient = computeTransientOverrides(payload, 0.85);
        const merged = mergeSessionAndAutoTransients(sessionArr, autoTransient);
        let finalPayload = payload;
        if (autoTransient.length > 0) {
          const p2 = await postDryRun(merged);
          if (p2) finalPayload = p2;
        }
        const mergedAppliedIds = new Set(autoAppliedTxIds);
        autoTransient.forEach((t) => mergedAppliedIds.add(String(t.transactionId)));
        sessionArr.forEach((t) => mergedAppliedIds.add(String(t.transactionId)));

        const toReview = (finalPayload.ecrituresPreview || []).filter(
          (r) =>
            (r.resolution_source === 'fallback' || r.lmnp_bucket === 'A_CLASSER') &&
            !mergedAppliedIds.has(String(r.transaction_id)) &&
            (!r.suggestion || r.suggestion.source === 'fallback' || (r.suggestion.confidence || 0) < 0.85),
        ).length;

        setAutoFeedback({ applied: autoTransient.length, toReview });
        setAutoAppliedTxIds((prev) => {
          const n = new Set(prev);
          sessionArr.forEach((t) => n.add(String(t.transactionId)));
          autoTransient.forEach((t) => n.add(String(t.transactionId)));
          return n;
        });
        setDryRun(finalPayload);
        if (!opts?.suppressSuccessToast) {
          if (autoTransient.length > 0) {
            toast.success(
              `${autoTransient.length} correction(s) appliquée(s) automatiquement · ${toReview} élément(s) à vérifier`,
            );
          } else {
            toast.success('Analyse LMNP terminée');
          }
        }
        return finalPayload;
      }

      if (!isAutoMode) {
        setAutoFeedback(null);
        setAutoAppliedTxIds(new Set());
      }
      setDryRun(payload);
      if (!opts?.suppressSuccessToast) {
        toast.success('Analyse LMNP terminée');
      }
      return payload;
    } catch {
      toast.error('Erreur réseau');
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runFinal = async () => {
    let currentDryRun = dryRun;
    if (!currentDryRun?.dryRunPayloadHash) {
      currentDryRun = await runDryRun();
      if (!currentDryRun?.dryRunPayloadHash) return;
    }

    const sessionArrFinal: TxOverride[] = sessionRecordToSessionArr(sessionTransientByTxId);
    let transientForFinal: TxOverride[] = [];
    if (isAutoMode) {
      transientForFinal = mergeSessionAndAutoTransients(sessionArrFinal, computeTransientOverrides(currentDryRun, 0.85));
      const criticalRemaining = (currentDryRun.ecrituresPreview || []).filter(
        (r) =>
          (r.resolution_source === 'fallback' || r.lmnp_bucket === 'A_CLASSER') &&
          (!r.suggestion || r.suggestion.source === 'fallback' || (r.suggestion.confidence || 0) < 0.6),
      ).length;
      if (criticalRemaining > 0) {
        toast.error(`⚠ ${criticalRemaining} élément(s) à faible confiance restent critiques. Analyse requise.`);
        return;
      }
    } else if ((currentDryRun.manifest.blockingAnomalyCount || 0) > 0) {
      toast.error('Des anomalies bloquantes subsistent. Corrigez-les depuis la liste ou créez une règle de mapping.');
      return;
    }

    try {
      setIsFinalizing(true);
      let dryRunForFinal = currentDryRun;
      if (isAutoMode) {
        const preFinalDryRun = await fetch('/api/lmnp/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(isActivityView ? { lmnpActivityId } : { propertyId: effectivePropertyId }),
            exerciseYear,
            mode: 'dryRun',
            transientTxOverrides: transientForFinal,
          }),
        });
        const preFinalJson = await preFinalDryRun.json().catch(() => null);
        if (!preFinalDryRun.ok || !preFinalJson?.success) {
          toast.error(preFinalJson?.message || preFinalJson?.error || 'Pré-analyse finale impossible');
          return;
        }
        dryRunForFinal = preFinalJson as DryRunPayload;
        setDryRun(dryRunForFinal);
      }

      const res = await fetch('/api/lmnp/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isActivityView ? { lmnpActivityId } : { propertyId: effectivePropertyId }),
          exerciseYear,
          mode: 'final',
          dryRunPayloadHash: dryRunForFinal.dryRunPayloadHash,
          transientTxOverrides: transientForFinal,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.message || json?.error || 'Export final impossible');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LMNP_${(isActivityView ? selectedActivity?.name : selectedProperty?.name) || effectivePropertyId}_${exerciseYear}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Dossier comptable LMNP généré');
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsFinalizing(false);
    }
  };

  const createSuggestedRule = async (s: NonNullable<EcriturePreview['suggestion']>, row: EcriturePreview) => {
    if (isAutoMode) {
      const txId = String(row.transaction_id);
      const nextSession: Record<string, SessionOverrideValue> = {
        ...sessionTransientByTxId,
        [txId]: { lmnpBucket: s.suggestedBucket, lmnpLabel: s.suggestedLabel },
      };
      setSessionTransientByTxId(nextSession);
      setAutoAppliedTxIds((prev) => {
        const n = new Set(prev);
        n.add(txId);
        return n;
      });
      void persistLmnpLearning(row, s.suggestedBucket, s.suggestedLabel, Math.max(s.confidence, 0.65));
      const refreshed = await runDryRun(nextSession, { suppressSuccessToast: true });
      if (refreshed) {
        toast.success(s.confidence < 0.85 ? 'Correction mémorisée par Smartimmo' : 'Correction prise en compte pour cette analyse');
      }
      return;
    }

    if (!isAdmin) {
      toast.error('Action réservée admin');
      return;
    }
    try {
      const res = await fetch('/api/admin/lmnp/mapping-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseYear,
          propertyId: undefined,
          natureCode: s.suggestedNatureCode || row.nature_code || undefined,
          categoryId: undefined,
          lmnpBucket: s.suggestedBucket,
          lmnpLabel: s.suggestedLabel,
          priority: 760,
          active: true,
          mappingVersion: dryRun?.manifest.mappingVersion || '1',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Création de règle impossible');
        return;
      }
      toast.success(json?.skipped ? 'Correction déjà couverte' : 'Correction appliquée');
      void persistLmnpLearning(row, s.suggestedBucket, s.suggestedLabel, Math.max(s.confidence, 0.65));
      void runDryRun();
    } catch {
      toast.error('Erreur réseau');
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-orange-100 shadow-sm">
        <CardHeader className="space-y-0 pb-4">
          {/* Ligne 1 — Titre + statut */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-gray-100">
            <div className="min-w-0">
              <CardTitle className="text-[1.65rem] leading-tight text-gray-900">Pilotage LMNP</CardTitle>
              <p className="mt-1 text-sm text-gray-500 leading-snug max-w-xl">
                Préparez votre dossier comptable LMNP en quelques clics.
              </p>
              {isActivityView && selectedActivity && (
                <p className="mt-1 text-xs text-gray-600">
                  Activité LMNP : <span className="font-medium text-gray-800">{selectedActivity.name}</span> · SIRET{' '}
                  <span className="font-mono text-gray-800">{selectedActivity.siret}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isActivityView && (
                <Badge variant="secondary" size="sm" className="border border-amber-200 bg-amber-50 text-amber-800">
                  Vue bien - export partiel
                </Badge>
              )}
              <Badge variant={status.variant} size="sm" className="shrink-0 self-start sm:self-center mt-0.5 sm:mt-0">
                {status.label}
              </Badge>
            </div>
          </div>

          {/* Ligne 2 — Paramètres */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4 pb-4 border-b border-gray-100">
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={isActivityView ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setScopeView('activity')}
                disabled={activities.length === 0}
              >
                Vue globale LMNP (activité/SIRET)
              </Button>
              <Button
                type="button"
                variant={!isActivityView ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setScopeView('property')}
              >
                Vue par bien
              </Button>
            </div>
            <div>
              {isActivityView ? (
                <>
                  <LabelText>Activité LMNP</LabelText>
                  <Select
                    value={lmnpActivityId}
                    onChange={(e) => setLmnpActivityId(e.target.value)}
                    options={activities.map((a) => ({ value: a.id, label: `${a.name} (${a.siret})` }))}
                  />
                  {!isLoadingActivities && activities.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-700">
                      Aucune activité LMNP configurée. Fallback actif par bien.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <LabelText>Bien</LabelText>
                  <Select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    options={properties.map((p) => ({ value: p.id, label: p.name }))}
                  />
                </>
              )}
            </div>
            <div>
              <LabelText>Exercice</LabelText>
              <Input type="number" value={exerciseYear} onChange={(e) => setExerciseYear(parseInt(e.target.value || '0', 10) || 0)} />
            </div>
            {isActivityView && selectedActivity && (
              <div className="sm:col-span-2 text-xs text-gray-600 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Biens inclus ({(selectedActivity.Properties || []).length}) :</span>
                  <Link href="/parametres/lmnp-activities">
                    <Button size="sm" variant="outline">
                      Gérer l’activité LMNP
                    </Button>
                  </Link>
                </div>
                {(selectedActivity.Properties || []).length > 0 ? (
                  <ul className="space-y-0.5">
                    {(selectedActivity.Properties || []).map((p) => (
                      <li key={p.id}>
                        <Link href={`/biens/${p.id}`} className="text-primary-700 hover:underline">
                          • {p.name} ({[p.postalCode, p.city].filter(Boolean).join(' ') || p.address || 'Adresse non renseignée'})
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div>—</div>
                )}
              </div>
            )}
          </div>

          {/* Ligne 3 — Mode automatique */}
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Switch checked={autoApplyConfident} onCheckedChange={setAutoApplyConfident} />
              <span className="text-sm font-medium text-gray-800">Mode automatique</span>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed pl-1 sm:pl-9">
              Smartimmo applique les corrections fiables sans modifier vos transactions.
            </p>
          </div>

          {/* Ligne 4 — Actions */}
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              size="md"
              className="w-full sm:w-auto order-2 sm:order-1 justify-center text-gray-700 border-gray-300 hover:bg-gray-50"
              onClick={runDryRun}
              disabled={isAnalyzing || isLoadingProps || (isActivityView && isLoadingActivities)}
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Analyser
            </Button>
            <Button
              size="lg"
              variant="primary"
              className="w-full sm:w-auto order-1 sm:order-2 justify-center px-6 shadow-md hover:shadow-xl ring-1 ring-orange-500/20 hover:scale-[1.015] active:scale-[0.99] transition-all duration-150 text-sm sm:text-base font-semibold"
              onClick={runFinal}
              disabled={!dryRun || (!isAutoMode && dryRun.manifest.blockingAnomalyCount > 0) || isFinalizing}
            >
              {isFinalizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileArchive className="h-4 w-4 mr-2" />}
              Générer le dossier comptable
            </Button>
          </div>

          {/* Ligne 5 — Feedback compact */}
          {isAutoMode && autoFeedback && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" aria-hidden />
              <span>
                {autoFeedback.applied} correction{autoFeedback.applied !== 1 ? 's' : ''} · {autoFeedback.toReview} à vérifier
              </span>
            </div>
          )}
        </CardHeader>
      </Card>

      {dryRun && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi title="Transactions classées" value={`${dryRun.manifest.transactionCount - dryRun.manifest.blockingAnomalyCount}/${dryRun.manifest.transactionCount}`} />
            <Kpi title="Couverture" value={pct(dryRun.manifest.coverageRate)} />
            <Kpi title="Anomalies" value={String(dryRun.manifest.anomalyCount)} />
            <Kpi title="A_CLASSER" value={String(kpis?.aClasser ?? 0)} />
            <Kpi title="Recettes locatives" value={euro(kpis?.recettes || 0)} />
            <Kpi title="Charges exploitation" value={euro(kpis?.chargesExploitation || 0)} />
            <Kpi title="Charges fiscales" value={euro(kpis?.chargesFiscales || 0)} />
            <Kpi title="Intérêts emprunt" value={euro(kpis?.interets || 0)} />
            <Kpi title="Assurance emprunteur" value={euro(kpis?.assurance || 0)} />
            <Kpi title="Résultat LMNP estimé" value={euro(kpis?.resultatEstime || 0)} />
            <Kpi
              title="Qualité LMNP"
              value={`${Math.round(
                ((dryRun.manifest.coverageRate || 0) * 0.7 +
                  (1 - Math.min((dryRun.manifest.blockingAnomalyCount || 0) / Math.max(dryRun.manifest.transactionCount || 1, 1), 1)) * 0.2 +
                  ((toFixRows.filter((r) => (r.suggestion?.confidence || 0) >= 0.85).length / Math.max(toFixRows.length || 1, 1)) * 0.1)) *
                  100,
              )}% prêt comptable`}
            />
          </div>

          {correctedThisAnalysisGroups.length > 0 && (
            <Card className="rounded-2xl border-green-100 bg-green-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> Corrections retenues pour cette analyse
                </CardTitle>
                <CardDescription className="text-xs">
                  Mémoire d’analyse (stateless) : ces positions restent prises en compte tant que vous analysez ce bien et
                  cet exercice. Smartimmo enregistre aussi vos validations pour les prochains exports. Les lignes
                  proches (même sens métier) sont regroupées.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {correctedThisAnalysisGroups.map((g) => (
                  <div
                    key={g.groupKey}
                    className="rounded-xl border border-green-100 bg-white/80 p-2 text-sm flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium flex flex-wrap items-center gap-2">
                        <span className="truncate">{g.title}</span>
                        {g.count > 1 && (
                          <Badge variant="primary" size="sm" className="shrink-0">
                            ×{g.count}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {g.lmnpBucket} · {g.lmnpLabel}
                        {g.count > 1 && (
                          <span className="text-gray-400"> · cumul {euro(g.totalAmount)}</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" size="sm" className="shrink-0 border border-green-200 text-green-800 bg-green-50/90">
                      Corrigé pour cette analyse
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> À corriger
              </CardTitle>
              <CardDescription>Transactions non classées / fallback avant génération finale.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {toFixRows.length === 0 && <div className="text-sm text-gray-600 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Aucun point bloquant détecté dans l’aperçu.</div>}
              {toFixRows.slice(0, 15).map((r) => (
                <div key={r.transaction_id} className="rounded-xl border border-gray-200 p-3 text-sm grid grid-cols-1 md:grid-cols-6 gap-2">
                  <div className="md:col-span-2">
                    <div className="font-medium">{rowDisplayName(r)}</div>
                    <div className="text-xs text-gray-500">{r.nature_code || '—'} · {r.category_label || r.category_slug || '—'}</div>
                  </div>
                  <div>{euro(Number(r.amount) || 0)}</div>
                  <div>{isAutoMode ? 'Correction proposée' : (r.lmnp_bucket || '—')}</div>
                  <div>{isAutoMode ? 'Validation recommandée' : (r.lmnp_label || '—')}</div>
                  <div><Badge variant={r.resolution_source === 'fallback' ? 'warning' : 'gray'}>{r.resolution_source}</Badge></div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Auto-suggestions</CardTitle>
              <CardDescription>
                Suggestions basées sur documents, apprentissage Smartimmo, catégories et libellés — sans modifier vos
                transactions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestions.length === 0 && <div className="text-sm text-gray-500">Aucune suggestion détectée pour l’aperçu courant.</div>}
              {suggestions.map(({ row, suggestion }) => {
                const ctaLabel = !isAutoMode && suggestion.confidence >= 0.85 ? 'Corriger automatiquement' : 'Valider cette correction';
                return (
                <div key={`${row.transaction_id}-${suggestion.suggestedBucket}-${suggestion.suggestedLabel}`} className="rounded-xl border border-gray-200 p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-medium">
                      {rowDisplayName(row)} — {suggestion.suggestedBucket} · {suggestion.suggestedLabel}
                    </div>
                    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-1">
                      <Badge size="sm" variant={confidenceBadge(suggestion.confidence).variant}>
                        {confidenceBadge(suggestion.confidence).label}
                      </Badge>
                      <Badge size="sm" variant="info">
                        Source: {sourceLabel(suggestion.source)}
                      </Badge>
                      <span>{Math.round(suggestion.confidence * 100)}%</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{suggestion.reason}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Nature {row.nature_code || '—'} · {row.category_label || row.category_slug || '—'} ·{' '}
                      {row.accounting_month || '—'}
                    </div>
                    {row.linkedDocuments?.[0] && (
                      <div className="text-xs text-gray-500 mt-1">
                        Document: {row.linkedDocuments[0].filename} · Type détecté: {row.linkedDocuments[0].documentTypeLabel || row.linkedDocuments[0].documentTypeCode || '—'}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => createSuggestedRule(suggestion, row)}
                    disabled={(!isAutoMode && !isAdmin) || suggestion.confidence < 0.6}
                    title={suggestion.confidence < 0.6 ? 'Suggestion à faible confiance : action désactivée' : ''}
                  >
                    {ctaLabel}
                  </Button>
                </div>
                );
              })}
            </CardContent>
          </Card>

          {!isAutoMode && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Dossier comptable</CardTitle>
                <CardDescription>Dry run, ZIP et accès rapide aux écrans admin LMNP.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Badge variant="info">Version mapping: {dryRun.manifest.mappingVersion}</Badge>
                {dryRun.recentRun?.id && <Badge variant="gray">Dernier run: {dryRun.recentRun.id}</Badge>}
                <Link href="/admin/lmnp/runs"><Button size="sm" variant="outline">Historique runs</Button></Link>
                <Link href="/admin/lmnp/anomalies"><Button size="sm" variant="outline">Anomalies</Button></Link>
                <Link href="/admin/lmnp/overrides"><Button size="sm" variant="outline">Overrides</Button></Link>
                <Link href="/admin/lmnp/mapping-rules"><Button size="sm" variant="outline">Règles</Button></Link>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card className="rounded-2xl border-gray-200">
      <CardContent className="pt-4">
        <div className="text-xs text-gray-500">{title}</div>
        <div className="text-lg font-semibold text-gray-900">{value}</div>
      </CardContent>
    </Card>
  );
}

function LabelText({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>;
}

