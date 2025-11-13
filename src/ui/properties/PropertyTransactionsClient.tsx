'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Property } from '../../domain/entities/Property';
import { useTransactionsTable } from '../transactions/useTransactionsTable';
import TransactionsTable from '../transactions/TransactionsTable';
import TransactionModal from '../transactions/TransactionModal';
import { useToast } from '../../hooks/useToast';
import { formatCurrencyEUR } from '../../utils/format';
import TransactionStatsCards from '../components/stats/TransactionStatsCards';

interface PropertyTransactionsClientProps {
  property: Property;
  searchParams: { [key: string]: string | string[] | undefined };
}

const CATEGORIES = [
  { value: '', label: 'Toutes les catégories' },
  { value: 'LOYER', label: 'Loyer' },
  { value: 'CHARGES', label: 'Charges' },
  { value: 'DEPOT_RECU', label: 'Dépôt de garantie reçu' },
  { value: 'DEPOT_RENDU', label: 'Dépôt de garantie rendu' },
  { value: 'AVOIR', label: 'Avoir / Régularisation' },
  { value: 'PENALITE', label: 'Pénalité / Retenue' },
  { value: 'AUTRE', label: 'Autre' },
];

export default function PropertyTransactionsClient({ property, searchParams }: PropertyTransactionsClientProps) {
  const router = useRouter();
  const { addToast } = useToast();

  // Hook unifié
  const {
    payments,
    total,
    count,
    isLoading,
    filters,
    setFilters,
    refreshPayments,
  } = useTransactionsTable({
    context: 'property',
    propertyId: property.id,
    initialQuery: {
      category: (searchParams.Category as string) || undefined,
      dateFrom: (searchParams.dateFrom as string) || undefined,
      dateTo: (searchParams.dateTo as string) || undefined,
      q: (searchParams.q as string) || undefined,
    },
  });

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingPaymentId, setEditingPaymentId] = useState<string | undefined>();
  const [duplicatingPayment, setDuplicatingPayment] = useState<any>(undefined);

  // Mettre à jour l'URL quand les filtres changent
  const updateFilters = (newFilters: any) => {
    setFilters(newFilters);
    
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value as string);
      }
    });
    
    const queryString = params.toString();
    router.push(`/biens/${property.id}/transactions${queryString ? '?' + queryString : ''}`);
  };

  const handleEdit = (payment: any) => {
    setModalMode('edit');
    setEditingPaymentId(payment.id);
    setDuplicatingPayment(undefined);
    setIsModalOpen(true);
  };

  const handleDuplicate = (payment: any) => {
    setModalMode('create');
    setEditingPaymentId(undefined);
    setDuplicatingPayment(payment);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Confirmer la suppression de cette transaction ?')) return;

    try {
      const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      
      addToast('Transaction supprimée', 'success');
      refreshPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
      addToast('Erreur lors de la suppression', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header avec bouton CTA */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900">Transactions</h3>
          <p className="text-neutral-600 mt-1">
            {count} transaction{count > 1 ? 's' : ''} • Total : {formatCurrencyEUR(total)}
          </p>
        </div>
        <button
          onClick={() => {
            setModalMode('create');
            setEditingPaymentId(undefined);
            setDuplicatingPayment(undefined);
            setIsModalOpen(true);
          }}
          className="bg-primary-700 text-base-100 px-4 py-2 rounded-md shadow-md hover:bg-primary-800 transition-colors flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Ajouter une transaction</span>
        </button>
      </div>

      {/* Stats Cards */}
      <TransactionStatsCards 
        propertyId={property.id}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
      />

      {/* Filtres */}
      <div className="bg-base-100 rounded-lg shadow-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Catégorie */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Catégorie
            </label>
            <select
              value={filters.Category || ''}
              onChange={(e) => updateFilters({ ...filters, category: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date de début */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Date de début
            </label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => updateFilters({ ...filters, dateFrom: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
            />
          </div>

          {/* Date de fin */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Date de fin
            </label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => updateFilters({ ...filters, dateTo: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
            />
          </div>

          {/* Recherche */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Recherche
            </label>
            <input
              type="text"
              value={filters.q || ''}
              onChange={(e) => updateFilters({ ...filters, q: e.target.value || undefined })}
              placeholder="Libellé, référence..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <TransactionsTable
        payments={payments}
        loading={isLoading}
        context="property"
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          refreshPayments();
        }}
        mode={modalMode}
        paymentId={editingPaymentId}
        duplicatingPayment={duplicatingPayment}
        context="property"
        defaultPropertyId={property.id}
        currentFilters={filters as any}
      />
    </div>
  );
}

