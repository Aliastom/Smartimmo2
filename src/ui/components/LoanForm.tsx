'use client';

import React from 'react';
import { Property } from '../../domain/entities/Property';
import { Loan } from '../../domain/entities/Loan';

interface LoanFormProps {
  properties: Property[];
  loan?: Loan;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const LOAN_STATUS = [
  { value: 'active', label: 'Actif' },
  { value: 'paid_off', label: 'Remboursé' },
  { value: 'refinanced', label: 'Refinancé' },
];

export default function LoanForm({ 
  properties, 
  loan, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}: LoanFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="propertyId" className="block text-sm font-medium text-neutral-700">
          Bien concerné *
        </label>
        <select
          id="propertyId"
          name="propertyId"
          required
          defaultValue={loan?.propertyId || ''}
          className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
        >
          <option value="">Sélectionner un bien</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name} - {property.address}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="bankName" className="block text-sm font-medium text-neutral-700">
          Nom de la banque *
        </label>
        <input
          type="text"
          id="bankName"
          name="bankName"
          required
          defaultValue={loan?.bankName || ''}
          className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          placeholder="Ex: Crédit Agricole"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="loanAmount" className="block text-sm font-medium text-neutral-700">
            Montant emprunté (€) *
          </label>
          <input
            type="number"
            id="loanAmount"
            name="loanAmount"
            required
            step="0.01"
            min="0"
            defaultValue={loan?.loanAmount || '0'}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
        <div>
          <label htmlFor="durationMonths" className="block text-sm font-medium text-neutral-700">
            Durée (mois) *
          </label>
          <input
            type="number"
            id="durationMonths"
            name="durationMonths"
            required
            min="1"
            defaultValue={loan?.durationMonths || '240'}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="interestRate" className="block text-sm font-medium text-neutral-700">
            Taux d'intérêt (%) *
          </label>
          <input
            type="number"
            id="interestRate"
            name="interestRate"
            required
            step="0.001"
            min="0"
            max="100"
            defaultValue={loan?.interestRate ? (loan.interestRate * 100) : '0'}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
        <div>
          <label htmlFor="insuranceRate" className="block text-sm font-medium text-neutral-700">
            Taux d'assurance (%) *
          </label>
          <input
            type="number"
            id="insuranceRate"
            name="insuranceRate"
            required
            step="0.001"
            min="0"
            max="100"
            defaultValue={loan?.insuranceRate ? (loan.insuranceRate * 100) : '0'}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-neutral-700">
            Date de début *
          </label>
          <input
            type="date"
            id="startDate"
            name="startDate"
            required
            defaultValue={loan?.startDate ? new Date(loan.startDate).toISOString().split('T')[0] : ''}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-neutral-700">
            Statut *
          </label>
          <select
            id="status"
            name="status"
            required
            defaultValue={loan?.status || ''}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          >
            <option value="">Sélectionner un statut</option>
            {LOAN_STATUS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
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
          {isLoading ? 'Enregistrement...' : loan ? 'Modifier' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
}
