import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PatrimoineResponse, PatrimoineMode } from '@/types/dashboard';
import { expandEcheances } from '@/lib/echeances/expandEcheances';
import { buildSchedule, crdAtDate } from '@/lib/finance/amortization';

/**
 * GET /api/dashboard/patrimoine
 * Agrège les données pour le dashboard Patrimoine Global
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || getDefaultFrom();
    const to = searchParams.get('to') || getDefaultTo();
    const mode = (searchParams.get('mode') || 'realise') as PatrimoineMode;
    const propertyId = searchParams.get('propertyId') || undefined;
    const type = searchParams.get('type') || undefined;
    const leaseStatus = searchParams.get('leaseStatus') || undefined;

    // Parser les dates
    const [fromYear, fromMonth] = from.split('-').map(Number);
    const [toYear, toMonth] = to.split('-').map(Number);
    const fromDate = new Date(fromYear, fromMonth - 1, 1);
    const toDate = new Date(toYear, toMonth, 0, 23, 59, 59); // Dernier jour du mois

    // Générer tous les mois dans la période
    const months: string[] = [];
    let currentYear = fromYear;
    let currentMonth = fromMonth;
    while (currentYear < toYear || (currentYear === toYear && currentMonth <= toMonth)) {
      months.push(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    // Calculer selon le mode
    let response: PatrimoineResponse;
    if (mode === 'realise') {
      response = await calculateRealise(fromDate, toDate, months, propertyId, type, leaseStatus);
    } else if (mode === 'prevision') {
      response = await calculatePrevision(fromDate, toDate, months, propertyId, type, leaseStatus);
    } else {
      // Lissé : moyenne mobile 3 mois
      const realiseData = await calculateRealise(fromDate, toDate, months, propertyId, type, leaseStatus);
      response = smoothData(realiseData);
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] Error in /api/dashboard/patrimoine:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Erreur lors du calcul des données' },
      { status: 500 }
    );
  }
}

/**
 * Mode RÉALISÉ : transactions réelles avec paidAt non nul
 */
async function calculateRealise(
  fromDate: Date,
  toDate: Date,
  months: string[],
  propertyId?: string,
  type?: string,
  leaseStatus?: string
): Promise<PatrimoineResponse> {
  // Convertir les dates en format YYYY-MM pour comparer avec accounting_month
  const fromMonth = formatMonth(fromDate);
  const toMonth = formatMonth(toDate);

  const where: any = {
    paidAt: { not: null },
    // Filtrer par mois comptable (accounting_month) au lieu de date
    accounting_month: { gte: fromMonth, lte: toMonth },
  };

  if (propertyId) {
    where.propertyId = propertyId;
  }

  // Récupérer toutes les transactions réalisées
  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      id: true,
      amount: true,
      nature: true,
      date: true,
      accounting_month: true,
      propertyId: true,
      Property: {
        select: { name: true },
      },
    },
  });

  // Initialiser les séries mensuelles
  const loyersMap = new Map<string, number>();
  const chargesMap = new Map<string, number>();
  const cashflowMap = new Map<string, number>();

  months.forEach((month) => {
    loyersMap.set(month, 0);
    chargesMap.set(month, 0);
    cashflowMap.set(month, 0);
  });

  // Agréger par mois
  transactions.forEach((tx) => {
    // Utiliser accountingMonth si disponible, sinon formater la date
    const month = tx.accountingMonth || formatMonth(new Date(tx.date));
    if (!months.includes(month)) return;

    const amount = Math.abs(tx.amount || 0);
    const isLoyer = tx.nature === 'LOYER' || (tx.amount > 0 && !type) || type === 'loyer';
    const isCharge = tx.nature?.includes('CHARGE') || tx.nature?.includes('CHARGES') || (tx.amount < 0 && !type) || type === 'charges';

    if (isLoyer) {
      loyersMap.set(month, (loyersMap.get(month) || 0) + amount);
      cashflowMap.set(month, (cashflowMap.get(month) || 0) + amount);
    }
    if (isCharge) {
      const chargeAmount = Math.abs(amount);
      chargesMap.set(month, (chargesMap.get(month) || 0) + chargeAmount);
      cashflowMap.set(month, (cashflowMap.get(month) || 0) - chargeAmount);
    }
  });

  // Convertir en arrays
  const loyers = months.map((month) => ({
    month,
    value: loyersMap.get(month) || 0,
  }));

  const charges = months.map((month) => ({
    month,
    value: chargesMap.get(month) || 0,
  }));

  const cashflow = months.map((month) => ({
    month,
    value: cashflowMap.get(month) || 0,
  }));

  // Calculer les KPIs avec les séries de cashflow
  const cashflowValues = cashflow.map(item => item.value);
  const kpis = await calculateKPIs(fromDate, toDate, propertyId, 'realise', transactions, undefined, cashflowValues);

  // Répartition par bien
  const repartition = await calculateRepartitionParBien(transactions, type || 'loyers');

  // Agenda (transactions réelles)
  const agenda = transactions
      .filter((tx) => tx.paidAt)
      .map((tx) => ({
        date: new Date(tx.date).toISOString().split('T')[0],
        type: tx.nature?.toLowerCase() || 'transaction',
        label: tx.Property?.name || 'Transaction',
        amount: Math.abs(tx.amount || 0),
        entity: {
          kind: 'transaction' as const,
          id: tx.id,
        },
      }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 40); // Limiter à 40

  return {
    period: { from: months[0], to: months[months.length - 1], months },
    kpis,
    series: { loyers, charges, cashflow },
    repartitionParBien: repartition,
    agenda,
  };
}

