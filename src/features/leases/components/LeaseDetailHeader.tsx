'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Building2, Edit, Trash2, Banknote, FileText, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useLeasePaymentsTimeline } from '../hooks/useLeasePaymentsTimeline';
import { formatLeasePeriod } from '@/utils/leaseUtils';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import type { LeasePaymentsTimelineMonth } from '../hooks/useLeasePaymentsTimeline';
import { getLocalDB } from '@/lib/offline/db';
import {
  getNextLeaseAction,
  toLeaseForNextAction,
  type LeaseNextActionFinancialInput,
} from '../utils/getNextLeaseAction';
import { getLeaseContractStatusInfo, getLeasePaymentHealthInfo } from '../utils/leaseWorkflowStatus';
import { useLeaseIndexationStatus } from '../hooks/useLeaseIndexationStatus';

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const isResilie = (status: string) =>
  ['RÉSILIÉ', 'RESILIE', 'TERMINATED'].includes(status);

function docMentionsYearMonth(doc: { filenameOriginal?: string; fileName?: string; metadata?: string | null }, ym: string): boolean {
  const blob = `${doc.filenameOriginal || ''} ${doc.fileName || ''} ${doc.metadata || ''}`.toLowerCase();
  if (blob.includes(ym)) return true;
  const [y, m] = ym.split('-');
  if (y && m) {
    if (blob.includes(`${m}/${y}`) || blob.includes(`${m}.${y}`)) return true;
  }
  return false;
}

interface LeaseDetailHeaderProps {
  lease: LeaseWithDetails;
  onEdit: () => void;
  onDelete: () => void;
  onTerminateLease?: () => void;
  onGenerateReceipt?: () => void;
  onEnregistrerPaiement?: (month: LeasePaymentsTimelineMonth) => void;
  /** Fusionné avec la détection locale de quittance manquante (IndexedDB). */
  financialData?: LeaseNextActionFinancialInput;
  onIndexLease?: () => void;
  onRenewLease?: () => void;
}

