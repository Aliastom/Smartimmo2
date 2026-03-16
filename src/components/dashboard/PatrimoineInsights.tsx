'use client';

import React, { useMemo } from 'react';
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { PatrimoineKPIs, MonthlySeriesItem, AgendaItem } from '@/types/dashboard';

interface PatrimoineInsightsProps {
  kpis: PatrimoineKPIs;
  cashflow: MonthlySeriesItem[];
  agenda: AgendaItem[];
  mode: 'realise' | 'prevision' | 'lisse';
}

type InsightType = 'positive' | 'negative' | 'warning';

interface Insight {
  message: string;
  type: InsightType;
  recommendation?: string;
}

export function PatrimoineInsights({ kpis, cashflow, agenda, mode }: PatrimoineInsightsProps) {
  const insights = useMemo(() => {
    const items: Insight[] = [];

    // Analyse du cashflow annuel
    if (kpis.cashflowAnnuelMoyen !== null) {
      const annualCashflow = kpis.cashflowAnnuelMoyen * 12;
      if (annualCashflow > 0) {
        items.push({
          message: `Votre cashflow annuel ${mode === 'prevision' ? 'projeté' : 'réalisé'} est positif (+${Math.round(annualCashflow).toLocaleString('fr-FR')} €)`,
          type: 'positive',
        });
      } else if (annualCashflow < 0) {
        items.push({
          message: `Votre cashflow annuel ${mode === 'prevision' ? 'projeté' : 'réalisé'} est négatif (${Math.round(annualCashflow).toLocaleString('fr-FR')} €)`,
          type: 'negative',
          recommendation: 'Pensez à réduire vos charges non récupérables ou renégocier vos prêts.',
        });
      }
    }

    // Trouver le mois le plus chargé
    if (cashflow.length > 0) {
      const sortedMonths = [...cashflow].sort((a, b) => a.value - b.value);
      const worstMonth = sortedMonths[0];
      
      if (worstMonth && worstMonth.value < 0) {
        const [year, month] = worstMonth.month.split('-');
        const monthNames = [
          'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
          'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
        ];
        const monthName = monthNames[parseInt(month) - 1];
        
        // Trouver les grandes dépenses de ce mois
        const monthAgenda = agenda.filter(item => item.date.startsWith(worstMonth.month));
        const bigExpenses = monthAgenda
          .filter(item => item.amount && item.amount > 500)
          .sort((a, b) => (b.amount || 0) - (a.amount || 0))
          .slice(0, 2);
        
        if (bigExpenses.length > 0) {
          const expenseLabels = bigExpenses.map(e => 
            `${e.label.toLowerCase()} (${Math.round(e.amount || 0).toLocaleString('fr-FR')} €)`
          ).join(' et ');
          items.push({
            message: `Le mois de ${monthName} est le plus chargé à cause de ${expenseLabels}`,
            type: 'warning',
          });
        } else {
          items.push({
            message: `Le mois de ${monthName} ${year} présente le cashflow le plus faible`,
            type: 'warning',
          });
        }
      }
    }

    // Analyse du rendement
    if (kpis.rendementNet !== null) {
      if (kpis.rendementNet >= 5) {
        items.push({
          message: `Votre rendement net de ${kpis.rendementNet.toFixed(1)}% est excellent`,
          type: 'positive',
        });
      } else if (kpis.rendementNet >= 3) {
        items.push({
          message: `Votre rendement net de ${kpis.rendementNet.toFixed(1)}% est correct mais peut être amélioré`,
          type: 'warning',
        });
      } else {
        items.push({
          message: `Votre rendement net de ${kpis.rendementNet.toFixed(1)}% est en dessous des standards du marché`,
          type: 'negative',
          recommendation: 'Votre rentabilité est faible, envisagez une indexation de loyer ou une optimisation des charges.',
        });
      }
    }

    // Analyse de l'endettement
    if (kpis.ltv !== null && kpis.ltv > 0) {
      if (kpis.ltv > 80) {
        items.push({
          message: `Votre taux d'endettement (${kpis.ltv.toFixed(0)}%) est élevé`,
          type: 'negative',
          recommendation: 'Soyez prudent et anticipez vos échéances pour éviter les difficultés de trésorerie.',
        });
      } else if (kpis.ltv > 50) {
        items.push({
          message: `Votre taux d'endettement est de ${kpis.ltv.toFixed(0)}%`,
          type: 'warning',
          recommendation: 'Restez vigilant sur vos échéances de prêts.',
        });
      } else {
        items.push({
          message: `Votre taux d'endettement de ${kpis.ltv.toFixed(0)}% est maîtrisé`,
          type: 'positive',
        });
      }
    }

    // Analyse de la vacance
    if (kpis.vacancePct !== null && kpis.vacancePct > 10) {
      items.push({
        message: `Votre taux de vacance est de ${kpis.vacancePct.toFixed(1)}%`,
        type: 'warning',
        recommendation: 'Vérifiez vos baux en fin de période et anticipez les recherches de locataires.',
      });
    }

    // Prochaines échéances importantes
    if (mode === 'prevision' && agenda.length > 0) {
      const today = new Date();
      const upcomingExpenses = agenda
        .filter(item => {
          const itemDate = new Date(item.date);
          return itemDate > today && item.amount && item.amount > 1000;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 1);
      
      if (upcomingExpenses.length > 0) {
        const expense = upcomingExpenses[0];
        const expenseDate = new Date(expense.date);
        const daysUntil = Math.ceil((expenseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        items.push({
          message: `Prochaine échéance importante : ${expense.label} (${Math.round(expense.amount || 0).toLocaleString('fr-FR')} €) dans ${daysUntil} jours`,
          type: 'warning',
        });
      }
    }

    return items.slice(0, 3);
  }, [kpis, cashflow, agenda, mode]);

  const getIcon = (type: InsightType) => {
    switch (type) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    }
  };

  if (insights.length === 0) {
    return null;
  }

  const getTitle = (insight: Insight) => {
    if (insight.type === 'positive' && insight.message.includes('cashflow')) return 'Cashflow positif';
    if (insight.type === 'negative' && insight.message.includes('cashflow')) return 'Cashflow négatif';
    if (insight.message.includes('rendement')) return insight.type === 'positive' ? 'Rendement excellent' : insight.type === 'negative' ? 'Rendement faible' : 'Rendement correct';
    if (insight.message.includes('endettement')) return 'Endettement';
    if (insight.message.includes('mois de')) return 'Mois le plus chargé';
    if (insight.message.includes('vacance')) return 'Vacance';
    if (insight.message.includes('échéance')) return 'Prochaine échéance';
    return 'Point d\'attention';
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-blue-600" />
        Analyse de votre patrimoine
      </h3>
      <div className="grid gap-3 sm:grid-cols-1">
        {insights.map((insight, index) => (
          <div
            key={index}
            className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
          >
            <div className="flex-shrink-0 mt-0.5">{getIcon(insight.type)}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm">{getTitle(insight)}</p>
              <p className="text-sm text-gray-700 leading-snug mt-0.5">{insight.message}</p>
              {insight.recommendation && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Suggestion</p>
                  <p className="text-sm text-slate-600 mt-0.5 italic">{insight.recommendation}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

