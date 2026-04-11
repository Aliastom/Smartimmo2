/**
 * Core Component pour la page Prêts/Loans
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 * 
 * Réplique EXACTEMENT le comportement de LoansClient.tsx
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { notify2 } from '@/lib/notify2';
import { Plus, Trash2, CheckCircle, Loader2, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PaginationV2 } from '@/components/ui2/PaginationV2';
import { TableV2, TableHeaderV2, TableHeaderCellV2, TableBodyV2, TableRowV2, TableCellV2 } from '@/components/ui2/TableV2';
import { useUI2 } from '@/hooks/useUI2';
import { LoansKpiBar } from '@/components/loans/LoansKpiBar';
import { LoansCRDTimelineChart } from '@/components/loans/LoansCRDTimelineChart';
import { LoansByPropertyChart } from '@/components/loans/LoansByPropertyChart';
import { LoansTopCostlyChart } from '@/components/loans/LoansTopCostlyChart';
import { TopCostlyLoansModal } from '@/components/loans/TopCostlyLoansModal';
import { LoansFilters } from '@/components/loans/LoansFilters';
import { LoanModalV2 } from '@/components/loans/LoanModalV2';
import { LoanDrawer } from '@/components/loans/LoanDrawer';
import { ConfirmDeleteLoanModal } from '@/components/loans/ConfirmDeleteLoanModal';
import { ConfirmDeleteMultipleLoansModal } from '@/components/loans/ConfirmDeleteMultipleLoansModal';
import { useLoansCharts } from '@/hooks/useLoansCharts';
import { useLoansData, type Loan, type LoansFilters } from './hooks/useLoansData';
import { usePropertyCashflowMonthlyMap } from './hooks/usePropertyCashflowMonthlyMap';
import { computePortfolioPilotageMetrics } from './utils/computePortfolioPilotageMetrics';
import { computePortfolioCashflowNetMoyenApresCredit } from './utils/computePortfolioCashflowNetMoyen';
import {
  LoansPortfolioPilotageBar,
  propertyLoansTabHref,
  type LoansPortfolioPilotageFilterKey,
} from './components/LoansPortfolioPilotageBar';
import { LoansPriorityActionsCard } from './components/LoansPriorityActionsBlock';
import { buildLoanPilotagePriorityItems } from './utils/buildLoanPilotagePriorityItems';
import { getLoanRepositoryOffline } from '@/lib/offline/repositories/LoanRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useAlert } from '@/hooks/useAlert';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import {
  GlobalPilotageDetailAccordion,
  GlobalPilotageAlertsSection,
  GLOBAL_ROW_DETAIL_LINK_CLASS,
} from '@/components/global-pilotage';

export interface LoansPageCoreProps {
  mode: 'normal' | 'app-shell';
}

const PILOTAGE_FILTER_LABELS: Record<LoansPortfolioPilotageFilterKey, string> = {
  negative_cf: 'Biens en cashflow négatif après crédit',
  heavy_payment: 'Mensualité > 80 % du cashflow',
  high_rate: 'Taux élevés (> 4 %)',
};

export function LoansPageCore({
  mode,
}: LoansPageCoreProps) {
  const { organizationId } = useCurrentOrganization();
  const { showAlert } = useAlert();
  const router = mode === 'normal' ? useRouter() : null;
  const queryClient = useQueryClient();
  const isUI2Active = useUI2();
  const sidebarContext = useSidebarOptional();

  // États des modals et drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);

  // États pour la sélection multiple
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);

  // État pour la limite mobile (cards)
  const [mobileLimit, setMobileLimit] = useState(3);

  // État pour la modal Top 5
  const [showTopCostlyModal, setShowTopCostlyModal] = useState(false);

  const [loansDetailOpen, setLoansDetailOpen] = useState(false);

  // États pour la période
  // ✅ Ne pas fixer de période par défaut : le hook calculera automatiquement depuis le prêt le plus ancien
  const [periodStart, setPeriodStart] = useState<string | undefined>(undefined);
  const [periodEnd, setPeriodEnd] = useState<string | undefined>(undefined);

  // État pour le filtre KPI actif
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);

  /** Filtre rapide pilotage (tableau uniquement) — app-shell */
  const [pilotageQuickFilter, setPilotageQuickFilter] = useState<LoansPortfolioPilotageFilterKey | null>(null);

  // États des filtres
  const [filters, setFilters] = useState<LoansFilters>({
    search: '',
    propertyId: '',
    active: '1',
  });

  // État pour forcer le rafraîchissement
  const [refreshKey, setRefreshKey] = useState(0);

  // Utiliser le hook unifié pour les données
  // ✅ Scope 'global' pour la page globale (pas de propertyId fixe)
  const {
    loans,
    fullConvertedLoans,
    properties,
    kpis,
    kpisLoading,
    loading,
    error,
  } = useLoansData({
    mode,
    filters: mode === 'app-shell' ? filters : undefined,
    activeKpiFilter,
    periodStart,
    periodEnd,
    scope: 'global', // ✅ Scope global pour la page globale
  });

  const { cashflowMonthlyByPropertyId, isLoadingCashflowMap } = usePropertyCashflowMonthlyMap(
    mode,
    organizationId,
  );

  const portfolioPilotageIndex = useMemo(
    () =>
      computePortfolioPilotageMetrics(
        fullConvertedLoans ?? [],
        cashflowMonthlyByPropertyId,
      ),
    [fullConvertedLoans, cashflowMonthlyByPropertyId],
  );

  const loanPilotagePriorityRows = useMemo(
    () =>
      mode === 'app-shell'
        ? buildLoanPilotagePriorityItems(
            fullConvertedLoans ?? [],
            cashflowMonthlyByPropertyId,
            portfolioPilotageIndex,
            4
          )
        : [],
    [mode, fullConvertedLoans, cashflowMonthlyByPropertyId, portfolioPilotageIndex],
  );

  /** Moyenne par bien (cashflow brut moy. − mensualités) — vue globale App Shell */
  const portfolioCashflowNetMoyenApresCredit = useMemo(
    () =>
      mode === 'app-shell'
        ? computePortfolioCashflowNetMoyenApresCredit(
            fullConvertedLoans ?? [],
            cashflowMonthlyByPropertyId,
          )
        : null,
    [mode, fullConvertedLoans, cashflowMonthlyByPropertyId],
  );

  /** Biens en cashflow négatif — liens « Voir le bien » dans la barre de pilotage */
  const negativeCashflowPropertyLinks = useMemo(() => {
    const ids = portfolioPilotageIndex.negativeCashflowPropertyIds;
    if (ids.size === 0) return [];
    const nameById = new Map<string, string>();
    for (const p of properties as { id?: string; name?: string }[]) {
      if (p?.id && ids.has(p.id) && p.name) nameById.set(p.id, p.name);
    }
    for (const l of fullConvertedLoans ?? []) {
      if (!ids.has(l.propertyId)) continue;
      if (!nameById.has(l.propertyId) && l.propertyName) {
        nameById.set(l.propertyId, l.propertyName);
      }
    }
    return [...ids]
      .map((id) => ({ id, name: nameById.get(id) ?? 'Bien' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [portfolioPilotageIndex.negativeCashflowPropertyIds, properties, fullConvertedLoans]);

  const showVoirLeBienInTable = pilotageQuickFilter === 'negative_cf';

  const renderPropertyColumn = useCallback(
    (loan: Loan, alignEnd?: boolean) => {
      const href = propertyLoansTabHref(loan.propertyId);
      return (
        <div className={alignEnd ? 'flex flex-col gap-0.5 items-end' : 'flex flex-col gap-0.5 items-start'}>
          <Link
            href={href}
            className="text-primary-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {loan.propertyName}
          </Link>
          {showVoirLeBienInTable && (
            <Link
              href={href}
              className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Voir le bien
            </Link>
          )}
        </div>
      );
    },
    [showVoirLeBienInTable],
  );

  const loansForTable = useMemo(() => {
    if (!pilotageQuickFilter) return loans;
    switch (pilotageQuickFilter) {
      case 'negative_cf':
        return loans.filter((l) => portfolioPilotageIndex.negativeCashflowPropertyIds.has(l.propertyId));
      case 'heavy_payment':
        return loans.filter((l) => portfolioPilotageIndex.heavyPaymentLoanIds.has(l.id));
      case 'high_rate':
        return loans.filter((l) => portfolioPilotageIndex.highRateLoanIds.has(l.id));
      default:
        return loans;
    }
  }, [loans, pilotageQuickFilter, portfolioPilotageIndex]);

  // Charger les graphiques avec le hook
  const { data: chartsData, isLoading: chartsLoading } = useLoansCharts({
    mode, // ✅ Passer le mode pour détecter app-shell vs normal
    from: periodStart,
    to: periodEnd,
    propertyId: filters.propertyId || undefined,
    scope: 'global', // ✅ Scope global pour la page globale
  });

  // Gestion des filtres — toute modification des filtres classiques retire le filtre pilotage (évite double lecture ambiguë)
  const handleFiltersChange = useCallback((newFilters: LoansFilters) => {
    setFilters(newFilters);
    setPilotageQuickFilter(null);
  }, []);

  const handleKpiFilterChange = useCallback((filterKey: string | null) => {
    if (filterKey === activeKpiFilter) {
      setActiveKpiFilter(null);
    } else {
      setActiveKpiFilter(filterKey);
    }
  }, [activeKpiFilter]);

  const handleResetFilters = useCallback(() => {
    setFilters({
      search: '',
      propertyId: '',
      active: '1',
    });
    setActiveKpiFilter(null);
    setPilotageQuickFilter(null);
  }, []);

  const handleApplyPilotageFilter = useCallback((key: LoansPortfolioPilotageFilterKey) => {
    setPilotageQuickFilter(key);
  }, []);

  const handleResetPilotageOnly = useCallback(() => {
    setPilotageQuickFilter(null);
  }, []);

  const handlePeriodChange = useCallback((start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
    setPilotageQuickFilter(null);
  }, []);

  // CRUD Handlers
  const handleCreate = () => {
    setSelectedLoan(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEdit = (loan: Loan) => {
    setSelectedLoan(loan);
    setModalMode('edit');
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDuplicate = (loan: Loan) => {
    setSelectedLoan({ ...loan, id: undefined as any, label: `${loan.label} (copie)` });
    setModalMode('create');
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDelete = (loan: Loan) => {
    setLoanToDelete(loan);
    setShowDeleteModal(true);
    setIsDrawerOpen(false);
  };

  const handleRowClick = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsDrawerOpen(true);
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (mode === 'app-shell' || !navigator.onLine) {
        // Mode app-shell ou offline : utiliser le repository offline
        const repo = getLoanRepositoryOffline();
        const orgId = organizationId || 'default';
        
        const payload = {
          propertyId: data.propertyId,
          label: data.label,
          principal: data.principal,
          annualRatePct: data.annualRatePct,
          durationMonths: data.durationMonths,
          defermentMonths: data.defermentMonths,
          insurancePct: data.insurancePct,
          feesUpfront: data.feesUpfront,
          startDate: new Date(data.startDate).toISOString(),
          paymentDay: data.paymentDay,
          loanType: (data as any).loanType,
          repaymentType: (data as any).repaymentType,
          amortizationProfile: (data as any).amortizationProfile,
          notes: (data as any).notes,
          isActive: data.isActive,
          rateType: 'FIXE', // Par défaut
          organizationId: orgId,
        };

        if (data.id) {
          await repo.upsert({
            id: data.id,
            ...payload,
          }, orgId);
        } else {
          await repo.upsert(payload, orgId);
        }

        setIsModalOpen(false);
        
        // ⚠️ CRITIQUE: Si online, pousser immédiatement les pendingOps vers Supabase
        // (conforme au modèle : Situation 5 et 7 - actions online doivent être synchronisées immédiatement)
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        if (isOnline) {
          try {
            const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(organizationId);
            
            await showAlert({
              type: 'success',
              title: 'Prêt enregistré',
              message: 'Le prêt a été enregistré localement et sur le serveur.',
            });
          } catch (syncError) {
            console.error('Error syncing loan operation:', syncError);
            await showAlert({
              type: 'success',
              title: 'Prêt enregistré localement',
              message: 'Le prêt a été enregistré localement.\nLa synchronisation sera effectuée lors de la prochaine synchronisation.',
            });
          }
        } else {
          await showAlert({
            type: 'success',
            title: 'Prêt enregistré (mode hors-ligne)',
            message: 'Le prêt a été enregistré localement.\nIl sera automatiquement synchronisé avec le serveur dès que la connexion sera rétablie.',
          });
        }

        if (mode === 'app-shell') {
          // ✅ Émettre un événement ciblé avec payload scope global
          window.dispatchEvent(new CustomEvent('loans:refresh', { 
            detail: { scope: 'global', reason: data.id ? 'update' : 'crud' } 
          }));
        } else if (mode === 'normal' && router) {
          router.refresh();
        }
        setRefreshKey((k) => k + 1);
        return;
      }

      // Mode normal online : utiliser l'API
      const url = data.id ? `/api/loans/${data.id}` : '/api/loans';
      const method = data.id ? 'PATCH' : 'POST';

      const payload = {
        propertyId: data.propertyId,
        label: data.label,
        principal: data.principal,
        annualRatePct: data.annualRatePct,
        durationMonths: data.durationMonths,
        defermentMonths: data.defermentMonths,
        insurancePct: data.insurancePct,
        feesUpfront: data.feesUpfront,
        startDate: new Date(data.startDate).toISOString(),
        paymentDay: data.paymentDay,
        loanType: (data as any).loanType,
        repaymentType: (data as any).repaymentType,
        amortizationProfile: (data as any).amortizationProfile,
        notes: (data as any).notes,
        isActive: data.isActive,
        stagedDocumentIds: data.stagedDocumentIds,
        stagedLinkItemIds: data.stagedLinkItemIds,
        borrowers: data.borrowers,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de l\'enregistrement');
      }

      notify2.success(data.id ? 'Prêt modifié avec succès' : 'Prêt créé avec succès');

      // Invalider les queries React Query
      queryClient.invalidateQueries({ queryKey: ['loans-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['loans-charts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });

      setIsModalOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (error: any) {
      notify2.error('Erreur', error.message);
    }
  };

  const handleConfirmDelete = async (action: 'deactivate' | 'delete') => {
    if (mode === 'app-shell' || !navigator.onLine) {
      if (loanToDelete) {
        const repo = getLoanRepositoryOffline();
        const orgId = organizationId || 'default';
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        
        if (action === 'deactivate') {
          await repo.upsert({ ...loanToDelete, id: loanToDelete.id, isActive: false, organizationId: orgId }, orgId);
        } else {
          await repo.delete(loanToDelete.id, orgId, 'hard');
        }
        
        // ⚠️ CRITIQUE: Si online, pousser immédiatement les pendingOps vers Supabase
        if (isOnline) {
          try {
            const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(organizationId);
            
            await showAlert({
              type: 'success',
              title: action === 'delete' ? 'Prêt supprimé' : 'Prêt désactivé',
              message: action === 'delete'
                ? 'Le prêt a été supprimé localement et sur le serveur.'
                : 'Le prêt a été désactivé localement et sur le serveur.',
            });
          } catch (syncError) {
            console.error('Error syncing loan operation:', syncError);
            await showAlert({
              type: 'success',
              title: action === 'delete' ? 'Prêt supprimé localement' : 'Prêt désactivé localement',
              message: action === 'delete'
                ? 'Le prêt a été supprimé localement.\nLa suppression sera synchronisée avec le serveur lors de la prochaine synchronisation.'
                : 'Le prêt a été désactivé localement.\nLa synchronisation sera effectuée lors de la prochaine synchronisation.',
            });
          }
        } else {
          await showAlert({
            type: 'success',
            title: action === 'delete' ? 'Prêt supprimé (mode hors-ligne)' : 'Prêt désactivé (mode hors-ligne)',
            message: action === 'delete'
              ? 'Le prêt a été supprimé localement.\nLa suppression sera automatiquement synchronisée avec le serveur dès que la connexion sera rétablie.'
              : 'Le prêt a été désactivé localement.\nLa synchronisation sera automatiquement effectuée dès que la connexion sera rétablie.',
          });
        }

        setShowDeleteModal(false);
        setLoanToDelete(null);

        if (mode === 'app-shell') {
          // ✅ Émettre un événement ciblé avec payload scope global
          window.dispatchEvent(new CustomEvent('loans:refresh', { 
            detail: { scope: 'global', reason: action === 'delete' ? 'delete' : 'update' } 
          }));
        } else if (mode === 'normal' && router) {
          router.refresh();
        }
        setRefreshKey((k) => k + 1);
      }
      return;
    }

    // Mode normal online
    queryClient.invalidateQueries({ queryKey: ['loans-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['loans-charts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
    setRefreshKey((k) => k + 1);
  };

  const handleConfirmDeleteMultiple = async () => {
    if (mode === 'app-shell' || !navigator.onLine) {
      const repo = getLoanRepositoryOffline();
      const orgId = organizationId || 'default';
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      
      for (const loanId of selectedLoanIds) {
        await repo.delete(loanId, orgId);
      }

      // ⚠️ CRITIQUE: Si online, pousser immédiatement les pendingOps vers Supabase
      if (isOnline) {
        try {
          const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
          const syncService = getGlobalSyncService();
          await syncService.syncAllPendingToRemote(organizationId);
          
          await showAlert({
            type: 'success',
            title: 'Prêts supprimés',
            message: `${selectedLoanIds.length} prêt${selectedLoanIds.length > 1 ? 's' : ''} supprimé${selectedLoanIds.length > 1 ? 's' : ''} localement et sur le serveur.`,
          });
        } catch (syncError) {
          console.error('Error syncing delete loans operation:', syncError);
          await showAlert({
            type: 'success',
            title: 'Prêts supprimés localement',
            message: `${selectedLoanIds.length} prêt${selectedLoanIds.length > 1 ? 's' : ''} supprimé${selectedLoanIds.length > 1 ? 's' : ''} localement.\nLa suppression sera synchronisée avec le serveur lors de la prochaine synchronisation.`,
          });
        }
      } else {
        await showAlert({
          type: 'success',
          title: 'Prêts supprimés (mode hors-ligne)',
          message: `${selectedLoanIds.length} prêt${selectedLoanIds.length > 1 ? 's' : ''} supprimé${selectedLoanIds.length > 1 ? 's' : ''} localement.\nLa suppression sera automatiquement synchronisée avec le serveur dès que la connexion sera rétablie.`,
        });
      }

      setSelectedLoanIds([]);
      
      if (mode === 'app-shell') {
        window.dispatchEvent(new CustomEvent('loans:refresh'));
      } else if (mode === 'normal' && router) {
        router.refresh();
      }
      setRefreshKey((k) => k + 1);
      return;
    }

    // Mode normal online : utiliser l'API
    if (selectedLoanIds.length > 0) {
      await Promise.all(
        selectedLoanIds.map(loanId => 
          fetch(`/api/loans/${loanId}`, { method: 'DELETE' })
        )
      );
      
      notify2.success(`${selectedLoanIds.length} prêt(s) supprimé(s) avec succès`);
      
      // Invalider les queries React Query
      queryClient.invalidateQueries({ queryKey: ['loans-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['loans-charts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
      setSelectedLoanIds([]);
      setRefreshKey((k) => k + 1);
      setShowDeleteMultipleModal(false);
    }
  };

  const handleDeleteMultiple = () => {
    if (selectedLoanIds.length === 0) {
      notify2.warning('Aucun prêt sélectionné');
      return;
    }
    setShowDeleteMultipleModal(true);
  };

  // Sélection
  const handleSelectLoan = (id: string) => {
    setSelectedLoanIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedLoanIds(checked ? loansForTable.map((l) => l.id) : []);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (loan: Loan) => {
    const status = loan.loanBusinessStatus || 'inactif';
    if (status === 'actif') {
      return <Badge variant="success">Actif</Badge>;
    }
    if (status === 'solde') {
      return <Badge variant="secondary">Soldé</Badge>;
    }
    return <Badge variant="warning">Inactif</Badge>;
  };

  // Helper pour générer le sous-texte hover (informations du prêt)
  const getHoverInfo = (loan: Loan) => {
    const parts = [];
    if (loan.propertyName) {
      parts.push(loan.propertyName);
    }
    if (loan.startDate) {
      const startDate = formatDate(loan.startDate);
      parts.push(`Début: ${startDate}`);
    }
    return parts.join(' • ') || undefined;
  };

  const charts = chartsData || { crdTimeline: [], crdByProperty: [], topCostlyLoans: [] };

  // États de chargement et erreur
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        <span className="ml-3 text-gray-600">Chargement des prêts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">
          <p className="font-medium">{error}</p>
        </div>
      </div>
    );
  }

  // Rendu principal
  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-full">
      {/* Header */}
      <div className="mb-4 sm:mb-6 space-y-3">
        {/* Ligne 1 : Hamburger + Titre + Bouton "+" */}
        <div className="flex items-center justify-between w-full gap-2">
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
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate min-w-0">Prêts Immobiliers</h1>
            <div className="flex-shrink-0">
              <button
                onClick={handleCreate}
                className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label="Nouveau prêt"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Ligne 2 : Description */}
        <p className="text-sm sm:text-base text-gray-600">Gérez vos prêts et suivez leur amortissement</p>
      </div>

      <div className="p-6 space-y-6">
        {mode === 'app-shell' && (
          <>
            <LoansPriorityActionsCard
              rows={loanPilotagePriorityRows}
              isLoading={loading || isLoadingCashflowMap}
              onAnalyze={handleRowClick}
              onViewDetail={handleRowClick}
              formatCurrency={formatCurrency}
            >
              <div className="border-t border-red-200/80 pt-3">
                <LoansPortfolioPilotageBar
                  compact
                  negativeCashflowPropertyCount={portfolioPilotageIndex.negativeCashflowPropertyCount}
                  heavyPaymentLoanCount={portfolioPilotageIndex.heavyPaymentLoanCount}
                  highRateLoanCount={portfolioPilotageIndex.highRateLoanCount}
                  activeFilter={pilotageQuickFilter}
                  onApplyFilter={handleApplyPilotageFilter}
                  onResetPilotage={handleResetPilotageOnly}
                  isLoading={loading || isLoadingCashflowMap}
                  negativeCashflowPropertyLinks={negativeCashflowPropertyLinks}
                />
              </div>
            </LoansPriorityActionsCard>

            <GlobalPilotageAlertsSection>
              <p className="text-sm text-gray-700">
                Analysez les biens en cashflow négatif, les mensualités lourdes et les taux élevés avant
                d&apos;ajuster le tableau.
              </p>
              {portfolioCashflowNetMoyenApresCredit != null && (
                <p className="text-xs text-gray-600 mt-2 tabular-nums">
                  Cashflow net moyen après crédit :{' '}
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(portfolioCashflowNetMoyenApresCredit)}
                  </span>
                </p>
              )}
            </GlobalPilotageAlertsSection>
          </>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Synthèse</h3>
          <LoansKpiBar
            kpis={kpis}
            activeFilter={activeKpiFilter}
            onFilterChange={handleKpiFilterChange}
            isLoading={kpisLoading}
            sustainabilityKpi={
              mode === 'app-shell'
                ? {
                    loading: loading || isLoadingCashflowMap,
                    value: portfolioCashflowNetMoyenApresCredit,
                  }
                : undefined
            }
          />
        </div>

        <GlobalPilotageDetailAccordion
          open={loansDetailOpen}
          onToggle={() => setLoansDetailOpen((v) => !v)}
          title="Détail complet (graphiques, filtres et tableau)"
        >
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <LoansCRDTimelineChart
              data={charts.crdTimeline}
              isLoading={chartsLoading}
            />
            <LoansByPropertyChart
              data={charts.crdByProperty}
              isLoading={chartsLoading}
              financingNavigation={mode === 'app-shell'}
            />
            <LoansTopCostlyChart
              data={charts.topCostlyLoans}
              isLoading={chartsLoading}
              onViewMore={() => setShowTopCostlyModal(true)}
              financingNavigation={mode === 'app-shell'}
            />
          </div>

          <LoansFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onResetFilters={handleResetFilters}
            properties={properties}
            periodStart={periodStart}
            periodEnd={periodEnd}
            onPeriodChange={handlePeriodChange}
            pilotageFilterLabel={
              mode === 'app-shell' && pilotageQuickFilter
                ? PILOTAGE_FILTER_LABELS[pilotageQuickFilter]
                : null
            }
            onClearPilotageFilter={mode === 'app-shell' ? handleResetPilotageOnly : undefined}
          />

        {/* Tableau */}
        <div className="bg-white rounded-xl border border-gray-200">
          {/* Header du tableau */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Prêts immobiliers</h3>
              <div className="text-sm text-gray-600">
                {loansForTable.length} prêt{loansForTable.length > 1 ? 's' : ''} au total
              </div>
            </div>

            {/* Sélection multiple */}
            {selectedLoanIds.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  {selectedLoanIds.length} prêt(s) sélectionné(s)
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteMultiple}
                  className="ml-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Archiver la sélection
                </Button>
              </div>
            )}
          </div>

          {/* Vue mobile : Cards */}
          <div className="lg:hidden space-y-3 p-4">
            {loading && loans.length === 0 ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                </div>
              ))
            ) : loansForTable.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                Aucun prêt trouvé
              </div>
            ) : (
              <>
                {loansForTable.slice(0, mobileLimit).map((loan) => (
                  <div
                    key={loan.id}
                    onClick={() => handleRowClick(loan)}
                    className="bg-white border rounded-lg p-4 shadow-sm transition-all hover:shadow-md cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={selectedLoanIds.includes(loan.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectLoan(loan.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 flex-shrink-0"
                          />
                          <h4 className="text-sm font-semibold text-gray-900 truncate">{loan.label}</h4>
                        </div>
                        <div className="mb-2">{getStatusBadge(loan)}</div>
                        <div className="space-y-1 mb-2">
                          <div className="flex items-start justify-between gap-2 text-sm">
                            <span className="text-gray-600 shrink-0 pt-0.5">Bien:</span>
                            <div className="min-w-0 text-right">{renderPropertyColumn(loan, true)}</div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Mensualité:</span>
                            <span className="font-semibold text-cyan-600">
                              {formatCurrency(loan.loanDisplay?.monthlyPayment || loan.monthlyPayment || 0)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">CRD actuel:</span>
                            <span className="font-medium text-gray-900">
                              {formatCurrency(loan.loanDisplay?.currentCRD || 0)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Taux:</span>
                            <span className="text-gray-900">{loan.annualRatePct}%</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Durée restante:</span>
                            <span className="text-gray-900">{loan.loanDisplay?.remainingMonths ?? 0} mois</span>
                          </div>
                          {typeof loan.loanDisplay?.repaidPercent === 'number' && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">% remboursé:</span>
                              <span className="text-gray-900">{Math.round(loan.loanDisplay.repaidPercent)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0 w-full min-w-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          size="sm"
                          className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(loan);
                          }}
                        >
                          Analyser
                        </Button>
                        <button
                          type="button"
                          className={GLOBAL_ROW_DETAIL_LINK_CLASS}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(loan);
                          }}
                        >
                          Voir détail
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {loansForTable.length > mobileLimit && (
                  <button
                    onClick={() => setMobileLimit(prev => prev + 10)}
                    className="w-full py-2 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg border border-orange-200 transition-colors"
                  >
                    Voir plus ({loansForTable.length - mobileLimit} restantes)
                  </button>
                )}
              </>
            )}
          </div>

          {/* Table Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            {isUI2Active ? (
              // Version UI2 avec TableV2
              <TableV2>
                <TableHeaderV2>
                  <tr>
                    <TableHeaderCellV2>
                      <input
                        type="checkbox"
                        checked={selectedLoanIds.length === loansForTable.length && loansForTable.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </TableHeaderCellV2>
                    <TableHeaderCellV2>Libellé</TableHeaderCellV2>
                    <TableHeaderCellV2>Bien</TableHeaderCellV2>
                    <TableHeaderCellV2 className="text-right">Mensualité</TableHeaderCellV2>
                    <TableHeaderCellV2 className="text-right">CRD Actuel</TableHeaderCellV2>
                    <TableHeaderCellV2 className="text-right">Taux</TableHeaderCellV2>
                    <TableHeaderCellV2 className="text-right">Durée restante</TableHeaderCellV2>
                    <TableHeaderCellV2 className="text-center">Statut</TableHeaderCellV2>
                    <TableHeaderCellV2 className="text-center whitespace-nowrap">Action</TableHeaderCellV2>
                  </tr>
                </TableHeaderV2>
                <TableBodyV2>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={9} className="px-4 py-3">
                          <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  ) : loansForTable.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                        Aucun prêt trouvé
                      </td>
                    </tr>
                  ) : (
                    loansForTable.map((loan) => (
                      <TableRowV2
                        key={loan.id}
                        onClick={() => handleRowClick(loan)}
                        onHoverInfo={getHoverInfo(loan)}
                      >
                        <TableCellV2 onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedLoanIds.includes(loan.id)}
                            onChange={() => handleSelectLoan(loan.id)}
                            className="rounded border-gray-300"
                          />
                        </TableCellV2>
                        <TableCellV2>
                          <div className="font-medium text-gray-900">{loan.label}</div>
                        </TableCellV2>
                        <TableCellV2>
                          <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out text-sm">
                            {renderPropertyColumn(loan)}
                          </div>
                        </TableCellV2>
                        <TableCellV2 className="text-right">
                          <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out font-semibold text-cyan-600">
                            {formatCurrency(loan.loanDisplay?.monthlyPayment || loan.monthlyPayment || 0)}
                          </div>
                        </TableCellV2>
                        <TableCellV2 className="text-right">
                          <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out font-medium text-gray-900">
                            {formatCurrency(loan.loanDisplay?.currentCRD || 0)}
                          </div>
                        </TableCellV2>
                        <TableCellV2 className="text-right">
                          <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out text-sm text-gray-600">
                            {loan.annualRatePct}%
                          </div>
                        </TableCellV2>
                        <TableCellV2 className="text-right">
                          <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out text-sm text-gray-600">
                            {loan.loanDisplay?.remainingMonths ?? 0} mois
                          </div>
                        </TableCellV2>
                        <TableCellV2 className="text-center">
                          <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                            {getStatusBadge(loan)}
                          </div>
                        </TableCellV2>
                        <TableCellV2 className="text-center align-top" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col items-center max-w-[9rem] mx-auto py-0.5">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-8 w-full max-w-[8rem] bg-orange-600 hover:bg-orange-700 text-white text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(loan);
                              }}
                            >
                              Analyser
                            </Button>
                            <button
                              type="button"
                              className={`${GLOBAL_ROW_DETAIL_LINK_CLASS} !text-[11px]`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(loan);
                              }}
                            >
                              Voir détail
                            </button>
                          </div>
                        </TableCellV2>
                      </TableRowV2>
                    ))
                  )}
                </TableBodyV2>
              </TableV2>
            ) : (
              // Version normale avec table HTML
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedLoanIds.length === loansForTable.length && loansForTable.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Libellé</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bien</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mensualité</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CRD Actuel</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taux</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Durée restante</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={9} className="px-4 py-3">
                          <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  ) : loansForTable.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                        Aucun prêt trouvé
                      </td>
                    </tr>
                  ) : (
                    loansForTable.map((loan) => (
                      <tr
                        key={loan.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleRowClick(loan)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedLoanIds.includes(loan.id)}
                            onChange={() => handleSelectLoan(loan.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{loan.label}</td>
                        <td className="px-4 py-3 text-sm">{renderPropertyColumn(loan)}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-cyan-600">
                          {formatCurrency(loan.loanDisplay?.monthlyPayment || loan.monthlyPayment || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {formatCurrency(loan.loanDisplay?.currentCRD || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{loan.annualRatePct}%</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {loan.loanDisplay?.remainingMonths ?? 0} mois
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(loan)}
                        </td>
                        <td className="px-4 py-3 text-center align-top" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col items-center max-w-[9rem] mx-auto py-0.5">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-8 w-full max-w-[8rem] bg-orange-600 hover:bg-orange-700 text-white text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(loan);
                              }}
                            >
                              Analyser
                            </Button>
                            <button
                              type="button"
                              className={`${GLOBAL_ROW_DETAIL_LINK_CLASS} !text-[11px]`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(loan);
                              }}
                            >
                              Voir détail
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
        </GlobalPilotageDetailAccordion>
      </div>

      {/* Modal de formulaire */}
      <LoanModalV2
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        properties={properties}
        initialData={selectedLoan || undefined}
        onSubmit={handleFormSubmit}
        mode={modalMode === 'duplicate' ? 'create' : modalMode}
        lockPropertyId={false} // ✅ Page globale : permettre de choisir le bien
      />

      {/* Drawer lecture seule */}
      <LoanDrawer
        loan={selectedLoan}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />

      {/* Modal suppression simple */}
      <ConfirmDeleteLoanModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        loanId={loanToDelete?.id || ''}
        loanLabel={loanToDelete?.label}
      />

      {/* Modal suppression multiple */}
      <ConfirmDeleteMultipleLoansModal
        isOpen={showDeleteMultipleModal}
        onClose={() => setShowDeleteMultipleModal(false)}
        onConfirm={handleConfirmDeleteMultiple}
        loanIds={selectedLoanIds}
      />

      {/* Modal Top 5 Coûteux */}
      <TopCostlyLoansModal
        isOpen={showTopCostlyModal}
        onClose={() => setShowTopCostlyModal(false)}
        data={charts.topCostlyLoans}
        financingNavigation={mode === 'app-shell'}
      />
    </div>
  );
}
