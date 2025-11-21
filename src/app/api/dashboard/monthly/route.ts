import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGestionCodes } from '@/lib/settings/appSettings';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { logDebug } from '@/lib/utils/logger';
import type {
  MonthlyDashboardData,
  MonthlyKPIs,
  LoyerNonEncaisse,
  IndexationATraiter,
  EcheancePret,
  EcheanceCharge,
  BailAEcheance,
  DocumentAValider,
  IntraMensuelDataPoint,
  CashflowCumuleDataPoint,
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
    
    // Récupérer les natures pour identifier les loyers
    const natures = await prisma.natureEntity.findMany({
      select: {
        code: true,
        label: true,
        flow: true,
      },
    });
    const natureMap = new Map(natures.map(n => [n.code, n]));
    
    // Identifier les natures de type LOYER
    const loyerNatures = natures
      .filter(n => n.code.includes('LOYER') || n.label.toLowerCase().includes('loyer'))
      .map(n => n.code);
    
    // Transactions du mois courant (filtrées par accounting_month)
    const transactions = await prisma.transaction.findMany({
      where: whereTransaction,
      select: {
        id: true,
        amount: true,
        nature: true,
        paidAt: true,
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
        paidAt: true,
        accounting_month: true,
      },
    });
    
    // Calcul des KPIs mois courant
    // IMPORTANT: Les KPIs se basent sur accounting_month, pas sur paidAt
    let loyersEncaisses = 0;
    let chargesPayees = 0;
    let cashflow = 0;
    
    // Debug: compter les transactions par type
    let debugStats = {
      total: transactions.length,
      loyers: 0,
      charges: 0,
      filteredOut: 0,
    };
    
    for (const transaction of transactions) {
      const natureData = transaction.nature ? natureMap.get(transaction.nature) : null;
      const isLoyer = transaction.nature && loyerNatures.includes(transaction.nature);
      const amount = transaction.amount;
      
      // Appliquer filtre source
      if (sourceFilter === 'loyer' && !isLoyer) {
        debugStats.filteredOut++;
        continue;
      }
      if (sourceFilter === 'hors_loyer' && isLoyer) {
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
      if (isLoyer) {
        loyersEncaisses += Math.abs(amount);
        debugStats.loyers++;
      }
      
      if (natureData?.flow === 'INCOME') {
        cashflow += Math.abs(amount);
      } else if (natureData?.flow === 'EXPENSE') {
        chargesPayees += Math.abs(amount);
        cashflow -= Math.abs(amount);
        debugStats.charges++;
      }
    }
    
    logDebug('[Dashboard Monthly] Calcul KPIs:', {
      ...debugStats,
      loyersEncaisses,
      chargesPayees,
      cashflow,
    });
    
    // Calcul des KPIs mois précédent
    // IMPORTANT: Les KPIs se basent sur accounting_month, pas sur paidAt
    let prevLoyersEncaisses = 0;
    let prevChargesPayees = 0;
    let prevCashflow = 0;
    
    for (const transaction of prevTransactions) {
      const natureData = transaction.nature ? natureMap.get(transaction.nature) : null;
      const isLoyer = transaction.nature && loyerNatures.includes(transaction.nature);
      const amount = transaction.amount;
      
      // Compter TOUTES les transactions du mois comptable (indépendamment de paidAt)
      if (isLoyer) {
        prevLoyersEncaisses += Math.abs(amount);
      }
      
      if (natureData?.flow === 'INCOME') {
        prevCashflow += Math.abs(amount);
      } else if (natureData?.flow === 'EXPENSE') {
        prevChargesPayees += Math.abs(amount);
        prevCashflow -= Math.abs(amount);
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
      loyersEncaisses,
      loyersAttendus,
      chargesPayees,
      cashflow,
      tauxEncaissement,
      bauxActifs,
      documentsEnvoyes,
      deltaLoyersEncaisses: loyersEncaisses - prevLoyersEncaisses,
      deltaChargesPayees: chargesPayees - prevChargesPayees,
      deltaCashflow: cashflow - prevCashflow,
      deltaTauxEncaissement: tauxEncaissement - prevTauxEncaissement,
    };
    
    // ========================================================================
    // 2. LISTES ACTIONNABLES
    // ========================================================================
    
    // Loyers non encaissés / en retard (du mois courant)
    // Récupérer toutes les transactions de loyer du mois (même non payées) pour les relances
    const whereLoyersNonEncaisses: any = {
      accounting_month: month,
      organizationId,
      nature: { in: loyerNatures },
      paidAt: null, // Non payées
    };
    
    if (bienIds.length > 0) {
      whereLoyersNonEncaisses.propertyId = { in: bienIds };
    }
    
    if (locataireIds.length > 0) {
      whereLoyersNonEncaisses.Lease_Transaction_leaseIdToLease = {
        tenantId: { in: locataireIds },
      };
    }
    
    const loyersNonEncaissesTransactions = await prisma.transaction.findMany({
      where: whereLoyersNonEncaisses,
      select: {
        id: true,
        amount: true,
        date: true,
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
    
    const loyersNonEncaisses: LoyerNonEncaisse[] = [];
    const today = new Date();
    
    for (const transaction of loyersNonEncaissesTransactions) {
      const dateEcheance = new Date(transaction.date);
      const retardJours = Math.floor((today.getTime() - dateEcheance.getTime()) / (1000 * 60 * 60 * 24));
      const statut = retardJours > 0 ? 'en_retard' : 'a_venir';
      
      loyersNonEncaisses.push({
        id: transaction.id,
        leaseId: transaction.Lease_Transaction_leaseIdToLease?.id || '',
        propertyId: transaction.Property?.id || '',
        propertyName: transaction.Property?.name || '',
        tenantName: transaction.Lease_Transaction_leaseIdToLease?.Tenant 
          ? `${transaction.Lease_Transaction_leaseIdToLease.Tenant.firstName} ${transaction.Lease_Transaction_leaseIdToLease.Tenant.lastName}`
          : '',
        montant: Math.abs(transaction.amount),
        dateEcheance: dateEcheance.toISOString().split('T')[0],
        retardJours,
        statut,
      });
    }
    
    // Relances : Calculer les loyers attendus par bail et vérifier les paiements
    // On récupère la nature du loyer depuis la configuration
    const gestionCodes = await getGestionCodes();
    const rentNature = gestionCodes.rentNature;
    
    // Récupérer tous les baux actifs (avec filtres)
    const whereLeasesForRelances: any = {
      status: 'ACTIF',
      startDate: { lte: today },
      organizationId,
    };
    
    if (bienIds.length > 0) {
      whereLeasesForRelances.propertyId = { in: bienIds };
    }
    
    if (locataireIds.length > 0) {
      whereLeasesForRelances.tenantId = { in: locataireIds };
    }
    
    const leasesForRelances = await prisma.lease.findMany({
      where: whereLeasesForRelances,
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
    
    // Pour chaque bail, générer les mois attendus et vérifier les paiements
    const relances: LoyerNonEncaisse[] = [];
    
    if (leasesForRelances.length === 0) {
      // Pas de baux actifs, donc pas de relances
    } else {
      // Récupérer TOUTES les transactions de loyer payées pour les baux concernés (optimisation)
      const whereRentTransactions: any = {
        leaseId: { in: leasesForRelances.map(l => l.id) },
        nature: rentNature,
        paidAt: { not: null },
        organizationId,
      };
      
      const paidRentTransactions = await prisma.transaction.findMany({
        where: whereRentTransactions,
        select: {
          id: true,
          leaseId: true,
          accounting_month: true,
        },
      });
      
      // Créer un Set pour une recherche rapide : "leaseId-accountingMonth"
      const paidMonths = new Set<string>();
      paidRentTransactions.forEach(tx => {
        if (tx.accounting_month) {
          paidMonths.add(`${tx.leaseId}-${tx.accounting_month}`);
        }
      });
      
      const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      
      for (const lease of leasesForRelances) {
        const leaseStartDate = new Date(lease.startDate);
        const leaseEndDate = lease.endDate ? new Date(lease.endDate) : null;
        
        // Générer tous les mois depuis le début du bail jusqu'à maintenant
        const startMonth = new Date(leaseStartDate.getFullYear(), leaseStartDate.getMonth(), 1);
        const endMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const currentMonthDate = new Date(startMonth);
        
        while (currentMonthDate <= endMonth) {
          const accountingMonth = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
          
          // Si le bail est terminé avant ce mois, on s'arrête
          if (leaseEndDate && currentMonthDate > leaseEndDate) {
            break;
          }
          
          // Ne pas vérifier le mois en cours (seulement les mois passés)
          if (accountingMonth < currentMonthStr) {
            // Vérifier si ce mois a été payé
            const isPaid = paidMonths.has(`${lease.id}-${accountingMonth}`);
            
            // Si pas de transaction payée pour ce mois = loyer en retard
            if (!isPaid) {
              // Calculer le nombre de jours de retard depuis la fin du mois
              const endOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0);
              const retardJours = Math.floor((today.getTime() - endOfMonth.getTime()) / (1000 * 60 * 60 * 24));
              
              relances.push({
                id: `${lease.id}-${accountingMonth}`, // ID virtuel unique
                leaseId: lease.id,
                propertyId: lease.Property?.id || '',
                propertyName: lease.Property?.name || '',
                tenantName: lease.Tenant
                  ? `${lease.Tenant.firstName} ${lease.Tenant.lastName}`
                  : '',
                montant: lease.rentAmount,
                dateEcheance: endOfMonth.toISOString().split('T')[0],
                accountingMonth: accountingMonth, // Ajouter le mois comptable
                retardJours,
                statut: 'en_retard' as const,
              });
            }
          }
          
          // Passer au mois suivant
          currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
        }
      }
      
      // Trier les relances par nombre de jours de retard (les plus anciennes en premier)
      relances.sort((a, b) => b.retardJours - a.retardJours);
    }
    
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
        insurancePct: true,
        startDate: true,
        property: {
          select: {
            name: true,
          },
        },
      },
    });
    
    for (const loan of loans) {
      // Calcul simplifié de la mensualité
      const principal = Number(loan.principal);
      const monthlyRate = Number(loan.annualRatePct) / 100 / 12;
      const n = loan.durationMonths;
      
      let mensualite = 0;
      if (monthlyRate > 0) {
        mensualite = principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
      } else {
        mensualite = principal / n;
      }
      
      const assurance = loan.insurancePct ? (principal * Number(loan.insurancePct) / 100 / 12) : 0;
      const montantTotal = mensualite + assurance;
      
      // Date d'échéance = jour de début du prêt
      const startDate = new Date(loan.startDate);
      const echeanceDate = new Date(year, monthNum - 1, startDate.getDate());
      
      if (echeanceDate >= firstDay && echeanceDate <= lastDay) {
        echeancesPrets.push({
          id: `pret-${loan.id}`,
          loanId: loan.id,
          propertyName: loan.property.name,
          dateEcheance: echeanceDate.toISOString().split('T')[0],
          montantTotal,
          capital: mensualite - (mensualite * monthlyRate),
          interets: mensualite * monthlyRate,
          assurance,
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
    
    // Baux arrivant à échéance (dans les 30 jours)
    const bauxAEcheance: BailAEcheance[] = [];
    const echeanceLimit = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
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
    // 3. GRAPHIQUES
    // ========================================================================
    
    // Graphique intra-mensuel : encaissements vs dépenses par jour
    // Utiliser les transactions payées du mois comptable sélectionné
    const intraMensuel: IntraMensuelDataPoint[] = [];
    const dailyMap = new Map<string, { encaissements: number; depenses: number }>();
    
    // Initialiser tous les jours du mois
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dailyMap.set(dateStr, { encaissements: 0, depenses: 0 });
    }
    
    // Remplir avec les transactions du mois comptable (indépendamment de paidAt)
    // Utiliser la date de la transaction (date) au lieu de paidAt pour le graphique
    for (const transaction of transactions) {
      // Utiliser la date de la transaction, ou paidAt si disponible
      const transactionDate = transaction.paidAt || transaction.date;
      const dateStr = new Date(transactionDate).toISOString().split('T')[0];
      if (!dailyMap.has(dateStr)) continue;
      
      const data = dailyMap.get(dateStr)!;
      const natureData = transaction.nature ? natureMap.get(transaction.nature) : null;
      const amount = Math.abs(transaction.amount);
      
      if (natureData?.flow === 'INCOME') {
        data.encaissements += amount;
      } else if (natureData?.flow === 'EXPENSE') {
        data.depenses += amount;
      }
      
      dailyMap.set(dateStr, data);
    }
    
    // Convertir en tableau
    for (const [date, data] of Array.from(dailyMap.entries()).sort()) {
      intraMensuel.push({
        date,
        encaissements: data.encaissements,
        depenses: data.depenses,
      });
    }
    
    // Graphique cashflow cumulé
    const cashflowCumule: CashflowCumuleDataPoint[] = [];
    let cumulated = 0;
    
    for (const point of intraMensuel) {
      cumulated += point.encaissements - point.depenses;
      cashflowCumule.push({
        date: point.date,
        cashflow: cumulated,
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
        loyersNonEncaisses,
        relances,
        indexations,
        echeancesPrets,
        echeancesCharges,
        bauxAEcheance,
        documentsAValider,
      },
      graph: {
        intraMensuel,
        cashflowCumule,
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

