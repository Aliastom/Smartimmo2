'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Loader2, FileArchive, Sparkles, AlertTriangle, CheckCircle2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

type Property = { id: string; name: string };
type LmnpActivity = {
  id: string;
  name: string;
  siret: string;
  fiscalRegime: 'micro_bic' | 'reel_simplifie';
  updatedAt?: string;
  Properties?: Array<{
    id: string;
    name: string;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    fiscalTypeId?: string | null;
    fiscalRegimeId?: string | null;
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

const emptyActivityForm = {
  name: '',
  siret: '',
  fiscalRegime: 'reel_simplifie' as const,
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
  const router = useRouter();
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
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [isDeletingActivity, setIsDeletingActivity] = useState(false);
  const [editActivityOpen, setEditActivityOpen] = useState(false);
  const [deleteActivityOpen, setDeleteActivityOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<LmnpActivity | null>(null);
  const [activityForm, setActivityForm] = useState(emptyActivityForm);
  const [activeTab, setActiveTab] = useState<'activities' | 'dossier'>('activities');
  /** Corrections mémoire pour l'analyse courante (stateless), fusionnées à chaque dry run. */
  const [sessionTransientByTxId, setSessionTransientByTxId] = useState<Record<string, SessionOverrideValue>>({});
  const isAutoMode = autoApplyConfident;

  React.useEffect(() => {
    setSessionTransientByTxId({});
    setAutoAppliedTxIds(new Set());
    setAutoFeedback(null);
  }, [propertyId, lmnpActivityId, exerciseYear]);

  const loadActivities = React.useCallback(async () => {
    setIsLoadingActivities(true);
    try {
      const res = await fetch('/api/lmnp/activities?includeProperties=true');
      const json = await res.json().catch(() => null);
      const list = (json?.data || []) as LmnpActivity[];
      setActivities(list);
      return list;
    } catch {
      return [] as LmnpActivity[];
    } finally {
      setIsLoadingActivities(false);
    }
  }, []);

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

    void loadActivities().then((list) => {
      if (cancelled) return;
      if (list.length > 0) {
        setLmnpActivityId((prev) => prev || list[0].id);
      }
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
  }, [loadActivities]);

  React.useEffect(() => {
    if (isLoadingActivities) return;
    if (activities.length > 0) {
      setScopeView('activity');
      if (!lmnpActivityId) setLmnpActivityId(activities[0].id);
      return;
    }
    setScopeView('property');
  }, [activities, isLoadingActivities, lmnpActivityId]);

  React.useEffect(() => {
    setDryRun(null);
    setSessionTransientByTxId({});
    setAutoAppliedTxIds(new Set());
    setAutoFeedback(null);
  }, [lmnpActivityId]);

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
  const selectedActivityPropertyCount = selectedActivity?.Properties?.length ?? 0;
  const hasActivities = activities.length > 0;
  const hasLinkedProperties = selectedActivityPropertyCount > 0;
  const hasAnalysis = !!dryRun;
  const isDossierReady = !!dryRun && (dryRun.manifest.blockingAnomalyCount || 0) === 0;
  const lmnpProgressSteps = useMemo(() => {
    const s1Done = hasActivities;
    const s2Done = hasLinkedProperties;
    const s3Done = isDossierReady;
    return [
      { step: 1 as const, label: 'Activité créée', done: s1Done, current: !s1Done },
      { step: 2 as const, label: 'Biens associés', done: s2Done, current: s1Done && !s2Done },
      { step: 3 as const, label: 'Dossier prêt', done: s3Done, current: s1Done && s2Done && !s3Done },
    ];
  }, [hasActivities, hasLinkedProperties, isDossierReady]);
  const canGenerateFinal =
    !!dryRun && (isAutoMode || (dryRun.manifest.blockingAnomalyCount || 0) === 0);
  const premiumBtnClass = 'transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]';
  const floatGenerateClass =
    'shadow-xl backdrop-blur-sm transition-all duration-200 ease-out hover:scale-[1.03] active:scale-[0.97]';

  const openBiensForLmnpLinking = () => {
    toast.info('Ouvrez le bien concerné puis choisissez cette activité LMNP.');
    router.push('/app?view=biens');
  };

  const openCreateActivity = () => {
    setEditingActivity(null);
    setActivityForm(emptyActivityForm);
    setEditActivityOpen(true);
  };

  const openEditActivity = () => {
    if (!selectedActivity) return;
    setEditingActivity(selectedActivity);
    setActivityForm({
      name: selectedActivity.name,
      siret: selectedActivity.siret,
      fiscalRegime: selectedActivity.fiscalRegime,
    });
    setEditActivityOpen(true);
  };

  const saveActivity = async () => {
    if (!activityForm.name.trim()) {
      toast.error('Le nom de l’activité est requis');
      return;
    }
    if (!/^\d{14}$/.test(activityForm.siret)) {
      toast.error('Le SIRET doit contenir exactement 14 chiffres');
      return;
    }
    try {
      setIsSavingActivity(true);
      const method = editingActivity ? 'PATCH' : 'POST';
      const url = editingActivity ? `/api/lmnp/activities/${editingActivity.id}` : '/api/lmnp/activities';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activityForm.name.trim(),
          siret: activityForm.siret,
          fiscalRegime: activityForm.fiscalRegime,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Impossible de sauvegarder l’activité');
        return;
      }
      await loadActivities();
      if (json?.data?.id) {
        setLmnpActivityId(String(json.data.id));
      }
      setEditActivityOpen(false);
      toast.success(editingActivity ? 'Activité LMNP modifiée' : 'Activité LMNP créée');
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsSavingActivity(false);
    }
  };

  const deleteActivity = async () => {
    if (!selectedActivity) return;
    if (selectedActivityPropertyCount > 0) {
      toast.error(`Suppression impossible : ${selectedActivityPropertyCount} bien(s) rattaché(s).`);
      return;
    }
    try {
      setIsDeletingActivity(true);
      const res = await fetch(`/api/lmnp/activities/${selectedActivity.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Suppression impossible');
        return;
      }
      const refreshed = await loadActivities();
      setLmnpActivityId(refreshed[0]?.id || '');
      setDeleteActivityOpen(false);
      toast.success('Activité LMNP supprimée');
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsDeletingActivity(false);
    }
  };

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
      <Card className="border-orange-100 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="space-y-0 pb-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-gray-100">
            <div className="min-w-0">
              <CardTitle className="text-[1.65rem] leading-tight text-gray-900">LMNP</CardTitle>
              <p className="mt-1 text-sm text-gray-500 leading-snug max-w-xl">
                Gérez vos activités LMNP, vos biens rattachés et votre dossier comptable.
              </p>
            </div>
            {activeTab === 'activities' && (
              <div className="flex items-center gap-2 self-start sm:self-center">
                <Badge variant={status.variant} size="sm" className="shrink-0 self-start sm:self-center mt-0.5 sm:mt-0">
                  {status.label}
                </Badge>
              </div>
            )}
          </div>

          <AnimatePresence>
            {isDossierReady && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="mt-4 w-full rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 border-l-4 border-l-emerald-500"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">🎉 Votre dossier est prêt</p>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Tout est analysé. Vous pouvez générer votre dossier comptable.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'activities' | 'dossier')} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="activities">Activités & biens</TabsTrigger>
              <TabsTrigger value="dossier" disabled={!hasActivities}>
                Dossier comptable
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activities" className="mt-4 space-y-4">
              <Card className="border-gray-200 bg-white rounded-2xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Activité LMNP</CardTitle>
                  <CardDescription>Suivez les étapes pour préparer votre dossier LMNP sereinement.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-orange-100 bg-orange-50/40 px-3 py-3">
                    <p className="text-xs font-medium text-orange-900">Progression LMNP</p>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {lmnpProgressSteps.map((item) => {
                        const boxClass = item.done
                          ? 'border-emerald-200 bg-emerald-50/90 text-emerald-900 shadow-sm'
                          : item.current
                            ? 'border-orange-300 bg-white text-orange-900 shadow-[0_0_0_1px_rgba(249,115,22,0.12)]'
                            : 'border-gray-200 bg-white text-gray-500';
                        const mark = item.done ? '✔' : item.current ? '●' : '○';
                        return (
                          <motion.div
                            key={item.step}
                            layout
                            initial={false}
                            animate={{ scale: item.current ? 1.02 : 1 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                            className={`rounded-lg border px-2.5 py-2 text-xs transition-all duration-300 ${boxClass}`}
                          >
                            <span className="font-semibold mr-1">{mark}</span>
                            <span>{item.label}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {hasActivities ? (
                    <div className="rounded-xl border border-orange-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">Activité en cours</p>
                          <p className="text-base font-semibold text-gray-900 mt-1">{selectedActivity?.name || '—'}</p>
                          <p className="text-sm text-gray-600 mt-0.5">
                            SIRET <span className="font-mono">{selectedActivity?.siret || '—'}</span> ·{' '}
                            {selectedActivity?.fiscalRegime === 'reel_simplifie' ? 'Réel simplifié' : selectedActivity?.fiscalRegime === 'micro_bic' ? 'Micro BIC' : '—'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {selectedActivityPropertyCount} bien{selectedActivityPropertyCount > 1 ? 's' : ''} rattaché
                            {selectedActivityPropertyCount > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="min-w-[260px]">
                            <Select
                              className="h-10 text-sm"
                              value={lmnpActivityId}
                              onChange={(e) => {
                                setScopeView('activity');
                                setLmnpActivityId(e.target.value);
                              }}
                              options={activities.map((a) => ({ value: a.id, label: `${a.name} (${a.siret})` }))}
                            />
                          </div>
                          <Button type="button" size="sm" variant="outline" className={premiumBtnClass} onClick={openEditActivity} disabled={!selectedActivity}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Modifier
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            className={premiumBtnClass}
                            disabled={!selectedActivity || selectedActivityPropertyCount > 0}
                            onClick={() => setDeleteActivityOpen(true)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Supprimer
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() => void loadActivities()}
                            disabled={isLoadingActivities}
                            title="Rafraîchir la liste des activités"
                          >
                            <RefreshCw className={`h-4 w-4 ${isLoadingActivities ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
                      Créez votre activité LMNP pour démarrer.
                    </div>
                  )}

                  <motion.div
                    key={`next-${hasActivities}-${hasLinkedProperties}-${hasAnalysis}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="rounded-2xl border border-orange-200/90 bg-orange-50/40 px-6 py-6 shadow-md space-y-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-900/90">Prochaine étape</p>
                    {!hasActivities ? (
                      <>
                        <Button
                          type="button"
                          size="lg"
                          variant="primary"
                          onClick={openCreateActivity}
                          className={`h-12 px-6 shadow-md ${premiumBtnClass}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Créer ma première activité
                        </Button>
                        <div className="text-sm text-gray-700 leading-snug max-w-xl">
                          <p>Créez votre activité LMNP (SIRET) pour centraliser vos biens.</p>
                          <p className="text-gray-500 mt-1">Ensuite, vous pourrez analyser et générer votre dossier.</p>
                        </div>
                      </>
                    ) : !hasLinkedProperties ? (
                      <>
                        <Button
                          type="button"
                          size="lg"
                          variant="primary"
                          className={`h-12 px-6 shadow-md ${premiumBtnClass}`}
                          onClick={openBiensForLmnpLinking}
                        >
                          Associer un bien
                        </Button>
                        <div className="text-sm text-gray-700 leading-snug max-w-xl">
                          <p>Ajoutez au moins un bien à cette activité pour débloquer l’analyse.</p>
                          <p className="text-gray-500 mt-1">Rendez-vous sur vos biens pour lier ce bien à l’activité.</p>
                        </div>
                      </>
                    ) : !hasAnalysis ? (
                      <>
                        <Button
                          type="button"
                          size="lg"
                          variant="primary"
                          className={`h-12 px-6 shadow-md ${premiumBtnClass}`}
                          disabled={!hasLinkedProperties}
                          title={
                            !hasLinkedProperties
                              ? 'Associez au moins un bien à cette activité pour lancer l’analyse.'
                              : undefined
                          }
                          onClick={() => hasLinkedProperties && setActiveTab('dossier')}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Analyser
                        </Button>
                        <div className="text-sm text-gray-700 leading-snug max-w-xl">
                          <p>Vos biens sont prêts : lancez l’analyse du dossier.</p>
                          <p className="text-gray-500 mt-1">Smartimmo vérifie les écritures avant la génération.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="lg"
                          variant="primary"
                          className={`h-12 px-6 shadow-md ${premiumBtnClass}`}
                          onClick={() => setActiveTab('dossier')}
                        >
                          Ouvrir le dossier comptable
                        </Button>
                        <div className="text-sm text-gray-700 leading-snug max-w-xl">
                          <p>Analyse terminée : poursuivez dans l’onglet dossier.</p>
                          <p className="text-gray-500 mt-1">Vous pourrez générer votre export depuis le bas de page.</p>
                        </div>
                      </>
                    )}
                  </motion.div>

                  {selectedActivityPropertyCount > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-700" />
                      <p>
                        Suppression impossible : {selectedActivityPropertyCount}{' '}
                        {selectedActivityPropertyCount > 1 ? 'biens sont rattachés' : 'bien est rattaché'} à cette activité.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-gray-200 bg-white rounded-2xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Biens rattachés</CardTitle>
                </CardHeader>
                <CardContent>
                  {(selectedActivity?.Properties || []).length > 0 ? (
                    <ul className="space-y-2.5">
                      {(selectedActivity?.Properties || []).map((p) => (
                        <li key={p.id} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md transition-all duration-200">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 text-sm">
                              <p className="font-medium text-gray-900">{p.name}</p>
                              <p className="text-gray-600">
                                {[p.postalCode, p.city].filter(Boolean).join(' ') || p.address || 'Adresse non renseignée'}
                              </p>
                              <p className="text-gray-500">
                                Type fiscal: {p.fiscalTypeId || '—'} · Régime: {p.fiscalRegimeId || '—'}
                              </p>
                            </div>
                            <Link href={`/app?view=property&propertyId=${p.id}`}>
                              <Button type="button" size="sm" variant="outline" className={premiumBtnClass}>
                                Ouvrir le bien
                              </Button>
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50/30 px-4 py-3">
                      <p className="text-sm text-gray-700">Aucun bien rattaché pour le moment.</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Utilisez la carte « Prochaine étape » ci-dessus pour associer un bien.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dossier" className="mt-4 space-y-4">
              {!hasActivities ? (
                <Card className="border-amber-200 bg-amber-50/60">
                  <CardContent className="py-4 text-sm text-amber-900">
                    Créez une activité LMNP pour générer un dossier comptable.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card className="border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Paramètres du dossier</CardTitle>
                      <CardDescription>Exercice, analyse et corrections avant export.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                        <div className={`grid gap-2 ${isDossierReady ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                          <p>
                            <span className="text-gray-500">Exercice:</span>{' '}
                            <span className="font-medium text-gray-900">{exerciseYear}</span>
                          </p>
                          {!isDossierReady && (
                            <p>
                              <span className="text-gray-500">Statut:</span>{' '}
                              <span
                                className={
                                  !hasAnalysis
                                    ? 'text-amber-700 font-medium'
                                    : (dryRun?.manifest.blockingAnomalyCount || 0) > 0
                                      ? 'text-amber-800 font-medium'
                                      : 'text-gray-800 font-medium'
                                }
                              >
                                {!hasAnalysis
                                  ? 'En attente d’analyse'
                                  : (dryRun?.manifest.blockingAnomalyCount || 0) > 0
                                    ? 'Analysé — points à corriger'
                                    : 'Analysé'}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <LabelText>Exercice</LabelText>
                          <Input type="number" value={exerciseYear} onChange={(e) => setExerciseYear(parseInt(e.target.value || '0', 10) || 0)} />
                        </div>
                        <div className="md:col-span-2" />
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Switch checked={autoApplyConfident} onCheckedChange={setAutoApplyConfident} />
                          <span className="text-sm font-medium text-gray-800">Mode automatique</span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed pl-1 sm:pl-9">
                          Smartimmo applique les corrections fiables sans modifier vos transactions.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={isActivityView ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => setScopeView('activity')}
                          disabled={!hasActivities}
                        >
                          Vue activité
                        </Button>
                        <Button variant={!isActivityView ? 'primary' : 'outline'} size="sm" onClick={() => setScopeView('property')}>
                          Vue par bien
                        </Button>
                        {!isActivityView && (
                          <div className="min-w-[280px] flex-1">
                            <Select
                              value={propertyId}
                              onChange={(e) => setPropertyId(e.target.value)}
                              options={properties.map((p) => ({ value: p.id, label: p.name }))}
                            />
                          </div>
                        )}
                      </div>
                      {!isActivityView && (
                        <Badge variant="secondary" size="sm" className="border border-amber-200 bg-amber-50 text-amber-800">
                          Vue par bien - mode secondaire
                        </Badge>
                      )}

                      <div
                        className={`rounded-xl border px-4 py-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between ${
                          hasAnalysis
                            ? 'border-gray-100 bg-transparent'
                            : 'border-orange-200/90 bg-orange-50/50 shadow-sm'
                        }`}
                      >
                        {!hasAnalysis && (
                          <p className="text-sm text-gray-800 sm:max-w-md">
                            <span className="font-semibold text-orange-900">Étape suivante :</span> lancez une analyse pour
                            préparer la génération du dossier.
                          </p>
                        )}
                        <Button
                          variant={hasAnalysis ? 'outline' : 'primary'}
                          size="md"
                          className={`w-full sm:w-auto shrink-0 justify-center ${
                            hasAnalysis
                              ? `text-gray-700 border-gray-300 hover:bg-gray-50 ${premiumBtnClass}`
                              : `h-11 px-5 shadow-md ${premiumBtnClass}`
                          }`}
                          onClick={runDryRun}
                          disabled={
                            isAnalyzing ||
                            isLoadingProps ||
                            (isActivityView && isLoadingActivities) ||
                            (isActivityView && !hasLinkedProperties) ||
                            (!isActivityView && !propertyId)
                          }
                          title={
                            isActivityView && !hasLinkedProperties
                              ? 'Associez au moins un bien à cette activité avant d’analyser.'
                              : !isActivityView && !propertyId
                                ? 'Sélectionnez un bien pour lancer l’analyse.'
                                : undefined
                          }
                        >
                          {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                          Analyser
                        </Button>
                      </div>

                      {(isAnalyzing || isFinalizing) && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                          <p>
                            {isAnalyzing
                              ? 'Analyse en cours...'
                              : 'Génération en cours...'}
                          </p>
                          <p className="text-blue-800/90">
                            {isAnalyzing
                              ? 'Smartimmo vérifie vos écritures et prépare votre dossier.'
                              : 'Smartimmo assemble les pièces pour votre dossier comptable.'}
                          </p>
                          <div className="mt-2 h-1.5 w-full rounded-full bg-blue-100 overflow-hidden">
                            <div className="h-full w-1/3 bg-blue-500 animate-pulse" />
                          </div>
                        </div>
                      )}

                      {isAutoMode && autoFeedback && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" aria-hidden />
                          <span>
                            {autoFeedback.applied} correction{autoFeedback.applied !== 1 ? 's' : ''} appliquée{autoFeedback.applied !== 1 ? 's' : ''} automatiquement · {autoFeedback.toReview} point{autoFeedback.toReview > 1 ? 's' : ''} à valider
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {dryRun && (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <Kpi title="Transactions classées" value={`${dryRun.manifest.transactionCount - dryRun.manifest.blockingAnomalyCount}/${dryRun.manifest.transactionCount}`} insight="Suivi de classement de l'exercice" />
                        <Kpi title="Couverture" value={pct(dryRun.manifest.coverageRate)} insight="Part des écritures correctement affectées" />
                        <Kpi title="Anomalies" value={String(dryRun.manifest.anomalyCount)} insight="Points nécessitant votre attention" />
                        <Kpi title="A_CLASSER" value={String(kpis?.aClasser ?? 0)} insight="Éléments encore en attente de décision" />
                        <Kpi title="Recettes locatives" value={euro(kpis?.recettes || 0)} insight="Tendance locative de la période" />
                        <Kpi title="Charges exploitation" value={euro(kpis?.chargesExploitation || 0)} insight="Dépenses opérationnelles suivies" />
                        <Kpi title="Charges fiscales" value={euro(kpis?.chargesFiscales || 0)} insight="Impact fiscal provisionné" />
                        <Kpi title="Intérêts emprunt" value={euro(kpis?.interets || 0)} insight="Coût financier de la dette" />
                        <Kpi title="Assurance emprunteur" value={euro(kpis?.assurance || 0)} insight="Couverture assurance des prêts" />
                        <Kpi title="Résultat LMNP estimé" value={euro(kpis?.resultatEstime || 0)} insight="Projection avant génération finale" />
                        <Kpi
                          title="Qualité LMNP"
                          value={`${Math.round(
                            ((dryRun.manifest.coverageRate || 0) * 0.7 +
                              (1 - Math.min((dryRun.manifest.blockingAnomalyCount || 0) / Math.max(dryRun.manifest.transactionCount || 1, 1), 1)) * 0.2 +
                              ((toFixRows.filter((r) => (r.suggestion?.confidence || 0) >= 0.85).length / Math.max(toFixRows.length || 1, 1)) * 0.1)) *
                              100,
                          )}% prêt comptable`}
                          insight="Indice global de préparation du dossier"
                        />
                      </div>

                      <Card className="rounded-2xl border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                        <CardHeader>
                          <CardTitle>Contrôles et corrections</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {correctedThisAnalysisGroups.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
                            <Card className="rounded-2xl border-green-100 bg-green-50/40 shadow-sm">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-600" /> Corrections retenues
                                </CardTitle>
                                <CardDescription className="text-xs">
                                  Mémoire d’analyse (stateless) : ces positions restent prises en compte tant que vous analysez ce bien et cet exercice.
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
                                        {g.count > 1 && <span className="text-gray-400"> · cumul {euro(g.totalAmount)}</span>}
                                      </div>
                                    </div>
                                    <Badge variant="secondary" size="sm" className="shrink-0 border border-green-200 text-green-800 bg-green-50/90">
                                      Corrigé pour cette analyse
                                    </Badge>
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                            </motion.div>
                          )}

                          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
                          <Card className="rounded-2xl border-orange-200 bg-orange-50/20">
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
                          </motion.div>

                          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26 }}>
                          <Card className="rounded-2xl border-gray-200">
                            <CardHeader>
                              <CardTitle>Auto-suggestions</CardTitle>
                              <CardDescription>
                                Suggestions basées sur documents, apprentissage Smartimmo, catégories et libellés — sans modifier vos transactions.
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
                                        Nature {row.nature_code || '—'} · {row.category_label || row.category_slug || '—'} · {row.accounting_month || '—'}
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
                          </motion.div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardHeader>
      </Card>

      {activeTab === 'dossier' && hasAnalysis && (
        <motion.div
          className="fixed bottom-6 right-24 lg:right-28 z-40"
          animate={isDossierReady && !isFinalizing ? { opacity: [0.95, 1, 0.95] } : { opacity: 1 }}
          transition={
            isDossierReady && !isFinalizing
              ? { duration: 3, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.2 }
          }
        >
          <Button
            size="lg"
            variant="primary"
            className={`h-12 px-6 rounded-xl ${floatGenerateClass}`}
            onClick={runFinal}
            disabled={!canGenerateFinal || isFinalizing}
            title={
              isFinalizing
                ? undefined
                : !canGenerateFinal
                  ? 'Corrigez les anomalies bloquantes avant de générer, ou activez le mode automatique.'
                  : undefined
            }
          >
            {isFinalizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileArchive className="h-4 w-4 mr-2" />}
            Générer mon dossier
          </Button>
        </motion.div>
      )}

      <Dialog open={editActivityOpen} onOpenChange={(o) => !o && setEditActivityOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingActivity ? 'Modifier activité LMNP' : 'Créer activité LMNP'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Nom activité</label>
              <Input
                value={activityForm.name}
                onChange={(e) => setActivityForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: LMNP Thomas"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">SIRET</label>
              <Input
                value={activityForm.siret}
                onChange={(e) => setActivityForm((p) => ({ ...p, siret: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
                placeholder="14 chiffres"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Régime fiscal</label>
              <Select
                value={activityForm.fiscalRegime}
                onChange={(e) =>
                  setActivityForm((p) => ({ ...p, fiscalRegime: e.target.value as 'micro_bic' | 'reel_simplifie' }))
                }
                options={[
                  { value: 'reel_simplifie', label: 'Réel simplifié' },
                  { value: 'micro_bic', label: 'Micro BIC' },
                ]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditActivityOpen(false)} disabled={isSavingActivity}>
              Annuler
            </Button>
            <Button type="button" onClick={saveActivity} disabled={isSavingActivity}>
              {isSavingActivity ? 'Sauvegarde…' : editingActivity ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteActivityOpen} onOpenChange={(o) => !o && setDeleteActivityOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l’activité LMNP</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">
            Confirmer la suppression de l’activité <span className="font-medium">{selectedActivity?.name}</span> ?
          </p>
          {selectedActivityPropertyCount > 0 && (
            <p className="text-sm text-amber-700">
              Suppression impossible : {selectedActivityPropertyCount} bien(s) rattaché(s).
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteActivityOpen(false)} disabled={isDeletingActivity}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={deleteActivity}
              disabled={isDeletingActivity || selectedActivityPropertyCount > 0}
            >
              {isDeletingActivity ? 'Suppression…' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function Kpi({ title, value, insight }: { title: string; value: string; insight?: string }) {
  return (
    <Card className="rounded-2xl border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <CardContent className="pt-4">
        <div className="text-xs text-gray-500">{title}</div>
        <div className="text-lg font-semibold text-gray-900">{value}</div>
        {insight && <div className="text-[11px] text-gray-500 mt-1">{insight}</div>}
      </CardContent>
    </Card>
  );
}

function LabelText({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>;
}

