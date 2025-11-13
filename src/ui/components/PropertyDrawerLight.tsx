'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRight, MapPin, Euro, TrendingUp, Home } from 'lucide-react';
import { Property } from '../../domain/entities/Property';
import { Payment } from '../../domain/entities/Payment';
import { Lease } from '../../domain/entities/Lease';
import { formatCurrencyEUR, formatDateFR, formatPercentage } from '@/utils/format';
import Link from 'next/link';
import KpiCard from './KpiCard';
import { usePropertyRuntimeStatus } from '../hooks/usePropertyRuntimeStatus';
import { usePropertySummary } from '../hooks/usePropertySummary';
import { isLeaseActive } from '../../lib/leases';

interface PropertyDrawerLightProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
}

// Helper functions for transaction display
function getTransactionKind(tx: any): 'REVENUE' | 'EXPENSE' | 'OTHER' {
  // 1. Si l'API fournit un signedAmount:
  if (typeof tx.signedAmount === 'number') {
    if (tx.signedAmount > 0) return 'REVENUE';
    if (tx.signedAmount < 0) return 'EXPENSE';
  }
  
  // 2. Sinon, utilise la catégorie (DB) si disponible:
  const categoryType = tx?.accountingCategory?.type; // 'REVENU' | 'DEPENSE' | 'NON_DEFINI'
  if (categoryType === 'REVENU') return 'REVENUE';
  if (categoryType === 'DEPENSE') return 'EXPENSE';
  
  // 3. Fallback via nature si mappée:
  if (['LOYER', 'CHARGES', 'DEPOT_RECU'].includes(tx.nature)) return 'REVENUE';
  if (['ASSURANCE', 'TRAVAUX', 'TAXE_FONCIERE', 'AUTRE'].includes(tx.nature)) return 'EXPENSE';
  
  return 'OTHER';
}

function formatSignedAmount(tx: any): string {
  const kind = getTransactionKind(tx);
  const amt = Number(tx.amount ?? 0);
  const sign = kind === 'EXPENSE' ? '-' : kind === 'REVENUE' ? '+' : '';
  return `${sign}${amt.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`;
}

