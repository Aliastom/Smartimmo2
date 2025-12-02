import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGestionCodes } from '@/lib/settings/appSettings';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { logDebug } from '@/lib/utils/logger';
import { buildSchedule } from '@/lib/finance/amortization';
import type {
  MonthlyDashboardData,
  MonthlyKPIs,
  LoyerNonEncaisse,
  TransactionNonRapprochee,
  IndexationATraiter,
  EcheancePret,
  EcheanceCharge,
  BailAEcheance,
  DocumentAValider,
} from '@/types/dashboard';

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/monthly
 * 
 * Récupère les données du dashboard mensuel opérationnel
 * 
 * Query params:
 * - month: string (Format YYYY-MM, défaut: mois courant)
 * - bienIds: string[] (IDs des biens, séparés par virgule)
 * - locataireIds: string[] (IDs des locataires, séparés par virgule)
 * - type: 'INCOME' | 'EXPENSE' | 'ALL' (défaut: ALL)
 * - statut: 'paye' | 'en_retard' | 'a_venir' | 'ALL' (défaut: ALL)
 * - source: 'loyer' | 'hors_loyer' | 'ALL' (défaut: ALL)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    logDebug('[Dashboard Monthly] User:', { id: user.id, email: user.email, organizationId });
    const searchParams = request.nextUrl.searchParams;
    
    // Période : mois courant par défaut
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const month = searchParams.get('month') || defaultMonth;
    
    // Calcul des bornes de la période
    const [year, monthNum] = month.split('-').map(Number);
    const firstDay = new Date(year, monthNum - 1, 1);
    const lastDay = new Date(year, monthNum, 0);
    const firstDayStr = firstDay.toISOString().split('T')[0];
    const lastDayStr = lastDay.toISOString().split('T')[0];
    
    // Période mois précédent pour les deltas
    const prevMonth = new Date(year, monthNum - 2, 1);
    const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    const prevFirstDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
    const prevLastDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0);
    
    // Filtres
    const bienIds = searchParams.get('bienIds')?.split(',').filter(Boolean) || [];
    const locataireIds = searchParams.get('locataireIds')?.split(',').filter(Boolean) || [];
    const typeFilter = searchParams.get('type') || 'ALL';
    const statutFilter = searchParams.get('statut') || 'ALL';
    const sourceFilter = searchParams.get('source') || 'ALL';
    const focusLoyer = searchParams.get('focusLoyer') === 'true';
    
    // ========================================================================
    // 1. CALCUL DES KPIs
    // ========================================================================
    
    // Filtres de base pour les transactions (utiliser uniquement accounting_month)
    const whereTransaction: any = {
      accounting_month: month,
      organizationId,
    };

    const wherePrevTransaction: any = {
      accounting_month: prevMonthStr,
      organizationId,
    };
    
    if (bienIds.length > 0) {
      whereTransaction.propertyId = { in: bienIds };
      wherePrevTransaction.propertyId = { in: bienIds };
    }
    
    if (locataireIds.length > 0) {
      whereTransaction.Lease_Transaction_leaseIdToLease = {
        tenantId: { in: locataireIds },
      };
      wherePrevTransaction.Lease_Transaction_leaseIdToLease = {
        tenantId: { in: locataireIds },
      };
    }
    
    // Récupérer les natures pour identifier les flows (INCOME/EXPENSE)
    const natures = await prisma.natureEntity.findMany({
      select: {
        code: true,
        label: true,
        flow: true,
      },
    });
    const natureMap = new Map(natures.map(n => [n.code, n]));
    
    // Transactions du mois courant (filtrées par accounting_month)
    const transactions = await prisma.transaction.findMany({
      where: whereTransaction,
      select: {
        id: true,
        amount: true,
        nature: true,
        categoryId: true,
        paidAt: true,
        rapprochementStatus: true,
        date: true,
        accounting_month: true,
        leaseId: true,
        Property: {
          select: {
            id: true,
            name: true,
          },
        },
        Lease_Transaction_leaseIdToLease: {
          select: {
            id: true,
            Tenant: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
    
    // Debug: logger le nombre de transactions trouvées
    const paidTransactions = transactions.filter(t => t.paidAt);
    const unpaidTransactions = transactions.filter(t => !t.paidAt);
    const withAccountingMonth = transactions.filter(t => t.accounting_month === month);
    const withNullAccountingMonth = transactions.filter(t => !t.accounting_month);
    
    logDebug('[Dashboard Monthly] Transactions trouvées:', {
      count: transactions.length,
      month,
      withAccountingMonth: withAccountingMonth.length,
      withNullAccountingMonth: withNullAccountingMonth.length,
      paidCount: paidTransactions.length,
      unpaidCount: unpaidTransactions.length,
      samplePaid: paidTransactions.slice(0, 3).map(t => ({
        id: t.id,
        accounting_month: t.accounting_month,
        paidAt: t.paidAt,
        amount: t.amount,
        nature: t.nature,
      })),
      sampleUnpaid: unpaidTransactions.slice(0, 3).map(t => ({
        id: t.id,
        accounting_month: t.accounting_month,
        paidAt: t.paidAt,
        amount: t.amount,
        nature: t.nature,
      })),
    });
    
    // Transactions du mois précédent (filtrées par accounting_month)
    const prevTransactions = await prisma.transaction.findMany({
      where: wherePrevTransaction,
      select: {
        id: true,
        amount: true,
        nature: true,
        categoryId: true,
        paidAt: true,
        rapprochementStatus: true,
        accounting_month: true,
      },
    });
    
    // Calcul des KPIs mois courant
    // IMPORTANT: Les KPIs se basent sur accounting_month, pas sur paidAt
    // Simplifié : Somme encaissée = toutes les transactions INCOME, Dépenses réalisées = toutes les transactions EXPENSE
    let sommesEncaisses = 0; // Total INCOME
    let sommesEncaissesRapprochees = 0; // INCOME avec paidAt
    let depensesRealisees = 0; // Total EXPENSE
    let depensesRealiseesRapprochees = 0; // EXPENSE avec paidAt
    let cashflow = 0;
    
    // Pour le filtre source et focusLoyer, on a besoin d'identifier les loyers et frais de gestion
    const gestionCodes = await getGestionCodes();
    const rentNature = gestionCodes.rentNature;
    const rentCategorySlug = gestionCodes.rentCategory;
    const mgmtNature = gestionCodes.mgmtNature;
    const mgmtCategorySlug = gestionCodes.mgmtCategory;
    
    const rentCategory = await prisma.category.findUnique({
      where: { slug: rentCategorySlug },
      select: { id: true },
    });
    const rentCategoryId = rentCategory?.id || null;
    
    const mgmtCategory = await prisma.category.findUnique({
      where: { slug: mgmtCategorySlug },
      select: { id: true },
    });
    const mgmtCategoryId = mgmtCategory?.id || null;
    
    const loyerNatures = natures
      .filter(n => n.code.includes('LOYER') || n.label.toLowerCase().includes('loyer'))
      .map(n => n.code);
    
    // Debug: compter les transactions par type
    let debugStats = {
      total: transactions.length,
      income: 0,
      expense: 0,
      filteredOut: 0,
    };
    
    for (const transaction of transactions) {
      const natureData = transaction.nature ? natureMap.get(transaction.nature) : null;
      const amount = transaction.amount;
      
      // Pour le filtre source, identifier les loyers
      const hasCorrectNature = transaction.nature === rentNature;
      const hasCorrectCategory = rentCategoryId ? transaction.categoryId === rentCategoryId : true;
      const isLoyer = hasCorrectNature && hasCorrectCategory;
      const isLoyerFallback = !rentCategoryId && transaction.nature && loyerNatures.includes(transaction.nature);
      const isLoyerFinal = isLoyer || isLoyerFallback;
      
      // Appliquer filtre source
      if (sourceFilter === 'loyer' && !isLoyerFinal) {
        debugStats.filteredOut++;
        continue;
      }
      if (sourceFilter === 'hors_loyer' && isLoyerFinal) {
        debugStats.filteredOut++;
        continue;
      }
      
      // Appliquer filtre statut (seulement pour l'affichage, pas pour les KPIs)
      if (statutFilter === 'paye' && !transaction.paidAt) {
        debugStats.filteredOut++;
        continue;
      }
      if (statutFilter === 'en_retard' && transaction.paidAt) {
        debugStats.filteredOut++;
        continue;
      }
      if (statutFilter === 'a_venir' && transaction.paidAt) {
        debugStats.filteredOut++;
        continue;
      }
      
      // Compter TOUTES les transactions du mois comptable (indépendamment de paidAt)
      // Si focusLoyer est activé, filtrer selon les codes système
      if (focusLoyer) {
        // Focus loyer : uniquement les transactions avec nature ET catégorie = codes système
        if (natureData?.flow === 'INCOME') {
          // Pour INCOME : doit être un loyer (nature + catégorie loyer)
          const isLoyer = transaction.nature === rentNature && 
                         (rentCategoryId ? transaction.categoryId === rentCategoryId : true);
          if (!isLoyer) {
            debugStats.filteredOut++;
            continue;
          }
        } else if (natureData?.flow === 'EXPENSE') {
          // Pour EXPENSE : doit être frais de gestion (nature + catégorie frais de gestion)
          const isFraisGestion = transaction.nature === mgmtNature && 
                                 (mgmtCategoryId ? transaction.categoryId === mgmtCategoryId : true);
          if (!isFraisGestion) {
            debugStats.filteredOut++;
            continue;
          }
        } else {
          // Pas INCOME ni EXPENSE, ignorer
          debugStats.filteredOut++;
          continue;
        }
      }
      
      // Simplifié : utiliser uniquement le flow
      // IMPORTANT: Utiliser rapprochementStatus pour les montants rapprochés (cohérent avec les transactions non rapprochées)
      if (natureData?.flow === 'INCOME') {
        const montant = Math.abs(amount);
        sommesEncaisses += montant;
        if (transaction.rapprochementStatus === 'rapprochee') {
          sommesEncaissesRapprochees += montant;
        }
        cashflow += montant;
        debugStats.income++;
      } else if (natureData?.flow === 'EXPENSE') {
        const montant = Math.abs(amount);
        depensesRealisees += montant;
        if (transaction.rapprochementStatus === 'rapprochee') {
          depensesRealiseesRapprochees += montant;
        }
        cashflow -= montant;
        debugStats.expense++;
      }
    }
    
    logDebug('[Dashboard Monthly] Calcul KPIs:', {
      ...debugStats,
      sommesEncaisses,
      sommesEncaissesRapprochees,
      depensesRealisees,
      depensesRealiseesRapprochees,
      cashflow,
    });
    
    // Calcul des KPIs mois précédent
    // IMPORTANT: Les KPIs se basent sur accounting_month, pas sur paidAt
    // Simplifié : utiliser uniquement le flow
    let prevSommesEncaisses = 0;
    let prevSommesEncaissesRapprochees = 0;
    let prevDepensesRealisees = 0;
    let prevDepensesRealiseesRapprochees = 0;
    let prevCashflow = 0;
    
    for (const transaction of prevTransactions) {
      const natureData = transaction.nature ? natureMap.get(transaction.nature) : null;
      const amount = transaction.amount;
      
      // Si focusLoyer est activé, filtrer selon les codes système
      if (focusLoyer) {
        if (natureData?.flow === 'INCOME') {
          const isLoyer = transaction.nature === rentNature && 
                         (rentCategoryId ? transaction.categoryId === rentCategoryId : true);
          if (!isLoyer) continue;
        } else if (natureData?.flow === 'EXPENSE') {
          const isFraisGestion = transaction.nature === mgmtNature && 
                                 (mgmtCategoryId ? transaction.categoryId === mgmtCategoryId : true);
          if (!isFraisGestion) continue;
        } else {
          continue;
        }
      }
      
      // Compter TOUTES les transactions du mois comptable (indépendamment de paidAt)
      // Simplifié : utiliser uniquement le flow
      // IMPORTANT: Utiliser rapprochementStatus pour les montants rapprochés (cohérent avec les transactions non rapprochées)
      if (natureData?.flow === 'INCOME') {
        const montant = Math.abs(amount);
        prevSommesEncaisses += montant;
        if (transaction.rapprochementStatus === 'rapprochee') {
          prevSommesEncaissesRapprochees += montant;
        }
        prevCashflow += montant;
      } else if (natureData?.flow === 'EXPENSE') {
        const montant = Math.abs(amount);
        prevDepensesRealisees += montant;
        if (transaction.rapprochementStatus === 'rapprochee') {
          prevDepensesRealiseesRapprochees += montant;
        }
        prevCashflow -= montant;
      }
    }
    
    // Calcul des loyers attendus (baux actifs)
    const whereLease: any = {
      status: 'ACTIF',
      startDate: {
        lte: lastDay,
      },
      OR: [
        { endDate: null },
        { endDate: { gte: firstDay } },
      ],
      organizationId,
    };
    
    if (bienIds.length > 0) {
      whereLease.propertyId = { in: bienIds };
    }
    
    if (locataireIds.length > 0) {
      whereLease.tenantId = { in: locataireIds };
    }
    
    const activeLeases = await prisma.lease.findMany({
      where: whereLease,
      select: {
        id: true,
        rentAmount: true,
        startDate: true,
        endDate: true,
      },
    });
    
    // Calculer loyers attendus avec prorata si nécessaire
    let loyersAttendus = 0;
    for (const lease of activeLeases) {
      const leaseStart = new Date(lease.startDate);
      const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;
      
      // Vérifier si bail actif tout le mois
      if (leaseStart <= firstDay && (!leaseEnd || leaseEnd >= lastDay)) {
        loyersAttendus += lease.rentAmount;
      } else {
        // Prorata temporis
        const daysInMonth = (lastDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24) + 1;
        let activeDays = daysInMonth;
        
        if (leaseStart > firstDay) {
          activeDays -= (leaseStart.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24);
        }
        
        if (leaseEnd && leaseEnd < lastDay) {
          activeDays -= (lastDay.getTime() - leaseEnd.getTime()) / (1000 * 60 * 60 * 24);
        }
        
        loyersAttendus += (lease.rentAmount * activeDays) / daysInMonth;
      }
    }
    
    const bauxActifs = activeLeases.length;
    // Le taux d'encaissement reste basé sur les loyers attendus vs loyers encaissés (pour les loyers uniquement)
    // On calcule les loyers encaissés pour le taux d'encaissement
    let loyersEncaisses = 0;
    for (const transaction of transactions) {
      const natureData = transaction.nature ? natureMap.get(transaction.nature) : null;
      const hasCorrectNature = transaction.nature === rentNature;
      const hasCorrectCategory = rentCategoryId ? transaction.categoryId === rentCategoryId : true;
      const isLoyer = hasCorrectNature && hasCorrectCategory;
      const isLoyerFallback = !rentCategoryId && transaction.nature && loyerNatures.includes(transaction.nature);
      if ((isLoyer || isLoyerFallback) && natureData?.flow === 'INCOME') {
        loyersEncaisses += Math.abs(transaction.amount);
      }
    }
    const tauxEncaissement = loyersAttendus > 0 ? (loyersEncaisses / loyersAttendus) * 100 : 0;
    
    // Calcul taux encaissement mois précédent
    const prevActiveLeases = await prisma.lease.count({
      where: {
        status: 'ACTIF',
        startDate: {
          lte: prevLastDay,
        },
        OR: [
          { endDate: null },
          { endDate: { gte: prevFirstDay } },
        ],
        organizationId,
      },
    });
    
    const prevLoyersAttendus = prevActiveLeases * (activeLeases.length > 0 ? loyersAttendus / activeLeases.length : 0);
    let prevLoyersEncaisses = 0;
    for (const transaction of prevTransactions) {
      const natureData = transaction.nature ? natureMap.get(transaction.nature) : null;
      const hasCorrectNature = transaction.nature === rentNature;
      const hasCorrectCategory = rentCategoryId ? transaction.categoryId === rentCategoryId : true;
      const isLoyer = hasCorrectNature && hasCorrectCategory;
      const isLoyerFallback = !rentCategoryId && transaction.nature && loyerNatures.includes(transaction.nature);
      if ((isLoyer || isLoyerFallback) && natureData?.flow === 'INCOME') {
        prevLoyersEncaisses += Math.abs(transaction.amount);
      }
    }
    const prevTauxEncaissement = prevLoyersAttendus > 0 ? (prevLoyersEncaisses / prevLoyersAttendus) * 100 : 0;
    
    // Documents générés/envoyés ce mois
    const documentsEnvoyes = await prisma.document.count({
      where: {
        uploadedAt: {
          gte: firstDay,
          lte: lastDay,
        },
        status: { not: 'pending' },
        organizationId,
      },
    });
    
    const kpis: MonthlyKPIs = {
      sommesEncaisses,
      sommesEncaissesRapprochees,
      loyersAttendus,
      depensesRealisees,
      depensesRealiseesRapprochees,
      cashflow,
      tauxEncaissement,
      bauxActifs,
      documentsEnvoyes,
      deltaSommesEncaisses: sommesEncaisses - prevSommesEncaisses,
      deltaDepensesRealisees: depensesRealisees - prevDepensesRealisees,
      deltaCashflow: cashflow - prevCashflow,
      deltaTauxEncaissement: tauxEncaissement - prevTauxEncaissement,
    };
    
    // ========================================================================
    // 2. LISTES ACTIONNABLES
    // ========================================================================
    
    // Relances : Calculer les loyers attendus par bien et vérifier les paiements
    // NOUVELLE LOGIQUE : Pour chaque bien, vérifier TOUS ses baux (actifs ou pas)
    // et ne compter comme en retard que les mois manquants pendant la durée d'un bail
    // On vérifie l'existence d'une transaction avec nature ET category = codes système
    
    const today = new Date();
    // Les codes système sont déjà récupérés plus haut, réutiliser les variables
    
    // Récupérer TOUS les baux (actifs ou pas) pour les biens concernés
    const whereAllLeases: any = {
      organizationId,
    };
    
    if (bienIds.length > 0) {
      whereAllLeases.propertyId = { in: bienIds };
    }
    
    if (locataireIds.length > 0) {
      whereAllLeases.tenantId = { in: locataireIds };
    }
    
    const allLeases = await prisma.lease.findMany({
      where: whereAllLeases,
      select: {
        id: true,
        rentAmount: true,
        startDate: true,
        endDate: true,
        propertyId: true,
        Property: {
          select: {
            id: true,
            name: true,
            acquisitionDate: true, // Date d'acquisition du bien (héritage)
          },
        },
        Tenant: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });
    
    // Récupérer TOUTES les transactions avec nature ET category = codes système (payées ou non) pour vérifier ce qui existe
    const whereAllRentTransactions: any = {
      nature: rentNature,
      organizationId,
    };
    
    // Filtrer aussi par catégorie si le code système est défini
    if (rentCategoryId) {
      whereAllRentTransactions.categoryId = rentCategoryId;
    }
    
    if (bienIds.length > 0) {
      whereAllRentTransactions.propertyId = { in: bienIds };
    }
    
    if (locataireIds.length > 0) {
      whereAllRentTransactions.Lease_Transaction_leaseIdToLease = {
        tenantId: { in: locataireIds },
      };
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
    // On vérifie par bail (leaseId + accounting_month) avec nature ET category = codes système
    const paidMonths = new Set<string>();
    allRentTransactions.forEach(tx => {
      // Vérifier que la transaction a bien la nature ET la catégorie système
      const hasCorrectNature = tx.nature === rentNature;
      const hasCorrectCategory = rentCategoryId ? tx.categoryId === rentCategoryId : true;
      
      if (tx.accounting_month && tx.leaseId && hasCorrectNature && hasCorrectCategory) {
        paidMonths.add(`${tx.leaseId}-${tx.accounting_month}`);
      }
    });
    
    // Grouper les baux par bien
    const leasesByProperty = new Map<string, typeof allLeases>();
    for (const lease of allLeases) {
      const propertyId = lease.propertyId || 'unknown';
      if (!leasesByProperty.has(propertyId)) {
        leasesByProperty.set(propertyId, []);
      }
      leasesByProperty.get(propertyId)!.push(lease);
    }
    
    const relances: LoyerNonEncaisse[] = [];
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    // Pour chaque bien, vérifier tous ses baux
    for (const [propertyId, leases] of leasesByProperty.entries()) {
      if (leases.length === 0) continue;
      
      const property = leases[0].Property;
      
      // Pour chaque bail de ce bien
      for (const lease of leases) {
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
              // Calculer le nombre de jours de retard
              // Pour le mois en cours, on calcule depuis le 1er du mois
              // Pour les mois passés, on calcule depuis la fin du mois
              let retardJours = 0;
              if (isCurrentMonth) {
                // Mois en cours : retard depuis le 1er du mois
                const firstOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
                retardJours = Math.floor((today.getTime() - firstOfMonth.getTime()) / (1000 * 60 * 60 * 24));
              } else {
                // Mois passé : retard depuis la fin du mois
                const endOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0);
                retardJours = Math.floor((today.getTime() - endOfMonth.getTime()) / (1000 * 60 * 60 * 24));
              }
              
              // Date d'échéance : fin du mois pour l'affichage
              const endOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0);
              
              relances.push({
                id: `${lease.id}-${accountingMonth}`, // ID virtuel unique
                leaseId: lease.id,
                propertyId: property?.id || propertyId,
                propertyName: property?.name || '',
                tenantName: lease.Tenant
                  ? `${lease.Tenant.firstName} ${lease.Tenant.lastName}`
                  : '',
                montant: lease.rentAmount,
                dateEcheance: endOfMonth.toISOString().split('T')[0],
                accountingMonth: accountingMonth,
                retardJours,
                statut: 'en_retard' as const,
              });
            }
          }
          
          // Passer au mois suivant
          currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
        }
      }
    }
    
    // Trier les relances par nombre de jours de retard (les plus anciennes en premier)
    relances.sort((a, b) => b.retardJours - a.retardJours);
    
    // Indexations à traiter (anniversaires de baux dans le mois ± 15j)
    const indexationStart = new Date(firstDay.getTime() - 15 * 24 * 60 * 60 * 1000);
    const indexationEnd = new Date(lastDay.getTime() + 15 * 24 * 60 * 60 * 1000);
    
    const indexations: IndexationATraiter[] = [];
    const leasesForIndexation = await prisma.lease.findMany({
      where: {
        status: 'ACTIF',
        indexationType: { not: null },
        organizationId,
      },
      select: {
        id: true,
        startDate: true,
        rentAmount: true,
        indexationType: true,
        Property: {
          select: {
            name: true,
          },
        },
        Tenant: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    
    for (const lease of leasesForIndexation) {
      const startDate = new Date(lease.startDate);
      // Calculer anniversaire dans l'année courante
      const anniversaire = new Date(year, startDate.getMonth(), startDate.getDate());
      
      if (anniversaire >= indexationStart && anniversaire <= indexationEnd) {
        indexations.push({
          id: `indexation-${lease.id}`,
          leaseId: lease.id,
          propertyName: lease.Property.name,
          tenantName: `${lease.Tenant.firstName} ${lease.Tenant.lastName}`,
          dateAnniversaire: anniversaire.toISOString().split('T')[0],
          loyerActuel: lease.rentAmount,
          indiceRequis: lease.indexationType || 'IRL',
        });
      }
    }
    
    // Échéances de prêts
    const echeancesPrets: EcheancePret[] = [];
    const loans = await prisma.loan.findMany({
      where: {
        isActive: true,
        startDate: {
          lte: lastDay,
        },
        OR: [
          { endDate: null },
          { endDate: { gte: firstDay } },
        ],
        organizationId,
      },
      select: {
        id: true,
        principal: true,
        annualRatePct: true,
        durationMonths: true,
        defermentMonths: true,
        insurancePct: true,
        startDate: true,
        paymentDay: true,
        property: {
          select: {
            name: true,
          },
        },
        LoanBorrower: {
          select: {
            firstName: true,
            lastName: true,
            responsibilityPct: true,
          },
        },
      },
    });
    
    for (const loan of loans) {
      // Pour un dashboard mensuel, afficher TOUS les prêts actifs ce mois-ci
      // Utiliser buildSchedule pour calculer correctement les intérêts et le capital du mois
      const schedule = buildSchedule({
        principal: Number(loan.principal),
        annualRatePct: Number(loan.annualRatePct),
        durationMonths: loan.durationMonths,
        defermentMonths: loan.defermentMonths || 0,
        insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
        startDate: loan.startDate,
        paymentDay: loan.paymentDay || undefined,
      });
      
      // Trouver la ligne du schedule correspondant au mois en cours
      const monthStr = `${year}-${String(monthNum).padStart(2, '0')}`;
      const scheduleRow = schedule.find(row => row.date === monthStr);
      
      if (scheduleRow) {
        // Calculer la date d'échéance basée sur paymentDay ou startDate
        const startDate = new Date(loan.startDate);
        const dayOfMonth = loan.paymentDay || startDate.getDate();
        const echeanceDate = new Date(year, monthNum - 1, dayOfMonth);
        const capital = scheduleRow.paymentPrincipal;
        const interets = scheduleRow.paymentInterest;
        const assurance = scheduleRow.paymentInsurance;
        const montantTotal = scheduleRow.paymentTotal;
        
        // 🆕 Informations sur les co-emprunteurs
        const borrowersCount = loan.LoanBorrower?.length || 0;
        let borrowersInfo = null;
        if (borrowersCount > 0) {
          const borrowers = loan.LoanBorrower.map(b => ({
            name: `${b.firstName} ${b.lastName}`,
            share: b.responsibilityPct ? Number(b.responsibilityPct) : null,
          }));
          borrowersInfo = {
            count: borrowersCount,
            borrowers,
          };
        }
        
        echeancesPrets.push({
          id: `pret-${loan.id}`,
          loanId: loan.id,
          propertyName: loan.property.name,
          dateEcheance: echeanceDate.toISOString().split('T')[0],
          montantTotal: Math.round(montantTotal * 100) / 100,
          capital: Math.round(capital * 100) / 100,
          interets: Math.round(interets * 100) / 100,
          assurance: Math.round(assurance * 100) / 100,
          borrowersInfo, // 🆕 Ajout info co-emprunteurs
        });
      }
    }
    
    // Échéances récurrentes (charges)
    const echeancesCharges: EcheanceCharge[] = [];
    const recurrentCharges = await prisma.echeanceRecurrente.findMany({
      where: {
        isActive: true,
        startAt: {
          lte: lastDay,
        },
        OR: [
          { endAt: null },
          { endAt: { gte: firstDay } },
        ],
        organizationId,
      },
      select: {
        id: true,
        label: true,
        type: true,
        montant: true,
        recuperable: true,
        periodicite: true,
        startAt: true,
        Property: {
          select: {
            name: true,
          },
        },
      },
    });
    
    for (const charge of recurrentCharges) {
      const startDate = new Date(charge.startAt);
      let echeanceDate: Date | null = null;
      
      // Calculer la date d'échéance selon la périodicité
      if (charge.periodicite === 'MONTHLY') {
        echeanceDate = new Date(year, monthNum - 1, startDate.getDate());
      } else if (charge.periodicite === 'QUARTERLY') {
        // Tous les 3 mois
        const startMonth = startDate.getMonth();
        if ((monthNum - 1 - startMonth) % 3 === 0) {
          echeanceDate = new Date(year, monthNum - 1, startDate.getDate());
        }
      } else if (charge.periodicite === 'YEARLY') {
        // Anniversaire annuel
        if (monthNum - 1 === startDate.getMonth()) {
          echeanceDate = new Date(year, monthNum - 1, startDate.getDate());
        }
      }
      
      if (echeanceDate && echeanceDate >= firstDay && echeanceDate <= lastDay) {
        echeancesCharges.push({
          id: `charge-${charge.id}`,
          echeanceId: charge.id,
          propertyName: charge.Property?.name,
          label: charge.label,
          type: charge.type,
          dateEcheance: echeanceDate.toISOString().split('T')[0],
          montant: Number(charge.montant),
          recuperable: charge.recuperable,
        });
      }
    }
    
    // Baux arrivant à échéance (dans les 3 mois)
    const bauxAEcheance: BailAEcheance[] = [];
    const echeanceLimit = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000); // 3 mois = 90 jours
    
    const leasesExpiring = await prisma.lease.findMany({
      where: {
        status: 'ACTIF',
        endDate: {
          not: null,
          gte: today,
          lte: echeanceLimit,
        },
        organizationId,
      },
      select: {
        id: true,
        endDate: true,
        Property: {
          select: {
            name: true,
          },
        },
        Tenant: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    
    for (const lease of leasesExpiring) {
      if (!lease.endDate) continue;
      
      const endDate = new Date(lease.endDate);
      const joursRestants = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      bauxAEcheance.push({
        id: `bail-${lease.id}`,
        leaseId: lease.id,
        propertyName: lease.Property.name,
        tenantName: `${lease.Tenant.firstName} ${lease.Tenant.lastName}`,
        dateFinBail: endDate.toISOString().split('T')[0],
        joursRestants,
      });
    }
    
    // Transactions non rapprochées (du mois sélectionné)
    const transactionsNonRapprochees: TransactionNonRapprochee[] = [];
    const whereTransactionsNonRapprochees: any = {
      accounting_month: month,
      organizationId,
      rapprochementStatus: { not: 'rapprochee' }, // Non rapprochées
    };
    
    if (bienIds.length > 0) {
      whereTransactionsNonRapprochees.propertyId = { in: bienIds };
    }
    
    if (locataireIds.length > 0) {
      whereTransactionsNonRapprochees.Lease_Transaction_leaseIdToLease = {
        tenantId: { in: locataireIds },
      };
    }
    
    const transactionsNonRapprocheesData = await prisma.transaction.findMany({
      where: whereTransactionsNonRapprochees,
      select: {
        id: true,
        label: true,
        amount: true,
        date: true,
        accounting_month: true,
        nature: true,
        propertyId: true,
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
    });
    
    for (const tx of transactionsNonRapprocheesData) {
      transactionsNonRapprochees.push({
        id: tx.id,
        propertyId: tx.propertyId,
        propertyName: tx.Property?.name || '',
        tenantName: tx.Lease_Transaction_leaseIdToLease?.Tenant
          ? `${tx.Lease_Transaction_leaseIdToLease.Tenant.firstName} ${tx.Lease_Transaction_leaseIdToLease.Tenant.lastName}`
          : undefined,
        label: tx.label,
        montant: Math.abs(tx.amount),
        date: tx.date.toISOString().split('T')[0],
        accountingMonth: tx.accounting_month || undefined,
        nature: tx.nature || undefined,
      });
    }
    
    // Documents à valider
    const documentsAValider: DocumentAValider[] = [];
    const docsToValidate = await prisma.document.findMany({
      where: {
        OR: [
          { ocrStatus: 'pending' },
          { ocrStatus: 'error' },
          { status: 'pending' },
        ],
        uploadedAt: {
          gte: firstDay,
          lte: lastDay,
        },
        organizationId,
      },
      select: {
        id: true,
        fileName: true,
        uploadedAt: true,
        ocrStatus: true,
        linkedTo: true,
        linkedId: true,
      },
      take: 20,
    });
    
    for (const doc of docsToValidate) {
      documentsAValider.push({
        id: doc.id,
        documentId: doc.id,
        fileName: doc.fileName,
        dateUpload: doc.uploadedAt.toISOString().split('T')[0],
        ocrStatus: doc.ocrStatus,
        linkedType: doc.linkedTo || undefined,
        linkedId: doc.linkedId || undefined,
      });
    }
    
    // ========================================================================
    // RÉPONSE
    // ========================================================================
    
    const response: MonthlyDashboardData = {
      period: {
        month,
        firstDay: firstDayStr,
        lastDay: lastDayStr,
      },
      kpis,
      aTraiter: {
        loyersNonEncaisses: [], // Plus utilisé, on utilise uniquement relances maintenant
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
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Erreur lors du calcul du dashboard mensuel:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul du dashboard mensuel' },
      { status: 500 }
    );
  }
}

