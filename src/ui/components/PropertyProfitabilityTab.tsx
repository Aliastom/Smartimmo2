'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Euro, Percent, Calendar, Home } from 'lucide-react';
import { Property } from '../../domain/entities/Property';
import { Transaction } from '../../domain/entities/Transaction';
import { Loan } from '../../domain/entities/Loan';
import { formatCurrencyEUR, formatPercentage } from '@/utils/format';

interface PropertyProfitabilityTabProps {
  property: Property;
  transactions: Transaction[];
  loan: Loan | null;
}

export default function PropertyProfitabilityTab({ property, transactions, loan }: PropertyProfitabilityTabProps) {
  // Calculs de rentabilité
  const currentYear = new Date().getFullYear();
  const currentYearTransactions = transactions.filter(t => 
    new Date(t.date).getFullYear() === currentYear
  );

  // Revenus (loyers)
  const rentalIncome = currentYearTransactions
    .filter(t => {
      // Supposer que les revenus ont un montant positif et sont liés aux loyers
      return t.amount > 0;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  // Charges (dépenses)
  const expenses = currentYearTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Charges de prêt
  const loanExpenses = loan ? loan.monthlyPayment * 12 : 0;

  // Revenus nets
  const netIncome = rentalIncome - expenses - loanExpenses;

  // Rentabilité brute
  const grossYield = property.acquisitionPrice > 0 ? (rentalIncome / property.acquisitionPrice) * 100 : 0;

  // Rentabilité nette
  const netYield = property.acquisitionPrice > 0 ? (netIncome / property.acquisitionPrice) * 100 : 0;

  // Cash-flow mensuel
  const monthlyCashFlow = netIncome / 12;

  // Plus-value potentielle
  const potentialGain = property.currentValue - property.acquisitionPrice;
  const gainPercentage = property.acquisitionPrice > 0 ? (potentialGain / property.acquisitionPrice) * 100 : 0;

  const metrics = [
    {
      title: 'Rentabilité brute',
      value: formatPercentage(grossYield),
      icon: TrendingUp,
      color: 'text-success',
      bgColor: 'bg-green-50',
      description: 'Loyers annuels / Prix d\'achat'
    },
    {
      title: 'Rentabilité nette',
      value: formatPercentage(netYield),
      icon: TrendingDown,
      color: 'text-primary',
      bgColor: 'bg-blue-50',
      description: 'Revenus nets / Prix d\'achat'
    },
    {
      title: 'Cash-flow mensuel',
      value: formatCurrencyEUR(monthlyCashFlow),
      icon: Euro,
      color: monthlyCashFlow >= 0 ? 'text-success' : 'text-error',
      bgColor: monthlyCashFlow >= 0 ? 'bg-green-50' : 'bg-red-50',
      description: 'Revenus nets / 12 mois'
    },
    {
      title: 'Plus-value potentielle',
      value: formatCurrencyEUR(potentialGain),
      icon: TrendingUp,
      color: potentialGain >= 0 ? 'text-success' : 'text-error',
      bgColor: potentialGain >= 0 ? 'bg-green-50' : 'bg-red-50',
      description: 'Valeur actuelle - Prix d\'achat'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h3 className="text-lg font-semibold text-neutral-900">Analyse de rentabilité</h3>
      </div>

      {/* Year Selector */}
      <div className="bg-base-100 border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-700">Année d'analyse :</span>
          <span className="text-sm text-neutral-900 font-semibold">{currentYear}</span>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Basé sur {currentYearTransactions.length} transaction(s) de l'année
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className={`${metric.bgColor} border border-neutral-200 rounded-lg p-6`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-neutral-700">{metric.title}</h4>
                <Icon className={`h-5 w-5 ${metric.color}`} />
              </div>
              <p className={`text-2xl font-bold ${metric.color} mb-1`}>{metric.value}</p>
              <p className="text-xs text-neutral-500">{metric.description}</p>
            </div>
          );
        })}
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-base-100 border border-neutral-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-neutral-900 mb-4 flex items-center">
          <Euro className="h-5 w-5 mr-2" />
          Détail des revenus et charges ({currentYear})
        </h4>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-neutral-100">
            <span className="text-neutral-700">Revenus locatifs</span>
            <span className="font-semibold text-success">{formatCurrencyEUR(rentalIncome)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-neutral-100">
            <span className="text-neutral-700">Charges et dépenses</span>
            <span className="font-semibold text-error">-{formatCurrencyEUR(expenses)}</span>
          </div>
          {loan && (
            <div className="flex justify-between items-center py-2 border-b border-neutral-100">
              <span className="text-neutral-700">Charges de prêt</span>
              <span className="font-semibold text-error">-{formatCurrencyEUR(loanExpenses)}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-3 border-t border-neutral-200">
            <span className="font-medium text-neutral-900">Revenus nets</span>
            <span className={`font-bold text-lg ${netIncome >= 0 ? 'text-success' : 'text-error'}`}>
              {formatCurrencyEUR(netIncome)}
            </span>
          </div>
        </div>
      </div>

      {/* Property Value Analysis */}
      <div className="bg-base-100 border border-neutral-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-neutral-900 mb-4 flex items-center">
          <Home className="h-5 w-5 mr-2" />
          Analyse de valeur
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-neutral-600 mb-1">Prix d'acquisition</p>
            <p className="text-lg font-semibold text-neutral-900">{formatCurrencyEUR(property.acquisitionPrice)}</p>
            <p className="text-xs text-neutral-500">{new Date(property.acquisitionDate).toLocaleDateString('fr-FR')}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-600 mb-1">Valeur actuelle</p>
            <p className="text-lg font-semibold text-neutral-900">{formatCurrencyEUR(property.currentValue)}</p>
            <p className={`text-xs ${potentialGain >= 0 ? 'text-success' : 'text-error'}`}>
              {potentialGain >= 0 ? '+' : ''}{formatPercentage(gainPercentage)} depuis l'acquisition
            </p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-blue-900 mb-3">Recommandations</h4>
        <div className="space-y-2 text-sm text-blue-800">
          {netYield < 3 && (
            <p>• La rentabilité nette est faible. Considérez optimiser les revenus ou réduire les charges.</p>
          )}
          {monthlyCashFlow < 0 && (
            <p>• Le cash-flow est négatif. Vérifiez les charges et considérez une réévaluation du loyer.</p>
          )}
          {potentialGain > 0 && (
            <p>• Excellente plus-value potentielle ! Le bien a pris de la valeur depuis l'acquisition.</p>
          )}
          {currentYearTransactions.length === 0 && (
            <p>• Aucune transaction enregistrée pour cette année. Ajoutez des transactions pour une analyse précise.</p>
          )}
        </div>
      </div>
    </div>
  );
}

