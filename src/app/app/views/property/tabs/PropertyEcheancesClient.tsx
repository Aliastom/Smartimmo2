'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { notify2 } from '@/lib/notify2';
import { Plus, Edit, Trash2, CheckCircle, Home, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Pagination } from '@/components/ui/Pagination';
import { usePropertyHeaderActions } from '@/app/biens/[id]/PropertyHeaderActionsContext';
import { PropertyEcheancesHero } from '@/components/echeances/PropertyEcheancesHero';
import EcheancesFilters from '@/components/echeances/EcheancesFilters';
import { EcheanceModal } from '@/components/echeances/EcheanceModal';
import { EcheanceDrawer } from '@/components/echeances/EcheanceDrawer';
import { ConfirmDeleteEcheanceModal } from '@/components/echeances/ConfirmDeleteEcheanceModal';
import { ConfirmDeleteMultipleEcheancesModal } from '@/components/echeances/ConfirmDeleteMultipleEcheancesModal';
import { useEcheancesData } from '@/features/echeances/hooks/useEcheancesData';
import {
  sumProjected12Months,
  temporalBadgeMeta,
  generationBadgeMeta,
  getStatutGeneration,
} from '@/lib/echeances/echeanceCashflowHelpers';
import { resolveNatureCodeForEcheance } from '@/lib/echeances/echeanceTypeMigration';
import {
  buildCoveredOccurrenceDates,
  pickPrimaryEcheanceForPilotage,
  countEcheancesWithUncoveredOccurrence,
  getNextUncoveredOccurrenceInfo,
  getNextUncoveredOccurrenceDate,
  listTheoreticalOccurrenceDates,
  filterLinksForOccurrence,
} from '@/lib/echeances/echeanceOccurrences';
import {
  computeCoverage,
  transactionToCoverageInput,
  type CoverageResult,
} from '@/lib/echeances/echeanceCoverage';
import {
  computeQualityScore,
  computeAlerts,
  computeSuggestions,
  computePropertyManagementScore,
} from '@/lib/echeances/echeanceInsights';
import { getLinkedTransactions } from '@/lib/echeances/echeanceTransactionLinkClient';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import {
  SUGGESTION_DATE_TOLERANCE_DAYS,
  SUGGESTION_AMOUNT_TOLERANCE_PERCENT,
  COVERAGE_ECART_DISPLAY_THRESHOLD_EUR,
  COVERAGE_OVER_LINKED_RATIO_CRITICAL,
} from '@/lib/echeances/echeanceLinkConfig';
import { cn } from '@/utils/cn';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getTenantRepositoryOffline } from '@/lib/offline/repositories/TenantRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { navigateToView } from '@/utils/appShellNavigation';
import { createEcheanceServiceWithMode } from '@/domain/services/echeanceServiceFactory';
import {
  EcheanceRecurrente,
  PERIODICITE_LABELS,
  getNatureBadgeClass,
  getCategoryLabelForEcheance,
} from '@/types/echeance';
import { getNatureLabelForEcheance } from '@/lib/echeances/echeanceDisplayHelpers';
import { useEcheanceReferential } from '@/features/echeances/hooks/useEcheanceReferential';
import { EcheanceFormSchema } from '@/lib/validations/echeance';
import Link from 'next/link';
import { TransactionModal } from '@/components/transactions/TransactionModalV2';
import { createTransactionServiceWithMode } from '@/domain/services/transactionServiceFactory';
import {
  fetchAndMergeLinksForProperty,
  getLinksByEcheanceIds,
  pruneOrphanEcheanceLinksForEcheanceIds,
  addEcheanceTransactionLink,
  type EcheanceTransactionLinkRow,
} from '@/lib/echeances/echeanceTransactionLinkClient';
import { buildTransactionFromEcheance } from '@/lib/echeances/echeanceTransactionPrefill';
import type { TransactionFormData } from '@/lib/validations/transaction';

interface PropertyEcheancesClientProps {
  propertyId: string;
  propertyName: string;
}

interface Filters {
  search: string;
  type: string;
  natureCode?: string;
  sens: string;
  periodicite: string;
  leaseId: string;
  recuperable: string;
  isActive: string; // ✅ Ajouter le filtre actif/inactif
}

