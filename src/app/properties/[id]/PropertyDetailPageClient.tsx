'use client';

import React, { useState } from 'react';
import { ArrowLeft, Edit, Trash2, Euro, TrendingUp, Calendar, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Property } from '../../../domain/entities/Property';
import { Transaction } from '../../../domain/entities/Transaction';
import { Loan } from '../../../domain/entities/Loan';
import { formatCurrencyEUR, formatDateFR, formatPercentage } from '../../../utils/format';
import KpiCard from '../../../ui/components/KpiCard';
import PropertyDrawer from '../../../ui/components/PropertyDrawer';

interface PropertyDetailPageClientProps {
  property: Property;
  transactions: Transaction[];
  loans: Loan[];
  yearRents: number;
  yearExpenses: number;
  annualCashFlow: number;
  yieldValue: number;
  capitalGain: number;
  capitalGainPercentage: number;
  missingRentAlert: boolean;
}

export default function PropertyDetailPageClient({
  property,
  transactions,
  loans,
  yearRents,
  yearExpenses,
  annualCashFlow,
  yieldValue,
  capitalGain,
  capitalGainPercentage,
  missingRentAlert
}: PropertyDetailPageClientProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const totalInvestment = property.acquisitionPrice + property.notaryFees;

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link 
              href="/biens"
              className="text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">{property.name}</h1>
              <div className="flex items-center space-x-2 text-neutral-600">
                <MapPin size={16} />
                <span>{property.address}, {property.postalCode} {property.city}</span>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="bg-primary-700 text-base-100 px-4 py-2 rounded-md shadow-md hover:bg-primary-800 transition-colors flex items-center space-x-2"
            >
              <Edit size={16} />
              <span>Modifier</span>
            </button>
            <button className="bg-error text-base-100 px-4 py-2 rounded-md shadow-md hover:bg-red-700 transition-colors flex items-center space-x-2">
              <Trash2 size={16} />
              <span>Supprimer</span>
            </button>
          </div>
        </div>

        {/* Alerte loyer manquant */}
        {missingRentAlert && (
          <div className="bg-warning-600 text-base-100 p-4 rounded-lg flex items-center space-x-3 shadow-card">
            <Calendar size={24} />
            <p className="font-medium">Alerte: loyer manquant pour ce mois-ci.</p>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard
            title="Loyers annuels"
            value={formatCurrencyEUR(yearRents)}
            icon={<Euro size={24} />}
            color="success"
          />
          <KpiCard
            title="Charges annuelles"
            value={formatCurrencyEUR(yearExpenses)}
            icon={<Euro size={24} />}
            color="danger"
          />
          <KpiCard
            title="Cash-flow annuel"
            value={formatCurrencyEUR(annualCashFlow)}
            icon={<TrendingUp size={24} />}
            color={annualCashFlow >= 0 ? "success" : "danger"}
          />
          <KpiCard
            title="Rendement"
            value={formatPercentage(yieldValue * 100)}
            icon={<TrendingUp size={24} />}
            color="primary"
          />
        </div>

        {/* Informations détaillées */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Informations générales */}
          <div className="bg-base-100 rounded-lg shadow-card p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Informations générales</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-neutral-600">Type:</span>
                <span className="font-medium">{property.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Surface:</span>
                <span className="font-medium">{property.surface} m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Pièces:</span>
                <span className="font-medium">{property.rooms}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Statut:</span>
                <span className="font-medium">{property.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Date d'acquisition:</span>
                <span className="font-medium">{formatDateFR(property.acquisitionDate)}</span>
              </div>
            </div>
          </div>

          {/* Investissement */}
          <div className="bg-base-100 rounded-lg shadow-card p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Investissement</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-neutral-600">Prix d'acquisition:</span>
                <span className="font-medium">{formatCurrencyEUR(property.acquisitionPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Frais de notaire:</span>
                <span className="font-medium">{formatCurrencyEUR(property.notaryFees)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Investissement total:</span>
                <span className="font-medium">{formatCurrencyEUR(totalInvestment)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Valeur actuelle:</span>
                <span className="font-medium">{formatCurrencyEUR(property.currentValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Plus-value:</span>
                <span className={`font-medium ${capitalGain >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatCurrencyEUR(capitalGain)} ({formatPercentage(capitalGainPercentage * 100)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Prêts associés */}
        {loans.length > 0 && (
          <div className="bg-base-100 rounded-lg shadow-card p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Prêts associés</h3>
            <div className="space-y-4">
              {loans.map((loan) => (
                <div key={loan.id} className="border border-neutral-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{loan.bankName}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      loan.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-base-200 text-base-content'
                    }`}>
                      {loan.status === 'active' ? 'Actif' : 'Clôturé'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-neutral-600">Montant:</span>
                      <div className="font-medium">{formatCurrencyEUR(loan.loanAmount)}</div>
                    </div>
                    <div>
                      <span className="text-neutral-600">Mensualité:</span>
                      <div className="font-medium">{formatCurrencyEUR(loan.monthlyPayment)}</div>
                    </div>
                    <div>
                      <span className="text-neutral-600">Taux:</span>
                      <div className="font-medium">{formatPercentage(loan.interestRate * 100)}</div>
                    </div>
                    <div>
                      <span className="text-neutral-600">Capital restant:</span>
                      <div className="font-medium">{formatCurrencyEUR(loan.remainingCapital)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions récentes */}
        <div className="bg-base-100 rounded-lg shadow-card p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Transactions récentes</h3>
          {transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.slice(0, 10).map((transaction) => (
                <div key={transaction.id} className="flex justify-between items-center py-2 border-b border-neutral-100 last:border-b-0">
                  <div>
                    <div className="font-medium">{transaction.label}</div>
                    <div className="text-sm text-neutral-600">
                      {formatDateFR(transaction.date)} • {transaction.amount > 0 ? 'Revenu' : 'Dépense'}
                    </div>
                  </div>
                  <div className={`font-medium ${
                    transaction.amount > 0 ? 'text-success' : 'text-error'
                  }`}>
                    {transaction.amount > 0 ? '+' : ''}{formatCurrencyEUR(transaction.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500">Aucune transaction enregistrée pour ce bien.</p>
          )}
        </div>
      </div>

      {/* PropertyDrawer pour l'édition */}
      <PropertyDrawer
        property={property}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onPropertyUpdate={() => {
          // Recharger la page
          window.location.reload();
        }}
      />
    </>
  );
}
