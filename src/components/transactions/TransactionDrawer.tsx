'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Edit,
  Trash2,
  FileText,
  Plus,
  Calendar,
  Euro,
  Building2,
  Users,
  Tag,
  Info,
  AlertCircle,
  Link2,
  Loader2,
  Unlink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { useToggleRapprochement, type RapprochementStatus } from '@/hooks/useToggleRapprochement';
import { notify2 } from '@/lib/notify2';
import { useTransactionDocuments } from '@/hooks/offline/useTransactionDocuments';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getEcheanceRepositoryOffline } from '@/lib/offline/repositories/EcheanceRepositoryOffline';
import {
  getLinkByTransactionId,
  addEcheanceTransactionLink,
  removeEcheanceTransactionLink,
} from '@/lib/echeances/echeanceTransactionLinkClient';
import { getNextOccurrenceInfo } from '@/lib/echeances/echeanceCashflowHelpers';
import {
  suggestEcheancesForTransaction,
  getVisibleSuggestions,
  type EcheanceForScoring,
  type ScoredSuggestion,
} from '@/lib/echeances/echeanceSuggestionScoring';
import { SUGGESTION_LEVEL_LABELS, type EcheanceRecurrente } from '@/types/echeance';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Drawer } from '@/components/ui/Drawer';

interface Transaction {
  id: string;
  date: string;
  label: string;
  Property: {
    id: string;
    name: string;
    address: string;
  };
  lease?: {
    id: string;
    status: string;
  };
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  Tenant?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  nature: {
    id: string;
    label: string;
    type: 'RECETTE' | 'DEPENSE';
  };
  Category: {
    id: string;
    label: string;
  };
  amount: number;
  reference?: string;
  paymentDate?: string;
  paymentMethod?: string;
  paidAt?: string;
  method?: string;
  notes?: string;
  accountingMonth?: string;
  monthsCovered?: number;
  autoDistribution?: boolean;
  hasDocument: boolean;
  status: 'rapprochee' | 'nonRapprochee';
  rapprochementStatus?: string;
  dateRapprochement?: string | null;
  bankRef?: string | null;
  createdAt?: string;
  updatedAt?: string;
  documents?: Array<{
    id: string;
    name: string;
    type: string;
    createdAt: string;
  }>;
  // Champs de série
  parentTransactionId?: string;
  moisIndex?: number;
  moisTotal?: number;
  // Gestion déléguée
  isAuto?: boolean;
  autoSource?: string | null;
}

interface TransactionDrawerProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onViewDocument?: (documentId: string, documentName: string) => void;
  onRefresh?: () => void;
  mode?: 'normal' | 'app-shell'; // Mode pour le rapprochement offline-first
  /** Ouvrir avec scroll vers la section Documents liés (clic 📎 dans la table) */
  initialScrollToDocuments?: boolean;
  onScrollToDocumentsDone?: () => void;
  /** Ouvrir avec scroll vers le bloc rapprochement (ex. liste « Actions à traiter ») */
  initialScrollToRapprochement?: boolean;
  onScrollToRapprochementDone?: () => void;
}

const PAYMENT_METHODS = {
  virement: 'Virement',
  cheque: 'Chèque',
  especes: 'Espèces',
  carte: 'Carte bancaire',
  prelevement: 'Prélèvement'
};