export default function PropertyEcheancesClient({ propertyId, propertyName }: PropertyEcheancesClientProps) {
  const { organizationId } = useCurrentOrganization();
  const { natures, categories, getDefaultCategoryId } = useEcheanceReferential('app-shell');
  
  // ✅ CORRECTION: Mémoriser les propriétés pour la modale pour éviter les re-renders inutiles
  // et s'assurer que le nom est toujours à jour (même si propertyName change après le mount)
  const propertiesForModal = useMemo(() => {
    // Ne pas créer l'option si le nom n'est pas encore chargé
    if (!propertyName || propertyName === 'Chargement...') {
      return [];
    }
    return [{ id: propertyId, name: propertyName }];
  }, [propertyId, propertyName]);

  // États des modals et drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedEcheance, setSelectedEcheance] = useState<EcheanceRecurrente | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [echeanceToDelete, setEcheanceToDelete] = useState<EcheanceRecurrente | null>(null);

  // États pour la sélection multiple
  const [selectedEcheanceIds, setSelectedEcheanceIds] = useState<string[]>([]);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);

  const [echeanceLinksById, setEcheanceLinksById] = useState<Map<string, EcheanceTransactionLinkRow[]>>(new Map());
  const [coverageByEcheanceId, setCoverageByEcheanceId] = useState<Map<string, CoverageResult>>(new Map());
  const [coveredOccurrenceByEcheanceId, setCoveredOccurrenceByEcheanceId] = useState<Map<string, Set<string>>>(
    new Map()
  );
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [echeanceForTx, setEcheanceForTx] = useState<EcheanceRecurrente | null>(null);
  const [txModalPrefill, setTxModalPrefill] = useState<Awaited<ReturnType<typeof buildTransactionFromEcheance>> | null>(
    null
  );
  const pendingOccurrenceYmdRef = useRef<string | null>(null);

  // États pour la période (format YYYY) - Par défaut : 5 années à venir
  const now = new Date();
  const currentYear = now.getFullYear();
  const [periodStart, setPeriodStart] = useState(currentYear.toString());
  const [periodEnd, setPeriodEnd] = useState((currentYear + 4).toString());
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('yearly');

  /** Filtres rapides tableau */
  const [quickScope, setQuickScope] = useState<
    '' | 'active' | 'inactive' | 'upcoming' | 'overdue' | 'charges' | 'revenus' | 'recuperables'
  >('');
  const [sortKey, setSortKey] = useState<'date' | 'montant' | 'natureCode' | 'actif'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // États des filtres (sans propertyId car fixe)
  const [filters, setFilters] = useState<Filters>({
    search: '',
    type: '',
    natureCode: '',
    sens: '',
    periodicite: '',
    leaseId: '',
    recuperable: '',
    isActive: '', // ✅ Ajouter le filtre actif/inactif
  });

  // État pour la pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 30, // ✅ Desktop: 30 items par page (comme Transactions et Documents)
  });

  // État pour la limite mobile (cards)
  const [mobileLimit, setMobileLimit] = useState(3);

  // ✅ Mémoriser les filters pour éviter les re-renders infinis
  const filtersForHook = useMemo(() => ({
    propertyId, // ✅ Filtrer par bien
    search: '',
    type: '',
    sens: '',
    periodicite: '',
    leaseId: '',
    recuperable: '',
  }), [propertyId]);

  // ✅ APP-SHELL: Charger les échéances depuis IndexedDB avec filtre propertyId
  const {
    allEcheances, // ✅ Toutes les échéances non filtrées (pour filtrage en mémoire)
    properties,
    leases: allLeases,
    totalCount,
    loading: isLoading,
  } = useEcheancesData({
    mode: 'app-shell',
    scope: 'property', // ✅ Scope property pour filtrer les events
    propertyId, // ✅ Passer propertyId pour filtrer les events
    filters: filtersForHook,
    activeKpiFilter: null,
    page: 1, // ✅ Pas de pagination côté hook, on fait tout en mémoire
    pageSize: 10000, // ✅ Charger toutes les échéances
  });

  // ✅ APP-SHELL: Filtrer les échéances en mémoire selon les filtres UI
  const filteredEcheances = useMemo(() => {
    // ✅ Note: allEcheances est déjà filtré par propertyId au niveau IndexedDB
    if (!allEcheances || allEcheances.length === 0) {
      return [];
    }
    let filtered = allEcheances.filter(echeance => {
      // ⚠️ CORRECTION: Ne plus exclure les échéances désactivées par défaut
      // Le toggle "Actif" sert à désactiver/activer une échéance, pas à la supprimer
      // Les échéances désactivées (isActive: false) doivent être visibles si le filtre est sur "Toutes"
      // 
      // Note: Le soft delete réel devrait utiliser un autre mécanisme (ex: champ deletedAt ou méthode deleteEcheance)
      // Pour l'instant, on affiche toutes les échéances (actives et inactives) quand le filtre est sur "Toutes"

      // Filtre de recherche
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!echeance.label.toLowerCase().includes(searchLower)) return false;
      }

      // Filtre par nature (référentiel métier)
      if (filters.natureCode) {
        const effectiveNature = resolveNatureCodeForEcheance(echeance);
        if (effectiveNature !== filters.natureCode) return false;
      }
      // Filtre de type (legacy)
      if (filters.type && !filters.natureCode && echeance.type !== filters.type) return false;

      // Filtre de sens
      if (filters.sens && echeance.sens !== filters.sens) return false;

      // Filtre de périodicité
      if (filters.periodicite && echeance.periodicite !== filters.periodicite) return false;

      // Filtre de bail
      if (filters.leaseId && echeance.Lease?.id !== filters.leaseId) return false;

      // Filtre récupérable
      if (filters.recuperable === 'true' && !echeance.recuperable) return false;
      if (filters.recuperable === 'false' && echeance.recuperable) return false;

      // ✅ Filtre actif/inactif (explicite uniquement)
      // Par défaut, on affiche TOUTES les échéances (actives ET inactives)
      if (filters.isActive === 'active' && !echeance.isActive) return false;
      if (filters.isActive === 'inactive' && echeance.isActive) return false;

      return true;
    });

    return filtered;
  }, [allEcheances, filters]);

  const metaById = useMemo(() => {
    const m = new Map<string, ReturnType<typeof getNextUncoveredOccurrenceInfo>>();
    const ref = new Date();
    for (const e of allEcheances || []) {
      const covered = coveredOccurrenceByEcheanceId.get(e.id) ?? new Set<string>();
      m.set(e.id, getNextUncoveredOccurrenceInfo(e, covered, ref));
    }
    return m;
  }, [allEcheances, coveredOccurrenceByEcheanceId]);

  const filteredWithQuick = useMemo(() => {
    let list = filteredEcheances;
    if (quickScope === 'active') list = list.filter((e) => e.isActive);
    else if (quickScope === 'inactive') list = list.filter((e) => !e.isActive);
    else if (quickScope === 'charges') list = list.filter((e) => e.sens === 'DEBIT');
    else if (quickScope === 'revenus') list = list.filter((e) => e.sens === 'CREDIT');
    else if (quickScope === 'recuperables') list = list.filter((e) => e.recuperable && e.sens === 'DEBIT');
    else if (quickScope === 'overdue') {
      list = list.filter((e) => {
        const info = metaById.get(e.id);
        return e.isActive && info?.temporalStatus === 'echue';
      });
    } else if (quickScope === 'upcoming') {
      list = list.filter((e) => {
        const info = metaById.get(e.id);
        if (!e.isActive || !info) return false;
        return info.temporalStatus === 'a_venir';
      });
    }
    return list;
  }, [filteredEcheances, quickScope, metaById]);

  const sortedForTable = useMemo(() => {
    const arr = [...filteredWithQuick];
    const dir = sortDir === 'asc' ? 1 : -1;
    const dateKey = (e: EcheanceRecurrente) => {
      const info = metaById.get(e.id);
      if (!e.isActive) return '9999-12-31';
      if (!info || info.temporalStatus === 'desactive') return '9999-12-30';
      return info.nextDate || info.displayDate || '9999-12-29';
    };
    arr.sort((a, b) => {
      let c = 0;
      if (sortKey === 'date') c = dateKey(a).localeCompare(dateKey(b));
      else if (sortKey === 'montant') c = a.montant - b.montant;
      else if (sortKey === 'natureCode') {
        const na = resolveNatureCodeForEcheance(a);
        const nb = resolveNatureCodeForEcheance(b);
        c = na.localeCompare(nb);
      } else c = (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1);
      return c * dir;
    });
    return arr;
  }, [filteredWithQuick, sortKey, sortDir, metaById]);

  const tableTotal = sortedForTable.length;
  const tablePages = Math.max(1, Math.ceil(tableTotal / pagination.limit));
  const pagedRows = useMemo(() => {
    const start = (pagination.page - 1) * pagination.limit;
    return sortedForTable.slice(start, start + pagination.limit);
  }, [sortedForTable, pagination.page, pagination.limit]);

  // ✅ APP-SHELL: Charger les baux depuis IndexedDB avec les informations des locataires
  const [leases, setLeases] = useState<Array<{ id: string; propertyId: string; type: string; status: string; tenantName?: string }>>([]);
  useEffect(() => {
    if (!organizationId) return;
    
    const loadLeases = async () => {
      try {
        const leaseRepo = getLeaseRepositoryOffline();
        const tenantRepo = getTenantRepositoryOffline();
        const allLeasesData = await leaseRepo.getAll(organizationId, {});
        // Filtrer par propertyId
        const propertyLeases = allLeasesData.filter(lease => lease.propertyId === propertyId);
        
        // Charger les locataires pour chaque bail
        const leasesWithTenants = await Promise.all(
          propertyLeases.map(async (lease) => {
            try {
              const tenant = await tenantRepo.getById(lease.tenantId, organizationId);
              const tenantName = tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : undefined;
              return {
                id: lease.id,
                propertyId: lease.propertyId,
                type: lease.type,
                status: lease.status,
                tenantName,
              };
            } catch (error) {
              console.error(`Erreur lors du chargement du locataire pour le bail ${lease.id}:`, error);
              return {
                id: lease.id,
                propertyId: lease.propertyId,
                type: lease.type,
                status: lease.status,
              };
            }
          })
        );
        
        setLeases(leasesWithTenants);
      } catch (error) {
        console.error('Erreur lors du chargement des baux:', error);
      }
    };

    loadLeases();
  }, [organizationId, propertyId]); // ✅ Chargé une seule fois, pas rechargé à chaque filtre

  const projected = useMemo(() => sumProjected12Months(allEcheances || []), [allEcheances]);
  const echuesCount = useMemo(() => {
    let n = 0;
    const ref = new Date();
    for (const e of allEcheances || []) {
      if (!e.isActive) continue;
      const covered = coveredOccurrenceByEcheanceId.get(e.id) ?? new Set<string>();
      const info = getNextUncoveredOccurrenceInfo(e, covered, ref);
      if (info?.temporalStatus === 'echue') n++;
    }
    return n;
  }, [allEcheances, coveredOccurrenceByEcheanceId]);
  const primaryPick = useMemo(
    () => pickPrimaryEcheanceForPilotage(allEcheances || [], coveredOccurrenceByEcheanceId, new Date()),
    [allEcheances, coveredOccurrenceByEcheanceId]
  );
  const reloadEcheanceLinks = useCallback(async () => {
    if (!organizationId || !propertyId || !(allEcheances?.length ?? 0)) {
      setEcheanceLinksById(new Map());
      setCoverageByEcheanceId(new Map());
      setCoveredOccurrenceByEcheanceId(new Map());
      return;
    }
    await fetchAndMergeLinksForProperty(organizationId, propertyId);
    const ids = (allEcheances || []).map((e) => e.id);
    await pruneOrphanEcheanceLinksForEcheanceIds(ids, organizationId);
    const m = await getLinksByEcheanceIds(ids);
    setEcheanceLinksById(m);

    const txRepo = getTransactionRepositoryOffline();
    const refNow = new Date();
    const coveredMap = new Map<string, Set<string>>();
    const coverageMap = new Map<string, CoverageResult>();

    for (const e of allEcheances || []) {
      const links = m.get(e.id) ?? [];
      const theoretical = listTheoreticalOccurrenceDates(e, refNow);
      if (theoretical.length === 0) {
        coveredMap.set(e.id, new Set());
        const exp = Math.abs(Number(e.montant));
        coverageMap.set(e.id, {
          totalLinked: 0,
          linkedCount: 0,
          expectedAmount: exp,
          ecartAbsolu: -exp,
          ecartRelatif: exp > 0 ? -1 : 0,
          statut: 'a_generer',
        });
        continue;
      }
      const txDateById = new Map<string, string>();
      for (const l of links) {
        const t = await txRepo.getById(l.transactionId, organizationId);
        if (t?.date) {
          const d = typeof t.date === 'string' ? t.date : (t.date as Date).toISOString().slice(0, 10);
          txDateById.set(l.transactionId, d);
        }
      }
      const covered = buildCoveredOccurrenceDates(
        theoretical,
        links,
        txDateById,
        SUGGESTION_DATE_TOLERANCE_DAYS
      );
      coveredMap.set(e.id, covered);

      const nextUnc = getNextUncoveredOccurrenceDate(e, covered, refNow);
      if (!nextUnc) {
        const txs = await getLinkedTransactions(e.id, organizationId);
        const inputs = txs.map((t) => transactionToCoverageInput(t.amount, t.nature));
        const cov = computeCoverage(e.montant, e.sens as 'CREDIT' | 'DEBIT', inputs, undefined, e.type);
        coverageMap.set(e.id, { ...cov, statut: 'generee' });
        continue;
      }

      const linksForOcc = filterLinksForOccurrence(nextUnc, links, txDateById, SUGGESTION_DATE_TOLERANCE_DAYS);
      const txsForOcc: Awaited<ReturnType<typeof getLinkedTransactions>> = [];
      for (const l of linksForOcc) {
        const t = await txRepo.getById(l.transactionId, organizationId);
        if (t) txsForOcc.push(t);
      }
      const inputs = txsForOcc.map((t) => transactionToCoverageInput(t.amount, t.nature));
      const cov = computeCoverage(e.montant, e.sens as 'CREDIT' | 'DEBIT', inputs, undefined, e.type);
      coverageMap.set(e.id, cov);
    }

    setCoveredOccurrenceByEcheanceId(coveredMap);
    setCoverageByEcheanceId(coverageMap);
  }, [organizationId, propertyId, allEcheances]);

  useEffect(() => {
    reloadEcheanceLinks();
  }, [reloadEcheanceLinks]);

  useEffect(() => {
    const onRefresh = () => {
      reloadEcheanceLinks();
    };
    window.addEventListener('echeanceLinks:refresh', onRefresh);
    window.addEventListener('sync:refresh', onRefresh);
    return () => {
      window.removeEventListener('echeanceLinks:refresh', onRefresh);
      window.removeEventListener('sync:refresh', onRefresh);
    };
  }, [reloadEcheanceLinks]);

  const countAGenerer = useMemo(
    () => countEcheancesWithUncoveredOccurrence(allEcheances || [], coveredOccurrenceByEcheanceId, new Date()),
    [allEcheances, coveredOccurrenceByEcheanceId]
  );

  const qualityScore = useMemo(() => {
    const active = (allEcheances || []).filter((e) => e.isActive);
    const items = active.map((e) => ({
      statut: coverageByEcheanceId.get(e.id)?.statut ?? (echeanceLinksById.get(e.id)?.length ? 'generee' : 'a_generer'),
    }));
    return computeQualityScore(items);
  }, [allEcheances, coverageByEcheanceId, echeanceLinksById]);

  const echeancesWithCoverage = useMemo(() => {
    const ref = new Date();
    return (allEcheances || []).map((e) => {
      const covered = coveredOccurrenceByEcheanceId.get(e.id) ?? new Set<string>();
      const info = getNextUncoveredOccurrenceInfo(e, covered, ref);
      const linkedCount = echeanceLinksById.get(e.id)?.length ?? 0;
      const coverage = coverageByEcheanceId.get(e.id);
      return {
        id: e.id,
        type: e.type,
        label: e.label,
        montant: e.montant,
        sens: e.sens,
        isActive: e.isActive,
        nextOccurrenceDate: info?.displayDate ?? info?.nextDate ?? null,
        coverage,
        linkedCount,
      };
    });
  }, [allEcheances, coverageByEcheanceId, echeanceLinksById, coveredOccurrenceByEcheanceId]);

  const alerts = useMemo(() => computeAlerts(echeancesWithCoverage), [echeancesWithCoverage]);
  const proactiveSuggestions = useMemo(() => computeSuggestions(echeancesWithCoverage), [echeancesWithCoverage]);
  const propertyScore = useMemo(() => {
    const items = (allEcheances || []).filter((e) => e.isActive).map((e) => ({
      statut: coverageByEcheanceId.get(e.id)?.statut ?? (echeanceLinksById.get(e.id)?.length ? 'generee' : 'a_generer'),
    }));
    return computePropertyManagementScore(items);
  }, [allEcheances, coverageByEcheanceId, echeanceLinksById]);

  const openCreateTxFromEcheance = useCallback(
    async (e: EcheanceRecurrente) => {
      const covered = coveredOccurrenceByEcheanceId.get(e.id) ?? new Set<string>();
      const ymd =
        getNextUncoveredOccurrenceDate(e, covered, new Date()) ||
        new Date().toISOString().slice(0, 10);
      pendingOccurrenceYmdRef.current = ymd;
      if (organizationId && e.propertyId && ymd) {
        try {
          const txRepo = getTransactionRepositoryOffline();
          const txs = await txRepo.getAll(organizationId, { propertyId: e.propertyId });
          const refDate = new Date(ymd + 'T12:00:00').getTime();
          const dayMs = 24 * 60 * 60 * 1000;
          const amountMin = Math.abs(e.montant) * (1 - SUGGESTION_AMOUNT_TOLERANCE_PERCENT);
          const amountMax = Math.abs(e.montant) * (1 + SUGGESTION_AMOUNT_TOLERANCE_PERCENT);
          const similar = txs.filter((t) => {
            const am = Math.abs(Number(t.amount));
            if (am < amountMin || am > amountMax) return false;
            const txDate = typeof t.date === 'string' ? new Date(t.date + 'T12:00:00').getTime() : new Date(t.date).getTime();
            const days = Math.abs((txDate - refDate) / dayMs);
            return days <= SUGGESTION_DATE_TOLERANCE_DAYS;
          });
          if (similar.length > 0) {
            const ok = window.confirm(
              'Une ou plusieurs transactions similaires (montant et date proches) existent peut-être déjà. Créer quand même une nouvelle transaction ?'
            );
            if (!ok) return;
          }
        } catch (_) {
          /* ignore */
        }
      }
      const prefill = await buildTransactionFromEcheance(e, ymd);
      setEcheanceForTx(e);
      setTxModalPrefill(prefill);
      setTxModalOpen(true);
    },
    [organizationId, coveredOccurrenceByEcheanceId]
  );

  const handleTxModalSubmit = useCallback(
    async (data: TransactionFormData & Record<string, unknown>) => {
      if (!organizationId || !echeanceForTx) throw new Error('Données manquantes');
      const svc = createTransactionServiceWithMode('app-shell');
      const paidAt = (data.paidAt as string) || (data.paymentDate as string);
      if (!paidAt?.trim()) throw new Error('La date de paiement est obligatoire.');
      const d = new Date(data.date as string);
      const accountingMonth =
        (data.accountingMonth as string) ||
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const pm = data.periodMonth != null ? String(data.periodMonth).padStart(2, '0') : String(d.getMonth() + 1).padStart(2, '0');
      const py = (data.periodYear as number) || d.getFullYear();
      const result = await svc.createTransaction({
        organizationId,
        propertyId: data.propertyId,
        leaseId: (data.leaseId as string) || null,
        categoryId: data.categoryId as string,
        nature: (data.nature as string) || undefined,
        label: (data.label as string) || echeanceForTx.label,
        amount: Number(data.amount),
        date: data.date as string,
        paidAt,
        accountingMonth,
        periodMonth: parseInt(pm, 10),
        periodYear: py,
        monthsCovered: (data.monthsCovered as number) || 1,
        skipAutoCommissions: true,
        method: (data.method as string) || (data.paymentMethod as string) || 'virement',
      });
      const occ =
        pendingOccurrenceYmdRef.current ||
        (typeof data.date === 'string' ? data.date.slice(0, 10) : null);
      pendingOccurrenceYmdRef.current = null;
      await addEcheanceTransactionLink({
        organizationId,
        echeanceId: echeanceForTx.id,
        transactionId: result.transaction.id,
        occurrenceDate: occ,
      });
      window.dispatchEvent(new CustomEvent('echeanceLinks:refresh', { detail: { propertyId } }));
      window.dispatchEvent(
        new CustomEvent('deadlines:refresh', { detail: { scope: 'property', propertyId, reason: 'tx-link' } })
      );
      return {
        totalCreated: result.totalCreated,
        successMessage: 'Transaction créée et liée à l’échéance',
      };
    },
    [organizationId, echeanceForTx, propertyId]
  );

  useEffect(() => {
    setPagination((prev) => ({
      ...prev,
      total: tableTotal,
      pages: tablePages,
      page: Math.min(prev.page, tablePages),
    }));
  }, [tableTotal, tablePages]);

  // ✅ APP-SHELL: Gestion des filtres (en mémoire uniquement, pas de fetch)
  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({
      search: '',
      type: '',
      natureCode: '',
      sens: '',
      periodicite: '',
      leaseId: '',
      recuperable: '',
      isActive: '',
    });
    setQuickScope('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const toggleSort = (key: 'date' | 'montant' | 'natureCode' | 'actif') => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'date' || key === 'actif' ? 'asc' : 'desc');
    }
    setPagination((p) => ({ ...p, page: 1 }));
  };

  // Handlers de période
  const handlePeriodChange = (start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  // CRUD Handlers
  const handleCreate = useCallback(() => {
    setSelectedEcheance(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const handleEdit = (echeance: EcheanceRecurrente) => {
    setSelectedEcheance(echeance);
    setModalMode('edit');
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDuplicate = (echeance: EcheanceRecurrente) => {
    setSelectedEcheance(echeance);
    setModalMode('duplicate');
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDelete = (echeance: EcheanceRecurrente) => {
    setEcheanceToDelete(echeance);
    setShowDeleteModal(true);
    setIsDrawerOpen(false);
  };

  const handleRowClick = (echeance: EcheanceRecurrente) => {
    setSelectedEcheance(echeance);
    setIsDrawerOpen(true);
  };

  // ✅ APP-SHELL: Soumission via Domain Service (local-first)
  const handleFormSubmit = async (data: EcheanceFormSchema) => {
    if (!organizationId) {
      notify2.error('OrganizationId manquant');
      return;
    }

    try {
      const echeanceService = createEcheanceServiceWithMode('app-shell');
      
      const common = {
        label: data.label,
        natureCode: data.natureCode,
        defaultCategoryId: data.categoryId || null,
        periodicite: data.periodicite,
        montant: data.montant,
        sens: data.sens,
        recuperable: data.recuperable,
        propertyId: data.propertyId || propertyId,
        leaseId: data.leaseId || null,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : null,
        isActive: data.isActive,
      };

      if (modalMode === 'edit' && selectedEcheance?.id) {
        await echeanceService.updateEcheance(selectedEcheance.id, organizationId, common);
      } else {
        await echeanceService.createEcheance({
          organizationId,
          ...common,
        });
      }
      
      // ✅ Émettre UNIQUEMENT un événement ciblé (pas de sync immédiate, pas de fetch bloquant)
      window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'crud' } 
      }));
      
      setIsModalOpen(false);
      notify2.success(modalMode === 'edit' ? 'Échéance modifiée avec succès' : 'Échéance créée avec succès');
    } catch (error: any) {
      console.error('Erreur lors de la création/modification de l\'échéance:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de la sauvegarde');
    }
  };

  // ✅ APP-SHELL: Désactivation ou Suppression via Domain Service (local-first)
  const handleConfirmDelete = async (action: 'deactivate' | 'delete') => {
    if (!organizationId || !echeanceToDelete) {
      notify2.error('Données manquantes pour l\'opération');
      return;
    }

    try {
      const echeanceService = createEcheanceServiceWithMode('app-shell');
      
      if (action === 'deactivate') {
        // ✅ APP-SHELL: Désactiver via service (même processus que le toggle)
        await echeanceService.updateEcheance(echeanceToDelete.id, organizationId, {
          isActive: false,
        });
        
        notify2.success('Échéance désactivée avec succès');
      } else {
        // ✅ APP-SHELL: Supprimer définitivement via service (hard delete, supprime de IndexedDB + crée pendingOp delete)
        await echeanceService.deleteEcheance(echeanceToDelete.id, organizationId, 'hard');
        
        notify2.success('Échéance supprimée avec succès');
      }
      
      // ✅ Émettre UNIQUEMENT un événement ciblé (pas de sync immédiate, pas de fetch bloquant)
      window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
        detail: { scope: 'property', propertyId, reason: action === 'delete' ? 'delete' : 'update' } 
      }));
      
      setShowDeleteModal(false);
      setEcheanceToDelete(null);
    } catch (error: any) {
      console.error('Erreur lors de l\'opération:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de l\'opération');
    }
  };

  // Calculer l'état des échéances sélectionnées pour afficher le bon bouton
  const selectedEcheancesState = useMemo(() => {
    if (selectedEcheanceIds.length === 0) return null;
    
    const selected = filteredEcheances.filter(e => selectedEcheanceIds.includes(e.id));
    const activeCount = selected.filter(e => e.isActive).length;
    const inactiveCount = selected.filter(e => !e.isActive).length;
    
    if (activeCount === selected.length) return 'all-active';
    if (inactiveCount === selected.length) return 'all-inactive';
    return 'mixed';
  }, [selectedEcheanceIds, filteredEcheances]);

  const handleActivateMultiple = async () => {
    if (!organizationId || selectedEcheanceIds.length === 0) {
      notify2.error('Aucune échéance sélectionnée');
      return;
    }

    const count = selectedEcheanceIds.length;

    try {
      const echeanceService = await createEcheanceServiceWithMode('app-shell');
      
      await Promise.all(
        selectedEcheanceIds.map(id => 
          echeanceService.updateEcheance(id, organizationId, {
            isActive: true,
          })
        )
      );
      
      window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'update_multiple' } 
      }));
      
      setSelectedEcheanceIds([]);
      notify2.success(`${count} échéance(s) activée(s) avec succès`);
    } catch (error: any) {
      console.error('Erreur lors de l\'activation:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de l\'activation');
    }
  };

  const handleDeactivateMultiple = async () => {
    if (!organizationId || selectedEcheanceIds.length === 0) {
      notify2.error('Aucune échéance sélectionnée');
      return;
    }

    const count = selectedEcheanceIds.length;

    try {
      const echeanceService = await createEcheanceServiceWithMode('app-shell');
      
      await Promise.all(
        selectedEcheanceIds.map(id => 
          echeanceService.updateEcheance(id, organizationId, {
            isActive: false,
          })
        )
      );
      
      // ✅ Émettre UNIQUEMENT un événement ciblé (pas de sync immédiate, pas de fetch bloquant)
      window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'update_multiple' } 
      }));
      
      setSelectedEcheanceIds([]);
      notify2.success(`${count} échéance(s) désactivée(s) avec succès`);
    } catch (error: any) {
      console.error('Erreur lors de la désactivation multiple:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de la désactivation');
    }
  };

  const handleConfirmDeleteMultiple = async (action: 'deactivate' | 'delete') => {
    if (!organizationId || selectedEcheanceIds.length === 0) {
      notify2.error('Aucune échéance sélectionnée');
      return;
    }

    const count = selectedEcheanceIds.length;

    try {
      const echeanceService = await createEcheanceServiceWithMode('app-shell');
      
      if (action === 'deactivate') {
        // ✅ APP-SHELL: Désactiver toutes les échéances sélectionnées
        await Promise.all(
          selectedEcheanceIds.map(id => 
            echeanceService.updateEcheance(id, organizationId, {
              isActive: false,
            })
          )
        );
        
        window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
          detail: { scope: 'property', propertyId, reason: 'update_multiple' } 
        }));
        
        setShowDeleteMultipleModal(false);
        setSelectedEcheanceIds([]);
        notify2.success(`${count} échéance(s) désactivée(s) avec succès`);
      } else {
        // ✅ APP-SHELL: Supprimer définitivement toutes les échéances sélectionnées (hard delete)
        // La sync serveur est découplée et se fera plus tard (auto ou manuel)
        await Promise.all(
          selectedEcheanceIds.map(id => 
            echeanceService.deleteEcheance(id, organizationId, 'hard')
          )
        );
        
        // ✅ Émettre UNIQUEMENT un événement ciblé (pas de sync immédiate, pas de fetch bloquant)
        window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
          detail: { scope: 'property', propertyId, reason: 'delete_multiple' } 
        }));
        
        setShowDeleteMultipleModal(false);
        setSelectedEcheanceIds([]);
        notify2.success(`${count} échéance(s) supprimée(s) avec succès`);
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'opération multiple:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de l\'opération');
    }
  };

  const handleDeleteMultiple = () => {
    if (selectedEcheanceIds.length === 0) {
      notify2.warning('Aucune échéance sélectionnée');
      return;
    }
    setShowDeleteMultipleModal(true);
  };

  // Sélection
  const handleSelectEcheance = (id: string) => {
    setSelectedEcheanceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedEcheanceIds(checked ? sortedForTable.map((e) => e.id) : []);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  const formatDate = (date: Date | string | null) => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const formatYmdFr = (ymd: string) =>
    new Date(ymd + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const heroToggleActive = async (e: EcheanceRecurrente) => {
    if (!organizationId) return;
    try {
      const echeanceService = createEcheanceServiceWithMode('app-shell');
      await echeanceService.updateEcheance(e.id, organizationId, { isActive: !e.isActive });
      window.dispatchEvent(
        new CustomEvent('deadlines:refresh', { detail: { scope: 'property', propertyId, reason: 'update' } })
      );
      notify2.success(!e.isActive ? 'Échéance activée' : 'Échéance désactivée');
    } catch (err: any) {
      notify2.error('Erreur', err?.message || 'Mise à jour impossible');
    }
  };

  const quickChip = (id: typeof quickScope, label: string) => (
    <button
      key={id || 'all'}
      type="button"
      onClick={() => {
        setQuickScope(id);
        setPagination((p) => ({ ...p, page: 1 }));
      }}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
        quickScope === id
          ? 'bg-orange-50 border-orange-300 text-orange-900'
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
      )}
    >
      {label}
    </button>
  );

  const { setActions } = usePropertyHeaderActions();

  // ✅ Utiliser useRef pour stabiliser setActions et éviter les boucles infinies
  const setActionsRef = React.useRef(setActions);
  setActionsRef.current = setActions;

  // Mémoriser les actions pour éviter les re-renders inutiles
  const headerActions = useMemo(() => (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCreate}
        className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none"
        aria-label="Nouvelle échéance"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        onClick={() => {
          // ✅ Utiliser navigateToView pour nettoyer les params property-scoped
          navigateToView('biens');
        }}
        className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none"
        aria-label="Liste des biens"
      >
        <Home className="h-4 w-4" />
      </button>
    </div>
  ), [handleCreate]);

  // Définir les actions dans le header
  // ✅ Utiliser setActionsRef pour éviter les re-renders causés par setActions qui change
  React.useEffect(() => {
    setActionsRef.current(headerActions);
    
    return () => {
      setActionsRef.current(null);
    };
  }, [headerActions]); // ✅ Seulement headerActions comme dépendance

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        {/* Bloc principal : prochaine échéance */}
        {isLoading ? (
          <div className="h-36 rounded-xl bg-gray-100 animate-pulse" />
        ) : primaryPick ? (
          <div className="space-y-3">
            {propertyScore.score > 0 && (
              <div className="flex justify-end">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border',
                    propertyScore.color === 'green' && 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    propertyScore.color === 'orange' && 'bg-amber-50 text-amber-800 border-amber-200',
                    propertyScore.color === 'red' && 'bg-red-50 text-red-800 border-red-200'
                  )}
                >
                  Score de gestion du bien : {propertyScore.score}/100
                </span>
              </div>
            )}
            <PropertyEcheancesHero
              echeance={primaryPick.echeance}
              info={primaryPick.info}
              linkedCount={coverageByEcheanceId.get(primaryPick.echeance.id)?.linkedCount ?? 0}
              coverage={coverageByEcheanceId.get(primaryPick.echeance.id)}
              natureLabel={getNatureLabelForEcheance(primaryPick.echeance, natures)}
              categoryLabel={getCategoryLabelForEcheance(primaryPick.echeance, categories, resolveNatureCodeForEcheance, getDefaultCategoryId)}
              hasUncoveredOccurrence={
                getNextUncoveredOccurrenceDate(
                  primaryPick.echeance,
                  coveredOccurrenceByEcheanceId.get(primaryPick.echeance.id) ?? new Set(),
                  new Date()
                ) != null
              }
              onViewDetail={() => {
                setSelectedEcheance(primaryPick.echeance);
                setIsDrawerOpen(true);
              }}
              onEdit={() => handleEdit(primaryPick.echeance)}
              onToggleActive={() => heroToggleActive(primaryPick.echeance)}
              onCreateTransaction={() => openCreateTxFromEcheance(primaryPick.echeance)}
              formatCurrency={formatCurrency}
              formatDateShort={formatYmdFr}
            />
          </div>
        ) : (allEcheances || []).some((e) => e.isActive) ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-5 py-6 text-center">
            <p className="text-emerald-900 text-sm font-medium">Aucune occurrence à couvrir (période analysée).</p>
            <p className="text-emerald-800/80 text-xs mt-1">Les échéances actives sont à jour ou hors fenêtre.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-5 py-8 text-center">
            <p className="text-gray-600 text-sm mb-3">Aucune échéance active à piloter pour ce bien.</p>
            <Button size="sm" onClick={handleCreate} className="bg-orange-600 hover:bg-orange-700">
              Créer une échéance
            </Button>
          </div>
        )}

        {/* KPI pilotage (5 indicateurs) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Charges à venir (12 mois)</p>
            <p className="text-xl font-semibold text-gray-900 tabular-nums mt-1">{formatCurrency(projected.chargesTotal)}</p>
          </div>
          <div
            className={cn(
              'rounded-xl border p-4 shadow-sm',
              projected.revenusTotal <= 0 ? 'border-gray-100 bg-gray-50/80' : 'border-gray-200 bg-white'
            )}
          >
            <p className={cn('text-xs font-medium uppercase tracking-wide', projected.revenusTotal <= 0 ? 'text-gray-400' : 'text-gray-500')}>
              Revenus à venir (12 mois)
            </p>
            <p
              className={cn(
                'text-xl font-semibold tabular-nums mt-1',
                projected.revenusTotal <= 0 ? 'text-gray-400' : 'text-emerald-700'
              )}
            >
              {formatCurrency(projected.revenusTotal)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Échues</p>
            <p
              className={cn(
                'text-xl font-semibold tabular-nums mt-1',
                echuesCount === 0 ? 'text-gray-400' : 'text-amber-600'
              )}
            >
              {echuesCount}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">À générer</p>
            <p
              className={cn(
                'text-xl font-semibold tabular-nums mt-1',
                countAGenerer === 0 ? 'text-gray-400' : 'text-amber-700'
              )}
            >
              {countAGenerer}
            </p>
            <p className="text-[10px] text-gray-500 mt-1 leading-tight">Avec au moins une occurrence non couverte</p>
          </div>
          <div
            className={cn(
              'rounded-xl border p-4 shadow-sm',
              qualityScore.color === 'green' && 'border-emerald-200 bg-emerald-50/50',
              qualityScore.color === 'orange' && 'border-amber-200 bg-amber-50/50',
              qualityScore.color === 'red' && 'border-red-200 bg-red-50/50',
              qualityScore.count === 0 && 'border-gray-100 bg-gray-50/80'
            )}
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Qualité de suivi</p>
            <p
              className={cn(
                'text-xl font-semibold tabular-nums mt-1',
                qualityScore.count === 0 && 'text-gray-400',
                qualityScore.color === 'green' && qualityScore.count > 0 && 'text-emerald-700',
                qualityScore.color === 'orange' && 'text-amber-700',
                qualityScore.color === 'red' && qualityScore.count > 0 && 'text-red-700'
              )}
            >
              {qualityScore.count === 0 ? '—' : `${qualityScore.scorePercent} %`}
            </p>
            <p className="text-[10px] text-gray-500 mt-1 leading-tight">
              {qualityScore.count === 0 ? 'Aucune échéance active' : 'Échéances bien suivies'}
            </p>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Alertes</p>
            <ul className="space-y-1 text-sm text-amber-900">
              {alerts.map((a, i) => (
                <li key={i}>⚠ {a.label}{a.detail ? ` — ${a.detail}` : ''}</li>
              ))}
            </ul>
          </div>
        )}

        {proactiveSuggestions.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions suggérées</p>
            <ul className="space-y-2">
              {proactiveSuggestions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-gray-700">{s.label}</span>
                  {s.action === 'create_transaction' && s.echeanceId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const e = (allEcheances || []).find((x) => x.id === s.echeanceId);
                        if (e) openCreateTxFromEcheance(e);
                      }}
                    >
                      Créer
                    </Button>
                  )}
                  {s.action === 'check_ecart' && s.echeanceId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const e = (allEcheances || []).find((x) => x.id === s.echeanceId);
                        if (e) {
                          setSelectedEcheance(e);
                          setIsDrawerOpen(true);
                        }
                      }}
                    >
                      Vérifier
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          {quickChip('', 'Toutes')}
          {quickChip('active', 'Actives')}
          {quickChip('inactive', 'Inactives')}
          {quickChip('upcoming', 'À venir')}
          {quickChip('overdue', 'Échues')}
          {quickChip('charges', 'Charges')}
          {quickChip('revenus', 'Revenus')}
          {quickChip('recuperables', 'Récupérables')}
        </div>

        <EcheancesFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onResetFilters={handleResetFilters}
          properties={[]}
          leases={leases}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onPeriodChange={handlePeriodChange}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          hidePropertyFilter={true} // Masquer le filtre Bien
        />

        {/* Tableau */}
        <div className="bg-white rounded-xl border border-gray-200">
          {/* Header du tableau */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Échéances de ce bien</h3>
              <div className="text-sm text-gray-600">
                {sortedForTable.length} échéance{sortedForTable.length > 1 ? 's' : ''}
              </div>
            </div>

            {/* Sélection multiple */}
            {selectedEcheanceIds.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-900">
                  {selectedEcheanceIds.length} échéance(s) sélectionnée(s)
                </span>
                <div className="flex gap-2 ml-auto">
                  {selectedEcheancesState === 'all-inactive' || selectedEcheancesState === 'mixed' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleActivateMultiple}
                      className="border-orange-200 text-orange-700 hover:bg-orange-100"
                    >
                      Activer la sélection
                    </Button>
                  ) : null}
                  {selectedEcheancesState === 'all-active' || selectedEcheancesState === 'mixed' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeactivateMultiple}
                      className="border-orange-200 text-orange-700 hover:bg-orange-100"
                    >
                      Désactiver la sélection
                    </Button>
                  ) : null}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteMultiple}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer la sélection
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Vue mobile : Cards */}
          <div className="lg:hidden space-y-3 p-4">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                </div>
              ))
            ) : sortedForTable.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                Aucune échéance pour ce bien
              </div>
            ) : (
              <>
                {sortedForTable.slice(0, mobileLimit).map((echeance) => {
                  const info = metaById.get(echeance.id);
                  const urg = info ? temporalBadgeMeta(info.temporalStatus) : temporalBadgeMeta('desactive');
                  return (
                  <div
                    key={echeance.id}
                    onClick={() => handleRowClick(echeance)}
                    className={cn(
                      'bg-white border rounded-lg p-4 shadow-sm transition-all hover:shadow-md cursor-pointer',
                      !echeance.isActive && 'opacity-60 bg-gray-50/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <input
                            type="checkbox"
                            checked={selectedEcheanceIds.includes(echeance.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectEcheance(echeance.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 flex-shrink-0"
                          />
                          <span className={cn('text-xs rounded-full px-2 py-0.5 border', urg.className)}>
                            {urg.emoji} {info?.message || urg.label}
                          </span>
                          <h4 className="text-sm font-semibold text-gray-900 truncate">{echeance.label}</h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge className={getNatureBadgeClass(resolveNatureCodeForEcheance(echeance))}>
                            {getNatureLabelForEcheance(echeance, natures)}
                          </Badge>
                          <span
                            className={
                              echeance.sens === 'DEBIT'
                                ? 'text-xs rounded-md px-2 py-0.5 bg-red-50 text-red-800 border border-red-100'
                                : 'text-xs rounded-md px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100'
                            }
                          >
                            {echeance.sens === 'DEBIT' ? 'Charge' : 'Revenu'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {PERIODICITE_LABELS[echeance.periodicite]}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {formatCurrency(echeance.montant)}
                        </div>
                        <div className="text-xs text-gray-600">
                          {info?.displayDate ? formatYmdFr(info.displayDate) : formatDate(echeance.startAt)}
                          {info?.message && (
                            <span className="block text-gray-500 mt-0.5">{info.message}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={echeance.isActive}
                          onCheckedChange={async (checked) => {
                            if (!organizationId) {
                              notify2.error('OrganizationId manquant');
                              return;
                            }

                            try {
                              const echeanceService = createEcheanceServiceWithMode('app-shell');
                              await echeanceService.updateEcheance(echeance.id, organizationId, {
                                isActive: checked,
                              });
                              window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
                                detail: { scope: 'property', propertyId, reason: 'update' } 
                              }));
                              notify2.success(checked ? 'Échéance activée' : 'Échéance désactivée');
                            } catch (error: any) {
                              console.error('Erreur lors de la mise à jour de l\'échéance:', error);
                              notify2.error('Erreur', error.message || 'Erreur lors de la mise à jour');
                            }
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(echeance);
                          }}
                          title="Éditer"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(echeance);
                          }}
                          title="Supprimer"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })}
                {sortedForTable.length > mobileLimit && (
                  <button
                    onClick={() => setMobileLimit(prev => prev + 10)}
                    className="w-full py-2 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg border border-orange-200 transition-colors"
                  >
                    Voir plus ({sortedForTable.length - mobileLimit} restantes)
                  </button>
                )}
              </>
            )}
          </div>

          {/* Table Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={
                        sortedForTable.length > 0 &&
                        selectedEcheanceIds.length === sortedForTable.length
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut projection</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Libellé</th>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none"
                    onClick={() => toggleSort('natureCode')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Nature <ArrowUpDown className="h-3 w-3 opacity-40" />
                    </span>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Périodicité</th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer select-none"
                    onClick={() => toggleSort('montant')}
                  >
                    <span className="inline-flex items-center gap-1 justify-end w-full">
                      Montant <ArrowUpDown className="h-3 w-3 opacity-40" />
                    </span>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sens</th>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none min-w-[140px]"
                    onClick={() => toggleSort('date')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Prochaine échéance <ArrowUpDown className="h-3 w-3 opacity-40" />
                    </span>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Transactions</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut génération</th>
                  <th
                    className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer select-none"
                    onClick={() => toggleSort('actif')}
                  >
                    <span className="inline-flex items-center gap-1 justify-center">
                      Actif <ArrowUpDown className="h-3 w-3 opacity-40" />
                    </span>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={14} className="px-4 py-3">
                        <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : sortedForTable.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-12 text-center text-gray-500">
                      Aucune échéance pour ce bien
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((echeance) => {
                    const info = metaById.get(echeance.id);
                    const urg = info ? temporalBadgeMeta(info.temporalStatus) : temporalBadgeMeta('desactive');
                    return (
                    <tr
                      key={echeance.id}
                      className={cn(
                        'hover:bg-gray-50 cursor-pointer border-b border-gray-100',
                        !echeance.isActive && 'bg-gray-50/60 opacity-80'
                      )}
                      onClick={() => handleRowClick(echeance)}
                    >
                      <td className="px-3 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedEcheanceIds.includes(echeance.id)}
                          onChange={() => handleSelectEcheance(echeance.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span className={cn('inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[11px] font-medium border whitespace-nowrap', urg.className)}>
                          <span>{urg.emoji}</span>
                          <span className="hidden xl:inline max-w-[88px] truncate">{info?.message || urg.label}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate">{echeance.label}</td>
                      <td className="px-3 py-3 text-sm align-middle">
                        <Badge className={cn(getNatureBadgeClass(resolveNatureCodeForEcheance(echeance)), 'text-xs font-normal')}>
                          {getNatureLabelForEcheance(echeance, natures)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {getCategoryLabelForEcheance(echeance, categories, resolveNatureCodeForEcheance, getDefaultCategoryId)}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        {PERIODICITE_LABELS[echeance.periodicite]}
                      </td>
                      <td className="px-3 py-3 text-sm text-right font-medium text-gray-900 tabular-nums">
                        {formatCurrency(echeance.montant)}
                      </td>
                      <td className="px-3 py-3 text-sm align-middle">
                        <span
                          className={
                            echeance.sens === 'DEBIT'
                              ? 'inline-flex rounded-md px-2 py-0.5 text-xs font-medium bg-red-50 text-red-800 border border-red-100'
                              : 'inline-flex rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-100'
                          }
                        >
                          {echeance.sens === 'DEBIT' ? 'Charge' : 'Revenu'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        <div className="font-medium tabular-nums">
                          {info?.displayDate ? formatYmdFr(info.displayDate) : formatDate(echeance.startAt)}
                        </div>
                        {info && info.temporalStatus !== 'desactive' && (
                          <div className="text-xs text-gray-500 mt-0.5">{info.message}</div>
                        )}
                      </td>
                      <td
                        className="px-3 py-3 align-middle text-center text-sm text-primary-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEcheance(echeance);
                          setIsDrawerOpen(true);
                        }}
                      >
                        {(() => {
                          const n = echeanceLinksById.get(echeance.id)?.length ?? 0;
                          if (n === 0) return <span className="text-gray-500 no-underline">Aucune</span>;
                          if (n === 1) return '1 transaction';
                          return `${n} transactions`;
                        })()}
                      </td>
                      <td className="px-3 py-3 align-middle text-center">
                        {(() => {
                          const linkedCount = echeanceLinksById.get(echeance.id)?.length ?? 0;
                          const coverage = coverageByEcheanceId.get(echeance.id);
                          const gen = getStatutGeneration(linkedCount, coverage);
                          const overRatio =
                            coverage?.expectedAmount != null &&
                            coverage.expectedAmount > 0 &&
                            gen === 'montant_superieur'
                              ? coverage.totalLinked / coverage.expectedAmount
                              : undefined;
                          const genBadge = generationBadgeMeta(gen, {
                            overRatio,
                            overRatioCritical: COVERAGE_OVER_LINKED_RATIO_CRITICAL,
                          });
                          const ecart = coverage?.ecartAbsolu;
                          const showEcart =
                            ecart !== undefined &&
                            ecart !== 0 &&
                            Math.abs(ecart) > COVERAGE_ECART_DISPLAY_THRESHOLD_EUR;
                          return (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={cn('inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[11px] font-medium border', genBadge.className)}>
                                <span>{genBadge.emoji}</span>
                                <span>{genBadge.label}</span>
                              </span>
                              {linkedCount > 0 && (
                                <span className="text-[10px] text-gray-500">
                                  {linkedCount} transaction{linkedCount > 1 ? 's' : ''}
                                  {showEcart && (
                                    <span className="tabular-nums">
                                      {' '}
                                      (écart {ecart! > 0 ? '+' : ''}
                                      {formatCurrency(ecart!)})
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={cn(
                              'text-[10px] font-semibold uppercase tracking-wide',
                              echeance.isActive ? 'text-emerald-700' : 'text-gray-400'
                            )}
                          >
                            {echeance.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <Switch
                            checked={echeance.isActive}
                            onCheckedChange={async (checked) => {
                              if (!organizationId) {
                                notify2.error('OrganizationId manquant');
                                return;
                              }
                              try {
                                const echeanceService = createEcheanceServiceWithMode('app-shell');
                                await echeanceService.updateEcheance(echeance.id, organizationId, {
                                  isActive: checked,
                                });
                                window.dispatchEvent(new CustomEvent('deadlines:refresh', {
                                  detail: { scope: 'property', propertyId, reason: 'update' },
                                }));
                                notify2.success(checked ? 'Échéance activée' : 'Échéance désactivée');
                              } catch (error: any) {
                                notify2.error('Erreur', error.message || 'Erreur lors de la mise à jour');
                              }
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(echeance);
                            }}
                            title="Éditer"
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(echeance);
                            }}
                            title="Supprimer"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Desktop */}
          {tablePages > 1 && (
            <div className="hidden lg:block p-4 border-t border-gray-200">
              <Pagination
                currentPage={pagination.page}
                totalPages={tablePages}
                onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal de formulaire */}
      <EcheanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        echeance={selectedEcheance}
        properties={propertiesForModal}
        leases={leases}
        mode={modalMode}
        defaultPropertyId={propertyId}
        dataMode="app-shell"
      />

      {/* Drawer lecture seule */}
      <EcheanceDrawer
        echeance={selectedEcheance}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        propertyId={propertyId}
        onCreateTransaction={openCreateTxFromEcheance}
        coveredOccurrenceDates={
          selectedEcheance ? coveredOccurrenceByEcheanceId.get(selectedEcheance.id) : undefined
        }
      />

      <TransactionModal
        key={echeanceForTx?.id || 'tx-echeance'}
        isOpen={txModalOpen}
        onClose={() => {
          pendingOccurrenceYmdRef.current = null;
          setTxModalOpen(false);
          setEcheanceForTx(null);
          setTxModalPrefill(null);
        }}
        onSubmit={handleTxModalSubmit as (data: TransactionFormData) => Promise<unknown>}
        context={{ type: 'property', propertyId }}
        mode="create"
        title="Nouvelle transaction (échéance)"
        prefill={txModalPrefill || undefined}
      />

      {/* Modal suppression simple */}
      <ConfirmDeleteEcheanceModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        echeanceId={echeanceToDelete?.id || ''}
        echeanceLabel={echeanceToDelete?.label}
      />

      {/* Modal suppression multiple */}
      <ConfirmDeleteMultipleEcheancesModal
        isOpen={showDeleteMultipleModal}
        onClose={() => setShowDeleteMultipleModal(false)}
        onConfirm={async (action) => {
          await handleConfirmDeleteMultiple(action);
        }}
        echeanceIds={selectedEcheanceIds}
      />
    </div>
  );
}

