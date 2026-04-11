'use client';

import React from 'react';
import { 
  Table, 
  TableHeader, 
  TableHeaderCell, 
  TableBody, 
  TableRow, 
  TableCell 
} from '@/components/ui/Table';
import { TableV2, TableHeaderV2, TableHeaderCellV2, TableBodyV2, TableRowV2, TableCellV2 } from '@/components/ui2/TableV2';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { 
  FileText, 
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Eye,
  Banknote
} from 'lucide-react';
import { useUI2 } from '@/hooks/useUI2';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { formatLeasePeriod } from '@/utils/leaseUtils';
import { LeaseHealthBadge } from '@/features/leases/components/LeaseHealthBadge';
import { LeaseNextActionCell } from '@/features/leases/components/LeaseNextActionCell';
import { LeaseIndexationRowBadge } from '@/features/leases/components/LeaseIndexationRowBadge';
import { getLeaseContractStatusInfo } from '@/features/leases/utils/leaseWorkflowStatus';
import type {
  LeasePilotageRowMeta,
  LeasePaymentPilotageMeta,
} from '@/features/leases/utils/buildLeasePriorityActions';
import { cn } from '@/utils/cn';
import type { LeasePilotageBucket } from '@/features/leases/utils/leasePilotageSection';

export type LeaseHealthStatus = 'ok' | 'partiel' | 'retard';

function pilotageRowShowsOrangeCta(meta: LeasePilotageRowMeta): boolean {
  return (
    meta.nextActionType === 'PAY_FULL' ||
    meta.nextActionType === 'PAY_REMAINING' ||
    meta.nextActionType === 'INDEXATION' ||
    meta.nextActionType === 'RENEWAL'
  );
}

