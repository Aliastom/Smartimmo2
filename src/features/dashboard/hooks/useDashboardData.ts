/**
 * Hook unifié pour charger les données du Dashboard mensuel
 * Fonctionne en mode "normal" (online avec fallback offline) et "app-shell" (offline-first)
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getTenantRepositoryOffline } from '@/lib/offline/repositories/TenantRepositoryOffline';
import { getLoanRepositoryOffline } from '@/lib/offline/repositories/LoanRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { isDbUnavailableError } from '@/lib/offline/dbErrors';
import { handleDbUnavailableError, ensureDbAvailable } from '@/lib/offline/dbErrorHandler';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { buildSchedule } from '@/lib/finance/amortization';
import { logToServer } from '@/lib/utils/logger';
import type { MonthlyDashboardData, LoyerNonEncaisse, TransactionNonRapprochee, IndexationATraiter, EcheancePret, EcheanceCharge, BailAEcheance, DocumentAValider } from '@/types/dashboard';
import type { LocalTransaction, LocalProperty, LocalLease, LocalTenant, LocalLoan, LocalEcheanceRecurrente, LocalDocument, LocalLoanBorrower, CachedNature, CachedCategory } from '@/lib/offline/db';
import {
  normalizeTransaction,
  normalizeNature,
  filterTransactions,
  computeDashboardKPIs,
  getGestionCodesFromCategories,
  type NormalizedTransaction,
  type NormalizedLease,
  type NormalizedNature,
} from '../utils/dashboardCalculations';
import { getLateRentAlerts, type LeaseForRelances } from '../utils/lateRentAlerts';

export interface DashboardFilters {
  month: string; // Format: 'YYYY-MM'
  bienIds: string[];
  locataireIds: string[];
  type: 'INCOME' | 'EXPENSE' | 'ALL';
  statut: 'paye' | 'en_retard' | 'a_venir' | 'ALL';
  source: 'loyer' | 'hors_loyer' | 'ALL';
  focusLoyer: boolean;
}

export interface UseDashboardDataOptions {
  mode: 'normal' | 'app-shell';
  filters?: DashboardFilters;
}

/** Structure vide pour éviter tout accès à .length sur undefined. */
const EMPTY_DASHBOARD_DATA: MonthlyDashboardData = {
  period: { month: '', firstDay: '', lastDay: '' },
  kpis: {
    sommesEncaisses: 0,
    sommesEncaissesRapprochees: 0,
    loyersAttendus: 0,
    depensesRealisees: 0,
    depensesRealiseesRapprochees: 0,
    cashflow: 0,
    tauxEncaissement: 0,
    bauxActifs: 0,
    documentsEnvoyes: 0,
    deltaSommesEncaisses: 0,
    deltaDepensesRealisees: 0,
    deltaCashflow: 0,
    deltaTauxEncaissement: 0,
  },
  aTraiter: {
    loyersNonEncaisses: [],
    relances: [],
    transactionsNonRapprochees: [],
    indexations: [],
    echeancesPrets: [],
    echeancesCharges: [],
    bauxAEcheance: [],
    documentsAValider: [],
  },
  graph: {
    intraMensuel: [],
    cashflowCumule: [],
    loyersRetardParMois: [],
  },
};

