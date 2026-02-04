/**
 * Service offline-first pour la génération de rapports d'anomalies de gestion déléguée
 * Calcule le rapport depuis IndexedDB (sans Prisma, sans fetch)
 */

import type { DelegatedManagementReportData } from '@/types/reports';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';

export interface DelegatedManagementReportInput {
  gestionnaireId: string;
  period: {
    from: Date;
    to: Date;
  };
  include: {
    lateRents: boolean;
    unmatchedTransactions: boolean;
    amountGaps: boolean;
    missingIndexations: boolean;
  };
  organizationId: string;
}

/**
 * Calcule les anomalies de gestion pour un gestionnaire délégué depuis IndexedDB
 */
export async function computeDelegatedManagementIssuesOffline(
  input: DelegatedManagementReportInput
): Promise<DelegatedManagementReportData> {
  const { gestionnaireId, period, include, organizationId } = input;

  // 1. Récupérer le gestionnaire depuis IndexedDB
  const db = await getLocalDB();
  const gestionnaire = await db.ManagementCompany
    .where('id')
    .equals(gestionnaireId)
    .first();

  if (!gestionnaire || gestionnaire.organizationId !== organizationId) {
    throw new Error(`Gestionnaire délégué non trouvé: ${gestionnaireId}`);
  }

  // 2. Récupérer tous les biens gérés par ce gestionnaire
  const propertyRepo = getPropertyRepositoryOffline();
  const allProperties = await propertyRepo.getAll(organizationId, { includeArchived: false });
  const properties = allProperties.filter(p => p.managementCompanyId === gestionnaireId);

  const propertyIds = properties.map(p => p.id);

  if (propertyIds.length === 0) {
    // Aucun bien géré par ce gestionnaire, retourner un rapport vide
    return createEmptyReport(gestionnaire, period);
  }

  // 3. Récupérer TOUS les baux (actifs ou pas) pour ces biens
  const leaseRepo = getLeaseRepositoryOffline();
  const allLeases = await leaseRepo.getAll(organizationId);
  const leases = allLeases.filter(l => propertyIds.includes(l.propertyId));

  // Enrichir les leases avec les données du bien et du locataire
  const enrichedLeases = await Promise.all(
    leases.map(async (lease) => {
      const property = properties.find(p => p.id === lease.propertyId);
      const tenant = lease.tenantId
        ? await db.Tenant.where('id').equals(lease.tenantId).first()
        : null;

      return {
        ...lease,
        Property: property ? {
          id: property.id,
          name: property.name,
          acquisitionDate: property.acquisitionDate,
        } : null,
        Tenant: tenant ? {
          id: tenant.id,
          firstName: tenant.firstName || '',
          lastName: tenant.lastName || '',
        } : null,
      };
    })
  );

  // 4. Calculer les anomalies selon les flags
  // ⚠️ OFFLINE-FIRST: Utiliser les valeurs par défaut pour les codes de gestion
  // (AppSetting n'est pas encore stocké en IndexedDB, on utilise les valeurs par défaut)
  const rentNature = process.env.RENT_NATURE_CODE || 'RECETTE_LOYER';
  const rentCategorySlug = process.env.RENT_CATEGORY_CODE || 'loyer_principal';

  // Récupérer l'ID de la catégorie correspondant au slug
  // ⚠️ OFFLINE-FIRST: Utiliser filter() car slug n'est pas indexé
  let rentCategoryId: string | null = null;
  try {
    const allCategories = await db.Category.toArray();
    const rentCategory = allCategories.find(c => c.slug === rentCategorySlug);
    rentCategoryId = rentCategory?.id || null;
  } catch (error) {
    console.warn('[delegatedManagementReportOffline] Impossible de récupérer la catégorie par slug:', error);
  }

  // 4.1. Loyers en retard
  const lateRents = include.lateRents
    ? await computeLateRentsOffline(enrichedLeases, period, rentNature, rentCategoryId, organizationId)
    : [];

  // 4.2. Transactions non rapprochées
  const unmatchedTransactions = include.unmatchedTransactions
    ? await computeUnmatchedTransactionsOffline(gestionnaireId, period, organizationId)
    : [];

  // 4.3. Écarts de montant
  const amountGaps = include.amountGaps
    ? await computeAmountGapsOffline(enrichedLeases, period, rentNature, organizationId)
    : [];

  // 4.4. Indexations non appliquées (préparation)
  const missingIndexations = include.missingIndexations
    ? await computeMissingIndexationsOffline(enrichedLeases, period, organizationId)
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
    totalBaux: enrichedLeases.length,
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
 * Calcule les loyers en retard depuis IndexedDB
 */
async function computeLateRentsOffline(
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

  // Générer tous les accounting_months de la période demandée
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

  // Récupérer TOUTES les transactions avec nature ET category = codes système
  const transactionRepo = getTransactionRepositoryOffline();
  const allTransactions = await transactionRepo.getAll(organizationId, {
    propertyId: propertyIds.length === 1 ? propertyIds[0] : undefined,
  });

  // Filtrer les transactions de loyer
  const rentTransactions = allTransactions.filter(tx => {
    const hasCorrectNature = tx.nature === rentNature;
    const hasCorrectCategory = rentCategoryId ? tx.categoryId === rentCategoryId : true;
    return hasCorrectNature && hasCorrectCategory;
  });

  // Créer un Set pour une recherche rapide : "leaseId-accountingMonth"
  const paidMonths = new Set<string>();
  rentTransactions.forEach(tx => {
    if (tx.accounting_month && tx.leaseId) {
      paidMonths.add(`${tx.leaseId}-${tx.accounting_month}`);
    }
  });

  // Grouper les baux par bien
  const leasesByProperty = new Map<string, typeof leases>();
  for (const lease of leases) {
    const propertyId = lease.propertyId || 'unknown';
    if (!leasesByProperty.has(propertyId)) {
      leasesByProperty.set(propertyId, []);
    }
    leasesByProperty.get(propertyId)!.push(lease);
  }

  // Pour chaque bien, vérifier tous ses baux
  for (const [propertyId, leasesForProperty] of leasesByProperty.entries()) {
    if (leasesForProperty.length === 0) continue;
    
    const property = leasesForProperty[0].Property;
    
    // Pour chaque bail de ce bien
    for (const lease of leasesForProperty) {
      const leaseStartDate = new Date(lease.startDate);
      const leaseEndDate = lease.endDate ? new Date(lease.endDate) : null;
      
      // Date d'acquisition du bien (héritage)
      const propertyAcquisitionDate = property?.acquisitionDate 
        ? new Date(property.acquisitionDate) 
        : null;
      
      // Date de début de vérification : maximum entre début du bail et date d'acquisition
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
        
        // Vérifier les mois passés ET le mois en cours
        const isPastMonth = accountingMonth < currentMonthStr;
        const isCurrentMonth = accountingMonth === currentMonthStr;
        
        if (isPastMonth || isCurrentMonth) {
          // Vérifier si ce mois a une transaction
          const isPaid = paidMonths.has(`${lease.id}-${accountingMonth}`);
          
          // Si pas de transaction = loyer en retard
          if (!isPaid) {
            // FILTRAGE PAR PÉRIODE : ne garder que les loyers en retard dans la période demandée
            if (!periodAccountingMonths.includes(accountingMonth)) {
              currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
              continue;
            }

            // Calculer le nombre de jours de retard
            let delayInDays = 0;
            if (isCurrentMonth) {
              const firstOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
              delayInDays = Math.floor((today.getTime() - firstOfMonth.getTime()) / (1000 * 60 * 60 * 24));
            } else {
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
              bienLabel: lease.Property?.name || 'Bien inconnu',
              bailLabel: '',
              locataireName: lease.Tenant 
                ? `${lease.Tenant.firstName} ${lease.Tenant.lastName}`
                : 'Locataire inconnu',
              month: monthLabel,
              dueAmount: expectedAmount,
              paidAmount: 0,
              delayInDays: delayInDays > 0 ? delayInDays : 0,
            });
          }
        }
        
        currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
      }
    }
  }

  // Trier les loyers en retard par nombre de jours de retard
  lateRents.sort((a, b) => (b.delayInDays || 0) - (a.delayInDays || 0));

  return lateRents;
}

