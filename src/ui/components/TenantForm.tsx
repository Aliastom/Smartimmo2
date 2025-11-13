'use client';

import React from 'react';
import { Tenant } from '../../domain/entities/Tenant';

interface TenantFormProps {
  tenant?: Tenant;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function TenantForm({ 
  tenant, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}: TenantFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-neutral-700">
            Prénom *
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            required
            defaultValue={tenant?.firstName || ''}
            className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          />
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-neutral-700">
            Nom *
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            required
            defaultValue={tenant?.lastName || ''}
            className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
          Email *
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          defaultValue={tenant?.email || ''}
          className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-neutral-700">
          Téléphone
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          defaultValue={tenant?.phone || ''}
          className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
        />
      </div>

      <div>
        <label htmlFor="birthDate" className="block text-sm font-medium text-neutral-700">
          Date de naissance
        </label>
        <input
          type="date"
          id="birthDate"
          name="birthDate"
          defaultValue={tenant?.birthDate ? new Date(tenant.birthDate).toISOString().split('T')[0] : ''}
          className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
        />
      </div>

      <div>
        <label htmlFor="nationality" className="block text-sm font-medium text-neutral-700">
          Nationalité
        </label>
        <input
          type="text"
          id="nationality"
          name="nationality"
          defaultValue={tenant?.nationality || ''}
          className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-neutral-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={tenant?.notes || ''}
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
          {isLoading ? 'Enregistrement...' : (tenant ? 'Mettre à jour' : 'Créer')}
        </button>
      </div>
    </form>
  );
}
