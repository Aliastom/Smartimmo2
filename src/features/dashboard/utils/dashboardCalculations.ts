/**
 * Fonctions de calcul unifiées pour le Dashboard
 * 
 * Ces fonctions sont utilisées à la fois en mode normal (API) et en mode app-shell (IndexedDB)
 * pour garantir des résultats identiques.
 */

import type { DashboardFilters } from '../hooks/useDashboardData';
import type { MonthlyKPIs } from '@/types/dashboard';
import type { LocalTransaction, LocalLease, LocalProperty, LocalTenant, LocalLoan, LocalLoanBorrower, LocalEcheanceRecurrente, LocalDocument, CachedNature, CachedCategory } from '@/lib/offline/db';
import { buildSchedule } from '@/lib/finance/amortization';

/**
 * Interface pour les données normalisées utilisées dans les calculs
 */
export interface NormalizedTransaction {
  id: string;
  amount: number;
  nature: string | null;
  categoryId: string | null;
  paidAt: Date | string | null;
  rapprochementStatus: string | null;
  date: Date | string;
  accounting_month: string | null;
  leaseId: string | null;
  propertyId: string | null;
}

export interface NormalizedLease {
  id: string;
  rentAmount: number;
  startDate: Date | string;
  endDate: Date | string | null;
  status: string;
  propertyId: string | null;
  tenantId: string | null;
  indexationType: string | null;
}

export interface NormalizedNature {
  code: string;
  flow: string | null;
  label: string;
}

export interface NormalizedCategory {
  id: string;
  slug: string;
}

/**
 * Codes système pour la gestion déléguée
 */
export interface GestionCodes {
  rentNature: string;
  rentCategorySlug: string;
  rentCategoryId: string | null;
  mgmtNature: string;
  mgmtCategorySlug: string;
  mgmtCategoryId: string | null;
}

/**
 * Obtient les codes de gestion depuis les catégories en cache
 * Utilise les valeurs par défaut si les catégories ne sont pas trouvées
 */
export function getGestionCodesFromCategories(
  categories: Map<string, any>
): GestionCodes {
  // IMPORTANT: Utiliser les mêmes valeurs par défaut que l'API
  // L'API utilise getGestionCodes() qui retourne:
  // - rentCategory par défaut: 'loyer_principal' (pas 'loyer-charges')
  // - mgmtCategory par défaut: 'frais_gestion' (pas 'frais-gestion')
  const rentNature = 'RECETTE_LOYER';
  const rentCategorySlug = 'loyer_principal'; // ⚠️ CORRIGÉ: Utiliser 'loyer_principal' comme l'API
  const mgmtNature = 'DEPENSE_GESTION';
  const mgmtCategorySlug = 'frais_gestion'; // ⚠️ CORRIGÉ: Utiliser 'frais_gestion' comme l'API

  // Chercher la catégorie par slug (comme l'API)
  const rentCategory = Array.from(categories.values()).find(
    c => c.slug === rentCategorySlug
  );
  const rentCategoryId = rentCategory?.id || null;

  const mgmtCategory = Array.from(categories.values()).find(
    c => c.slug === mgmtCategorySlug
  );
  const mgmtCategoryId = mgmtCategory?.id || null;

  return {
    rentNature,
    rentCategorySlug,
    rentCategoryId,
    mgmtNature,
    mgmtCategorySlug,
    mgmtCategoryId,
  };
}

/**
 * Normalise une transaction depuis IndexedDB ou Supabase
 */
export function normalizeTransaction(tx: any): NormalizedTransaction {
  return {
    id: tx.id,
    amount: typeof tx.amount === 'number' ? tx.amount : Number(tx.amount) || 0,
    nature: tx.nature || null,
    categoryId: tx.categoryId || null,
    paidAt: tx.paidAt || null,
    rapprochementStatus: tx.rapprochementStatus || null,
    date: tx.date,
    accounting_month: tx.accounting_month || null,
    // ⚠️ CRITIQUE: Utiliser bailId comme fallback si leaseId n'est pas présent
    // (bailId est un alias de leaseId dans Supabase)
    leaseId: tx.leaseId || tx.bailId || null,
    propertyId: tx.propertyId || null,
  };
}

