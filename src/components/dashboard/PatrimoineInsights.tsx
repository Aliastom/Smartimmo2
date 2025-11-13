'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { PatrimoineKPIs, MonthlySeriesItem, AgendaItem } from '@/types/dashboard';
import { cn } from '@/utils/cn';

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

    return items;
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

  return (
    <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <Lightbulb className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="font-semibold text-gray-900 text-sm">💡 Analyse de votre patrimoine</h3>
            <div className="space-y-2.5">
              {insights.map((insight, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(insight.type)}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed flex-1">
                      {insight.message}
                    </p>
                  </div>
                  {insight.recommendation && (
                    <p className="text-xs text-gray-600 leading-relaxed ml-6 italic">
                      → {insight.recommendation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