export function LeaseDetailHeader({
  lease,
  onEdit,
  onDelete,
  onTerminateLease,
  onGenerateReceipt,
  onEnregistrerPaiement,
  financialData: financialDataProp,
  onIndexLease,
  onRenewLease,
}: LeaseDetailHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [receiptGap, setReceiptGap] = useState<{ yearMonth: string; label: string } | undefined>();
  const timeline = useLeasePaymentsTimeline(
    lease.id,
    lease.propertyId,
    lease.organizationId,
    lease.paymentDay ?? 5,
    lease.rentAmount,
    lease.chargesRecupMensuelles ?? 0,
    lease.startDate,
    lease.status
  );
  const indexation = useLeaseIndexationStatus(lease);

  const organizationId = lease.organizationId ?? '';
  const resilie = isResilie(lease.status);

  useEffect(() => {
    let cancelled = false;
    async function detectMissingReceipt() {
      if (timeline.loading || !organizationId || resilie) {
        setReceiptGap(undefined);
        return;
      }
      if (timeline.cockpit.statutGlobal !== 'ok' || !timeline.lastPayment) {
        setReceiptGap(undefined);
        return;
      }
      const ym = timeline.lastPayment.month.yearMonth;
      try {
        const db = await getLocalDB();
        const types = await db.DocumentType.toArray();
        const quittanceTypeIds = types
          .filter((t: { code?: string }) => String(t.code || '').toUpperCase().includes('QUITTANCE'))
          .map((t: { id: string }) => t.id);
        const links = await db.DocumentLink.toArray();
        const leaseDocIds = links
          .filter(
            (l: { linkedId?: string; linkedType?: string }) =>
              String(l.linkedId) === lease.id && /lease/i.test(String(l.linkedType || ''))
          )
          .map((l: { documentId: string }) => l.documentId);
        if (leaseDocIds.length === 0) {
          if (!cancelled) setReceiptGap({ yearMonth: ym, label: timeline.lastPayment!.month.label });
          return;
        }
        const docs = await db.Document.where('id')
          .anyOf(leaseDocIds)
          .filter((d: { organizationId?: string; deletedAt?: string | null }) => d.organizationId === organizationId && !d.deletedAt)
          .toArray();
        const quittances = quittanceTypeIds.length
          ? docs.filter((d: { documentTypeId?: string | null }) => d.documentTypeId && quittanceTypeIds.includes(d.documentTypeId))
          : docs.filter((d: { filenameOriginal?: string; fileName?: string }) =>
              /quittance|receipt|reçu|recu/i.test(`${d.filenameOriginal || ''} ${d.fileName || ''}`)
            );
        const hasForMonth = quittances.some((d: { filenameOriginal?: string; fileName?: string; metadata?: string | null }) =>
          docMentionsYearMonth(d, ym)
        );
        if (!cancelled) {
          if (!hasForMonth) setReceiptGap({ yearMonth: ym, label: timeline.lastPayment!.month.label });
          else setReceiptGap(undefined);
        }
      } catch {
        if (!cancelled) setReceiptGap(undefined);
      }
    }
    void detectMissingReceipt();
    return () => {
      cancelled = true;
    };
  }, [
    timeline.loading,
    timeline.cockpit.statutGlobal,
    timeline.lastPayment?.month.yearMonth,
    timeline.lastPayment?.month.label,
    lease.id,
    organizationId,
    resilie,
  ]);

  const mergedFinancial = useMemo(
    (): LeaseNextActionFinancialInput => ({
      ...financialDataProp,
      pendingReceipt: financialDataProp?.pendingReceipt ?? receiptGap,
      indexationStatus: financialDataProp?.indexationStatus ?? indexation.status,
    }),
    [financialDataProp, receiptGap, indexation.status]
  );

  const nextAction = useMemo(
    () => getNextLeaseAction(toLeaseForNextAction(lease), timeline, mergedFinancial),
    [lease, timeline, mergedFinancial]
  );

  const paymentTargetMonth = useMemo(() => {
    if (!nextAction.month) return null;
    return timeline.months.find((m) => m.yearMonth === nextAction.month) ?? null;
  }, [nextAction.month, timeline.months]);

  const contractStatus = getLeaseContractStatusInfo(lease.status);
  const canOperatePayments = contractStatus.code === 'ACTIF';
  const statusVariantByCode = {
    BROUILLON: 'secondary',
    A_SIGNER: 'warning',
    ACTIF: 'success',
    RESILIE: 'danger',
    ARCHIVE: 'secondary',
  } as const;
  const statusConf = { variant: statusVariantByCode[contractStatus.code], label: contractStatus.label };
  const period = formatLeasePeriod(lease.startDate, lease.endDate, lease.furnishedType);
  const paymentHealth = getLeasePaymentHealthInfo(lease.status, timeline.cockpit.statutGlobal);
  const healthClassByTone = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
    neutral: 'bg-gray-100 text-gray-700',
  } as const;
  const healthIconByCode = {
    NON_DEMARRE: '⚪',
    CLOS: '⚪',
    RESILIE: '⚪',
    OK: '✅',
    PARTIEL: '⚠️',
    RETARD: '❌',
  } as const;

  const handlePrimaryCta = () => {
    switch (nextAction.type) {
      case 'PAY_REMAINING':
      case 'PAY_FULL':
        if (paymentTargetMonth && onEnregistrerPaiement) onEnregistrerPaiement(paymentTargetMonth);
        break;
      case 'GENERATE_RECEIPT':
        onGenerateReceipt?.();
        break;
      case 'INDEXATION':
        (onIndexLease ?? onEdit)();
        break;
      case 'RENEWAL':
        (onRenewLease ?? onEdit)();
        break;
      default:
        break;
    }
  };

  const primaryLabel =
    nextAction.type === 'PAY_REMAINING' || nextAction.type === 'PAY_FULL'
      ? 'Enregistrer paiement'
      : nextAction.type === 'GENERATE_RECEIPT'
        ? 'Générer quittance'
        : nextAction.type === 'INDEXATION'
          ? 'Indexer'
          : nextAction.type === 'RENEWAL'
            ? 'Renouveler'
            : null;

  const showPrimary = Boolean(
    !timeline.loading &&
      primaryLabel &&
      (((nextAction.type === 'PAY_REMAINING' || nextAction.type === 'PAY_FULL') &&
        onEnregistrerPaiement &&
        paymentTargetMonth) ||
        (nextAction.type === 'GENERATE_RECEIPT' && onGenerateReceipt) ||
        nextAction.type === 'INDEXATION' ||
        nextAction.type === 'RENEWAL')
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      {/* Bloc 1 — Identité (compact) */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-semibold text-gray-900">
            {lease.Tenant.firstName} {lease.Tenant.lastName}
          </h2>
          <Badge variant={statusConf.variant} className="text-xs">
            {statusConf.label}
          </Badge>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
          <Building2 className="h-3 w-3 shrink-0" />
          {lease.Property.name}
          <span className="text-gray-400">·</span>
          {period.startText} → {period.endText.replace('Au ', '').replace('Fin ', '')}
        </p>
      </div>

      {/* Bloc 2 — Statut global + Prochaine action (ordre de lecture prioritaire) */}
      <div className="flex flex-col gap-1.5">
        <span
          className={`inline-flex w-fit items-center rounded-md px-2 py-1 text-xs font-medium ${healthClassByTone[paymentHealth.tone]}`}
        >
          <span>{healthIconByCode[paymentHealth.code]}</span>
          <span className="ml-1">{paymentHealth.label}</span>
        </span>
        {timeline.loading ? (
          <p className="text-sm font-medium text-gray-400">Chargement du pilotage…</p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-800">{nextAction.label}</p>
            {nextAction.description ? (
              <p className="text-xs text-gray-500">{nextAction.description}</p>
            ) : null}
          </>
        )}
        {timeline.lastPayment && (
          <p className="text-xs text-gray-500">
            Dernier paiement : {formatDate(timeline.lastPayment.date)} · {formatCurrency(timeline.lastPayment.amount)}
          </p>
        )}
      </div>

      {/* Bloc 3 — KPIs secondaires */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Loyer/mois</p>
          <p className="text-sm font-semibold text-gray-900">{formatCurrency(timeline.cockpit.loyerMensuel)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Encaissé 12 mois</p>
          <p className="text-sm font-semibold text-gray-900">{formatCurrency(timeline.cockpit.totalEncaisse12Mois)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Taux paiement</p>
          <p className="text-sm font-semibold text-gray-900">
            {timeline.cockpit.tauxPaiement != null ? `${timeline.cockpit.tauxPaiement}%` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">En retard</p>
          <p className={`text-sm font-semibold ${timeline.cockpit.montantEnRetard > 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {timeline.cockpit.montantEnRetard > 0 ? formatCurrency(timeline.cockpit.montantEnRetard) : '—'}
          </p>
        </div>
      </div>

      {/* Bloc 4 — CTA principal selon la prochaine action métier */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
        {!resilie && canOperatePayments && showPrimary && (
          <Button variant="default" size="sm" onClick={handlePrimaryCta} className="shrink-0">
            {(nextAction.type === 'PAY_REMAINING' || nextAction.type === 'PAY_FULL') && (
              <Banknote className="h-3.5 w-3.5 mr-1.5" />
            )}
            {nextAction.type === 'GENERATE_RECEIPT' && <FileText className="h-3.5 w-3.5 mr-1.5" />}
            {primaryLabel}
          </Button>
        )}
        {!resilie && canOperatePayments && onGenerateReceipt && nextAction.type !== 'GENERATE_RECEIPT' && (
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerateReceipt}
            className="shrink-0 border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Générer quittance
          </Button>
        )}
          {/* Menu secondaire compact */}
          <div className="relative ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMenuOpen((o) => !o)}
              className="text-gray-500 hover:text-gray-700 shrink-0"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 top-full mt-1 z-20 py-1 min-w-[140px] rounded-lg border border-gray-200 bg-white shadow-lg">
                  {contractStatus.code !== 'RESILIE' && contractStatus.code !== 'ARCHIVE' && (
                    <button
                      type="button"
                      onClick={() => {
                        onEdit();
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Modifier
                    </button>
                  )}
                  {contractStatus.code === 'ACTIF' && onTerminateLease && (
                    <button
                      type="button"
                      onClick={() => {
                        onTerminateLease();
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Résilier le bail
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onDelete();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
    </div>
  );
}