export default function TransactionDrawer({
  transaction,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onViewDocument,
  onRefresh,
  mode = 'normal',
  initialScrollToDocuments = false,
  onScrollToDocumentsDone,
  initialScrollToRapprochement = false,
  onScrollToRapprochementDone,
}: TransactionDrawerProps) {
  const pathname = usePathname();
  const { mutate: toggleRapprochement, isPending: isTogglingRapprochement } = useToggleRapprochement(mode);
  const { organizationId } = useCurrentOrganization();
  const [localRapprochementStatus, setLocalRapprochementStatus] = useState<RapprochementStatus>(
    transaction?.rapprochementStatus === 'rapprochee' ? 'rapprochee' : 'non_rapprochee'
  );
  
  // Scroll vers la section Documents quand ouvert via clic 📎
  React.useEffect(() => {
    if (!isOpen || !initialScrollToDocuments || !transaction) return;
    const timer = setTimeout(() => {
      const el = document.getElementById('transaction-drawer-documents');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        onScrollToDocumentsDone?.();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, initialScrollToDocuments, transaction?.id, onScrollToDocumentsDone]);

  React.useEffect(() => {
    if (!isOpen || !initialScrollToRapprochement || !transaction) return;
    const timer = setTimeout(() => {
      const el = document.getElementById('transaction-drawer-rapprochement');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        onScrollToRapprochementDone?.();
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [isOpen, initialScrollToRapprochement, transaction?.id, onScrollToRapprochementDone]);

  // En mode app-shell, utiliser le hook pour charger les documents depuis IndexedDB
  const { 
    documents: linkedDocuments, 
    loading: documentsLoading,
    hasMissingDocuments 
  } = useTransactionDocuments(
    mode === 'app-shell' ? transaction?.id : null,
    mode === 'app-shell' && isOpen
  );
  
  // Utiliser les documents du hook en app-shell, sinon ceux de la transaction
  const displayDocuments = mode === 'app-shell' 
    ? linkedDocuments.map(doc => ({
        id: doc.id,
        name: doc.filenameOriginal,
        type: doc.documentTypeLabel || 'Non classé',
        createdAt: doc.uploadedAt,
      }))
    : (transaction?.Document || []);

  // ✅ OFFLINE-FIRST: Recharger la transaction depuis IndexedDB quand le drawer s'ouvre en mode app-shell
  React.useEffect(() => {
    if (!isOpen || !transaction) return;
    
    const syncStatus = async () => {
      // ✅ En mode app-shell, recharger depuis IndexedDB pour avoir le statut le plus récent
      if (mode === 'app-shell' && organizationId) {
        try {
          const repo = getTransactionRepositoryOffline();
          const localTransaction = await repo.getById(transaction.id, organizationId);
          
          if (localTransaction) {
            const status = localTransaction.rapprochementStatus || localTransaction.status;
            const newStatus: RapprochementStatus = status === 'rapprochee' ? 'rapprochee' : 'non_rapprochee';
            setLocalRapprochementStatus(newStatus);
            return;
          }
        } catch (error) {
          console.warn('[TransactionDrawer] Erreur lors du rechargement depuis IndexedDB:', error);
          // Fallback : utiliser le prop transaction
        }
      }
      
      // Mode normal ou fallback : utiliser le prop transaction directement
      const status = transaction.rapprochementStatus || transaction.status;
      const newStatus: RapprochementStatus = status === 'rapprochee' ? 'rapprochee' : 'non_rapprochee';
      setLocalRapprochementStatus(newStatus);
    };
    
    syncStatus();
  }, [isOpen, transaction?.id, mode, organizationId]);

  const [echeanceLinked, setEcheanceLinked] = useState<{
    linkId: string;
    echeanceId: string;
    label: string;
  } | null>(null);
  const [loadingEcheanceLink, setLoadingEcheanceLink] = useState(false);
  const [pickEcheanceOpen, setPickEcheanceOpen] = useState(false);
  const [echeanceCandidates, setEcheanceCandidates] = useState<{ id: string; label: string }[]>([]);
  const [linkingEcheance, setLinkingEcheance] = useState(false);
  const [suggestedEcheances, setSuggestedEcheances] = useState<ScoredSuggestion<EcheanceForScoring>[]>([]);
  const [showAllSuggestedEcheances, setShowAllSuggestedEcheances] = useState(false);
  const [loadingSuggestedEcheances, setLoadingSuggestedEcheances] = useState(false);

  React.useEffect(() => {
    if (!isOpen || !transaction) {
      setEcheanceLinked(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingEcheanceLink(true);
      try {
        if (mode === 'app-shell' && organizationId) {
          const link = await getLinkByTransactionId(transaction.id);
          if (cancelled) return;
          if (!link) {
            setEcheanceLinked(null);
            return;
          }
          const ech = await getEcheanceRepositoryOffline().getById(link.echeanceId, organizationId);
          if (cancelled) return;
          setEcheanceLinked(
            ech ? { linkId: link.id, echeanceId: ech.id, label: ech.label } : null
          );
        } else {
          const res = await fetch(
            `/api/echeance-transaction-links?transactionId=${encodeURIComponent(transaction.id)}`,
            { credentials: 'include' }
          );
          const j = await res.json();
          if (cancelled) return;
          const item = j.item;
          if (item?.Echeance) {
            setEcheanceLinked({
              linkId: item.id,
              echeanceId: item.Echeance.id,
              label: item.Echeance.label,
            });
          } else {
            setEcheanceLinked(null);
          }
        }
      } catch {
        if (!cancelled) setEcheanceLinked(null);
      } finally {
        if (!cancelled) setLoadingEcheanceLink(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, transaction?.id, mode, organizationId]);

  React.useEffect(() => {
    if (!isOpen || !transaction?.Property?.id || !organizationId || echeanceLinked) return;
    setLoadingSuggestedEcheances(true);
    (async () => {
      try {
        const pid = transaction.Property.id;
        const echRepo = getEcheanceRepositoryOffline();
        const all = await echRepo.getAll(organizationId, { propertyId: pid });
        const echForScoring: EcheanceForScoring[] = all.map((e) => {
          const next = getNextOccurrenceInfo(e as unknown as EcheanceRecurrente);
          return {
            id: e.id,
            propertyId: e.propertyId ?? null,
            leaseId: e.leaseId ?? null,
            montant: e.montant,
            sens: e.sens,
            label: e.label,
            type: e.type,
            nextOccurrenceDate: next?.displayDate ?? next?.nextDate ?? null,
          };
        });
        const txForScoring = {
          id: transaction.id,
          propertyId: transaction.Property.id,
          leaseId: transaction.lease?.id ?? transaction.Lease?.id ?? null,
          amount: transaction.amount,
          date: transaction.date || transaction.paymentDate || transaction.paidAt || '',
          label: transaction.label || '—',
          nature: transaction.nature?.type === 'RECETTE' ? 'RECETTE_LOYER' : 'DEPENSE_ENTRETIEN',
        };
        const scored = suggestEcheancesForTransaction(txForScoring, echForScoring, { includeFaible: false });
        setSuggestedEcheances(scored);
      } catch (e) {
        console.error(e);
        setSuggestedEcheances([]);
      } finally {
        setLoadingSuggestedEcheances(false);
      }
    })();
  }, [isOpen, transaction?.id, transaction?.Property?.id, transaction?.amount, transaction?.date, transaction?.label, transaction?.lease?.id, transaction?.nature?.type, organizationId, echeanceLinked]);

  const openPickEcheance = async () => {
    if (!transaction?.Property?.id || !organizationId) return;
    const pid = transaction.Property.id;
    setPickEcheanceOpen(true);
    try {
      if (mode === 'app-shell') {
        const all = await getEcheanceRepositoryOffline().getAll(organizationId, { propertyId: pid });
        setEcheanceCandidates(
          all.filter((e) => e.isActive).map((e) => ({ id: e.id, label: e.label }))
        );
      } else {
        const res = await fetch(
          `/api/echeances/list?propertyId=${encodeURIComponent(pid)}&pageSize=100&active=1`,
          { credentials: 'include' }
        );
        const j = await res.json();
        const rows = j.items || j.data || [];
        setEcheanceCandidates(
          (Array.isArray(rows) ? rows : []).map((r: { id: string; label: string }) => ({
            id: r.id,
            label: r.label,
          }))
        );
      }
    } catch {
      notify2.error('Impossible de charger les échéances');
      setEcheanceCandidates([]);
    }
  };

  const handleLinkToEcheance = async (echeanceId: string) => {
    if (!organizationId || !transaction) return;
    const existing = await getLinkByTransactionId(transaction.id);
    if (existing && existing.echeanceId !== echeanceId) {
      const ok = window.confirm(
        'Cette transaction est déjà liée à une autre échéance. Voulez-vous la lier à cette échéance à la place ?'
      );
      if (!ok) return;
      if (mode === 'app-shell') {
        await removeEcheanceTransactionLink(existing.id);
      } else {
        await fetch(`/api/echeance-transaction-links/${encodeURIComponent(existing.id)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      }
    }
    setLinkingEcheance(true);
    try {
      if (mode === 'app-shell') {
        await addEcheanceTransactionLink({
          organizationId,
          echeanceId,
          transactionId: transaction.id,
          occurrenceDate: null,
        });
      } else {
        const res = await fetch('/api/echeance-transaction-links', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            echeanceId,
            transactionId: transaction.id,
            matchType: 'manual',
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Liaison impossible');
        }
        const j = await res.json();
        const item = j.item;
        const label =
          echeanceCandidates.find((c) => c.id === echeanceId)?.label || 'Échéance';
        if (item?.id) {
          setEcheanceLinked({ linkId: item.id, echeanceId, label });
        }
      }
      const label =
        echeanceCandidates.find((c) => c.id === echeanceId)?.label || 'Échéance';
      if (mode === 'app-shell') {
        const dbLink = await getLinkByTransactionId(transaction.id);
        if (dbLink) {
          setEcheanceLinked({
            linkId: dbLink.id,
            echeanceId,
            label,
          });
        }
      }
      notify2.success('Échéance liée');
      setPickEcheanceOpen(false);
      window.dispatchEvent(
        new CustomEvent('echeanceLinks:refresh', {
          detail: { propertyId: transaction.Property?.id },
        })
      );
    } catch (e: any) {
      notify2.error(e?.message || 'Erreur');
    } finally {
      setLinkingEcheance(false);
    }
  };

  const handleUnlinkEcheance = async () => {
    if (!echeanceLinked) return;
    try {
      if (mode === 'app-shell') {
        await removeEcheanceTransactionLink(echeanceLinked.linkId);
      } else {
        await fetch(
          `/api/echeance-transaction-links/${encodeURIComponent(echeanceLinked.linkId)}`,
          { method: 'DELETE', credentials: 'include' }
        );
      }
      setEcheanceLinked(null);
      notify2.success('Lien retiré');
      window.dispatchEvent(
        new CustomEvent('echeanceLinks:refresh', {
          detail: { propertyId: transaction?.Property?.id },
        })
      );
    } catch (e: any) {
      notify2.error(e?.message || 'Erreur');
    }
  };

  if (!isOpen || !transaction) return null;

  const echeancesHref =
    pathname?.startsWith('/app')
      ? `/app?view=property&propertyId=${transaction.Property.id}&tab=deadlines`
      : `/biens/${transaction.Property.id}/echeances`;

  const handleToggleRapprochement = (checked: boolean) => {
    const newStatus: RapprochementStatus = checked ? 'rapprochee' : 'non_rapprochee';
    setLocalRapprochementStatus(newStatus);
    
    toggleRapprochement({
      id: transaction.id,
      status: newStatus
    }, {
      onSuccess: () => {
        // Le toast est déjà géré dans useToggleRapprochement
        // ⚠️ APP-SHELL : Pas de refresh en mode app-shell - les données sont déjà dans IndexedDB
        // L'état local est déjà à jour via setLocalRapprochementStatus
        // La liste se mettra à jour naturellement au prochain render (fermeture drawer, etc.)
        if (mode !== 'app-shell' && onRefresh) {
          onRefresh();
        }
      },
      onError: (error) => {
        // Le toast est déjà géré dans useToggleRapprochement
        // Revenir à l'état précédent en cas d'erreur
        setLocalRapprochementStatus(checked ? 'non_rapprochee' : 'rapprochee');
      }
    });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatAmount = (amount: number, type: 'RECETTE' | 'DEPENSE'): string => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(Math.abs(amount));
    
    return type === 'DEPENSE' ? `-${formatted}` : formatted;
  };

  const getAmountColor = (type: 'RECETTE' | 'DEPENSE'): string => {
    return type === 'RECETTE' ? 'text-green-600' : 'text-red-600';
  };

  const formatAccountingMonth = (yyyymm: string): string => {
    if (!yyyymm || !yyyymm.includes('-')) return yyyymm;
    const [year, month] = yyyymm.split('-');
    if (!month) return yyyymm; // Fallback si le split n'a pas fonctionné
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const monthName = monthNames[parseInt(month, 10) - 1];
    return `${monthName} ${year}`;
  };

  return (
    <>
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Détail transaction"
      size="xl"
      footer={
        <div className="flex items-center justify-end gap-3 p-4 border-t">
          {/* ⚠️ Désactiver le bouton Supprimer pour les commissions auto (server-only, supprimées en cascade) */}
          {(() => {
            const isAutoCommission = transaction.isAuto === true &&
              transaction.autoSource === 'gestion' &&
              transaction.parentTransactionId !== null &&
              transaction.parentTransactionId !== undefined;
            
            return (
          <Button
            variant="outline"
            onClick={() => onDelete(transaction)}
                disabled={isAutoCommission}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title={isAutoCommission ? "Cette commission est supprimée automatiquement avec la transaction parent" : undefined}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
            );
          })()}
          {/* Bouton Modifier masqué - le rapprochement se fait via la checkbox avec autosave */}
        </div>
      }
    >
      {/* Content : sections espacées, titres visibles */}
      <div className="p-4">
        <div className="space-y-6">
              {/* Header métier conservé dans le body */}
              <section className="space-y-2 border-b pb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Montant</p>
                <p className={`text-2xl font-bold mt-0.5 ${getAmountColor(transaction.nature.type)}`}>
                  {formatAmount(transaction.amount, transaction.nature.type)}
                </p>
                <p className="text-sm font-medium text-gray-900 leading-snug">
                  {transaction.nature?.label || transaction.label}
                  {transaction.Property?.name && ` – ${transaction.Property.name}`}
                  {transaction.accountingMonth && ` – ${formatAccountingMonth(transaction.accountingMonth)}`}
                </p>
              </section>
              {/* Statut */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Statut</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={transaction.nature.type === 'RECETTE' ? 'success' : 'danger'}
                  >
                    {transaction.nature.label}
                  </Badge>
                  <Badge
                    variant={localRapprochementStatus === 'rapprochee' ? 'success' : 'warning'}
                  >
                    {localRapprochementStatus === 'rapprochee' ? 'Rapprochée' : 'Non rapprochée'}
                  </Badge>
                  {transaction.isAuto && transaction.autoSource === 'gestion' && (
                    <Badge variant="secondary" className="text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                      Commission
                    </Badge>
                  )}
                </div>
                <div
                  id="transaction-drawer-rapprochement"
                  className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4 scroll-mt-4"
                >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={localRapprochementStatus === 'rapprochee'}
                    onCheckedChange={handleToggleRapprochement}
                    disabled={isTogglingRapprochement}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">
                      Marquer comme rapprochée
                    </span>
                    {isTogglingRapprochement && (
                      <span className="text-xs text-gray-500 ml-2">Enregistrement...</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Cette modification est automatiquement sauvegardée.
                </p>
                </div>
              </section>

              {/* Échéance liée */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Échéance liée
                </h3>
                {loadingEcheanceLink ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement…
                  </div>
                ) : echeanceLinked ? (
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <Link
                      href={echeancesHref}
                      className="text-sm font-medium text-orange-600 hover:underline"
                    >
                      {echeanceLinked.label}
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleUnlinkEcheance}
                      className="text-gray-600 shrink-0"
                    >
                      <Unlink className="h-4 w-4 mr-1" />
                      Retirer le lien
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">Aucune échéance liée</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={openPickEcheance}
                      className="gap-1"
                    >
                      <Link2 className="h-4 w-4" />
                      Lier à une échéance
                    </Button>
                    {loadingSuggestedEcheances ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500 pt-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Suggestions…
                      </div>
                    ) : suggestedEcheances.length > 0 ? (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Échéances suggérées
                        </p>
                        {(() => {
                          const { visible, hasMore } = getVisibleSuggestions(suggestedEcheances);
                          const toShow = showAllSuggestedEcheances ? suggestedEcheances : visible;
                          return (
                            <>
                              <ul className="space-y-1.5">
                                {toShow.map((s) => (
                                  <li
                                    key={s.item.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-100 p-2 text-sm bg-gray-50/50"
                                  >
                                    <div>
                                      <p className="font-medium text-gray-900">{s.item.label}</p>
                                      <p className="text-xs text-gray-600">
                                        {formatAmount(Math.abs(s.item.montant), transaction.nature.type)} ·{' '}
                                        {s.item.nextOccurrenceDate
                                          ? formatDate(s.item.nextOccurrenceDate)
                                          : '—'}
                                      </p>
                                      <span
                                        className={cn(
                                          'text-[10px] font-medium rounded px-1.5 py-0.5 mt-1 inline-block',
                                          s.level === 'FORT' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                                        )}
                                      >
                                        {SUGGESTION_LEVEL_LABELS[s.level]}
                                      </span>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => handleLinkToEcheance(s.item.id)}
                                      disabled={linkingEcheance}
                                    >
                                      Lier
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                              {hasMore && !showAllSuggestedEcheances && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="mt-2 text-primary-600"
                                  onClick={() => setShowAllSuggestedEcheances(true)}
                                >
                                  Voir plus
                                </Button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              {/* Bien */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bien</h3>
                <p className="font-medium text-gray-900">{transaction.Property.name}</p>
                {transaction.Property.address && (
                  <p className="text-sm text-gray-600 mt-0.5">{transaction.Property.address}</p>
                )}
              </section>

              {/* Locataire */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Locataire</h3>
                <p className="font-medium text-gray-900">
                  {(transaction.Tenant || transaction.tenant)
                    ? `${(transaction.Tenant || transaction.tenant)!.firstName} ${(transaction.Tenant || transaction.tenant)!.lastName}`
                    : '—'}
                </p>
              </section>

              {/* Paiement */}
              {(transaction.paymentDate || transaction.paymentMethod || transaction.paidAt || transaction.method) && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Euro className="h-3.5 w-3.5" />
                    Paiement
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {(transaction.paymentDate || transaction.paidAt) && (
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium text-gray-900">{formatDate(transaction.paymentDate || transaction.paidAt || '')}</p>
                      </div>
                    )}
                    {(transaction.paymentMethod || transaction.method) && (
                      <div>
                        <p className="text-gray-500">Mode</p>
                        <p className="font-medium text-gray-900">
                          {PAYMENT_METHODS[(transaction.paymentMethod || transaction.method) as keyof typeof PAYMENT_METHODS] || (transaction.paymentMethod || transaction.method)}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Période couverte */}
              {(transaction.accountingMonth || transaction.monthsCovered) && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Période couverte
                  </h3>
                  
                  {/* Mois comptable - Format visible et important */}
                  {transaction.accountingMonth && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-600 mb-1">Mois comptable</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatAccountingMonth(transaction.accountingMonth)}
                      </p>
                    </div>
                  )}
                  
                  {transaction.monthsCovered && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">Mois couverts</p>
                      <p className="font-medium">{transaction.monthsCovered} mois</p>
                    </div>
                  )}
                  
                  {/* Badge de série multi-mois - Debug et affichage */}
                  {transaction.moisTotal && transaction.moisIndex && (
                        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <Info className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm text-gray-900 font-medium flex items-center gap-2">
                                Transaction multi-mois
                                <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                                  Série ({transaction.moisTotal}) — {transaction.moisIndex}/{transaction.moisTotal}
                                </Badge>
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                Cette transaction fait partie d'une série de {transaction.moisTotal} mois. 
                                Le nombre de mois couverts n'est modifiable qu'à la création.
                              </p>
                            </div>
                          </div>
                        </div>
                  )}
                  
                  {transaction.autoDistribution && (
                    <div className="mt-4">
                      <Badge variant="primary">Distribution automatique</Badge>
                    </div>
                  )}
                </section>
              )}

              {/* Notes */}
              {transaction.notes && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{transaction.notes}</p>
                </section>
              )}

              {/* Informations système */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Informations système</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {transaction.accountingMonth && (
                    <div>
                      <p className="text-sm text-gray-600">Mois comptable</p>
                      <p className="font-medium">{transaction.accountingMonth}</p>
                    </div>
                  )}
                  {transaction.createdAt && (
                    <div>
                      <p className="text-sm text-gray-600">Créée le</p>
                      <p className="font-medium">{formatDate(transaction.createdAt)}</p>
                    </div>
                  )}
                  {transaction.updatedAt && (
                    <div>
                      <p className="text-sm text-gray-600">Modifiée le</p>
                      <p className="font-medium">{formatDate(transaction.updatedAt)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">ID</p>
                    <p className="font-mono text-xs text-gray-400">{transaction.id}</p>
                  </div>
                </div>
              </section>

              {/* Documents liés (id pour scroll depuis la table) */}
              <section id="transaction-drawer-documents" className="scroll-mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Documents liés
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="text-gray-400"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter (bientôt)
                  </Button>
                </div>
                
                {documentsLoading ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                    <p>Chargement des documents...</p>
                  </div>
                ) : displayDocuments && displayDocuments.length > 0 ? (
                  <div className="space-y-2">
                    {displayDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-gray-600">
                            {doc.type} • {doc.createdAt ? formatDate(doc.createdAt) : 'Date inconnue'}
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onViewDocument?.(doc.id, doc.name)}
                        >
                          Voir
                        </Button>
                      </div>
                    ))}
                    {hasMissingDocuments && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <span>Certains documents liés ne sont pas encore synchronisés</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Aucun document lié</p>
                  </div>
                )}
              </section>
        </div>
      </div>
    </Drawer>

    <Dialog open={pickEcheanceOpen} onOpenChange={setPickEcheanceOpen}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choisir une échéance</DialogTitle>
          <p className="text-sm text-gray-600 font-normal">Échéances actives du bien.</p>
        </DialogHeader>
        <div className="overflow-y-auto space-y-1 min-h-[160px]">
          {linkingEcheance ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            echeanceCandidates.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={linkingEcheance}
                onClick={() => handleLinkToEcheance(c.id)}
                className="w-full text-left rounded-lg border border-gray-200 p-3 hover:bg-orange-50/50 text-sm font-medium"
              >
                {c.label}
              </button>
            ))
          )}
          {!linkingEcheance && echeanceCandidates.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">Aucune échéance à afficher.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