export default function PropertyDrawerLight({ property, isOpen, onClose }: PropertyDrawerLightProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);

  // Statut automatique basé sur les baux actifs
  const { label: statusLabel, color: statusColor } = usePropertyRuntimeStatus(property?.id || '', {
    enabled: !!property?.id
  });

  // Résumé financier calculé côté backend
  const { data: summaryData } = usePropertySummary(property?.id || '');

  useEffect(() => {
    if (property && isOpen) {
      fetchData();
    }
  }, [property, isOpen]);

  const fetchData = async () => {
    if (!property) return;
    
    setLoading(true);
    try {
      const [paymentsRes, leasesRes] = await Promise.all([
        fetch(`/api/payments?propertyId=${property.id}`),
        fetch(`/api/leases?propertyId=${property.id}`),
      ]);

      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        setPayments(data.items || []);
      }

      if (leasesRes.ok) {
        const data = await leasesRes.json();
        setLeases(data.Lease || data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !property) return null;

  const currentYear = new Date().getFullYear();
  const yearPayments = payments.filter((p: any) => p.periodYear === currentYear);
  const yearRents = yearPayments
    .filter((p: any) => ['LOYER', 'CHARGES'].includes(p.Category))
    .reduce((sum, p: any) => sum + p.amount, 0);
  
  const yearExpenses = yearPayments
    .filter((p: any) => !['LOYER', 'CHARGES', 'DEPOT_RECU'].includes(p.Category))
    .reduce((sum, p: any) => sum + p.amount, 0);

  const cashFlow = yearRents - yearExpenses;

  const totalInvestment = property.acquisitionPrice + property.notaryFees;
  const yieldValue = totalInvestment > 0 ? (yearRents / totalInvestment) : 0;

  const activeLeases = Array.isArray(leases) ? leases.filter(l => isLeaseActive(l)) : [];
  const recentPayments = [...payments]
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Le statut est maintenant calculé automatiquement via usePropertyRuntimeStatus

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-base-content bg-opacity-50" onClick={onClose} />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-base-100 shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-base-100 border-b border-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-2xl font-bold text-neutral-900">{property.name}</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                  {statusLabel}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-neutral-600 mt-1">
                <MapPin size={16} />
                <span>{property.address}, {property.postalCode} {property.city}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link
                href={`/biens/${property.id}/transactions`}
                onClick={onClose}
                className="bg-primary-700 text-base-100 px-4 py-2 rounded-md shadow-md hover:bg-primary-800 transition-colors flex items-center space-x-2"
              >
                <span>Voir détails</span>
                <ArrowRight size={16} />
              </Link>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-neutral-100 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-neutral-600">Chargement...</p>
              </div>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard
                  title="Loyers annuels"
                  value={formatCurrencyEUR((summaryData?.summary.annualRentsCents || 0) / 100)}
                  icon={<Euro size={20} />}
                  color="success"
                />
                <KpiCard
                  title="Cash-flow annuel"
                  value={formatCurrencyEUR((summaryData?.summary.annualCashflowCents || 0) / 100)}
                  icon={<TrendingUp size={20} />}
                  color={(summaryData?.summary.annualCashflowCents || 0) >= 0 ? 'success' : 'danger'}
                />
                <KpiCard
                  title="Rendement"
                  value={formatPercentage(summaryData?.summary.grossYieldPct || 0)}
                  icon={<TrendingUp size={20} />}
                  color="primary"
                />
              </div>

              {/* Infos */}
              <div className="bg-base-100 rounded-lg border border-neutral-200 p-4">
                <h3 className="text-lg font-semibold text-neutral-900 mb-3">Informations</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-neutral-600">Type:</span>
                    <span className="font-medium ml-2">{property.type}</span>
                  </div>
                  <div>
                    <span className="text-neutral-600">Surface:</span>
                    <span className="font-medium ml-2">{property.surface} m²</span>
                  </div>
                  <div>
                    <span className="text-neutral-600">Pièces:</span>
                    <span className="font-medium ml-2">{property.rooms}</span>
                  </div>
                  <div>
                    <span className="text-neutral-600">Prix d'acquisition:</span>
                    <span className="font-medium ml-2">{formatCurrencyEUR(property.acquisitionPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Baux actifs */}
              <div className="bg-base-100 rounded-lg border border-neutral-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-neutral-900">Baux actifs ({activeLeases.length})</h3>
                  <Link
                    href={`/biens/${property.id}/leases`}
                    onClick={onClose}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Voir tous →
                  </Link>
                </div>
                {activeLeases.length > 0 ? (
                  <div className="space-y-2">
                    {activeLeases.slice(0, 3).map(lease => (
                      <div key={lease.id} className="flex justify-between items-center text-sm py-2 border-b border-neutral-100 last:border-0">
                        <span className="font-medium">
                          {lease.Tenant ? `${lease.Tenant.firstName} ${lease.Tenant.lastName}` : 'Locataire inconnu'}
                        </span>
                        <span className="text-neutral-600">{formatCurrencyEUR((lease.rentAmount || 0) + (lease.charges || 0))} / mois</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-500 text-sm">Aucun bail actif</p>
                )}
              </div>

              {/* Transactions récentes */}
              <div className="bg-base-100 rounded-lg border border-neutral-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-neutral-900">Dernières transactions</h3>
                  <Link
                    href={`/biens/${property.id}/transactions`}
                    onClick={onClose}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Voir toutes →
                  </Link>
                </div>
                {recentPayments.length > 0 ? (
                  <div className="space-y-2">
                    {recentPayments.map((payment: any) => {
                      const kind = getTransactionKind(payment);
                      const amountClass = 
                        kind === 'REVENUE' ? 'text-emerald-600' :
                        kind === 'EXPENSE' ? 'text-rose-600' :
                        'text-slate-500';
                      
                      return (
                        <div key={payment.id} className="flex justify-between items-center text-sm py-2 border-b border-neutral-100 last:border-0">
                          <div>
                            <div className="font-medium">{payment.label}</div>
                            <div className="text-xs text-neutral-500">{formatDateFR(new Date(payment.date))}</div>
                          </div>
                          <span className={`font-medium ${amountClass}`}>
                            {formatSignedAmount(payment)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-neutral-500 text-sm">Aucune transaction</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