/**
 * Normalise une nature depuis IndexedDB ou Supabase
 */
export function normalizeNature(nature: any): NormalizedNature {
  return {
    code: nature.code || nature.key || '',
    flow: nature.flow || null,
    label: nature.label || '',
  };
}

/**
 * Filtre les transactions selon les critères du dashboard
 */
export function filterTransactions(
  transactions: NormalizedTransaction[],
  filters: DashboardFilters,
  monthStart: Date,
  monthEnd: Date,
  prevMonthStart: Date,
  prevMonthEnd: Date,
  prevMonthStr: string,
  natures: Map<string, NormalizedNature>,
  gestionCodes: GestionCodes,
  leases?: Array<{ id: string; tenantId: string | null }>
): {
  currentMonth: NormalizedTransaction[];
  prevMonth: NormalizedTransaction[];
} {
  const prevMonthTransactions: NormalizedTransaction[] = [];
  const currentMonthTransactions: NormalizedTransaction[] = [];

  // Identifier les natures de loyer
  const loyerNatures: string[] = [];
  natures.forEach(nature => {
    if (nature.code.includes('LOYER') || nature.label.toLowerCase().includes('loyer')) {
      loyerNatures.push(nature.code);
    }
  });

  // Filtrer les transactions du mois courant
  for (const tx of transactions) {
    // IMPORTANT: Filtrer par accounting_month en priorité (cohérent avec l'API)
    // Fallback sur date si accounting_month n'est pas disponible (pour compatibilité avec données existantes)
    let isInCurrentMonth = false;
    let isInPrevMonth = false;

    if (tx.accounting_month) {
      // Priorité : utiliser accounting_month (comme l'API)
      isInCurrentMonth = tx.accounting_month === filters.month;
      isInPrevMonth = tx.accounting_month === prevMonthStr;
    } else {
      // Fallback : utiliser date si accounting_month n'est pas disponible
      // (pour compatibilité avec données IndexedDB qui n'auraient pas encore accounting_month)
      const txDate = new Date(tx.date);
      isInCurrentMonth = txDate >= monthStart && txDate <= monthEnd;
      isInPrevMonth = txDate >= prevMonthStart && txDate <= prevMonthEnd;
    }

    if (!isInCurrentMonth && !isInPrevMonth) {
      continue;
    }

    // Filtrer par bien
    if (filters.bienIds.length > 0) {
      if (!tx.propertyId || !filters.bienIds.includes(tx.propertyId)) {
        continue;
      }
    }

    // Filtrer par locataire
    if (filters.locataireIds.length > 0 && leases) {
      const relatedLeaseIds = leases
        .filter(l => l.tenantId && filters.locataireIds.includes(l.tenantId))
        .map(l => l.id);
      if (!tx.leaseId || !relatedLeaseIds.includes(tx.leaseId)) {
        continue;
      }
    }

    // Filtrer par type (INCOME/EXPENSE)
    if (filters.type !== 'ALL') {
      const nature = tx.nature ? natures.get(tx.nature) : null;
      const flow = nature?.flow?.toUpperCase();
      
      if (filters.type === 'INCOME') {
        if (flow !== 'INCOME' && flow !== 'RECETTE') {
          continue;
        }
      } else if (filters.type === 'EXPENSE') {
        if (flow !== 'EXPENSE' && flow !== 'DEPENSE') {
          continue;
        }
      }
    }

    // Filtrer par source (loyer/hors_loyer)
    if (filters.source !== 'ALL') {
      const hasCorrectNature = tx.nature === gestionCodes.rentNature;
      const hasCorrectCategory = gestionCodes.rentCategoryId ? tx.categoryId === gestionCodes.rentCategoryId : true;
      const isLoyer = hasCorrectNature && hasCorrectCategory;
      const isLoyerFallback = !gestionCodes.rentCategoryId && tx.nature && loyerNatures.includes(tx.nature);

      if (filters.source === 'loyer') {
        if (!isLoyer && !isLoyerFallback) {
          continue;
        }
      } else if (filters.source === 'hors_loyer') {
        if (isLoyer || isLoyerFallback) {
          continue;
        }
      }
    }

    // Filtrer par focusLoyer (gestion déléguée)
    if (filters.focusLoyer) {
      const nature = tx.nature ? natures.get(tx.nature) : null;
      const flow = nature?.flow?.toUpperCase();
      
      if (flow === 'INCOME' || flow === 'RECETTE') {
        const hasCorrectNature = tx.nature === gestionCodes.rentNature;
        const hasCorrectCategory = gestionCodes.rentCategoryId ? tx.categoryId === gestionCodes.rentCategoryId : true;
        if (!hasCorrectNature || !hasCorrectCategory) {
          continue;
        }
      } else if (flow === 'EXPENSE' || flow === 'DEPENSE') {
        const hasCorrectNature = tx.nature === gestionCodes.mgmtNature;
        const hasCorrectCategory = gestionCodes.mgmtCategoryId ? tx.categoryId === gestionCodes.mgmtCategoryId : true;
        if (!hasCorrectNature || !hasCorrectCategory) {
          continue;
        }
      } else {
        continue;
      }
    }

    // Filtrer par statut
    // IMPORTANT: Dans l'API, le filtre statut est appliqué AVANT le calcul des KPIs
    // Il faut donc l'appliquer ici aussi pour être cohérent
    if (filters.statut !== 'ALL') {
      // Note: paidAt peut être null, undefined, ou une date
      const hasPaidAt = tx.paidAt !== null && tx.paidAt !== undefined;
      
      if (filters.statut === 'paye' && !hasPaidAt) {
        continue;
      }
      if (filters.statut === 'en_retard' && hasPaidAt) {
        continue;
      }
      if (filters.statut === 'a_venir' && hasPaidAt) {
        continue;
      }
    }

    if (isInCurrentMonth) {
      currentMonthTransactions.push(tx);
    }
    if (isInPrevMonth) {
      prevMonthTransactions.push(tx);
    }
  }

  return {
    currentMonth: currentMonthTransactions,
    prevMonth: prevMonthTransactions,
  };
}

