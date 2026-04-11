'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Edit,
  Trash2,
  Copy,
  Calendar,
  Euro,
  Building2,
  FileText,
  Tag,
  Info,
  CheckCircle,
  XCircle,
  Link2,
  Unlink,
  PlusCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import {
  EcheanceRecurrente,
  PERIODICITE_LABELS,
  getNatureBadgeClass,
  getCategoryLabelForEcheance,
} from '@/types/echeance';
import { getNatureLabelForEcheance } from '@/lib/echeances/echeanceDisplayHelpers';
import { resolveNatureCodeForEcheance } from '@/lib/echeances/echeanceTypeMigration';
import { useEcheanceReferential } from '@/features/echeances/hooks/useEcheanceReferential';
import Link from 'next/link';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { createEcheanceServiceWithMode } from '@/domain/services/echeanceServiceFactory';
import { notify2 } from '@/lib/notify2';
import { cn } from '@/utils/cn';
import { getEcheanceRepositoryOffline } from '@/lib/offline/repositories/EcheanceRepositoryOffline';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getTenantRepositoryOffline } from '@/lib/offline/repositories/TenantRepositoryOffline';
import {
  getNextOccurrenceInfo,
  temporalBadgeMeta,
  generationBadgeMeta,
  getStatutGeneration,
} from '@/lib/echeances/echeanceCashflowHelpers';
import { getNextUncoveredOccurrenceInfo } from '@/lib/echeances/echeanceOccurrences';
import {
  getLinksByEcheanceIds,
  addEcheanceTransactionLink,
  removeEcheanceTransactionLink,
  getLinkByTransactionId,
} from '@/lib/echeances/echeanceTransactionLinkClient';
import {
  computeCoverage,
  transactionToCoverageInput,
  type CoverageResult,
} from '@/lib/echeances/echeanceCoverage';
import {
  suggestTransactionsForEcheance,
  getVisibleSuggestions,
  type TransactionForScoring,
  type ScoredSuggestion,
} from '@/lib/echeances/echeanceSuggestionScoring';
import { SUGGESTION_LEVEL_LABELS } from '@/types/echeance';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';

function SuggestionRow({
  suggestion,
  echeanceId,
  onLink,
  onIgnore,
  formatCurrency,
  formatDateShort,
  linking,
  checkLinkedElsewhere,
}: {
  suggestion: ScoredSuggestion<TransactionForScoring>;
  echeanceId: string;
  onLink: (txId: string) => void;
  onIgnore: () => void;
  formatCurrency: (n: number) => string;
  formatDateShort: (d: string) => string;
  linking: boolean;
  checkLinkedElsewhere: (txId: string) => Promise<{ echeanceId: string } | undefined>;
}) {
  const [linkedElsewhere, setLinkedElsewhere] = useState(false);
  useEffect(() => {
    let cancelled = false;
    checkLinkedElsewhere(suggestion.item.id).then((link) => {
      if (!cancelled && link && link.echeanceId !== echeanceId) setLinkedElsewhere(true);
    });
    return () => {
      cancelled = true;
    };
  }, [suggestion.item.id, echeanceId, checkLinkedElsewhere]);

  const reasonLabel = suggestion.reasons.map((r) => r.label).join(' + ');
  const levelLabel = SUGGESTION_LEVEL_LABELS[suggestion.level];

  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-gray-100 p-2 bg-gray-50/50 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900 truncate">{suggestion.item.label}</p>
        <p className="text-xs text-gray-600 tabular-nums mt-0.5">
          {formatDateShort(suggestion.item.date)} · {formatCurrency(suggestion.item.amount)}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <span
            className={cn(
              'text-[10px] font-medium rounded px-1.5 py-0.5',
              suggestion.level === 'FORT' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
            )}
          >
            {levelLabel}
          </span>
          <span className="text-[10px] text-gray-500 truncate max-w-[200px]" title={reasonLabel}>
            {reasonLabel}
          </span>
        </div>
        {linkedElsewhere && (
          <p className="text-[10px] text-amber-700 mt-1">Déjà liée à une autre échéance</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!linkedElsewhere && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onLink(suggestion.item.id)}
            disabled={linking}
          >
            Lier
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-gray-500" onClick={onIgnore}>
          Ignorer
        </Button>
      </div>
    </li>
  );
}

