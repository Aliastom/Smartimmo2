'use client';

import React from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { cn } from '@/utils/cn';

export interface BorrowerKpi {
  name: string;
  principal: number;
  crd: number;
  monthlyPayment: number;
}

export interface LoansKpis {
  totalPrincipal: number;
  totalCRD: number;
  monthlyPaymentAvg: number;
  activeLoansCount: number;
  borrowers?: BorrowerKpi[];
}

/** KPI App Shell : soutenabilité globale (hors filtre tableau) */
export interface LoansSustainabilityKpi {
  loading: boolean;
  /** null = aucun bien avec prêt actif */
  value: number | null;
}

interface LoansKpiBarProps {
  kpis: LoansKpis;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  isLoading?: boolean;
  /** Présent uniquement en vue globale App Shell */
  sustainabilityKpi?: LoansSustainabilityKpi;
}

export function LoansKpiBar({
  kpis,
  activeFilter,
  onFilterChange,
  isLoading = false,
  sustainabilityKpi,
}: LoansKpiBarProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Fonction pour formater la répartition des co-emprunteurs
  const formatBorrowersDistribution = (kpiType: 'principal' | 'crd' | 'mensualite'): string => {
    if (!kpis.borrowers || kpis.borrowers.length === 0) {
      return 'Aucun co-emprunteur';
    }

    // Prendre les 2 premiers co-emprunteurs (pour éviter que ce soit trop long)
    const topBorrowers = kpis.borrowers.slice(0, 2);
    
    const formatted = topBorrowers.map(b => {
      let amount = 0;
      if (kpiType === 'principal') amount = b.principal;
      else if (kpiType === 'crd') amount = b.crd;
      else if (kpiType === 'mensualite') amount = b.monthlyPayment;
      
      // Utiliser les initiales si le nom est trop long
      const nameParts = b.name.split(' ');
      let displayName = b.name;
      if (b.name.length > 15) {
        // Prendre les initiales : "Jean Dupont" -> "J. D."
        displayName = nameParts.map(p => p.charAt(0).toUpperCase() + '.').join(' ');
      } else if (b.name.length > 10) {
        // Tronquer : "Jean Dupont" -> "Jean D."
        displayName = nameParts[0] + ' ' + (nameParts[1] ? nameParts[1].charAt(0) + '.' : '');
      }
      
      return `${displayName}: ${formatCurrency(amount)}`;
    });
    
    // Ajouter un indicateur s'il y a plus de co-emprunteurs
    if (kpis.borrowers.length > 2) {
      formatted.push(`+${kpis.borrowers.length - 2} autre${kpis.borrowers.length - 2 > 1 ? 's' : ''}`);
    }
    
    return formatted.join(' • ');
  };

  const cards = [
    {
      id: 'principal',
      title: 'Capital Initial Total',
      value: formatCurrency(kpis.totalPrincipal),
      iconName: 'DollarSign',
      color: 'blue' as const,
      trendLabel: formatBorrowersDistribution('principal'),
    },
    {
      id: 'crd',
      title: 'CRD Total',
      value: formatCurrency(kpis.totalCRD),
      iconName: 'TrendingDown',
      color: 'orange' as const,
      trendLabel: formatBorrowersDistribution('crd'),
    },
    {
      id: 'mensualite',
      title: 'Mensualité Moyenne',
      value: formatCurrency(kpis.monthlyPaymentAvg),
      iconName: 'CreditCard',
      color: 'green' as const,
      trendLabel: formatBorrowersDistribution('mensualite'),
    },
    {
      id: 'actifs',
      title: 'Prêts Actifs',
      value: kpis.activeLoansCount.toString(),
      iconName: 'CheckCircle',
      color: 'purple' as const,
      trendLabel: kpis.borrowers && kpis.borrowers.length > 0 
        ? `${kpis.borrowers.length} co-emprunteur${kpis.borrowers.length > 1 ? 's' : ''}`
        : 'Aucun co-emprunteur',
    },
  ];

  const handleCardClick = (cardId: string) => {
    onFilterChange(cardId);
  };

  const skeletonCount = sustainabilityKpi ? 5 : 4;

  if (isLoading) {
    return (
      <div
        className={cn(
          'grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0',
          sustainabilityKpi ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4',
        )}
      >
        {Array.from({ length: skeletonCount }, (_, i) => i + 1).map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse"
          >
            <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  const sustainabilityTrendLabel =
    'Moyenne par bien : cashflow brut moyen (12 mois) − mensualités des prêts actifs';

  return (
    <div
      className={cn(
        'grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0',
        sustainabilityKpi ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4',
      )}
    >
      {cards.map((card) => (
        <StatCard
          key={card.id}
          title={card.title}
          value={card.value}
          iconName={card.iconName}
          color={card.color}
          onClick={() => handleCardClick(card.id)}
          isActive={activeFilter === card.id}
          rightIndicator="none"
          trendLabel={card.trendLabel}
          trendValue={0}
          trendDirection="flat"
        />
      ))}
      {sustainabilityKpi &&
        (sustainabilityKpi.loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse flex flex-col gap-3">
            <div className="h-5 bg-gray-200 rounded w-2/3" />
            <div className="h-8 bg-gray-200 rounded w-4/5" />
            <div className="h-4 bg-gray-100 rounded w-full" />
          </div>
        ) : (
          <StatCard
            title="Cashflow net moyen après crédit"
            value={
              sustainabilityKpi.value === null
                ? '—'
                : formatCurrency(sustainabilityKpi.value)
            }
            iconName="Activity"
            color={
              sustainabilityKpi.value === null
                ? 'slate'
                : sustainabilityKpi.value >= 0
                  ? 'emerald'
                  : 'red'
            }
            disabled
            rightIndicator="none"
            trendLabel={sustainabilityTrendLabel}
            trendValue={0}
            trendDirection="flat"
          />
        ))}
    </div>
  );
}