/**
 * Calcule les encaissements (sommes encaissées et rapprochées)
 */
export function computeEncaissements(
  transactions: NormalizedTransaction[],
  natures: Map<string, NormalizedNature>
): {
  sommesEncaisses: number;
  sommesEncaissesRapprochees: number;
} {
  let sommesEncaisses = 0;
  let sommesEncaissesRapprochees = 0;

  for (const tx of transactions) {
    const nature = tx.nature ? natures.get(tx.nature) : null;
    const flow = nature?.flow?.toUpperCase();
    const amount = Math.abs(tx.amount);

    // IMPORTANT: Utiliser uniquement 'INCOME' (cohérent avec l'API qui n'utilise pas 'RECETTE')
    if (flow === 'INCOME') {
      sommesEncaisses += amount;
      // IMPORTANT: Utiliser uniquement rapprochementStatus (cohérent avec l'API)
      if (tx.rapprochementStatus === 'rapprochee') {
        sommesEncaissesRapprochees += amount;
      }
    }
  }

  return { sommesEncaisses, sommesEncaissesRapprochees };
}

/**
 * Calcule les dépenses (dépenses réalisées et rapprochées)
 */
export function computeDepenses(
  transactions: NormalizedTransaction[],
  natures: Map<string, NormalizedNature>
): {
  depensesRealisees: number;
  depensesRealiseesRapprochees: number;
} {
  let depensesRealisees = 0;
  let depensesRealiseesRapprochees = 0;

  for (const tx of transactions) {
    const nature = tx.nature ? natures.get(tx.nature) : null;
    const flow = nature?.flow?.toUpperCase();
    const amount = Math.abs(tx.amount);

    // IMPORTANT: Utiliser uniquement 'EXPENSE' (cohérent avec l'API qui n'utilise pas 'DEPENSE')
    if (flow === 'EXPENSE') {
      depensesRealisees += amount;
      // IMPORTANT: Utiliser uniquement rapprochementStatus (cohérent avec l'API)
      if (tx.rapprochementStatus === 'rapprochee') {
        depensesRealiseesRapprochees += amount;
      }
    }
  }

  return { depensesRealisees, depensesRealiseesRapprochees };
}