/**
 * Calcule les transactions non rapprochées depuis IndexedDB
 */
async function computeUnmatchedTransactionsOffline(
  gestionnaireId: string,
  period: { from: Date; to: Date },
  organizationId: string
): Promise<DelegatedManagementReportData['unmatchedTransactions']> {
  // Récupérer les IDs des biens gérés par ce gestionnaire
  const propertyRepo = getPropertyRepositoryOffline();
  const allProperties = await propertyRepo.getAll(organizationId, { includeArchived: false });
  const properties = allProperties.filter(p => p.managementCompanyId === gestionnaireId);
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

  // Récupérer les transactions non rapprochées
  const transactionRepo = getTransactionRepositoryOffline();
  const allTransactions = await transactionRepo.getAll(organizationId);
  
  const transactions = allTransactions.filter(t => 
    propertyIds.includes(t.propertyId) &&
    t.accounting_month && periodAccountingMonths.includes(t.accounting_month) &&
    t.rapprochementStatus !== 'rapprochee' &&
    t.amount > 0
  );

  // Enrichir avec les données du bien et du locataire
  const db = await getLocalDB();
  const enrichedTransactions = await Promise.all(
    transactions.map(async (t) => {
      const property = properties.find(p => p.id === t.propertyId);
      let tenantName: string | undefined;
      
      if (t.leaseId) {
        const lease = await db.Lease.where('id').equals(t.leaseId).first();
        if (lease?.tenantId) {
          const tenant = await db.Tenant.where('id').equals(lease.tenantId).first();
          if (tenant) {
            tenantName = `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim();
          }
        }
      }

      return {
        date: new Date(t.date),
        label: t.label,
        amount: t.amount,
        potentialBien: property?.name,
        potentialLocataire: tenantName,
      };
    })
  );

  return enrichedTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Calcule les écarts de montant depuis IndexedDB
 */
async function computeAmountGapsOffline(
  leases: any[],
  period: { from: Date; to: Date },
  rentNature: string,
  organizationId: string
): Promise<DelegatedManagementReportData['amountGaps']> {
  const amountGaps: DelegatedManagementReportData['amountGaps'] = [];

  if (leases.length === 0) {
    return amountGaps;
  }

  const leaseIds = leases.map(l => l.id);

  // Générer les mois attendus dans la période
  const startMonth = new Date(period.from.getFullYear(), period.from.getMonth(), 1);
  const endMonth = new Date(period.to.getFullYear(), period.to.getMonth(), 1);

  // Récupérer toutes les transactions payées pour ces baux dans la période
  const allAccountingMonths: string[] = [];
  let currentMonth = new Date(startMonth);
  while (currentMonth <= endMonth) {
    allAccountingMonths.push(`${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`);
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  }

  const transactionRepo = getTransactionRepositoryOffline();
  const allTransactions = await transactionRepo.getAll(organizationId);
  
  const paidTransactions = allTransactions.filter(t =>
    leaseIds.includes(t.leaseId || '') &&
    t.nature === rentNature &&
    t.accounting_month && allAccountingMonths.includes(t.accounting_month) &&
    t.paidAt !== null
  );

  // Grouper les transactions par leaseId et accounting_month
  const paidByLeaseAndMonth = new Map<string, number>();
  for (const trans of paidTransactions) {
    if (trans.leaseId && trans.accounting_month) {
      const key = `${trans.leaseId}|${trans.accounting_month}`;
      const existing = paidByLeaseAndMonth.get(key) || 0;
      paidByLeaseAndMonth.set(key, existing + Math.abs(trans.amount));
    }
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
          bienLabel: lease.Property?.name || 'Bien inconnu',
          locataireName: lease.Tenant 
            ? `${lease.Tenant.firstName} ${lease.Tenant.lastName}`
            : 'Locataire inconnu',
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
async function computeMissingIndexationsOffline(
  leases: any[],
  period: { from: Date; to: Date },
  organizationId: string
): Promise<DelegatedManagementReportData['missingIndexations']> {
  // TODO: Implémenter la logique d'indexation
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
