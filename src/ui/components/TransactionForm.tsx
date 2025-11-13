'use client';

import React from 'react';
import { Transaction } from '../../domain/entities/Transaction';

interface TransactionFormProps {
  properties?: Array<{ id: string; name: string }>;
  transaction?: Transaction;
  propertyId?: string;
  hidePropertySelect?: boolean;
  categories?: Array<{ id: string; name: string }>;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// Les catégories seront chargées dynamiquement depuis l'API

export default function TransactionForm({ 
  properties = [], 
  transaction, 
  propertyId,
  hidePropertySelect = false,
  categories = [],
  onSubmit, 
  onCancel, 
  isLoading = false 
}: TransactionFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // Si propertyId est fourni, l'ajouter au formData
    if (propertyId) {
      formData.set('propertyId', propertyId);
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!hidePropertySelect && (
        <div>
          <label htmlFor="propertyId" className="block text-sm font-medium text-neutral-700">
            Bien concerné *
          </label>
          <select
            id="propertyId"
            name="propertyId"
            required
            defaultValue={transaction?.propertyId || propertyId || ''}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          >
            <option value="">Sélectionner un bien</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>
      )}


      <div>
        <label htmlFor="label" className="block text-sm font-medium text-neutral-700">
          Libellé *
        </label>
        <input
          type="text"
          id="label"
          name="label"
          required
          defaultValue={transaction?.label || ''}
          className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          placeholder="Ex: Loyer janvier 2025"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-neutral-700">
            Montant (€) *
          </label>
          <input
            type="number"
            id="amount"
            name="amount"
            required
            step="0.01"
            min="0"
            defaultValue={transaction?.amount || ''}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-neutral-700">
            Date *
          </label>
          <input
            type="date"
            id="date"
            name="date"
            required
            defaultValue={transaction?.date ? new Date(transaction.date).toISOString().split('T')[0] : ''}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-neutral-700">
          Catégorie
        </label>
        <select
          id="category"
          name="categoryId"
          defaultValue={transaction?.categoryId || ''}
          className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
        >
          <option value="">Sélectionner une catégorie</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="isRecurring"
          name="isRecurring"
          defaultChecked={transaction?.isRecurring || false}
          className="h-4 w-4 text-primary-700 focus:ring-primary-700 border-neutral-300 rounded"
        />
        <label htmlFor="isRecurring" className="ml-2 block text-sm text-neutral-700">
          Transaction récurrente
        </label>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-primary-700 text-base-100 rounded-md shadow-md hover:bg-primary-800 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Enregistrement...' : transaction ? 'Modifier' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
}