/** Normalise la réponse API sans jamais accéder à .length sur undefined (utilise uniquement Array.isArray). */
function safeNormalizeApiData(apiData: unknown): MonthlyDashboardData {
  if (!apiData || typeof apiData !== 'object') return EMPTY_DASHBOARD_DATA;
  const a = (apiData as Record<string, unknown>).aTraiter;
  const g = (apiData as Record<string, unknown>).graph;
  const p = (apiData as Record<string, unknown>).period;
  const k = (apiData as Record<string, unknown>).kpis;
  const at = a && typeof a === 'object' ? a as Record<string, unknown> : null;
  const gr = g && typeof g === 'object' ? g as Record<string, unknown> : null;
  return {
    period: (p && typeof p === 'object' && p !== null && 'month' in p) ? p as MonthlyDashboardData['period'] : EMPTY_DASHBOARD_DATA.period,
    kpis: (k && typeof k === 'object' && k !== null) ? k as MonthlyDashboardData['kpis'] : EMPTY_DASHBOARD_DATA.kpis,
    aTraiter: {
      loyersNonEncaisses: Array.isArray(at?.loyersNonEncaisses) ? at.loyersNonEncaisses : [],
      relances: Array.isArray(at?.relances) ? at.relances : [],
      transactionsNonRapprochees: Array.isArray(at?.transactionsNonRapprochees) ? at.transactionsNonRapprochees : [],
      indexations: Array.isArray(at?.indexations) ? at.indexations : [],
      echeancesPrets: Array.isArray(at?.echeancesPrets) ? at.echeancesPrets : [],
      echeancesCharges: Array.isArray(at?.echeancesCharges) ? at.echeancesCharges : [],
      bauxAEcheance: Array.isArray(at?.bauxAEcheance) ? at.bauxAEcheance : [],
      documentsAValider: Array.isArray(at?.documentsAValider) ? at.documentsAValider : [],
    },
    graph: {
      intraMensuel: Array.isArray(gr?.intraMensuel) ? gr.intraMensuel : [],
      cashflowCumule: Array.isArray(gr?.cashflowCumule) ? gr.cashflowCumule : [],
      loyersRetardParMois: Array.isArray(gr?.loyersRetardParMois) ? gr.loyersRetardParMois : [],
    },
    insights: (apiData as Record<string, unknown>).insights as string | undefined,
  };
}