function toAnnualAmount(montant: number, periodicite: string): number {
  switch (periodicite) {
    case 'MONTHLY':
      return montant * 12;
    case 'QUARTERLY':
      return montant * 4;
    case 'YEARLY':
      return montant;
    default:
      return montant;
  }
}

interface EcheanceDrawerProps {
  echeance: EcheanceRecurrente | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (echeance: EcheanceRecurrente) => void;
  onDuplicate: (echeance: EcheanceRecurrente) => void;
  onDelete: (echeance: EcheanceRecurrente) => void;
  propertyId?: string; // Pour émettre l'événement de refresh
  onCreateTransaction?: (echeance: EcheanceRecurrente) => void;
  /** Occurrences déjà couvertes (sync avec l’onglet Échéances bien). Si absent : comportement historique. */
  coveredOccurrenceDates?: Set<string>;
  /** Mode de chargement des catégories pour afficher le libellé */
  dataMode?: 'normal' | 'app-shell';
}

export function EcheanceDrawer({
  echeance: initialEcheance,
  isOpen,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  propertyId,
  onCreateTransaction,
  coveredOccurrenceDates,
  dataMode = 'app-shell',
}: EcheanceDrawerProps) {
  const pilotageInfo = React.useCallback(
    (e: EcheanceRecurrente) =>
      coveredOccurrenceDates != null
        ? getNextUncoveredOccurrenceInfo(e, coveredOccurrenceDates, new Date())
        : getNextOccurrenceInfo(e),
    [coveredOccurrenceDates]
  );
  const { organizationId } = useCurrentOrganization();
  const { natures, categories, getDefaultCategoryId } = useEcheanceReferential(dataMode);
  
  // ✅ CORRECTION: État local pour l'échéance (mis à jour via événements)
  const [echeance, setEcheance] = useState<EcheanceRecurrente | null>(initialEcheance);
  
  // Mettre à jour l'état local quand la prop change
  useEffect(() => {
    setEcheance(initialEcheance);
  }, [initialEcheance]);
  
  // ✅ CORRECTION: Écouter les événements de refresh pour mettre à jour l'échéance dans le drawer
  useEffect(() => {
    if (!isOpen || !echeance || !organizationId) return;
    
    const handleRefresh = async (event: Event) => {
      if (!(event instanceof CustomEvent && event.detail)) return;
      
      const detail = event.detail as { scope?: string; propertyId?: string; reason?: string };
      
      // Filtrer par scope et propertyId si présent
      if (detail.scope === 'property' && propertyId && detail.propertyId !== propertyId) {
        return;
      }
      
      // Recharger l'échéance depuis IndexedDB avec ses relations
      try {
        const echeanceRepo = getEcheanceRepositoryOffline();
        const updated = await echeanceRepo.getById(echeance.id, organizationId);
        
        if (updated) {
          // ✅ Récupérer les relations Property et Lease avec leurs noms
          let property = null;
          let lease = null;
          
          if (updated.propertyId) {
            const propertyRepo = getPropertyRepositoryOffline();
            const propertyData = await propertyRepo.getById(updated.propertyId, organizationId);
            if (propertyData) {
              property = { id: propertyData.id, name: propertyData.name };
            }
          }
          
          if (updated.leaseId) {
            const leaseRepo = getLeaseRepositoryOffline();
            const leaseData = await leaseRepo.getById(updated.leaseId, organizationId);
            if (leaseData) {
              // Récupérer le nom du locataire
              let tenantName = '';
              if (leaseData.tenantId) {
                const tenantRepo = getTenantRepositoryOffline();
                const tenantData = await tenantRepo.getById(leaseData.tenantId, organizationId);
                if (tenantData) {
                  tenantName = tenantData.name || '';
                }
              }
              lease = {
                id: leaseData.id,
                type: leaseData.type || '',
                status: leaseData.status || '',
                tenantName,
              };
            }
          }
          
          setEcheance({
            id: updated.id,
            propertyId: updated.propertyId || null,
            leaseId: updated.leaseId || null,
            label: updated.label,
            type: updated.type,
            natureCode: (updated as any).natureCode ?? undefined,
            defaultCategoryId: (updated as any).defaultCategoryId ?? undefined,
            periodicite: updated.periodicite,
            montant: Number(updated.montant),
            recuperable: updated.recuperable,
            sens: updated.sens,
            startAt: new Date(updated.startAt),
            endAt: updated.endAt ? new Date(updated.endAt) : null,
            isActive: updated.isActive,
            createdAt: updated.createdAt ? new Date(updated.createdAt) : undefined,
            updatedAt: updated.updatedAt ? new Date(updated.updatedAt) : undefined,
            Property: property,
            Lease: lease,
          });
        }
      } catch (error) {
        console.error('Erreur lors du rechargement de l\'échéance:', error);
      }
    };
    
    window.addEventListener('deadlines:refresh', handleRefresh);
    window.addEventListener('echeances:refresh', handleRefresh);
    
    return () => {
      window.removeEventListener('deadlines:refresh', handleRefresh);
      window.removeEventListener('echeances:refresh', handleRefresh);
    };
  }, [isOpen, echeance?.id, organizationId, propertyId]);

  const [linkedRows, setLinkedRows] = useState<
    Array<{
      linkId: string;
      transactionId: string;
      date: string;
      amount: number;
      label: string;
      nature?: string | null;
    }>
  >([]);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkCandidates, setLinkCandidates] = useState<
    Array<{ id: string; date: string; amount: number; label: string }>
  >([]);
  const [linking, setLinking] = useState(false);
  const [suggestions, setSuggestions] = useState<ScoredSuggestion<TransactionForScoring>[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [ignoredSuggestionIds, setIgnoredSuggestionIds] = useState<Set<string>>(new Set());

  const reloadLinkedTransactions = React.useCallback(async () => {
    if (!organizationId || !echeance?.id) return;
    setLoadingLinked(true);
    try {
      const map = await getLinksByEcheanceIds([echeance.id]);
      const links = map.get(echeance.id) || [];
      const txRepo = getTransactionRepositoryOffline();
      const rows: Array<{
        linkId: string;
        transactionId: string;
        date: string;
        amount: number;
        label: string;
        nature?: string | null;
      }> = [];
      for (const l of links) {
        const t = await txRepo.getById(l.transactionId, organizationId);
        if (t) {
          rows.push({
            linkId: l.id,
            transactionId: l.transactionId,
            date: typeof t.date === 'string' ? t.date : (t.date as Date).toISOString().slice(0, 10),
            amount: Number(t.amount),
            label: t.label || '—',
            nature: t.nature ?? null,
          });
        }
      }
      setLinkedRows(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLinked(false);
    }
  }, [organizationId, echeance?.id]);

  React.useEffect(() => {
    if (!isOpen || !echeance || !organizationId) return;
    reloadLinkedTransactions();
  }, [isOpen, echeance?.id, organizationId, reloadLinkedTransactions]);

  React.useEffect(() => {
    const onLinksRefresh = (ev: Event) => {
      const d = (ev as CustomEvent).detail as { propertyId?: string } | undefined;
      if (d?.propertyId && propertyId && d.propertyId !== propertyId) return;
      reloadLinkedTransactions();
    };
    window.addEventListener('echeanceLinks:refresh', onLinksRefresh);
    return () => window.removeEventListener('echeanceLinks:refresh', onLinksRefresh);
  }, [propertyId, reloadLinkedTransactions]);

  const coverageInDrawer = React.useMemo((): CoverageResult | undefined => {
    if (!echeance || linkedRows.length === 0) return undefined;
    const inputs = linkedRows.map((r) => transactionToCoverageInput(r.amount, r.nature));
    return computeCoverage(
      echeance.montant,
      echeance.sens as 'CREDIT' | 'DEBIT',
      inputs,
      undefined,
      echeance.type
    );
  }, [echeance, linkedRows]);

  React.useEffect(() => {
    if (!isOpen || !echeance || !propertyId || !organizationId) return;
    setLoadingSuggestions(true);
    (async () => {
      try {
        const txRepo = getTransactionRepositoryOffline();
        const txs = await txRepo.getAll(organizationId, { propertyId });
        const linkedToThis = new Set(linkedRows.map((r) => r.transactionId));
        const candidates: TransactionForScoring[] = txs
          .filter((t) => !linkedToThis.has(t.id))
          .map((t) => ({
            id: t.id,
            propertyId: t.propertyId,
            leaseId: t.leaseId ?? null,
            amount: Number(t.amount),
            date: typeof t.date === 'string' ? t.date : (t.date as Date).toISOString().slice(0, 10),
            label: t.label || '—',
            nature: t.nature ?? null,
          }));
        const nextOcc = pilotageInfo(echeance);
        const echForScoring = {
          id: echeance.id,
          propertyId: echeance.propertyId ?? null,
          leaseId: echeance.leaseId ?? null,
          montant: echeance.montant,
          sens: echeance.sens,
          label: echeance.label,
          type: echeance.type,
          nextOccurrenceDate: nextOcc?.displayDate ?? nextOcc?.nextDate ?? null,
        };
        const scored = suggestTransactionsForEcheance(echForScoring, candidates, { includeFaible: false });
        setSuggestions(scored);
      } catch (e) {
        console.error(e);
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    })();
  }, [
    isOpen,
    echeance?.id,
    echeance?.propertyId,
    echeance?.leaseId,
    echeance?.montant,
    echeance?.sens,
    echeance?.label,
    echeance?.type,
    propertyId,
    organizationId,
    linkedRows.length,
    pilotageInfo,
  ]);

  const openLinkPicker = async () => {
    if (!organizationId || !propertyId || !echeance) return;
    setLinkPickerOpen(true);
    setLinkSearch('');
    try {
      const db = await getLocalDB();
      const allLinks = db ? await db.EcheanceTransactionLink.where('organizationId').equals(organizationId).toArray() : [];
      const linkedTxIds = new Set(allLinks.map((x) => x.transactionId));
      const txRepo = getTransactionRepositoryOffline();
      const txs = await txRepo.getAll(organizationId, { propertyId });
      const candidates = txs
        .filter((t) => !linkedTxIds.has(t.id))
        .map((t) => ({
          id: t.id,
          date: typeof t.date === 'string' ? t.date : (t.date as Date).toISOString().slice(0, 10),
          amount: Number(t.amount),
          label: t.label || '—',
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
      setLinkCandidates(candidates);
    } catch (e) {
      console.error(e);
      notify2.error('Impossible de charger les transactions');
    }
  };

  const handleLinkTransaction = async (transactionId: string) => {
    if (!organizationId || !echeance) return;
    const existing = await getLinkByTransactionId(transactionId);
    if (existing && existing.echeanceId !== echeance.id) {
      const ok = window.confirm(
        'Cette transaction est déjà liée à une autre échéance. Voulez-vous la lier à cette échéance à la place ?'
      );
      if (!ok) return;
      await removeEcheanceTransactionLink(existing.id);
    }
    const nextInfo = pilotageInfo(echeance);
    const occ = nextInfo?.displayDate || nextInfo?.nextDate || null;
    setLinking(true);
    try {
      await addEcheanceTransactionLink({
        organizationId,
        echeanceId: echeance.id,
        transactionId,
        occurrenceDate: occ,
      });
      notify2.success('Transaction liée');
      setLinkPickerOpen(false);
      await reloadLinkedTransactions();
      if (propertyId) {
        window.dispatchEvent(new CustomEvent('echeanceLinks:refresh', { detail: { propertyId } }));
      }
    } catch (err: any) {
      notify2.error(err?.message || 'Liaison impossible');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (linkId: string) => {
    try {
      await removeEcheanceTransactionLink(linkId);
      notify2.success('Lien supprimé');
      await reloadLinkedTransactions();
      if (propertyId) {
        window.dispatchEvent(new CustomEvent('echeanceLinks:refresh', { detail: { propertyId } }));
      }
    } catch (err: any) {
      notify2.error(err?.message || 'Erreur');
    }
  };
  
  if (!isOpen || !echeance) return null;

  const nextInfo = pilotageInfo(echeance);
  const urg = nextInfo ? temporalBadgeMeta(nextInfo.temporalStatus) : temporalBadgeMeta('desactive');
  const chargeAnnuelleEstimee =
    echeance.sens === 'DEBIT' ? toAnnualAmount(echeance.montant, echeance.periodicite) : null;

  const messagesMetier: string[] = [];
  if (echeance.sens === 'DEBIT') {
    messagesMetier.push('Cette échéance impacte les charges du bien sur la période.');
  }
  if (echeance.recuperable && echeance.sens === 'DEBIT') {
    messagesMetier.push('Charge récupérable, refacturable au locataire selon le bail.');
  }
  if (!echeance.endAt) {
    messagesMetier.push('Aucune date de fin : récurrence jusqu’à modification ou désactivation.');
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatDateShort = (date: Date | string | null) => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getAmountColor = () => {
    return echeance.sens === 'DEBIT' ? 'text-red-600' : 'text-green-600';
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer - Mobile: plein écran, Desktop: side panel */}
      <div className="fixed right-0 top-0 h-screen w-full lg:w-auto lg:max-w-2xl bg-white shadow-xl transform transition-transform">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="min-w-0 flex-1 pr-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Échéance</p>
              <h2 className="text-lg font-semibold text-gray-900 truncate mt-0.5">{echeance.label}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`text-2xl font-bold tabular-nums ${getAmountColor()}`}>
                  {echeance.sens === 'DEBIT' ? '' : '+'}{formatCurrency(echeance.montant)}
                </span>
                <span className="text-xs text-gray-500">par occurrence</span>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 p-1">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content : 3 blocs métier + suggestions repliables */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Configuration</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge className={getNatureBadgeClass(resolveNatureCodeForEcheance(echeance))}>
                    {getNatureLabelForEcheance(echeance, natures)}
                  </Badge>
                  <span className="text-xs text-gray-600 self-center" title="Catégorie">
                    {getCategoryLabelForEcheance(echeance, categories, resolveNatureCodeForEcheance, getDefaultCategoryId)}
                  </span>
                  <span
                    className={
                      echeance.sens === 'DEBIT'
                        ? 'text-xs rounded-md px-2 py-0.5 bg-red-50 text-red-800 border border-red-100 self-center'
                        : 'text-xs rounded-md px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 self-center'
                    }
                  >
                    {echeance.sens === 'DEBIT' ? 'Charge' : 'Revenu'}
                  </span>
                  <Badge variant={echeance.isActive ? 'success' : 'secondary'}>
                    {echeance.isActive ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" /> Active
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" /> Inactive
                      </>
                    )}
                  </Badge>
                </div>
                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Impact prévisionnel</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {chargeAnnuelleEstimee != null && (
                    <div>
                      <p className="text-gray-500 text-xs">Charge annuelle estimée</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(chargeAnnuelleEstimee)}</p>
                    </div>
                  )}
                  {echeance.sens === 'CREDIT' && (
                    <div>
                      <p className="text-gray-500 text-xs">Revenu annuel estimé</p>
                      <p className="font-semibold text-emerald-700">{formatCurrency(toAnnualAmount(echeance.montant, echeance.periodicite))}</p>
                    </div>
                  )}
                </div>
                {messagesMetier.length > 0 && (
                  <ul className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-600">
                    {messagesMetier.map((msg, i) => (
                      <li key={i} className="flex gap-2">
                        <Info className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                        {msg}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Périodicité</span>
                    </div>
                    <p className="font-medium text-sm">{PERIODICITE_LABELS[echeance.periodicite]}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Charge récupérable</span>
                    </div>
                    <p className="font-medium text-sm">{echeance.recuperable ? 'Oui' : 'Non'}</p>
                  </div>
                  {echeance.Property && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Bien</span>
                      </div>
                      <Link
                        href={`/app?view=property&propertyId=${echeance.Property.id}&tab=transactions`}
                        className="font-medium text-sm text-primary-600 hover:underline"
                      >
                        {echeance.Property.name}
                      </Link>
                    </div>
                  )}
                  {echeance.Lease && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Bail</span>
                      </div>
                      <p className="font-medium text-sm">
                        {echeance.Lease.type} - {echeance.Lease.status}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Période
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Date de début</p>
                      <p className="font-medium">{formatDate(echeance.startAt)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Date de fin</p>
                      <p className="font-medium">
                        {echeance.endAt ? formatDate(echeance.endAt) : 'Aucune (récurrence infinie)'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 bg-gray-50/80 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="isActive-drawer"
                      checked={echeance.isActive}
                      onCheckedChange={async (checked) => {
                        if (!organizationId) {
                          notify2.error('OrganizationId manquant');
                          return;
                        }

                        try {
                          setEcheance((prev) => (prev ? { ...prev, isActive: checked } : null));

                          const echeanceService = await createEcheanceServiceWithMode('app-shell');

                          await echeanceService.updateEcheance(echeance.id, organizationId, {
                            isActive: checked,
                          });

                          if (propertyId) {
                            window.dispatchEvent(
                              new CustomEvent('deadlines:refresh', {
                                detail: { scope: 'property', propertyId, reason: 'update' },
                              })
                            );
                          } else {
                            window.dispatchEvent(new CustomEvent('echeances:refresh'));
                          }

                          notify2.success(checked ? 'Échéance activée' : 'Échéance désactivée');
                        } catch (error: any) {
                          console.error("Erreur lors de la mise à jour de l'échéance:", error);
                          setEcheance((prev) => (prev ? { ...prev, isActive: !checked } : null));
                          notify2.error('Erreur', error.message || 'Erreur lors de la mise à jour');
                        }
                      }}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">Règle active</span>
                      <p className="text-xs text-gray-600">Enregistrement automatique.</p>
                    </div>
                  </div>
                </div>
                <details className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-gray-700">Informations système</summary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs text-gray-600">
                    {echeance.createdAt && (
                      <div>
                        <p className="text-gray-500">Créée le</p>
                        <p className="font-medium text-gray-900">{formatDateShort(echeance.createdAt)}</p>
                      </div>
                    )}
                    {echeance.updatedAt && (
                      <div>
                        <p className="text-gray-500">Modifiée le</p>
                        <p className="font-medium text-gray-900">{formatDateShort(echeance.updatedAt)}</p>
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <p className="text-gray-500">ID</p>
                      <p className="font-mono text-[11px] text-gray-500 break-all">{echeance.id}</p>
                    </div>
                  </div>
                </details>
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Prochaine occurrence</h3>
                {nextInfo && nextInfo.temporalStatus !== 'desactive' ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border',
                          urg.className
                        )}
                      >
                        <span>{urg.emoji}</span> {nextInfo.message}
                      </span>
                    </div>
                    {nextInfo.displayDate && (
                      <p className="text-sm text-gray-700">
                        Date cible :{' '}
                        <strong className="text-gray-900">
                          {formatDateShort(new Date(nextInfo.displayDate + 'T12:00:00'))}
                        </strong>
                      </p>
                    )}
                    {echeance && (linkedRows.length > 0 || pilotageInfo(echeance)?.nextDate) && (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Frise</p>
                        {(() => {
                          const pi = pilotageInfo(echeance);
                          const nextOcc = pi?.nextDate ?? pi?.displayDate;
                          const entries: { date: string; label: string; type: 'echeance' | 'transaction' }[] = [];
                          if (nextOcc) entries.push({ date: nextOcc, label: 'Échéance prévue', type: 'echeance' });
                          linkedRows.forEach((r) =>
                            entries.push({
                              date: r.date.slice(0, 10),
                              label: `Transaction : ${r.label || '—'}`,
                              type: 'transaction',
                            })
                          );
                          entries.sort((a, b) => a.date.localeCompare(b.date));
                          return (
                            <ul className="space-y-1 text-xs text-gray-600">
                              {entries.map((ent, i) => (
                                <li key={i} className="flex gap-2">
                                  <span className="tabular-nums text-gray-500 shrink-0">
                                    {formatDateShort(ent.date)}
                                  </span>
                                  <span className={ent.type === 'echeance' ? 'text-primary-600' : ''}>
                                    → {ent.label}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Aucune occurrence pilotée (règle inactive).</p>
                )}
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transactions liées</h3>
                  {(() => {
                    const gen = getStatutGeneration(linkedRows.length, coverageInDrawer);
                    const overRatio =
                      coverageInDrawer?.statut === 'montant_superieur' &&
                      coverageInDrawer.expectedAmount != null &&
                      coverageInDrawer.expectedAmount > 0
                        ? coverageInDrawer.totalLinked / coverageInDrawer.expectedAmount
                        : undefined;
                    const gm = generationBadgeMeta(gen, {
                      overRatio,
                      overRatioCritical: 2,
                    });
                    return (
                      <span className={cn('text-[11px] font-medium rounded-md px-2 py-0.5 border', gm.className)}>
                        {gm.label}
                      </span>
                    );
                  })()}
                </div>
                {loadingLinked ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                  </div>
                ) : linkedRows.length === 0 ? (
                  <p className="text-sm text-gray-600 mb-3">Aucune transaction liée à cette règle.</p>
                ) : (
                  <ul className="space-y-2 mb-3">
                    {linkedRows.map((row) => (
                      <li
                        key={row.linkId}
                        className="flex items-start justify-between gap-2 text-sm border border-gray-100 rounded-lg p-2 bg-gray-50/50"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{row.label}</p>
                          <p className="text-xs text-gray-600 tabular-nums">
                            {formatDateShort(row.date)} · {formatCurrency(row.amount)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnlink(row.linkId)}
                          className="shrink-0 p-1.5 text-gray-500 hover:text-red-600 rounded-md hover:bg-red-50"
                          title="Retirer le lien"
                          aria-label="Retirer le lien"
                        >
                          <Unlink className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  {onCreateTransaction && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => onCreateTransaction(echeance)}
                    >
                      <PlusCircle className="h-4 w-4" />
                      Créer transaction
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" className="gap-1" onClick={openLinkPicker}>
                    <Link2 className="h-4 w-4" />
                    Lier transaction existante
                  </Button>
                </div>
              </section>

              <details className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 text-sm open:bg-white transition-colors">
                <summary className="cursor-pointer font-medium text-gray-800 list-none flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Suggestions automatiques
                  </span>
                  <span className="text-xs font-normal text-gray-500">(optionnel)</span>
                </summary>
                <p className="text-xs text-gray-600 mt-2 mb-3">
                  Propositions basées sur l’historique du bien — à utiliser si vous n’avez pas déjà saisi la transaction.
                </p>
                {loadingSuggestions ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                  </div>
                ) : (
                  (() => {
                    const filtered = suggestions.filter(
                      (s) => s.level !== 'FAIBLE' && !ignoredSuggestionIds.has(s.item.id)
                    );
                    if (filtered.length === 0) {
                      return <p className="text-sm text-gray-600">Aucune suggestion pour le moment.</p>;
                    }
                    const { visible, hasMore } = getVisibleSuggestions(filtered);
                    const toShow = showAllSuggestions ? filtered : visible;
                    return (
                      <>
                        <ul className="space-y-2">
                          {toShow.map((s) => (
                            <SuggestionRow
                              key={s.item.id}
                              suggestion={s}
                              echeanceId={echeance.id}
                              onLink={handleLinkTransaction}
                              onIgnore={() =>
                                setIgnoredSuggestionIds((prev) => new Set(prev).add(s.item.id))
                              }
                              formatCurrency={formatCurrency}
                              formatDateShort={formatDateShort}
                              linking={linking}
                              checkLinkedElsewhere={getLinkByTransactionId}
                            />
                          ))}
                        </ul>
                        {hasMore && !showAllSuggestions && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-primary-600"
                            onClick={() => setShowAllSuggestions(true)}
                          >
                            Voir plus
                          </Button>
                        )}
                      </>
                    );
                  })()
                )}
              </details>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50/30">
            <Button
              variant="ghost"
              onClick={() => onDelete(echeance)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 sm:mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
            <Button variant="outline" onClick={() => onDuplicate(echeance)}>
              <Copy className="h-4 w-4 mr-2" />
              Dupliquer
            </Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => onEdit(echeance)}>
              <Edit className="h-4 w-4 mr-2" />
              Éditer
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={linkPickerOpen} onOpenChange={setLinkPickerOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Lier une transaction existante</DialogTitle>
            <p className="text-sm text-gray-600 font-normal">
              Transactions du bien non encore liées à une échéance.
            </p>
          </DialogHeader>
          <Input
            placeholder="Rechercher (libellé, montant…)"
            value={linkSearch}
            onChange={(e) => setLinkSearch(e.target.value)}
            className="mb-2"
          />
          <div className="overflow-y-auto flex-1 min-h-[200px] space-y-1 pr-1">
            {linking && (
              <div className="flex justify-center py-8 text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {!linking &&
              linkCandidates
                .filter((c) => {
                  if (!linkSearch.trim()) return true;
                  const q = linkSearch.toLowerCase();
                  return (
                    c.label.toLowerCase().includes(q) ||
                    String(c.amount).includes(q) ||
                    c.date.includes(q)
                  );
                })
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={linking}
                    onClick={() => handleLinkTransaction(c.id)}
                    className="w-full text-left rounded-lg border border-gray-200 p-3 hover:bg-orange-50/50 hover:border-orange-200 transition-colors"
                  >
                    <p className="font-medium text-gray-900 truncate">{c.label}</p>
                    <p className="text-xs text-gray-600 tabular-nums mt-0.5">
                      {formatDateShort(c.date)} · {formatCurrency(c.amount)}
                    </p>
                  </button>
                ))}
            {!linking && linkCandidates.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">Aucune transaction disponible à lier.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