interface LeasesTableNewProps {
  leases: LeaseWithDetails[];
  organizationId?: string;
  onView?: (lease: LeaseWithDetails) => void;
  onEdit?: (lease: LeaseWithDetails) => void;
  onDelete?: (lease: LeaseWithDetails) => void;
  onActions?: (lease: LeaseWithDetails) => void;
  onSelect?: (leaseId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  selectedIds?: Set<string>;
  showSelection?: boolean;
  loading?: boolean;
  /** Map leaseId -> santé (pour surlignage lignes problématiques + action rapide) */
  leaseHealthMap?: Record<string, LeaseHealthStatus>;
  /** Callback pour action rapide "Payer" sur lignes retard/partiel */
  onQuickPay?: (lease: LeaseWithDetails) => void;
  /** Pilotage batch (App Shell) : colonne « Action principale » + teinte ligne */
  leasePilotageById?: Record<string, LeasePilotageRowMeta>;
  /** Détail mois courant + barre de progression (App Shell) */
  leasePaymentPilotageById?: Record<string, LeasePaymentPilotageMeta>;
  pageMode?: 'normal' | 'app-shell';
  /** Lien filtré vers les transactions du bail (contexte bien App Shell) */
  transactionsHrefForLease?: (lease: LeaseWithDetails) => string;
  onPilotageIgnoreToggle?: (lease: LeaseWithDetails, ignored: boolean) => void;
  /** Clic sur le CTA orange pilotage (même effet que le bandeau « Actions prioritaires »). */
  onPilotagePrimaryCta?: (lease: LeaseWithDetails, meta: LeasePilotageRowMeta) => void;
  /** Bucket pilotage par bail (pour afficher Ignorer seulement sur À traiter / À surveiller). */
  leasePilotageBucketById?: Record<string, LeasePilotageBucket>;
}

const LeasesTableNewComponent: React.FC<LeasesTableNewProps> = ({
  leases,
  organizationId,
  onView,
  onEdit,
  onDelete,
  onActions,
  onSelect,
  onSelectAll,
  selectedIds = new Set(),
  showSelection = true,
  loading = false,
  leaseHealthMap,
  onQuickPay,
  leasePilotageById,
  leasePaymentPilotageById,
  pageMode = 'normal',
  transactionsHrefForLease,
  onPilotageIgnoreToggle,
  onPilotagePrimaryCta,
  leasePilotageBucketById,
}) => {
  // ✅ [DEV-ONLY] Logs de debug (isolés derrière flag DEV)
  if (process.env.NODE_ENV === 'development' && (window as any).__SMARTIMMO_DEBUG_LEASES_TABLE__) {
    console.count('LeasesTableNew render');
    console.log('[LeasesTableNew] [DEV] Props reçues:', {
      leasesCount: leases.length,
      premierLeaseId: leases[0]?.id?.slice(0, 8),
      premierLeaseStatus: leases[0]?.status,
      selectedIdsSize: selectedIds.size,
      loading
    });
  }
  
  const isUI2Active = useUI2();
  const showPaymentPilotageCol = pageMode === 'app-shell' && !!leasePaymentPilotageById;

  const pilotageTertiaryBtnClass =
    'shrink-0 self-start p-0 border-0 bg-transparent text-sm font-normal text-slate-400 hover:text-slate-600 transition-colors cursor-pointer disabled:opacity-40';

  const renderPilotageIgnoreBesidePrimary = (lease: LeaseWithDetails) => {
    if (!onPilotageIgnoreToggle) return null;
    const bucket = leasePilotageBucketById?.[lease.id];
    if (lease.pilotageIgnored) {
      return (
        <button
          type="button"
          className={pilotageTertiaryBtnClass}
          title="Réafficher dans le pilotage opérationnel"
          onClick={(e) => {
            e.stopPropagation();
            onPilotageIgnoreToggle(lease, false);
          }}
        >
          Réactiver
        </button>
      );
    }
    if (bucket === 'critique' || bucket === 'surveiller') {
      return (
        <button
          type="button"
          className={pilotageTertiaryBtnClass}
          title="Masquer ce bail des actions prioritaires et du bloc À traiter"
          onClick={(e) => {
            e.stopPropagation();
            onPilotageIgnoreToggle(lease, true);
          }}
        >
          Ignorer
        </button>
      );
    }
    return null;
  };

  const renderAppShellActionPrincipale = (lease: LeaseWithDetails, meta: LeasePilotageRowMeta) => {
    const showOrange =
      !lease.pilotageIgnored && !!onPilotagePrimaryCta && pilotageRowShowsOrangeCta(meta);
    const payHints =
      !lease.pilotageIgnored &&
      (meta.nextActionType === 'PAY_FULL' || meta.nextActionType === 'PAY_REMAINING');
    const paymentHintText = payHints
      ? leasePaymentPilotageById?.[lease.id]?.transactionHint === 'existing'
        ? '→ lié à transaction existante'
        : leasePaymentPilotageById?.[lease.id]?.transactionHint === 'creates'
          ? '→ créera une transaction'
          : null
      : null;
    const showTransactionsLink = Boolean(transactionsHrefForLease && !lease.pilotageIgnored);

    return (
      <div className="flex flex-col gap-2 items-stretch max-w-[240px]">
        {showOrange ? (
          <Button
            type="button"
            size="sm"
            className="h-8 w-full justify-center sm:w-max sm:min-w-[7.5rem] bg-orange-600 hover:bg-orange-700 text-white font-semibold border-0 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              onPilotagePrimaryCta?.(lease, meta);
            }}
          >
            {meta.ctaLabel}
          </Button>
        ) : (
          <span
            className={cn(
              'text-sm font-medium text-slate-800',
              lease.pilotageIgnored && 'text-slate-400 font-normal',
              !lease.pilotageIgnored && meta.rowTone === 'retard' && 'text-red-800',
              !lease.pilotageIgnored && meta.rowTone === 'partiel' && 'text-amber-900',
              !lease.pilotageIgnored && meta.rowTone === 'resilie' && 'text-slate-500'
            )}
          >
            {meta.primaryLabel}
          </span>
        )}
        {paymentHintText ? <span className="text-xs text-slate-500 leading-snug">{paymentHintText}</span> : null}
        {showTransactionsLink && transactionsHrefForLease ? (
          <Link
            href={transactionsHrefForLease(lease)}
            className="text-sm font-medium text-slate-700 hover:underline w-fit"
            onClick={(e) => e.stopPropagation()}
          >
            Transactions du bail
          </Link>
        ) : null}
        {renderPilotageIgnoreBesidePrimary(lease)}
      </div>
    );
  };
  
  const getStatusBadge = (status: string) => {
    const normalized = getLeaseContractStatusInfo(status);
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      BROUILLON: { variant: 'secondary', icon: Edit, label: 'Brouillon' },
      A_SIGNER: { variant: 'warning', icon: Clock, label: 'À signer' },
      SIGNE: { variant: 'default', icon: CheckCircle, label: 'Signé' },
      ACTIF: { variant: 'success', icon: CheckCircle, label: 'Actif' },
      RESILIE: { variant: 'destructive', icon: XCircle, label: 'Résilié' },
      ARCHIVE: { variant: 'outline', icon: FileText, label: 'Archivé' },
    };

    const config = statusConfig[normalized.code];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getFurnishedBadge = (furnishedType: string | null) => {
    const types: Record<string, string> = {
      'VIDE': 'Vide',
      'MEUBLE': 'Meublé',
      'COLOCATION_MEUBLEE': 'Coloc. meublée',
      'COLOCATION_VIDE': 'Coloc. vide',
    };
    
    return <Badge variant="outline">{types[furnishedType || 'VIDE'] || 'Vide'}</Badge>;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getExpirationWarning = (endDate: string | null) => {
    if (!endDate) return null;
    
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return <Badge variant="destructive">Expiré</Badge>;
    } else if (diffDays <= 30) {
      return <Badge variant="destructive">Fin dans {diffDays}j</Badge>;
    } else if (diffDays <= 90) {
      return <Badge variant="warning">Expire bientôt</Badge>;
    }
    
    return null;
  };

  // Helper pour générer le contenu hover (info importante)
  const getHoverInfo = (lease: LeaseWithDetails) => {
    return null; // Pas d'info supplémentaire à afficher au hover
  };

  // Helper pour générer les actions hover
  const getHoverActions = (lease: LeaseWithDetails) => {
    return (
      <div className="flex items-center gap-4">
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(lease);
            }}
            className="flex items-center gap-1 text-[#ff6b35] hover:text-[#e55a2b] transition-colors underline text-sm font-medium"
          >
            <Edit className="h-4 w-4" />
            <span>MODIFIER</span>
          </button>
        )}
        {onActions && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onActions(lease);
            }}
            className="flex items-center gap-1 text-[#ff6b35] hover:text-[#e55a2b] transition-colors underline text-sm font-medium"
          >
            <FileText className="h-4 w-4" />
            <span>ACTIONS</span>
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(lease);
            }}
            className="flex items-center gap-1 text-red-600 hover:text-red-700 transition-colors underline text-sm font-medium"
          >
            <Trash2 className="h-4 w-4" />
            <span>SUPPRIMER</span>
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
        <p className="text-gray-500 mt-4">Chargement...</p>
      </div>
    );
  }

  if (leases.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Aucun bail trouvé</p>
        <p className="text-sm text-gray-400 mt-1">Ajustez vos filtres ou créez un nouveau bail</p>
      </div>
    );
  }

  return (
    <>
      {isUI2Active ? (
        // Version UI2 avec TableV2
        <TableV2>
          <TableHeaderV2>
            <tr>
              {showSelection && (
                <TableHeaderCellV2>
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    checked={selectedIds.size === leases.length && leases.length > 0}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = selectedIds.size > 0 && selectedIds.size < leases.length;
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      const shouldSelectAll = e.target.checked;
                      if (onSelectAll) {
                        onSelectAll(shouldSelectAll);
                      }
                    }}
                  />
                </TableHeaderCellV2>
              )}
              <TableHeaderCellV2>Bien</TableHeaderCellV2>
              <TableHeaderCellV2>Locataire(s)</TableHeaderCellV2>
              <TableHeaderCellV2>Type</TableHeaderCellV2>
              <TableHeaderCellV2>Période</TableHeaderCellV2>
              <TableHeaderCellV2>€ Loyer</TableHeaderCellV2>
              {showPaymentPilotageCol && (
                <TableHeaderCellV2 className="font-semibold text-gray-900 min-w-[130px]">Mois / encaissement</TableHeaderCellV2>
              )}
              {organizationId && <TableHeaderCellV2 className="font-semibold text-gray-900">Santé</TableHeaderCellV2>}
              <TableHeaderCellV2>Statut</TableHeaderCellV2>
              <TableHeaderCellV2 className="font-semibold text-gray-900 min-w-[140px]">Action principale</TableHeaderCellV2>
              <TableHeaderCellV2 className="text-center">Actions</TableHeaderCellV2>
            </tr>
          </TableHeaderV2>
          <TableBodyV2>
            {leases.map((lease) => {
              const contractStatus = getLeaseContractStatusInfo(lease.status).code;
              const canUsePaymentHealth = contractStatus === 'ACTIF';
              const health = leaseHealthMap?.[lease.id];
              const meta = leasePilotageById?.[lease.id];
              const rowTone = meta?.rowTone
                ? meta.rowTone
                : !canUsePaymentHealth
                  ? 'ok'
                  : health === 'retard'
                    ? 'retard'
                    : health === 'partiel'
                      ? 'partiel'
                      : 'ok';
              const isProblematic = canUsePaymentHealth && (health === 'retard' || health === 'partiel');
              const baseRowClass =
                rowTone === 'resilie'
                  ? 'bg-gray-100/90'
                  : rowTone === 'retard'
                    ? 'bg-red-50/70'
                    : rowTone === 'partiel'
                      ? 'bg-amber-50/70'
                      : undefined;
              const rowClass = lease.pilotageIgnored
                ? cn(baseRowClass, 'border-l-2 border-slate-300/90 !bg-slate-50/95 opacity-60 hover:opacity-100')
                : baseRowClass;
              return (
              <TableRowV2
                key={lease.id}
                dataLeaseRowId={lease.id}
                onClick={() => onView?.(lease)}
                onHoverInfo={getHoverInfo(lease)}
                className={rowClass}
              >
                {showSelection && (
                  <TableCellV2 onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      checked={selectedIds.has(lease.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        onSelect?.(lease.id, e.target.checked);
                      }}
                    />
                  </TableCellV2>
                )}
                <TableCellV2>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {lease.Property.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                      {lease.Property.address}
                    </div>
                  </div>
                </TableCellV2>
                <TableCellV2>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">
                      {lease.Tenant.firstName} {lease.Tenant.lastName}
                    </div>
                    <div className="text-xs text-gray-500 truncate ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                      {lease.Tenant.email}
                    </div>
                  </div>
                </TableCellV2>
                <TableCellV2>
                  <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out flex flex-col gap-1">
                    <span className="text-sm">{lease.type}</span>
                    {getFurnishedBadge(lease.furnishedType)}
                  </div>
                </TableCellV2>
                <TableCellV2>
                  <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out text-sm">
                    {(() => {
                      const period = formatLeasePeriod(lease.startDate, lease.endDate, lease.furnishedType);
                      return (
                        <>
                          <div>{period.startText}</div>
                          <div className={period.calculated ? 'text-gray-500 italic' : ''}>
                            {period.endText}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </TableCellV2>
                <TableCellV2>
                  <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                    <div className="font-medium text-gray-900">
                      {formatCurrency(lease.rentAmount)}
                    </div>
                    {lease.chargesRecupMensuelles && lease.chargesRecupMensuelles > 0 && (
                      <div className="text-xs text-gray-500">
                        + {formatCurrency(lease.chargesRecupMensuelles)} charges
                      </div>
                    )}
                  </div>
                </TableCellV2>
                {showPaymentPilotageCol && (
                  <TableCellV2>
                    {(() => {
                      const pay = leasePaymentPilotageById?.[lease.id];
                      if (!pay) return <span className="text-xs text-gray-400">—</span>;
                      return (
                        <div
                          className={cn(
                            'min-w-[120px] max-w-[160px]',
                            lease.pilotageIgnored && 'opacity-50'
                          )}
                        >
                          <div className="text-xs font-semibold text-gray-900 capitalize truncate" title={pay.currentMonthLabel}>
                            {pay.currentMonthLabel}
                          </div>
                          <div className="text-[11px] text-gray-600">
                            {formatCurrency(pay.paid)} / {formatCurrency(pay.expected)}
                          </div>
                          <div className="h-1.5 w-full bg-gray-200 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.round(pay.progress01 * 100))}%` }}
                            />
                          </div>
                          {pay.remaining > 0.02 && (
                            <div className="text-[11px] text-amber-800 font-medium mt-0.5">
                              Reste {formatCurrency(pay.remaining)}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </TableCellV2>
                )}
                {organizationId && (
                  <TableCellV2 className="font-medium">
                    <LeaseHealthBadge lease={lease} organizationId={organizationId} className="text-base" />
                  </TableCellV2>
                )}
                <TableCellV2>
                  <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                    {getStatusBadge(lease.status)}
                    {lease.pilotageIgnored && (
                      <div className="mt-1">
                        <Badge
                          variant="outline"
                          className="border-slate-300/90 bg-slate-50 text-[10px] font-medium py-0 px-1.5 text-slate-600"
                        >
                          Ignoré
                        </Badge>
                      </div>
                    )}
                    {organizationId && (
                      <div className="mt-1">
                        <LeaseIndexationRowBadge lease={lease} />
                      </div>
                    )}
                  </div>
                </TableCellV2>
                <TableCellV2 onClick={(e) => e.stopPropagation()}>
                  {pageMode === 'app-shell' && meta ? (
                    renderAppShellActionPrincipale(lease, meta)
                  ) : organizationId ? (
                    <div className="flex flex-col gap-2 items-start">
                      <LeaseNextActionCell lease={lease} organizationId={organizationId} />
                      {renderPilotageIgnoreBesidePrimary(lease)}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </TableCellV2>
                <TableCellV2 className="text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    {isProblematic && onQuickPay && pageMode !== 'app-shell' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickPay(lease);
                        }}
                        className="h-8 px-2 text-amber-700 border-amber-300 hover:bg-amber-50"
                        title="Enregistrer un paiement"
                      >
                        <Banknote className="h-4 w-4" />
                      </Button>
                    )}
                    {onView && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onView(lease);
                        }}
                        className="h-8 w-8 p-0"
                        title="Voir"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {onEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(lease);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCellV2>
              </TableRowV2>
              );
            })}
          </TableBodyV2>
        </TableV2>
      ) : (
        // Version normale avec Table
        <Table hover>
          <TableHeader>
            <TableRow>
              {showSelection && (
                <TableHeaderCell>
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    checked={selectedIds.size === leases.length && leases.length > 0}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = selectedIds.size > 0 && selectedIds.size < leases.length;
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      const shouldSelectAll = e.target.checked;
                      if (onSelectAll) {
                        onSelectAll(shouldSelectAll);
                      }
                    }}
                  />
                </TableHeaderCell>
              )}
              <TableHeaderCell>Bien</TableHeaderCell>
              <TableHeaderCell>Locataire(s)</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Période</TableHeaderCell>
              <TableHeaderCell>€ Loyer</TableHeaderCell>
              {showPaymentPilotageCol && (
                <TableHeaderCell className="font-semibold text-gray-900 min-w-[130px]">Mois / encaissement</TableHeaderCell>
              )}
              {organizationId && <TableHeaderCell className="font-semibold text-gray-900">Santé</TableHeaderCell>}
              <TableHeaderCell>Statut</TableHeaderCell>
              <TableHeaderCell className="font-semibold text-gray-900 min-w-[140px]">Action principale</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leases.map((lease) => {
              const contractStatus = getLeaseContractStatusInfo(lease.status).code;
              const canUsePaymentHealth = contractStatus === 'ACTIF';
              const health = leaseHealthMap?.[lease.id];
              const meta = leasePilotageById?.[lease.id];
              const rowTone = meta?.rowTone
                ? meta.rowTone
                : !canUsePaymentHealth
                  ? 'ok'
                  : health === 'retard'
                    ? 'retard'
                    : health === 'partiel'
                      ? 'partiel'
                      : 'ok';
              const isProblematic = canUsePaymentHealth && (health === 'retard' || health === 'partiel');
              const baseRowClass =
                rowTone === 'resilie'
                  ? 'bg-gray-100/90'
                  : rowTone === 'retard'
                    ? 'bg-red-50/70'
                    : rowTone === 'partiel'
                      ? 'bg-amber-50/70'
                      : '';
              const rowClass = lease.pilotageIgnored
                ? cn(
                    baseRowClass,
                    'border-l-2 border-slate-300/90 !bg-slate-50/95 opacity-60 hover:opacity-100'
                  )
                : baseRowClass;
              return (
              <TableRow 
                key={lease.id}
                data-lease-row-id={lease.id}
                className={cn('cursor-pointer hover:bg-gray-50', rowClass)}
                onClick={() => onView?.(lease)}
              >
                {showSelection && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      checked={selectedIds.has(lease.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        onSelect?.(lease.id, e.target.checked);
                      }}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {lease.Property.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {lease.Property.address}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">
                      {lease.Tenant.firstName} {lease.Tenant.lastName}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {lease.Tenant.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm">{lease.type}</span>
                    {getFurnishedBadge(lease.furnishedType)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {(() => {
                      const period = formatLeasePeriod(lease.startDate, lease.endDate, lease.furnishedType);
                      return (
                        <>
                          <div>{period.startText}</div>
                          <div className={period.calculated ? 'text-gray-500 italic' : ''}>
                            {period.endText}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-gray-900">
                    {formatCurrency(lease.rentAmount)}
                  </div>
                  {lease.chargesRecupMensuelles && lease.chargesRecupMensuelles > 0 && (
                    <div className="text-xs text-gray-500">
                      + {formatCurrency(lease.chargesRecupMensuelles)} charges
                    </div>
                  )}
                </TableCell>
                {showPaymentPilotageCol && (
                  <TableCell>
                    {(() => {
                      const pay = leasePaymentPilotageById?.[lease.id];
                      if (!pay) return <span className="text-xs text-gray-400">—</span>;
                      return (
                        <div
                          className={cn(
                            'min-w-[120px] max-w-[160px]',
                            lease.pilotageIgnored && 'opacity-50'
                          )}
                        >
                          <div className="text-xs font-semibold text-gray-900 capitalize truncate" title={pay.currentMonthLabel}>
                            {pay.currentMonthLabel}
                          </div>
                          <div className="text-[11px] text-gray-600">
                            {formatCurrency(pay.paid)} / {formatCurrency(pay.expected)}
                          </div>
                          <div className="h-1.5 w-full bg-gray-200 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.round(pay.progress01 * 100))}%` }}
                            />
                          </div>
                          {pay.remaining > 0.02 && (
                            <div className="text-[11px] text-amber-800 font-medium mt-0.5">
                              Reste {formatCurrency(pay.remaining)}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                )}
                {organizationId && (
                  <TableCell className="font-medium">
                    <LeaseHealthBadge lease={lease} organizationId={organizationId} className="text-base" />
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {getStatusBadge(lease.status)}
                    {lease.pilotageIgnored && (
                      <Badge
                        variant="outline"
                        className="w-fit border-slate-300/90 bg-slate-50 text-[10px] font-medium py-0 px-1.5 text-slate-600"
                      >
                        Ignoré
                      </Badge>
                    )}
                    {organizationId && <LeaseIndexationRowBadge lease={lease} />}
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {pageMode === 'app-shell' && meta ? (
                    renderAppShellActionPrincipale(lease, meta)
                  ) : organizationId ? (
                    <div className="flex flex-col gap-2 items-start">
                      <LeaseNextActionCell lease={lease} organizationId={organizationId} />
                      {renderPilotageIgnoreBesidePrimary(lease)}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isProblematic && onQuickPay && pageMode !== 'app-shell' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickPay(lease);
                        }}
                        title="Enregistrer un paiement"
                        className="text-amber-700 hover:bg-amber-50"
                      >
                        <Banknote className="h-4 w-4" />
                      </Button>
                    )}
                    {onView && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onView(lease);
                        }}
                        title="Voir"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit?.(lease);
                      }}
                      title="Modifier"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
}

// ✅ React.memo avec comparaison optimisée incluant les champs mutables (status, updatedAt)
// ⚠️ CRITIQUE : La comparaison DOIT inclure status et updatedAt pour détecter les changements
// ⚠️ OPTIMISATION : Comparaison rapide (length check d'abord, puis signature uniquement si nécessaire)
export const LeasesTableNew = React.memo(LeasesTableNewComponent, (prevProps, nextProps) => {
  // Comparaison basique (rapide)
  if (prevProps.loading !== nextProps.loading) return false;
  if (prevProps.leases.length !== nextProps.leases.length) return false;
  if (prevProps.selectedIds.size !== nextProps.selectedIds.size) return false;
  if (prevProps.showSelection !== nextProps.showSelection) return false;
  if (prevProps.organizationId !== nextProps.organizationId) return false;
  if (prevProps.onQuickPay !== nextProps.onQuickPay) return false;
  if (prevProps.leaseHealthMap !== nextProps.leaseHealthMap) return false;
  if (prevProps.leasePilotageById !== nextProps.leasePilotageById) return false;
  if (prevProps.leasePaymentPilotageById !== nextProps.leasePaymentPilotageById) return false;
  if (prevProps.pageMode !== nextProps.pageMode) return false;
  if (prevProps.transactionsHrefForLease !== nextProps.transactionsHrefForLease) return false;
  if (prevProps.onPilotageIgnoreToggle !== nextProps.onPilotageIgnoreToggle) return false;
  if (prevProps.onPilotagePrimaryCta !== nextProps.onPilotagePrimaryCta) return false;
  if (prevProps.leasePilotageBucketById !== nextProps.leasePilotageBucketById) return false;

  // ✅ OPTIMISATION : Si même nombre de leases, comparer uniquement les signatures
  // ⚠️ ROBUSTE AUX STRING ISO : updatedAt peut être string ISO ou Date, normaliser en string
  const normalizeUpdatedAt = (updatedAt: string | Date | undefined): string => {
    if (!updatedAt) return '';
    if (typeof updatedAt === 'string') return updatedAt;
    if (updatedAt instanceof Date) return updatedAt.toISOString();
    return String(updatedAt);
  };
  
  // ✅ Comparaison optimisée : signature id:status:updatedAt pour chaque lease
  // Permet de détecter les changements de status ou updatedAt même si l'ID reste identique
  const prevLeasesSignature = prevProps.leases
    .map((l) => `${l.id}:${l.status}:${normalizeUpdatedAt(l.updatedAt)}:${l.pilotageIgnored ? 1 : 0}`)
    .join('|');
  const nextLeasesSignature = nextProps.leases
    .map((l) => `${l.id}:${l.status}:${normalizeUpdatedAt(l.updatedAt)}:${l.pilotageIgnored ? 1 : 0}`)
    .join('|');
  if (prevLeasesSignature !== nextLeasesSignature) {
    if (process.env.NODE_ENV === 'development' && (window as any).__SMARTIMMO_DEBUG_LEASES_TABLE__) {
      console.log('[LeasesTableNew] [DEV] Re-render nécessaire (signature changée):', {
        prevCount: prevProps.leases.length,
        nextCount: nextProps.leases.length,
        prevSignature: prevLeasesSignature.substring(0, 100),
        nextSignature: nextLeasesSignature.substring(0, 100)
      });
    }
    return false;
  }
  
  // Comparer les IDs sélectionnés
  const prevSelected = Array.from(prevProps.selectedIds).sort().join(',');
  const nextSelected = Array.from(nextProps.selectedIds).sort().join(',');
  if (prevSelected !== nextSelected) return false;
  
  // Si tout est identique, on peut skip le re-render
  return true;
});