/**
 * Calcule le cashflow
 */
export function computeCashflow(
  sommesEncaisses: number,
  depensesRealisees: number
): number {
  return sommesEncaisses - depensesRealisees;
}

/**
 * Calcule les loyers attendus avec prorata temporis
 */
export function computeLoyersAttendus(
  leases: NormalizedLease[],
  monthStart: Date,
  monthEnd: Date,
  filters: DashboardFilters
): number {
  // Filtrer les baux actifs
  const activeLeases = leases.filter(l => {
    if (l.status !== 'ACTIF') return false;
    const leaseStart = new Date(l.startDate);
    const leaseEnd = l.endDate ? new Date(l.endDate) : null;
    return leaseStart <= monthEnd && (!leaseEnd || leaseEnd >= monthStart);
  });

  // Appliquer les filtres
  let filteredLeases = activeLeases;
  
  if (filters.bienIds.length > 0) {
    filteredLeases = filteredLeases.filter(l => 
      l.propertyId && filters.bienIds.includes(l.propertyId)
    );
  }

  if (filters.locataireIds.length > 0) {
    filteredLeases = filteredLeases.filter(l => 
      l.tenantId && filters.locataireIds.includes(l.tenantId)
    );
  }

  // Calculer les loyers attendus avec prorata
  let loyersAttendus = 0;
  const daysInMonth = (monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24) + 1;

  for (const lease of filteredLeases) {
    const leaseStart = new Date(lease.startDate);
    const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;

    if (leaseStart <= monthStart && (!leaseEnd || leaseEnd >= monthEnd)) {
      // Bail actif tout le mois
      loyersAttendus += lease.rentAmount || 0;
    } else {
      // Prorata temporis
      let activeDays = daysInMonth;
      if (leaseStart > monthStart) {
        activeDays -= Math.floor((leaseStart.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));
      }
      if (leaseEnd && leaseEnd < monthEnd) {
        activeDays -= Math.floor((monthEnd.getTime() - leaseEnd.getTime()) / (1000 * 60 * 60 * 24));
      }
      loyersAttendus += ((lease.rentAmount || 0) * activeDays) / daysInMonth;
    }
  }

  return loyersAttendus;
}

/**
 * Calcule les loyers encaissés
 */
export function computeLoyersEncaisses(
  transactions: NormalizedTransaction[],
  natures: Map<string, NormalizedNature>,
  gestionCodes: GestionCodes
): number {
  let loyersEncaisses = 0;

  // Identifier les natures de loyer
  const loyerNatures: string[] = [];
  natures.forEach(nature => {
    if (nature.code.includes('LOYER') || nature.label.toLowerCase().includes('loyer')) {
      loyerNatures.push(nature.code);
    }
  });

  for (const tx of transactions) {
    const nature = tx.nature ? natures.get(tx.nature) : null;
    const flow = nature?.flow?.toUpperCase();
    
    const hasCorrectNature = tx.nature === gestionCodes.rentNature;
    const hasCorrectCategory = gestionCodes.rentCategoryId ? tx.categoryId === gestionCodes.rentCategoryId : true;
    const isLoyer = hasCorrectNature && hasCorrectCategory;
    const isLoyerFallback = !gestionCodes.rentCategoryId && tx.nature && loyerNatures.includes(tx.nature);
    
    // IMPORTANT: Utiliser uniquement 'INCOME' (cohérent avec l'API)
    if ((isLoyer || isLoyerFallback) && flow === 'INCOME') {
      loyersEncaisses += Math.abs(tx.amount);
    }
  }

  return loyersEncaisses;
}

