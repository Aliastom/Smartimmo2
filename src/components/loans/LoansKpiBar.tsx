'use client';

import React from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { Wallet, TrendingDown, Hash, CheckCircle } from 'lucide-react';

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

interface LoansKpiBarProps {
  kpis: LoansKpis;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  isLoading?: boolean;
}

export function LoansKpiBar({
  kpis,
  activeFilter,
  onFilterChange,
  isLoading = false,
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

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
        {[1, 2, 3, 4].map((i) => (
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

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
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
    </div>
  );
}

