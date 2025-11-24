/**
 * Service de génération de rapports d'anomalies pour gestionnaire délégué
 */

import { prisma } from '@/lib/prisma';
import { getGestionCodes } from '@/lib/settings/appSettings';
import type { DelegatedManagementReportData } from '@/types/reports';

/**
 * Calcule les anomalies de gestion pour un gestionnaire délégué sur une période donnée
 */
export async function computeDelegatedManagementIssues(
  gestionnaireId: string,
  period: { from: Date; to: Date },
  includeFlags: {
    lateRents: boolean;
    unmatchedTransactions: boolean;
    amountGaps: boolean;
    missingIndexations: boolean;
  },
  organizationId: string
): Promise<DelegatedManagementReportData> {
  // 1. Récupérer le gestionnaire
  const gestionnaire = await prisma.managementCompany.findUnique({
    where: { id: gestionnaireId, organizationId },
    select: {
      id: true,
      nom: true,
      email: true,
    },
  });

  if (!gestionnaire) {
    throw new Error(`Gestionnaire délégué non trouvé: ${gestionnaireId}`);
  }

  // 2. Récupérer tous les biens gérés par ce gestionnaire
  const properties = await prisma.property.findMany({
    where: {
      managementCompanyId: gestionnaireId,
      organizationId,
      isArchived: false,
    },
    select: {
      id: true,
      name: true,
    },
  });

  const propertyIds = properties.map(p => p.id);

  if (propertyIds.length === 0) {
    // Aucun bien géré par ce gestionnaire, retourner un rapport vide
    return createEmptyReport(gestionnaire, period);
  }

  // 3. Récupérer TOUS les baux (actifs ou pas) pour ces biens - comme le dashboard
  const leases = await prisma.lease.findMany({
    where: {
      propertyId: { in: propertyIds },
      organizationId,
    },
    select: {
      id: true,
      propertyId: true,
      tenantId: true,
      rentAmount: true,
      chargesRecupMensuelles: true,
      startDate: true,
      endDate: true,
      Property: {
        select: {
          id: true,
          name: true,
          acquisitionDate: true, // IMPORTANT : date d'acquisition du bien (héritage)
        },
      },
      Tenant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      startDate: 'asc',
    },
  });

  // 4. Calculer les anomalies selon les flags
  const gestionCodes = await getGestionCodes();
  const rentNature = gestionCodes.rentNature;
  const rentCategorySlug = gestionCodes.rentCategory;

  // Récupérer l'ID de la catégorie correspondant au slug
  const rentCategory = await prisma.category.findUnique({
    where: { slug: rentCategorySlug },
    select: { id: true },
  });
  const rentCategoryId = rentCategory?.id || null;

  // 4.1. Loyers en retard - MÊME LOGIQUE QUE LE DASHBOARD + FILTRAGE PAR PÉRIODE
  const lateRents = includeFlags.lateRents
    ? await computeLateRents(leases, period, rentNature, rentCategoryId, organizationId)
    : [];

  // 4.2. Transactions non rapprochées
  const unmatchedTransactions = includeFlags.unmatchedTransactions
    ? await computeUnmatchedTransactions(gestionnaireId, period, organizationId)
    : [];

  // 4.3. Écarts de montant
  const amountGaps = includeFlags.amountGaps
    ? await computeAmountGaps(leases, period, rentNature, organizationId)
    : [];

  // 4.4. Indexations non appliquées (préparation)
  const missingIndexations = includeFlags.missingIndexations
    ? await computeMissingIndexations(leases, period, organizationId)
    : [];

  // 5. Calculer les graphiques
  const charts = computeCharts(lateRents, unmatchedTransactions, period);

  // 6. Synthèse
  const summary = {
    totalLateRents: lateRents.length,
    totalLateRentsAmount: lateRents.reduce((sum, r) => sum + r.dueAmount, 0),
    totalUnmatchedTransactions: unmatchedTransactions.length,
    totalUnmatchedAmount: unmatchedTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
    totalAmountGapsCases: amountGaps.length,
    totalAmountGapsValue: amountGaps.reduce((sum, g) => sum + Math.abs(g.diff), 0),
    totalMissingIndexationsCases: missingIndexations.length,
    totalMissingIndexationsAmount: missingIndexations.reduce((sum, i) => sum + i.diffPerMonth, 0),
    totalBaux: leases.length,
  };

  return {
    gestionnaire: {
      id: gestionnaire.id,
      name: gestionnaire.nom,
      email: gestionnaire.email || undefined,
    },
    period,
    summary,
    lateRents,
    unmatchedTransactions,
    amountGaps,
    missingIndexations,
    charts,
  };
}