/**
 * Calcule le taux d'encaissement
 */
export function computeTauxEncaissement(
  loyersEncaisses: number,
  loyersAttendus: number
): number {
  return loyersAttendus > 0 ? (loyersEncaisses / loyersAttendus) * 100 : 0;
}

/**
 * Calcule tous les KPIs du dashboard
 */
export function computeDashboardKPIs(
  currentMonthTransactions: NormalizedTransaction[],
  prevMonthTransactions: NormalizedTransaction[],
  currentMonthLeases: NormalizedLease[],
  prevMonthLeases: NormalizedLease[],
  monthStart: Date,
  monthEnd: Date,
  prevMonthStart: Date,
  prevMonthEnd: Date,
  filters: DashboardFilters,
  natures: Map<string, NormalizedNature>,
  gestionCodes: GestionCodes,
  documentsCount: number
): MonthlyKPIs {
  // Calculer les encaissements et dépenses du mois courant
  const currentEncaissements = computeEncaissements(currentMonthTransactions, natures);
  const currentDepenses = computeDepenses(currentMonthTransactions, natures);
  const currentCashflow = computeCashflow(currentEncaissements.sommesEncaisses, currentDepenses.depensesRealisees);

  // Calculer les encaissements et dépenses du mois précédent
  const prevEncaissements = computeEncaissements(prevMonthTransactions, natures);
  const prevDepenses = computeDepenses(prevMonthTransactions, natures);
  const prevCashflow = computeCashflow(prevEncaissements.sommesEncaisses, prevDepenses.depensesRealisees);

  // Calculer les loyers attendus
  const loyersAttendus = computeLoyersAttendus(currentMonthLeases, monthStart, monthEnd, filters);
  const prevLoyersAttendus = computeLoyersAttendus(prevMonthLeases, prevMonthStart, prevMonthEnd, filters);

  // Calculer les loyers encaissés
  const loyersEncaisses = computeLoyersEncaisses(currentMonthTransactions, natures, gestionCodes);
  const prevLoyersEncaisses = computeLoyersEncaisses(prevMonthTransactions, natures, gestionCodes);

  // Calculer le taux d'encaissement
  const tauxEncaissement = computeTauxEncaissement(loyersEncaisses, loyersAttendus);
  const prevTauxEncaissement = computeTauxEncaissement(prevLoyersEncaisses, prevLoyersAttendus);

  // Compter les baux actifs
  const bauxActifs = currentMonthLeases.filter(l => l.status === 'ACTIF').length;

  return {
    sommesEncaisses: currentEncaissements.sommesEncaisses,
    sommesEncaissesRapprochees: currentEncaissements.sommesEncaissesRapprochees,
    loyersAttendus,
    depensesRealisees: currentDepenses.depensesRealisees,
    depensesRealiseesRapprochees: currentDepenses.depensesRealiseesRapprochees,
    cashflow: currentCashflow,
    tauxEncaissement,
    bauxActifs,
    documentsEnvoyes: documentsCount,
    deltaSommesEncaisses: currentEncaissements.sommesEncaisses - prevEncaissements.sommesEncaisses,
    deltaDepensesRealisees: currentDepenses.depensesRealisees - prevDepenses.depensesRealisees,
    deltaCashflow: currentCashflow - prevCashflow,
    deltaTauxEncaissement: tauxEncaissement - prevTauxEncaissement,
  };
}