export function useDashboardData(options: UseDashboardDataOptions) {
  const { mode, filters: filtersProp } = options;
  const { organizationId, isLoading: orgLoading } = useCurrentOrganization();
  const router = mode === 'normal' ? useRouter() : null;
  const searchParams = mode === 'normal' ? useSearchParams() : null;

  // ⚠️ IMPORTANT : Tous les hooks doivent être déclarés AVANT tout return conditionnel
  const [properties, setProperties] = useState<LocalProperty[]>([]);
  const [tenants, setTenants] = useState<LocalTenant[]>([]);
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [leases, setLeases] = useState<LocalLease[]>([]);
  const [loans, setLoans] = useState<LocalLoan[]>([]);
  const [loanBorrowers, setLoanBorrowers] = useState<LocalLoanBorrower[]>([]);
  const [echeances, setEcheances] = useState<LocalEcheanceRecurrente[]>([]);
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [natures, setNatures] = useState<Map<string, CachedNature>>(new Map());
  const [categories, setCategories] = useState<Map<string, CachedCategory>>(new Map());
  // En mode app-shell, loading initial dépend de orgLoading
  const [loading, setLoading] = useState(mode === 'app-shell' ? (orgLoading || !organizationId) : false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Extraire les filtres selon le mode
  const filters = useMemo(() => {
    if (mode === 'normal' && searchParams) {
      const now = new Date();
      return {
        month: searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        bienIds: searchParams.get('bienIds')?.split(',').filter(Boolean) || [],
        locataireIds: searchParams.get('locataireIds')?.split(',').filter(Boolean) || [],
        type: (searchParams.get('type') as 'INCOME' | 'EXPENSE' | 'ALL') || 'ALL',
        statut: (searchParams.get('statut') as 'paye' | 'en_retard' | 'a_venir' | 'ALL') || 'ALL',
        source: (searchParams.get('source') as 'loyer' | 'hors_loyer' | 'ALL') || 'ALL',
        focusLoyer: searchParams.get('focusLoyer') === 'true',
      };
    }
    return filtersProp || {
      month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      bienIds: [],
      locataireIds: [],
      type: 'ALL',
      statut: 'ALL',
      source: 'ALL',
      focusLoyer: false,
    };
  }, [mode, searchParams, filtersProp]);

  // Charger les données selon le mode
  // Utiliser un ref pour éviter les logs StrictMode
  const phase3LoggedRef = React.useRef(false);
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (mode === 'app-shell') {
        // Guard : attendre organizationId (pas d'erreur, juste retourner en loading)
        if (!organizationId || orgLoading) {
          // Ne pas logger d'erreur, juste attendre
          setLoading(true);
          return;
        }

        // Logger PHASE 3 une seule fois
        const phase3StartTime = performance.now();
        if (!phase3LoggedRef.current) {
          phase3LoggedRef.current = true;
          logToServer('[PHASE 3] 💾 Chargement des données locales depuis IndexedDB - Démarrage');
          logToServer('[PHASE 3] 📊 Chargement des tables nécessaires: properties, leases, tenants, transactions, documents, échéances, loans, indices fiscaux, catégories, signaux...');
        }

        try {
          setLoading(true);
          setError(null);

          const db = await getLocalDB();
          // ⚠️ CRITIQUE: Si getLocalDB retourne null (DB indisponible), throw pour remonter l'état
          await ensureDbAvailable(db);
          
          const transRepo = getTransactionRepositoryOffline();
          const propRepo = getPropertyRepositoryOffline();
          const leaseRepo = getLeaseRepositoryOffline();
          const tenantRepo = getTenantRepositoryOffline();
          const loanRepo = getLoanRepositoryOffline();

          // Charger toutes les données en parallèle
          const [
            transactionsData,
            propertiesData,
            leasesData,
            tenantsData,
            loansData,
            echeancesData,
            documentsData,
            naturesData,
            categoriesData,
            loanBorrowersData,
          ] = await Promise.all([
            transRepo.getAll(organizationId, {}),
            propRepo.getAll(organizationId, {}),
            leaseRepo.getAll(organizationId, {}),
            tenantRepo.getAll(organizationId, {}),
            loanRepo.getAll(organizationId, {}),
            db.EcheanceRecurrente.where('organizationId').equals(organizationId).toArray(),
            db.Document.where('organizationId').equals(organizationId).toArray(),
            db.NatureEntity.toArray(),
            db.Category.toArray(),
            db.LoanBorrower.where('organizationId').equals(organizationId).toArray(),
          ]);

          // Log détaillé des données IndexedDB (grouper en un seul log)
          if (phase3LoggedRef.current) {
            logToServer(`[PHASE 3] 📊 Données chargées: transactions=${transactionsData.length}, properties=${propertiesData.length}, leases=${leasesData.length}, tenants=${tenantsData.length}, loans=${loansData.length}, echeances=${echeancesData.length}, documents=${documentsData.length}, natures=${naturesData.length}, categories=${categoriesData.length}, loanBorrowers=${loanBorrowersData.length}`);
            logToServer('[PHASE 3] 🔄 Génération des KPI, Insights, Échéances, Alertes...');
          }

          // IMPORTANT: Indexer la Map par key (qui contient le code de la nature)
          // Les transactions ont tx.nature = code, et dans IndexedDB key = code
          const natureMap = new Map<string, CachedNature>();
          naturesData.forEach(nature => {
            // Indexer par key (qui est le code de la nature)
            natureMap.set(nature.key, nature);
            // Aussi indexer par code si différent (pour compatibilité)
            if (nature.code && nature.code !== nature.key) {
              natureMap.set(nature.code, nature);
            }
          });

          const categoryMap = new Map<string, CachedCategory>();
          categoriesData.forEach(cat => {
            categoryMap.set(cat.id, cat);
          });

          if (!cancelled) {
            setTransactions(transactionsData);
            setProperties(propertiesData);
            setLeases(leasesData);
            setTenants(tenantsData);
            setLoans(loansData);
            setEcheances(echeancesData);
            setDocuments(documentsData);
            setNatures(natureMap);
            setCategories(categoryMap);
            setLoanBorrowers(loanBorrowersData);
            setLoading(false);
            
            if (phase3LoggedRef.current) {
              const phase3EndTime = performance.now();
              const phase3Duration = Math.round(phase3EndTime - phase3StartTime);
              logToServer(`[PHASE 3] ✅ Chargement IndexedDB terminé en ${phase3Duration}ms - Données prêtes pour l'hydratation UI`);
            }
          }
        } catch (e: any) {
          if (!cancelled) {
            // ⚠️ CRITIQUE: Si DB_UNAVAILABLE, émettre un événement pour que l'app affiche l'écran de recovery
            if (isDbUnavailableError(e)) {
              handleDbUnavailableError(e, 'useDashboardData');
              setError('La base de données locale n\'est pas accessible.');
            } else {
              logToServer(`[PHASE 3] ❌ Erreur lors du chargement IndexedDB: ${e?.message || String(e)}`, 'error');
              setError('Impossible de charger les données du dashboard.');
            }
            setLoading(false);
          }
        }
      } else {
        // Mode normal : les données seront chargées via React Query
        setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [mode, organizationId, refreshKey, orgLoading]);

      // Écouter les événements de refresh en mode app-shell
      useEffect(() => {
        if (mode === 'app-shell') {
          const handleRefresh = () => {
            logToServer('[PHASE 5] 🔔 Événement sync:refresh reçu - Rechargement des données');
            setRefreshKey(prev => prev + 1);
          };
          const handleFullSyncComplete = (event: any) => {
            // Vérifier que c'est pour la bonne organisation
            if (event.detail?.organizationId === organizationId) {
              logToServer('[PHASE 5] 🔔 Événement fullSync:complete reçu - Rechargement des données');
              setRefreshKey(prev => prev + 1);
            }
          };
          window.addEventListener('sync:refresh', handleRefresh);
          window.addEventListener('dashboard:refresh', handleRefresh);
          window.addEventListener('fullSync:complete', handleFullSyncComplete);
          return () => {
            window.removeEventListener('sync:refresh', handleRefresh);
            window.removeEventListener('dashboard:refresh', handleRefresh);
            window.removeEventListener('fullSync:complete', handleFullSyncComplete);
          };
        }
      }, [mode, organizationId]);

  // En mode normal, utiliser React Query pour charger les données
  // ⚠️ IMPORTANT: En mode app-shell, AUCUN appel API/Prisma ne doit être fait
  // Le fetch ci-dessous est protégé par `enabled: mode === 'normal'`
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      month: filters.month,
      ...(filters.bienIds.length > 0 && { bienIds: filters.bienIds.join(',') }),
      ...(filters.locataireIds.length > 0 && { locataireIds: filters.locataireIds.join(',') }),
      ...(filters.type !== 'ALL' && { type: filters.type }),
      ...(filters.statut !== 'ALL' && { statut: filters.statut }),
      ...(filters.source !== 'ALL' && { source: filters.source }),
      ...(filters.focusLoyer && { focusLoyer: 'true' }),
    });
    return params.toString();
  }, [filters]);

  const { data: apiData, isLoading: apiLoading, error: apiError } = useQuery<MonthlyDashboardData>({
    queryKey: ['dashboard-monthly', queryParams],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/monthly?${queryParams}`);
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des données');
      }
      return response.json();
    },
    enabled: mode === 'normal',
    staleTime: 2 * 60 * 1000,
    retry: 3,
  });

  // Calculer les données du dashboard en mode app-shell
  const calculatedData = useMemo(() => {
    if (mode === 'app-shell') {
      // Si on est encore en train de charger, retourner null pour afficher le loading
      if (loading) {
        return null;
      }
      
      // Si aucune transaction mais les données sont chargées, retourner une structure vide
      if (transactions.length === 0) {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        return {
          period: {
            month: filters.month,
            firstDay: monthStart.toISOString().split('T')[0],
            lastDay: monthEnd.toISOString().split('T')[0],
          },
          kpis: {
            sommesEncaisses: 0,
            sommesEncaissesRapprochees: 0,
            loyersAttendus: 0,
            depensesRealisees: 0,
            depensesRealiseesRapprochees: 0,
            cashflow: 0,
            tauxEncaissement: 0,
            bauxActifs: 0,
            documentsEnvoyes: 0,
            nLoyersAttendus: 0,
            nLoyersEncaisses: 0,
            deltaSommesEncaisses: 0,
            deltaDepensesRealisees: 0,
            deltaCashflow: 0,
            deltaTauxEncaissement: 0,
          },
          aTraiter: {
            loyersNonEncaisses: [],
            relances: [],
            transactionsNonRapprochees: [],
            indexations: [],
            echeancesPrets: [],
            echeancesCharges: [],
            bauxAEcheance: [],
            documentsAValider: [],
          },
          graph: {
            intraMensuel: [],
            cashflowCumule: [],
            loyersRetardParMois: [],
          },
          insights: undefined,
        } as MonthlyDashboardData;
      }
      // Extraire l'année et le mois du filtre
      const [year, monthNum] = filters.month.split('-').map(Number);
      const monthStart = new Date(year, monthNum - 1, 1);
      const monthEnd = new Date(year, monthNum, 0, 23, 59, 59);
      const firstDayStr = monthStart.toISOString().split('T')[0];
      const lastDayStr = monthEnd.toISOString().split('T')[0];

      // Mois précédent pour les deltas
      const prevMonth = new Date(year, monthNum - 2, 1);
      const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
      const prevMonthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
      const prevMonthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59);

      // Normaliser les données
      const normalizedTransactions: NormalizedTransaction[] = transactions.map(normalizeTransaction);
      
      // Normaliser les natures
      const normalizedNatures = new Map<string, NormalizedNature>();
      natures.forEach((nature, key) => {
        normalizedNatures.set(key, normalizeNature(nature));
      });

      // Obtenir les codes de gestion
      const gestionCodes = getGestionCodesFromCategories(categories);

      // Filtrer les transactions avec la fonction unifiée
      const { currentMonth: filteredTransactions, prevMonth: prevFilteredTransactions } = filterTransactions(
        normalizedTransactions,
        filters,
        monthStart,
        monthEnd,
        prevMonthStart,
        prevMonthEnd,
        prevMonthStr,
        normalizedNatures,
        gestionCodes,
        leases.map(l => ({ id: l.id, tenantId: l.tenantId || null }))
      );

      // Normaliser les baux
      const normalizedLeases: NormalizedLease[] = leases.map(l => ({
        id: l.id,
        rentAmount: l.rentAmount || 0,
        startDate: l.startDate,
        endDate: l.endDate,
        status: l.status,
        propertyId: l.propertyId || null,
        tenantId: l.tenantId || null,
        indexationType: l.indexationType || null,
      }));

      // Filtrer les baux actifs du mois courant et précédent
      const currentMonthLeases = normalizedLeases.filter(l => {
        if (l.status !== 'ACTIF') return false;
        const leaseStart = new Date(l.startDate);
        const leaseEnd = l.endDate ? new Date(l.endDate) : null;
        return leaseStart <= monthEnd && (!leaseEnd || leaseEnd >= monthStart);
      });

      const prevMonthLeases = normalizedLeases.filter(l => {
        if (l.status !== 'ACTIF') return false;
        const leaseStart = new Date(l.startDate);
        const leaseEnd = l.endDate ? new Date(l.endDate) : null;
        return leaseStart <= prevMonthEnd && (!leaseEnd || leaseEnd >= prevMonthStart);
      });

      // Documents envoyés ce mois
      const documentsEnvoyes = documents.filter(d => {
        const uploadDate = new Date(d.uploadedAt);
        return uploadDate >= monthStart && uploadDate <= monthEnd && d.status !== 'pending';
      }).length;

      // Calculer tous les KPIs avec la fonction unifiée
      const kpis = computeDashboardKPIs(
        filteredTransactions,
        prevFilteredTransactions,
        currentMonthLeases,
        prevMonthLeases,
        monthStart,
        monthEnd,
        prevMonthStart,
        prevMonthEnd,
        filters,
        normalizedNatures,
        gestionCodes,
        documentsEnvoyes
      );

      // ========================================================================
      // CALCUL DES LISTES ACTIONNABLES (une seule source : getLateRentAlerts)
      // ========================================================================

      let allLeases = leases;
      if (filters.bienIds.length > 0) {
        allLeases = allLeases.filter(l => l.propertyId && filters.bienIds.includes(l.propertyId));
      }
      if (filters.locataireIds.length > 0) {
        allLeases = allLeases.filter(l => l.tenantId && filters.locataireIds.includes(l.tenantId));
      }

      let allRentTransactions = normalizedTransactions.filter(t => {
        if (t.nature !== gestionCodes.rentNature) return false;
        if (gestionCodes.rentCategoryId && t.categoryId !== gestionCodes.rentCategoryId) return false;
        return true;
      });
      if (filters.bienIds.length > 0) {
        allRentTransactions = allRentTransactions.filter(t => t.propertyId && filters.bienIds.includes(t.propertyId));
      }
      if (filters.locataireIds.length > 0) {
        const relatedLeaseIds = allLeases.filter(l => l.tenantId && filters.locataireIds.includes(l.tenantId)).map(l => l.id);
        allRentTransactions = allRentTransactions.filter(t => t.leaseId && relatedLeaseIds.includes(t.leaseId));
      }

      const paidMonths = new Set<string>();
      allRentTransactions.forEach(tx => {
        const hasCorrectNature = tx.nature === gestionCodes.rentNature;
        const hasCorrectCategory = gestionCodes.rentCategoryId ? tx.categoryId === gestionCodes.rentCategoryId : true;
        if (tx.accounting_month && tx.leaseId && hasCorrectNature && hasCorrectCategory) {
          paidMonths.add(`${tx.leaseId}-${tx.accounting_month}`);
        }
      });

      const propertyNameById = new Map(properties.map(p => [p.id, p.name || '']));
      const tenantNameById = new Map(tenants.map(t => [t.id, `${t.firstName} ${t.lastName}`]));
      const acquisitionDateByPropertyId = new Map(properties.map(p => [p.id, p.acquisitionDate ?? null]));
      const leasesForRelances: LeaseForRelances[] = allLeases.map(l => ({
        id: l.id,
        propertyId: l.propertyId || null,
        tenantId: l.tenantId || null,
        rentAmount: l.rentAmount || 0,
        startDate: l.startDate,
        endDate: l.endDate ?? null,
        status: l.status,
      }));

      const relances = getLateRentAlerts({
        leases: leasesForRelances,
        paidMonths,
        selectedMonth: filters.month,
        mode: 'open_arrears_as_of_month',
        propertyNameById,
        tenantNameById,
        acquisitionDateByPropertyId,
      });

      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
        const summaryIds = relances.map(r => r.id).sort();
        console.log('[late-rents][summary]', { count: relances.length, selectedMonth: filters.month, ids: summaryIds });
      }

      // Indexations à traiter
      const indexations: IndexationATraiter[] = [];
      const indexationStart = new Date(monthStart.getTime() - 15 * 24 * 60 * 60 * 1000);
      const indexationEnd = new Date(monthEnd.getTime() + 15 * 24 * 60 * 60 * 1000);

      const leasesForIndexation = leases.filter(l => 
        l.status === 'ACTIF' && l.indexationType
      );

      for (const lease of leasesForIndexation) {
        const startDate = new Date(lease.startDate);
        const anniversaire = new Date(year, startDate.getMonth(), startDate.getDate());

        if (anniversaire >= indexationStart && anniversaire <= indexationEnd) {
          const property = properties.find(p => p.id === lease.propertyId);
          const tenant = tenants.find(t => t.id === lease.tenantId);

          indexations.push({
            id: `indexation-${lease.id}`,
            leaseId: lease.id,
            propertyName: property?.name || '',
            tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : '',
            dateAnniversaire: anniversaire.toISOString().split('T')[0],
            loyerActuel: lease.rentAmount || 0,
            indiceRequis: lease.indexationType || 'IRL',
          });
        }
      }

      // Échéances de prêts
      const echeancesPrets: EcheancePret[] = [];
      const activeLoans = loans.filter(l => 
        l.isActive && 
        new Date(l.startDate) <= monthEnd &&
        (!l.endDate || new Date(l.endDate) >= monthStart)
      );

      for (const loan of activeLoans) {
        try {
          const schedule = buildSchedule({
            principal: Number(loan.principal),
            annualRatePct: Number(loan.annualRatePct),
            durationMonths: loan.durationMonths,
            defermentMonths: loan.defermentMonths || 0,
            insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
            startDate: new Date(loan.startDate),
            paymentDay: loan.paymentDay || undefined,
          });

          const monthStr = `${year}-${String(monthNum).padStart(2, '0')}`;
          const scheduleRow = schedule.find(row => row.date === monthStr || row.date.startsWith(monthStr + '-'));

          if (scheduleRow) {
            const startDate = new Date(loan.startDate);
            const dayOfMonth = loan.paymentDay || startDate.getDate();
            const echeanceDate = new Date(year, monthNum - 1, dayOfMonth);
            const property = properties.find(p => p.id === loan.propertyId);
            const borrowers = loanBorrowers.filter(b => b.loanId === loan.id);

            let borrowersInfo = null;
            if (borrowers.length > 0) {
              borrowersInfo = {
                count: borrowers.length,
                borrowers: borrowers.map(b => ({
                  name: `${b.firstName} ${b.lastName}`,
                  share: b.responsibilityPct ? Number(b.responsibilityPct) : null,
                })),
              };
            }

            echeancesPrets.push({
              id: `pret-${loan.id}`,
              loanId: loan.id,
              propertyName: property?.name || '',
              dateEcheance: echeanceDate.toISOString().split('T')[0],
              montantTotal: scheduleRow.paymentTotal,
              capital: scheduleRow.paymentPrincipal,
              interets: scheduleRow.paymentInterest,
              assurance: scheduleRow.paymentInsurance,
              borrowersInfo,
            });
          }
        } catch (error) {
          // Erreur silencieuse pour le calcul de prêt
        }
      }

      // Échéances récurrentes (charges)
      const echeancesCharges: EcheanceCharge[] = [];
      const activeEcheances = echeances.filter(e => 
        e.isActive &&
        new Date(e.startAt) <= monthEnd &&
        (!e.endAt || new Date(e.endAt) >= monthStart)
      );

      for (const charge of activeEcheances) {
        const startDate = new Date(charge.startAt);
        let echeanceDate: Date | null = null;

        if (charge.periodicite === 'MONTHLY') {
          echeanceDate = new Date(year, monthNum - 1, startDate.getDate());
        } else if (charge.periodicite === 'QUARTERLY') {
          const startMonth = startDate.getMonth();
          if ((monthNum - 1 - startMonth) % 3 === 0) {
            echeanceDate = new Date(year, monthNum - 1, startDate.getDate());
          }
        } else if (charge.periodicite === 'YEARLY') {
          if (monthNum - 1 === startDate.getMonth()) {
            echeanceDate = new Date(year, monthNum - 1, startDate.getDate());
          }
        }

        if (echeanceDate && echeanceDate >= monthStart && echeanceDate <= monthEnd) {
          const property = properties.find(p => p.id === charge.propertyId);

          echeancesCharges.push({
            id: `charge-${charge.id}`,
            echeanceId: charge.id,
            propertyName: property?.name,
            label: charge.label,
            type: charge.type,
            dateEcheance: echeanceDate.toISOString().split('T')[0],
            montant: Number(charge.montant),
            recuperable: charge.recuperable,
          });
        }
      }

      // Baux arrivant à échéance (dans les 90 jours)
      const today = new Date();
      const bauxAEcheance: BailAEcheance[] = [];
      const echeanceLimit = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

      const leasesExpiring = leases.filter(l => 
        l.status === 'ACTIF' &&
        l.endDate &&
        new Date(l.endDate) >= today &&
        new Date(l.endDate) <= echeanceLimit
      );

      for (const lease of leasesExpiring) {
        if (!lease.endDate) continue;

        const endDate = new Date(lease.endDate);
        const joursRestants = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const property = properties.find(p => p.id === lease.propertyId);
        const tenant = tenants.find(t => t.id === lease.tenantId);

        bauxAEcheance.push({
          id: `bail-${lease.id}`,
          leaseId: lease.id,
          propertyName: property?.name || '',
          tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : '',
          dateFinBail: endDate.toISOString().split('T')[0],
          joursRestants,
        });
      }

      // Transactions non rapprochées
      // IMPORTANT: L'API ne filtre PAS les transactions non rapprochées par statut
      // Il faut donc utiliser les transactions filtrées SANS le filtre statut
      const filtersWithoutStatut: DashboardFilters = {
        ...filters,
        statut: 'ALL', // Forcer statut à ALL pour les transactions non rapprochées
      };
      
      const { currentMonth: transactionsForUnreconciled } = filterTransactions(
        normalizedTransactions,
        filtersWithoutStatut,
        monthStart,
        monthEnd,
        prevMonthStart,
        prevMonthEnd,
        prevMonthStr,
        normalizedNatures,
        gestionCodes,
        leases.map(l => ({ id: l.id, tenantId: l.tenantId || null }))
      );

      const transactionsNonRapprochees: TransactionNonRapprochee[] = [];
      const nonRapprochees = transactionsForUnreconciled.filter(t => 
        t.rapprochementStatus !== 'rapprochee'
      );

      for (const tx of nonRapprochees.slice(0, 20)) {
        const originalTx = transactions.find(t => t.id === tx.id);
        const property = properties.find(p => p.id === tx.propertyId);
        const lease = leases.find(l => l.id === tx.leaseId);
        const tenant = lease ? tenants.find(t => t.id === lease.tenantId) : null;

        transactionsNonRapprochees.push({
          id: tx.id,
          propertyId: tx.propertyId || '',
          propertyName: property?.name || '',
          tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : undefined,
          label: originalTx?.label || '',
          montant: Math.abs(tx.amount),
          date: typeof tx.date === 'string' ? tx.date : tx.date.toISOString().split('T')[0],
          accountingMonth: tx.accounting_month || undefined,
          nature: tx.nature || undefined,
        });
      }

      // Documents à valider
      const documentsAValider: DocumentAValider[] = [];
      const docsToValidate = documents.filter(d => {
        const uploadDate = new Date(d.uploadedAt);
        return uploadDate >= monthStart && uploadDate <= monthEnd &&
               (d.ocrStatus === 'pending' || d.ocrStatus === 'error' || d.status === 'pending');
      }).slice(0, 20);

      for (const doc of docsToValidate) {
        documentsAValider.push({
          id: doc.id,
          documentId: doc.id,
          fileName: doc.fileName,
          dateUpload: new Date(doc.uploadedAt).toISOString().split('T')[0],
          ocrStatus: doc.ocrStatus,
          linkedType: doc.linkedTo || undefined,
          linkedId: doc.linkedId || undefined,
        });
      }

      return {
        period: {
          month: filters.month,
          firstDay: firstDayStr,
          lastDay: lastDayStr,
        },
        kpis,
        aTraiter: {
          loyersNonEncaisses: [], // Plus utilisé, on utilise uniquement relances
          relances,
          transactionsNonRapprochees,
          indexations,
          echeancesPrets,
          echeancesCharges,
          bauxAEcheance,
          documentsAValider,
        },
        graph: {
          intraMensuel: [],
          cashflowCumule: [],
          loyersRetardParMois: [], // Calculé côté client dans TasksPanel
        },
        insights: undefined,
      } as MonthlyDashboardData;
    }
    return null;
  }, [mode, transactions, leases, loans, loanBorrowers, echeances, documents, natures, categories, properties, tenants, filters]);

  // Guard : en mode app-shell, retourner loading si organizationId n'est pas prêt
  // ⚠️ Ce guard doit être APRÈS tous les hooks
  if (mode === 'app-shell' && (orgLoading || !organizationId)) {
    return {
      data: EMPTY_DASHBOARD_DATA,
      properties: [],
      tenants: [],
      loading: true,
      error: null,
      router: router || null,
      searchParams: searchParams || null,
    };
  }

  const safeData =
    mode === 'normal'
      ? (apiData ? safeNormalizeApiData(apiData) : EMPTY_DASHBOARD_DATA)
      : (calculatedData ?? EMPTY_DASHBOARD_DATA);

  return {
    data: safeData,
    properties: Array.isArray(properties) ? properties : [],
    tenants: Array.isArray(tenants) ? tenants : [],
    loading: mode === 'normal' ? apiLoading : loading,
    error: mode === 'normal' ? (apiError as Error | null) : (error ? new Error(error) : null),
    // Utilitaires pour le mode normal
    router: router || null,
    searchParams: searchParams || null,
  };
}
