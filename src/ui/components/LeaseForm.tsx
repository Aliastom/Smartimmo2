'use client';

import React, { useState, useEffect } from 'react';
import { Lease } from '../../domain/entities/Lease';
import { Property } from '../../domain/entities/Property';
import { Tenant } from '../../domain/entities/Tenant';

interface LeaseFormProps {
  lease?: Lease;
  properties: Property[];
  tenants: Tenant[];
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const LEASE_TYPES = [
  { value: 'residential', label: 'Résidentiel' },
  { value: 'commercial', label: 'Commercial' },
];

export default function LeaseForm({ 
  lease, 
  properties,
  tenants,
  onSubmit, 
  onCancel, 
  isLoading = false 
}: LeaseFormProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState(lease?.propertyId || '');
  const [selectedTenantId, setSelectedTenantId] = useState(lease?.tenantId || '');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onSubmit(formData);
  };

  // Filtrer les locataires disponibles (optionnel : seulement ceux sans bail actif)
  const availableTenants = tenants;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="propertyId" className="block text-sm font-medium text-neutral-700">
          Bien *
        </label>
        <select
          id="propertyId"
          name="propertyId"
          required
          value={selectedPropertyId}
          onChange={(e) => setSelectedPropertyId(e.target.value)}
          className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
        >
          <option value="">Sélectionner un bien</option>
          {properties.map(property => (
            <option key={property.id} value={property.id}>
              {property.name} - {property.address}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="tenantId" className="block text-sm font-medium text-neutral-700">
          Locataire *
        </label>
        <select
          id="tenantId"
          name="tenantId"
          required
          value={selectedTenantId}
          onChange={(e) => setSelectedTenantId(e.target.value)}
          className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
        >
          <option value="">Sélectionner un locataire</option>
          {availableTenants.map(tenant => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.firstName} {tenant.lastName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-neutral-700">
          Type de bail *
        </label>
        <select
          id="type"
          name="type"
          required
          defaultValue={lease?.type || ''}
          className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
        >
          <option value="">Sélectionner un type</option>
          {LEASE_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-neutral-700">
            Date de début *
          </label>
          <input
            type="date"
            id="startDate"
            name="startDate"
            required
            defaultValue={lease?.startDate ? new Date(lease.startDate).toISOString().split('T')[0] : ''}
            className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          />
        </div>

        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-neutral-700">
            Date de fin
          </label>
          <input
            type="date"
            id="endDate"
            name="endDate"
            defaultValue={lease?.endDate ? new Date(lease.endDate).toISOString().split('T')[0] : ''}
            className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="rentAmount" className="block text-sm font-medium text-neutral-700">
            Loyer HC (€) *
          </label>
          <input
            type="number"
            id="rentAmount"
            name="rentAmount"
            required
            min="0"
            step="0.01"
            defaultValue={lease?.rentAmount || ''}
            className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          />
        </div>

        <div>
          <label htmlFor="charges" className="block text-sm font-medium text-neutral-700">
            Charges (€)
          </label>
          <input
            type="number"
            id="charges"
            name="charges"
            min="0"
            step="0.01"
            defaultValue={lease?.charges || ''}
            className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="deposit" className="block text-sm font-medium text-neutral-700">
            Dépôt de garantie (€)
          </label>
          <input
            type="number"
            id="deposit"
            name="deposit"
            min="0"
            step="0.01"
            defaultValue={lease?.deposit || ''}
            className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          />
        </div>

        <div>
          <label htmlFor="paymentDay" className="block text-sm font-medium text-neutral-700">
            Jour de paiement
          </label>
          <input
            type="number"
            id="paymentDay"
            name="paymentDay"
            min="1"
            max="31"
            defaultValue={lease?.paymentDay || ''}
            className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          />
        </div>
      </div>


      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-neutral-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={lease?.notes || ''}
          className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
        />
      </div>

      {/* Boutons */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-neutral-700 bg-base-100 border border-neutral-300 rounded-md hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-base-100 bg-primary border border-transparent rounded-md hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Enregistrement...' : (lease ? 'Mettre à jour' : 'Créer')}
        </button>
      </div>
    </form>
  );
}