/**
 * Mode PRÉVISIONNEL : baux actifs + échéances récurrentes
 */
async function calculatePrevision(
  fromDate: Date,
  toDate: Date,
  months: string[],
  propertyId?: string,
  type?: string,
  leaseStatus?: string
): Promise<PatrimoineResponse> {
  const whereLease: any = {
    status: leaseStatus || 'ACTIF',
    startDate: { lte: toDate },
    OR: [
      { endDate: null },
      { endDate: { gte: fromDate } },
    ],
  };

  if (propertyId) {
    whereLease.propertyId = propertyId;
  }

  // Récupérer les baux actifs
  const leases = await prisma.lease.findMany({
    where: whereLease,
    select: {
      id: true,
      propertyId: true,
      rentAmount: true,
      chargesRecupMensuelles: true,
      startDate: true,
      endDate: true,
      Property: {
        select: { name: true },
      },
    },
  });

  // Initialiser les séries
  const loyersMap = new Map<string, number>();
  const chargesMap = new Map<string, number>();
  const cashflowMap = new Map<string, number>();

  months.forEach((month) => {
    loyersMap.set(month, 0);
    chargesMap.set(month, 0);
    cashflowMap.set(month, 0);
  });

  // Calculer les loyers attendus par mois
  leases.forEach((lease) => {
    const startMonthStr = formatMonth(lease.startDate);
    const [leaseStartYear, leaseStartMonth] = startMonthStr.split('-').map(Number);
    const leaseEndYear = lease.endDate ? lease.endDate.getFullYear() : 9999;
    const leaseEndMonth = lease.endDate ? lease.endDate.getMonth() + 1 : 12;

    months.forEach((month) => {
      const [monthYear, monthMonth] = month.split('-').map(Number);
      const isActive =
        monthYear > leaseStartYear ||
        (monthYear === leaseStartYear && monthMonth >= leaseStartMonth);
      const isNotEnded =
        monthYear < leaseEndYear ||
        (monthYear === leaseEndYear && monthMonth <= leaseEndMonth);

      if (isActive && isNotEnded && (!type || type === 'loyer')) {
        const loyer = lease.rentAmount || 0;
        const charges = lease.chargesRecupMensuelles || 0;
        const total = loyer + charges;
        loyersMap.set(month, (loyersMap.get(month) || 0) + total);
        cashflowMap.set(month, (cashflowMap.get(month) || 0) + total);
      }
    });
  });

  // Récupérer les échéances récurrentes pour la période
  const whereEcheances: any = {
    isActive: true,
    startAt: { lte: toDate },
    OR: [
      { endAt: null },
      { endAt: { gte: fromDate } },
    ],
  };

  if (propertyId) {
    whereEcheances.propertyId = propertyId;
  }

  const echeancesRecurrentes = await prisma.echeanceRecurrente.findMany({
    where: whereEcheances,
    select: {
      id: true,
      propertyId: true,
      leaseId: true,
      label: true,
      type: true,
      periodicite: true,
      montant: true,
      recuperable: true,
      sens: true,
      startAt: true,
      endAt: true,
      isActive: true,
    },
  });

  // Convertir les Decimal en number pour expandEcheances
  const echeancesInput = echeancesRecurrentes.map((e) => ({
    ...e,
    montant: typeof e.montant === 'object' && 'toNumber' in e.montant 
      ? (e.montant as any).toNumber() 
      : parseFloat(e.montant.toString()),
    startAt: e.startAt instanceof Date ? e.startAt : new Date(e.startAt),
    endAt: e.endAt ? (e.endAt instanceof Date ? e.endAt : new Date(e.endAt)) : null,
  }));

  // Expand en occurrences mensuelles
  const occurrences = expandEcheances(echeancesInput, months[0], months[months.length - 1]);

  // Agréger les échéances par mois
  occurrences.forEach((occurrence) => {
    const month = occurrence.date.substring(0, 7); // YYYY-MM
    if (!months.includes(month)) return;

    const amount = occurrence.amount || 0;
    
    if (occurrence.sens === 'DEBIT') {
      // Charges (dépenses)
      chargesMap.set(month, (chargesMap.get(month) || 0) + amount);
      cashflowMap.set(month, (cashflowMap.get(month) || 0) - amount);
    } else if (occurrence.sens === 'CREDIT') {
      // Revenus (ex: LOYER_ATTENDU, CHARGE_RECUP)
      loyersMap.set(month, (loyersMap.get(month) || 0) + amount);
      cashflowMap.set(month, (cashflowMap.get(month) || 0) + amount);
    }
  });

  // Ajouter les mensualités de prêts aux charges prévisionnelles
  const whereLoan: any = { isActive: true };
  if (propertyId) {
    whereLoan.propertyId = propertyId;
  }

  const loans = await prisma.loan.findMany({
    where: whereLoan,
    select: {
      id: true,
      principal: true,
      annualRatePct: true,
      durationMonths: true,
      defermentMonths: true,
      insurancePct: true,
      startDate: true,
      endDate: true,
    },
  });

  // Pour chaque prêt, calculer les mensualités par mois
  loans.forEach((loan) => {
    const schedule = buildSchedule({
      principal: Number(loan.principal),
      annualRatePct: Number(loan.annualRatePct),
      durationMonths: loan.durationMonths,
      defermentMonths: loan.defermentMonths,
      insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
      startDate: loan.startDate,
    });

    // Pour chaque mois de la période, ajouter la mensualité si le prêt est actif
    months.forEach((month) => {
      const loanStartMonth = formatMonth(loan.startDate);
      const loanEndMonth = loan.endDate ? formatMonth(loan.endDate) : '9999-12';
      
      if (month >= loanStartMonth && month <= loanEndMonth) {
        // Trouver la ligne du schedule pour ce mois
        const scheduleRow = schedule.find(row => row.date === month);
        if (scheduleRow) {
          const monthlyPayment = scheduleRow.paymentTotal;
          chargesMap.set(month, (chargesMap.get(month) || 0) + monthlyPayment);
          cashflowMap.set(month, (cashflowMap.get(month) || 0) - monthlyPayment);
        }
      }
    });
  });

  // Convertir en arrays
  const loyers = months.map((month) => ({
    month,
    value: loyersMap.get(month) || 0,
  }));

  const charges = months.map((month) => ({
    month,
    value: chargesMap.get(month) || 0,
  }));

  const cashflow = months.map((month) => ({
    month,
    value: cashflowMap.get(month) || 0,
  }));

  // KPIs - calculer cashflowMois depuis les séries déjà calculées
  const lastMonth = months[months.length - 1];
  const lastMonthLoyers = loyersMap.get(lastMonth) || 0;
  const lastMonthCharges = chargesMap.get(lastMonth) || 0;
  const lastMonthCashflow = lastMonthLoyers - lastMonthCharges;
  
  // Calculer les KPIs avec les séries de cashflow
  const cashflowValues = cashflow.map(item => item.value);
  const kpis = await calculateKPIs(fromDate, toDate, propertyId, 'prevision', undefined, leases, cashflowValues);
  // Override cashflowMois avec la valeur calculée depuis les séries
  kpis.cashflowMois = lastMonthCashflow;

  // Répartition par bien (basée sur les baux)
  const repartition = leases.reduce((acc, lease) => {
    const label = lease.Property?.name || `Bien ${lease.propertyId}`;
    const value = (lease.rentAmount || 0) + (lease.chargesRecupMensuelles || 0);
    const existing = acc.find((r) => r.label === label);
    if (existing) {
      existing.value += value;
    } else {
      acc.push({ label, value });
    }
    return acc;
  }, [] as { label: string; value: number }[]);

  // Agenda : baux + échéances récurrentes
  const agendaLeases = leases.map((lease) => ({
    date: new Date(lease.startDate).toISOString().split('T')[0],
    type: 'loyer',
    label: `Loyer - ${lease.Property?.name || 'Bien'}`,
    amount: (lease.rentAmount || 0) + (lease.chargesRecupMensuelles || 0),
    entity: {
      kind: 'lease' as const,
      id: lease.id,
    },
  }));

  const agendaEcheances = occurrences.map((occ) => {
    // Mapper les types d'échéance vers les types AgendaItem
    const typeMap: Record<string, string> = {
      PRET: 'pret',
      COPRO: 'copro',
      PNO: 'pno',
      ASSURANCE: 'entretien',
      IMPOT: 'impots',
      CFE: 'cfe',
      ENTRETIEN: 'entretien',
      AUTRE: 'entretien',
      LOYER_ATTENDU: 'loyer',
      CHARGE_RECUP: 'loyer',
    };

    return {
      date: occ.date,
      type: typeMap[occ.type] || 'entretien',
      label: occ.label,
      amount: occ.amount,
      entity: occ.propertyId
        ? { kind: 'property' as const, id: occ.propertyId }
        : occ.leaseId
        ? { kind: 'lease' as const, id: occ.leaseId }
        : undefined,
    };
  });

  const agenda: PatrimoineResponse['agenda'] = [...agendaLeases, ...agendaEcheances]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 40);

  return {
    period: { from: months[0], to: months[months.length - 1], months },
    kpis,
    series: { loyers, charges, cashflow },
    repartitionParBien: repartition,
    agenda,
  };
}

