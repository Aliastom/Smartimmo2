'use client';

import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useTransactionsTable } from './useTransactionsTable';
import TransactionsTable from './TransactionsTable';
import TransactionModal from './TransactionModal';
import { useToast } from '../../hooks/useToast';
import { formatCurrencyEUR } from '@/utils/format';
import TransactionStatsCards from '../components/stats/TransactionStatsCards';

interface TransactionsPageContentProps {
  properties: Array<{ id: string; name: string }>;
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

export default function TransactionsPageContent({ properties }: TransactionsPageContentProps) {
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
    context: 'global',
  });

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingPaymentId, setEditingPaymentId] = useState<string | undefined>();
  const [duplicatingPayment, setDuplicatingPayment] = useState<any>(undefined);

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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900">Transactions</h2>
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
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
      />

      {/* Filtres */}
      <div className="bg-base-100 rounded-lg shadow-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Bien */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Bien
            </label>
            <select
              value={(filters as any).propertyId || ''}
              onChange={(e) => setFilters({ ...filters, propertyId: e.target.value || undefined } as any)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
            >
              <option value="">Tous les biens</option>
              {properties.map((prop) => (
                <option key={prop.id} value={prop.id}>
                  {prop.name}
                </option>
              ))}
            </select>
          </div>

          {/* Catégorie */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Catégorie
            </label>
            <select
              value={filters.Category || ''}
              onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })}
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
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
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
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
            />
          </div>
        </div>

        {/* Recherche */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              value={filters.q || ''}
              onChange={(e) => setFilters({ ...filters, q: e.target.value || undefined })}
              placeholder="Rechercher par libellé ou référence..."
              className="w-full pl-10 pr-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
            />
          </div>
        </div>

        {/* Reset */}
        {((filters as any).propertyId || filters.Category || filters.dateFrom || filters.dateTo || filters.q) && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setFilters({})}
              className="text-sm text-primary hover:text-primary font-medium"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <TransactionsTable
        payments={payments}
        loading={isLoading}
        context="global"
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />

      {/* Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          refreshPayments();
        }}
        mode={modalMode}
        paymentId={editingPaymentId}
        duplicatingPayment={duplicatingPayment}
        context="global"
        currentFilters={filters as any}
      />
    </div>
  );
}

