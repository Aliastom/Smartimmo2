'use client';

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Property } from '../../domain/entities/Property';
import { Transaction } from '../../domain/entities/Transaction';
import { Category } from '../../domain/entities/Category';
import DataTable from './DataTable';
import FormModal from './FormModal';
import TransactionForm from './TransactionForm';
import ActionButtons from './ActionButtons';
import { formatCurrencyEUR, formatDateShort } from '@/utils/format';
import { useToast } from '../../hooks/useToast';
import { useRouter } from 'next/navigation';

interface PropertyTransactionsTabProps {
  property: Property;
  transactions: Transaction[];
  onUpdate: () => void;
}

export default function PropertyTransactionsTab({ property, transactions, onUpdate }: PropertyTransactionsTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>(transactions);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (categoryFilter) {
      setFilteredTransactions(transactions.filter(t => t.categoryId === categoryFilter));
    } else {
      setFilteredTransactions(transactions);
    }
  }, [transactions, categoryFilter]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    try {
      const data = {
        propertyId: formData.get('propertyId'),
        label: formData.get('label'),
        date: formData.get('date'),
        amount: formData.get('amount'),
        categoryId: formData.get('categoryId'),
        leaseId: formData.get('leaseId'),
        isRecurring: formData.get('isRecurring') === 'true',
      };

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        showSuccess('Transaction ajoutée', 'La transaction a été créée avec succès');
        setIsModalOpen(false);
        onUpdate();
        router.refresh();
      } else {
        showError('Erreur', 'Erreur lors de la création de la transaction');
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      showError('Erreur', 'Une erreur inattendue est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTransaction = async (transaction: Transaction) => {
    try {
      const newLabel = prompt('Nouveau libellé:', transaction.label);
      if (newLabel === null) return;
      
      const newAmount = prompt('Nouveau montant:', transaction.amount.toString());
      if (newAmount === null) return;
      
      const data = {
        label: newLabel,
        amount: newAmount,
        date: new Date(transaction.date).toISOString().split('T')[0],
        categoryId: transaction.categoryId,
        propertyId: transaction.propertyId,
        leaseId: transaction.leaseId,
        isRecurring: transaction.isRecurring,
      };

      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        showSuccess('Transaction modifiée', 'La transaction a été mise à jour avec succès');
        onUpdate();
        router.refresh();
      } else {
        showError('Erreur', 'Erreur lors de la modification de la transaction');
      }
    } catch (error) {
      console.error('Error editing transaction:', error);
      showError('Erreur', 'Une erreur inattendue est survenue');
    }
  };

  const handleDeleteTransaction = async (transaction: Transaction) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
      try {
        const response = await fetch(`/api/transactions/${transaction.id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          showSuccess('Transaction supprimée', 'La transaction a été supprimée avec succès');
          onUpdate();
          router.refresh();
        } else {
          showError('Erreur', 'Erreur lors de la suppression de la transaction');
        }
      } catch (error) {
        console.error('Error deleting transaction:', error);
        showError('Erreur', 'Une erreur inattendue est survenue');
      }
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'N/A';
  };

  const columns = [
    {
      key: 'date' as keyof Transaction,
      label: 'Date',
      sortable: true,
      render: (transaction: Transaction) => formatDateShort(transaction.date)
    },
    {
      key: 'label' as keyof Transaction,
      label: 'Libellé'
    },
    {
      key: 'categoryId' as keyof Transaction,
      label: 'Catégorie',
      render: (transaction: Transaction) => getCategoryName(transaction.categoryId)
    },
    { 
      key: 'amount' as keyof Transaction, 
      label: 'Montant', 
      sortable: true,
      render: (transaction: Transaction) => formatCurrencyEUR(transaction.amount)
    },
    {
      key: 'actions' as keyof Transaction,
      label: 'Actions',
      render: (transaction: Transaction) => (
        <ActionButtons
          onEdit={() => handleEditTransaction(transaction)}
          onDelete={() => handleDeleteTransaction(transaction)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-neutral-900">
          Transactions ({filteredTransactions.length})
        </h3>
        <div className="flex items-center space-x-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          >
            <option value="">Toutes les catégories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-primary text-base-100 rounded-md hover:bg-primary transition"
          >
            <Plus className="h-4 w-4" />
            <span>Transaction</span>
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      {filteredTransactions.length > 0 ? (
        <DataTable
          columns={columns}
          data={filteredTransactions}
          searchPlaceholder="Rechercher une transaction..."
        />
      ) : (
        <div className="text-center py-8 bg-neutral-50 rounded-lg border border-neutral-200">
          <p className="text-neutral-500">
            {categoryFilter ? 'Aucune transaction pour cette catégorie' : 'Aucune transaction pour ce bien'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-2 text-primary hover:text-blue-800 font-medium"
          >
            Créer la première transaction
          </button>
        </div>
      )}

      {/* Modal */}
      <FormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Ajouter une transaction"
      >
        <TransactionForm
          propertyId={property.id}
          hidePropertySelect
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={isSubmitting}
        />
      </FormModal>
    </div>
  );
}