/**
 * Mode LISSÉ : moyenne mobile 3 mois
 */
function smoothData(data: PatrimoineResponse): PatrimoineResponse {
  const smooth = (series: { month: string; value: number }[]) => {
    return series.map((item, index) => {
      const window = [
        index >= 2 ? series[index - 2].value : item.value,
        index >= 1 ? series[index - 1].value : item.value,
        item.value,
        index < series.length - 1 ? series[index + 1].value : item.value,
        index < series.length - 2 ? series[index + 2].value : item.value,
      ];
      const sum = window.reduce((a, b) => a + b, 0);
      return { month: item.month, value: sum / window.length };
    });
  };

  return {
    ...data,
    series: {
      loyers: smooth(data.series.loyers),
      charges: smooth(data.series.charges),
      cashflow: smooth(data.series.cashflow),
    },
    // Préserver la répartition par bien (pas lissée)
    repartitionParBien: Array.isArray(data.repartitionParBien) ? data.repartitionParBien : [],
  };
}

/**
 * Calcule les KPIs
 */
async function calculateKPIs(
  fromDate: Date,
  toDate: Date,
  propertyId: string | undefined,
  mode: 'realise' | 'prevision',
  transactions?: any[],
  leases?: any[],
  cashflowSeries?: number[]
): Promise<PatrimoineResponse['kpis']> {
  // Valeur du parc
  const whereProperty: any = {};
  if (propertyId) {
    whereProperty.id = propertyId;
  }

  const properties = await prisma.property.findMany({
    where: whereProperty,
    select: {
      id: true,
      currentValue: true,
      acquisitionPrice: true,
    },
  });

  const valeurParc = properties.reduce((sum, p) => {
    return sum + (p.currentValue || p.acquisitionPrice || 0);
  }, 0);

  // Encours / Dette - calculer le CRD total des prêts actifs
  const whereLoan: any = { isActive: true };
  if (propertyId) {
    whereLoan.propertyId = propertyId;
  }

  const loans = await prisma.loan.findMany({
    where: whereLoan,
    select: {
      id: true,
      principal: true,
      annualRatePct: true,
      durationMonths: true,
      defermentMonths: true,
      insurancePct: true,
      startDate: true,
    },
  });

  let encoursDette = 0;
  const toMonth = formatMonth(toDate);
  
  for (const loan of loans) {
    const schedule = buildSchedule({
      principal: Number(loan.principal),
      annualRatePct: Number(loan.annualRatePct),
      durationMonths: loan.durationMonths,
      defermentMonths: loan.defermentMonths,
      insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
      startDate: loan.startDate,
    });
    
    const crd = crdAtDate(schedule, toMonth);
    encoursDette += crd;
  }

  // Cashflow du mois (dernier mois de la période)
  let cashflowMois: number | null = null;
  const lastMonthStr = formatMonth(toDate);
  if (mode === 'realise' && transactions) {
    const lastMonth = transactions
        .filter((tx) => {
        if (!tx.paidAt) return false;
        const txMonth = formatMonth(new Date(tx.paidAt));
        return txMonth === lastMonthStr;
      })
      .reduce((sum, tx) => {
        return sum + (tx.amount || 0);
      }, 0);
    cashflowMois = lastMonth;
  } else if (mode === 'prevision') {
    // Cashflow du dernier mois = loyers attendus - charges prévisionnelles du dernier mois
    // On utilise les séries déjà calculées dans calculatePrevision
    // Cette fonction est appelée après, donc on doit passer les séries ou les recalculer
    // Pour l'instant, on simplifie en calculant depuis les leases uniquement
    // TODO: Passer les occurrences d'échéances pour calculer précisément
    const lastMonthLeases = leases?.filter((lease) => {
      const leaseStart = new Date(lease.startDate);
      return leaseStart <= toDate && (!lease.endDate || new Date(lease.endDate) >= toDate);
    }) || [];
    const loyersMois = lastMonthLeases.reduce((sum, lease) => {
      return sum + (lease.rentAmount || 0) + (lease.chargesRecupMensuelles || 0);
    }, 0);
    // Les charges sont calculées via expandEcheances dans calculatePrevision
    // On retourne seulement les loyers pour l'instant (sera mis à jour dans calculatePrevision)
    cashflowMois = loyersMois;
  }

  // Rendement net = (Loyers annuels - Charges non récup - Mensualités prêts) / Valeur parc * 100
  let rendementNet: number | null = null;
  if (valeurParc > 0 && cashflowSeries && cashflowSeries.length > 0) {
    // Calculer les loyers annuels à partir des séries
    const monthlyLoyers = transactions
      ? transactions
          .filter((tx) => tx.nature === 'LOYER' || tx.amount > 0)
          .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0) / Math.max(transactions.length, 1)
      : leases
      ? leases.reduce((sum, lease) => sum + (lease.rentAmount || 0), 0) / Math.max(leases.length, 1)
      : 0;
    
    const annualRent = monthlyLoyers * 12;
    
    // Charges non récupérées (10% des loyers)
    const chargesNonRecup = annualRent * 0.1;
    
    // Mensualités annuelles des prêts
    let annualLoanPayments = 0;
    for (const loan of loans) {
      const schedule = buildSchedule({
        principal: Number(loan.principal),
        annualRatePct: Number(loan.annualRatePct),
        durationMonths: loan.durationMonths,
        defermentMonths: loan.defermentMonths,
        insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
        startDate: loan.startDate,
      });
      
      // Somme des mensualités sur 12 mois (ou moins si le prêt est plus court)
      const monthlyPayments = schedule.slice(0, 12).reduce((sum, row) => sum + row.paymentTotal, 0);
      annualLoanPayments += monthlyPayments;
    }
    
    // Nouvelle formule
    rendementNet = ((annualRent - chargesNonRecup - annualLoanPayments) / valeurParc) * 100;
  }

  // Vacance (%)
  let vacancePct: number | null = null;
  const totalMonths = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (totalMonths > 0 && properties.length > 0) {
    // Compter les mois sans bail actif (simplifié)
    const monthsWithLeases = leases
      ? leases.length * totalMonths // Approximation
      : totalMonths * properties.length * 0.8; // 80% d'occupation par défaut
    const totalMonthsPossible = totalMonths * properties.length;
    vacancePct = ((totalMonthsPossible - monthsWithLeases) / totalMonthsPossible) * 100;
  }

  // LTV (Loan-to-Value) = Dette / Valeur du parc
  let ltv: number | null = null;
  if (valeurParc > 0 && encoursDette > 0) {
    ltv = (encoursDette / valeurParc) * 100;
  }

  // Cashflow annuel moyen = somme(cashflow_mensuel) / nombre_de_mois
  let cashflowAnnuelMoyen: number | null = null;
  if (cashflowSeries && cashflowSeries.length > 0) {
    const sumCashflow = cashflowSeries.reduce((sum, val) => sum + val, 0);
    cashflowAnnuelMoyen = sumCashflow / cashflowSeries.length;
  }

  return {
    valeurParc: valeurParc || null,
    encoursDette,
    ltv,
    cashflowMois,
    cashflowAnnuelMoyen,
    rendementNet,
    vacancePct,
  };
}

/**
 * Calcul de la répartition par bien
 */
async function calculateRepartitionParBien(
  transactions: any[],
  type: 'loyers' | 'charges'
): Promise<{ label: string; value: number }[]> {
  const map = new Map<string, number>();

  transactions.forEach((tx) => {
    const label = tx.Property?.name || `Bien ${tx.propertyId}`;
    const isLoyer = tx.nature === 'LOYER' || tx.amount > 0;
    const isCharge = tx.nature?.includes('CHARGE') || tx.amount < 0;

    if ((type === 'loyers' && isLoyer) || (type === 'charges' && isCharge)) {
      const amount = Math.abs(tx.amount || 0);
      map.set(label, (map.get(label) || 0) + amount);
    }
  });

  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}

// Helpers
function formatMonth(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getDefaultFrom(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 11);
  return formatMonth(date);
}

function getDefaultTo(): string {
  return formatMonth(new Date());
}