/**
 * Calcule les loyers en retard - EXACTEMENT LA MÊME LOGIQUE QUE LE DASHBOARD (route.ts lignes 379-583)
 * + FILTRAGE PAR PÉRIODE (pour ne garder que les loyers en retard dans la période demandée)
 */
async function computeLateRents(
  leases: any[],
  period: { from: Date; to: Date },
  rentNature: string,
  rentCategoryId: string | null,
  organizationId: string
): Promise<DelegatedManagementReportData['lateRents']> {
  const lateRents: DelegatedManagementReportData['lateRents'] = [];

  if (leases.length === 0) {
    return lateRents;
  }

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // Générer tous les accounting_months de la période demandée (pour filtrer à la fin)
  const periodAccountingMonths: string[] = [];
  const startPeriodMonth = new Date(period.from.getFullYear(), period.from.getMonth(), 1);
  const endPeriodMonth = new Date(period.to.getFullYear(), period.to.getMonth(), 1);
  let currentPeriodMonth = new Date(startPeriodMonth);
  while (currentPeriodMonth <= endPeriodMonth) {
    periodAccountingMonths.push(`${currentPeriodMonth.getFullYear()}-${String(currentPeriodMonth.getMonth() + 1).padStart(2, '0')}`);
    currentPeriodMonth = new Date(currentPeriodMonth.getFullYear(), currentPeriodMonth.getMonth() + 1, 1);
  }

  // Récupérer les propertyIds des leases
  const propertyIds = [...new Set(leases.map(l => l.propertyId).filter(Boolean))];

  // Récupérer TOUTES les transactions avec nature ET category = codes système (payées ou non) pour vérifier ce qui existe
  // EXACTEMENT comme le dashboard lignes 437-468
  const whereAllRentTransactions: any = {
    propertyId: { in: propertyIds },
    nature: rentNature,
    organizationId,
  };

  // Filtrer aussi par catégorie si le code système est défini
  if (rentCategoryId) {
    whereAllRentTransactions.categoryId = rentCategoryId;
  }

  const allRentTransactions = await prisma.transaction.findMany({
    where: whereAllRentTransactions,
    select: {
      id: true,
      leaseId: true,
      accounting_month: true,
      propertyId: true,
      nature: true,
      categoryId: true,
    },
  });

  // Créer un Set pour une recherche rapide : "leaseId-accountingMonth"
  // EXACTEMENT comme le dashboard lignes 470-481
  const paidMonths = new Set<string>();
  allRentTransactions.forEach(tx => {
    // Vérifier que la transaction a bien la nature ET la catégorie système
    const hasCorrectNature = tx.nature === rentNature;
    const hasCorrectCategory = rentCategoryId ? tx.categoryId === rentCategoryId : true;
    
    if (tx.accounting_month && tx.leaseId && hasCorrectNature && hasCorrectCategory) {
      paidMonths.add(`${tx.leaseId}-${tx.accounting_month}`);
    }
  });

  // Grouper les baux par bien - EXACTEMENT comme le dashboard lignes 483-491
  const leasesByProperty = new Map<string, typeof leases>();
  for (const lease of leases) {
    const propertyId = lease.propertyId || 'unknown';
    if (!leasesByProperty.has(propertyId)) {
      leasesByProperty.set(propertyId, []);
    }
    leasesByProperty.get(propertyId)!.push(lease);
  }

  // Pour chaque bien, vérifier tous ses baux - EXACTEMENT comme le dashboard lignes 496-578
  for (const [propertyId, leasesForProperty] of leasesByProperty.entries()) {
    if (leasesForProperty.length === 0) continue;
    
    const property = leasesForProperty[0].Property;
    
    // Pour chaque bail de ce bien
    for (const lease of leasesForProperty) {
      const leaseStartDate = new Date(lease.startDate);
      const leaseEndDate = lease.endDate ? new Date(lease.endDate) : null;
      
      // Date d'acquisition du bien (héritage) - ne pas compter les retards avant cette date
      const propertyAcquisitionDate = property?.acquisitionDate 
        ? new Date(property.acquisitionDate) 
        : null;
      
      // Date de début de vérification : maximum entre début du bail et date d'acquisition
      // Si le bail a commencé avant l'héritage, on ne vérifie qu'à partir de l'héritage
      let effectiveStartDate = leaseStartDate;
      if (propertyAcquisitionDate && propertyAcquisitionDate > leaseStartDate) {
        effectiveStartDate = propertyAcquisitionDate;
      }
      
      // Générer tous les mois entre effectiveStartDate et endDate (ou aujourd'hui si pas de fin)
      const startMonth = new Date(effectiveStartDate.getFullYear(), effectiveStartDate.getMonth(), 1);
      const endMonth = leaseEndDate 
        ? new Date(leaseEndDate.getFullYear(), leaseEndDate.getMonth(), 1)
        : new Date(today.getFullYear(), today.getMonth(), 1);
      
      const currentMonthDate = new Date(startMonth);
      
      while (currentMonthDate <= endMonth) {
        const accountingMonth = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Vérifier les mois passés ET le mois en cours (si on est déjà dans le mois)
        // Pour le mois en cours, on considère qu'il est en retard si pas de transaction
        const isPastMonth = accountingMonth < currentMonthStr;
        const isCurrentMonth = accountingMonth === currentMonthStr;
        
        if (isPastMonth || isCurrentMonth) {
          // Vérifier si ce mois a une transaction avec nature ET category = codes système pour ce bail
          const isPaid = paidMonths.has(`${lease.id}-${accountingMonth}`);
          
          // Si pas de transaction = loyer en retard
          if (!isPaid) {
            // FILTRAGE PAR PÉRIODE : ne garder que les loyers en retard dans la période demandée
            if (!periodAccountingMonths.includes(accountingMonth)) {
              // Passer au mois suivant
              currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
              continue;
            }

            // Calculer le nombre de jours de retard
            // Pour le mois en cours, on calcule depuis le 1er du mois
            // Pour les mois passés, on calcule depuis la fin du mois
            let delayInDays = 0;
            if (isCurrentMonth) {
              // Mois en cours : retard depuis le 1er du mois
              const firstOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
              delayInDays = Math.floor((today.getTime() - firstOfMonth.getTime()) / (1000 * 60 * 60 * 24));
            } else {
              // Mois passé : retard depuis la fin du mois
              const endOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0);
              delayInDays = Math.floor((today.getTime() - endOfMonth.getTime()) / (1000 * 60 * 60 * 24));
            }
            
            // Formater le mois en français
            const monthNames = [
              'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
            ];
            const monthLabel = `${monthNames[currentMonthDate.getMonth()]} ${currentMonthDate.getFullYear()}`;
            
            const expectedAmount = lease.rentAmount + (lease.chargesRecupMensuelles || 0);
            
            lateRents.push({
              bienLabel: lease.Property.name,
              bailLabel: '',
              locataireName: `${lease.Tenant.firstName} ${lease.Tenant.lastName}`,
              month: monthLabel,
              dueAmount: expectedAmount,
              paidAmount: 0,
              delayInDays: delayInDays > 0 ? delayInDays : 0,
            });
          }
        }
        
        // Passer au mois suivant
        currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
      }
    }
  }

  // Trier les loyers en retard par nombre de jours de retard (les plus anciennes en premier)
  lateRents.sort((a, b) => (b.delayInDays || 0) - (a.delayInDays || 0));

  return lateRents;
}

/**
 * Calcule les transactions non rapprochées associées au gestionnaire
 * Utilise EXACTEMENT la même logique que le dashboard :
 * - Récupère les transactions des biens gérés par le gestionnaire
 * - Filtre par accounting_month dans la période
 * - Status : rapprochementStatus != 'rapprochee' (comme le dashboard utilise { not: 'rapprochee' })
 */
async function computeUnmatchedTransactions(
  gestionnaireId: string,
  period: { from: Date; to: Date },
  organizationId: string
) {
  // Récupérer les IDs des biens gérés par ce gestionnaire
  const properties = await prisma.property.findMany({
    where: {
      managementCompanyId: gestionnaireId,
      organizationId,
      isArchived: false,
    },
    select: {
      id: true,
    },
  });

  const propertyIds = properties.map(p => p.id);

  if (propertyIds.length === 0) {
    return [];
  }

  // Générer tous les accounting_months de la période
  const periodAccountingMonths: string[] = [];
  const startMonth = new Date(period.from.getFullYear(), period.from.getMonth(), 1);
  const endMonth = new Date(period.to.getFullYear(), period.to.getMonth(), 1);
  let currentMonth = new Date(startMonth);
  while (currentMonth <= endMonth) {
    periodAccountingMonths.push(`${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`);
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      propertyId: { in: propertyIds }, // Filtrer par biens gérés par le gestionnaire
      accounting_month: { in: periodAccountingMonths }, // Filtrer par accounting_month dans la période
      rapprochementStatus: { not: 'rapprochee' }, // Comme le dashboard : { not: 'rapprochee' }
      amount: { gt: 0 }, // Seulement les montants positifs (revenus), pas les commissions
      organizationId,
    },
    select: {
      id: true,
      date: true,
      label: true,
      amount: true,
      propertyId: true,
      leaseId: true,
      Property: {
        select: {
          name: true,
        },
      },
      Lease_Transaction_leaseIdToLease: {
        select: {
          Tenant: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: {
      date: 'desc',
    },
  });

  return transactions.map(t => ({
    date: t.date,
    label: t.label,
    amount: t.amount,
    potentialBien: t.Property?.name,
    potentialLocataire: t.Lease_Transaction_leaseIdToLease?.Tenant
      ? `${t.Lease_Transaction_leaseIdToLease.Tenant.firstName} ${t.Lease_Transaction_leaseIdToLease.Tenant.lastName}`
      : undefined,
  }));
}

/**
 * Calcule les écarts de montant entre loyers attendus et montants reversés
 */
async function computeAmountGaps(
  leases: any[],
  period: { from: Date; to: Date },
  rentNature: string,
  organizationId: string
) {
  const amountGaps: DelegatedManagementReportData['amountGaps'] = [];

  if (leases.length === 0) {
    return amountGaps;
  }

  const leaseIds = leases.map(l => l.id);

  // Générer les mois attendus dans la période
  const startMonth = new Date(period.from.getFullYear(), period.from.getMonth(), 1);
  const endMonth = new Date(period.to.getFullYear(), period.to.getMonth(), 1);

  // Récupérer toutes les transactions payées pour ces baux dans la période (une seule requête)
  const allAccountingMonths: string[] = [];
  let currentMonth = new Date(startMonth);
  while (currentMonth <= endMonth) {
    allAccountingMonths.push(`${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`);
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  }

  const paidTransactions = await prisma.transaction.findMany({
    where: {
      leaseId: { in: leaseIds },
      nature: rentNature,
      accounting_month: { in: allAccountingMonths },
      paidAt: { not: null },
      organizationId,
    },
    select: {
      leaseId: true,
      accounting_month: true,
      amount: true,
    },
  });

  // Grouper les transactions par leaseId et accounting_month
  const paidByLeaseAndMonth = new Map<string, number>();
  for (const trans of paidTransactions) {
    const key = `${trans.leaseId}|${trans.accounting_month}`;
    const existing = paidByLeaseAndMonth.get(key) || 0;
    paidByLeaseAndMonth.set(key, existing + Math.abs(trans.amount));
  }

  // Pour chaque bail, vérifier les écarts
  for (const lease of leases) {
    const leaseStart = new Date(lease.startDate);
    const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;
    
    let currentMonth = new Date(Math.max(startMonth.getTime(), leaseStart.getTime()));

    while (currentMonth <= endMonth) {
      if (leaseEnd && leaseEnd < currentMonth) {
        break;
      }

      const accountingMonth = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      const key = `${lease.id}|${accountingMonth}`;
      
      // Montant attendu
      const expectedAmount = lease.rentAmount + (lease.chargesRecupMensuelles || 0);
      
      // Montant reversé
      const receivedAmount = paidByLeaseAndMonth.get(key) || 0;
      const diff = expectedAmount - receivedAmount;
      
      // Si écart >= 0.01 €
      if (Math.abs(diff) >= 0.01) {
        const monthNames = [
          'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
          'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
        ];
        const monthLabel = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
        
        amountGaps.push({
          bienLabel: lease.Property.name,
          locataireName: `${lease.Tenant.firstName} ${lease.Tenant.lastName}`,
          month: monthLabel,
          expectedAmount,
          receivedAmount,
          diff,
        });
      }
      
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    }
  }

  return amountGaps;
}

/**
 * Calcule les indexations non appliquées (préparation - à implémenter)
 */
async function computeMissingIndexations(
  leases: any[],
  period: { from: Date; to: Date },
  organizationId: string
): Promise<DelegatedManagementReportData['missingIndexations']> {
  // TODO: Implémenter la logique d'indexation
  // Pour l'instant, retourner un tableau vide
  return [];
}

/**
 * Calcule les données pour les graphiques
 */
function computeCharts(
  lateRents: DelegatedManagementReportData['lateRents'],
  unmatchedTransactions: DelegatedManagementReportData['unmatchedTransactions'],
  period: { from: Date; to: Date }
) {
  // Regrouper les loyers en retard par mois
  const lateRentsByMonth = new Map<string, { count: number; amount: number }>();
  
  for (const rent of lateRents) {
    // Extraire le mois depuis le label "novembre 2025"
    const monthMatch = rent.month.match(/(\w+)\s+(\d{4})/);
    if (monthMatch) {
      const monthKey = `${monthMatch[2]}-${getMonthNumber(monthMatch[1])}`;
      const existing = lateRentsByMonth.get(monthKey) || { count: 0, amount: 0 };
      lateRentsByMonth.set(monthKey, {
        count: existing.count + 1,
        amount: existing.amount + rent.dueAmount,
      });
    }
  }
  
  const lateRentsCountByMonth = Array.from(lateRentsByMonth.entries())
    .map(([month, data]) => ({
      month,
      count: data.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  
  const lateRentsAmountByMonth = Array.from(lateRentsByMonth.entries())
    .map(([month, data]) => ({
      month,
      amount: data.amount,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  
  // Regrouper les transactions non rapprochées par mois
  const unmatchedByMonth = new Map<string, number>();
  for (const trans of unmatchedTransactions) {
    const monthKey = `${trans.date.getFullYear()}-${String(trans.date.getMonth() + 1).padStart(2, '0')}`;
    const existing = unmatchedByMonth.get(monthKey) || 0;
    unmatchedByMonth.set(monthKey, existing + Math.abs(trans.amount));
  }
  
  const unmatchedAmountByMonth = Array.from(unmatchedByMonth.entries())
    .map(([month, amount]) => ({
      month,
      amount,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  
  return {
    lateRentsCountByMonth,
    lateRentsAmountByMonth,
    unmatchedAmountByMonth,
  };
}

/**
 * Convertit le nom de mois français en numéro
 */
function getMonthNumber(monthName: string): string {
  const months: Record<string, string> = {
    'janvier': '01',
    'février': '02',
    'mars': '03',
    'avril': '04',
    'mai': '05',
    'juin': '06',
    'juillet': '07',
    'août': '08',
    'septembre': '09',
    'octobre': '10',
    'novembre': '11',
    'décembre': '12',
  };
  return months[monthName.toLowerCase()] || '01';
}

/**
 * Crée un rapport vide (aucun bien géré)
 */
function createEmptyReport(
  gestionnaire: { id: string; nom: string; email: string | null },
  period: { from: Date; to: Date }
): DelegatedManagementReportData {
  return {
    gestionnaire: {
      id: gestionnaire.id,
      name: gestionnaire.nom,
      email: gestionnaire.email || undefined,
    },
    period,
    summary: {
      totalLateRents: 0,
      totalLateRentsAmount: 0,
      totalUnmatchedTransactions: 0,
      totalUnmatchedAmount: 0,
      totalAmountGapsCases: 0,
      totalAmountGapsValue: 0,
      totalMissingIndexationsCases: 0,
      totalMissingIndexationsAmount: 0,
      totalBaux: 0,
    },
    lateRents: [],
    unmatchedTransactions: [],
    amountGaps: [],
    missingIndexations: [],
    charts: {
      lateRentsCountByMonth: [],
      lateRentsAmountByMonth: [],
      unmatchedAmountByMonth: [],
    },
  };
}


