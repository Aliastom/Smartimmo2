'use client';

import React, { useState } from 'react';
import { Property } from '../../domain/entities/Property';
import AddressAutocomplete from '@/components/forms/AddressAutocomplete';

interface PropertyFormProps {
  property?: Property;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const PROPERTY_TYPES = [
  { value: 'house', label: 'Maison' },
  { value: 'apartment', label: 'Appartement' },
  { value: 'garage', label: 'Garage' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'land', label: 'Terrain' },
];

const PROPERTY_STATUS = [
  { value: 'rented', label: 'Loué' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'under_works', label: 'En travaux' },
  { value: 'occupied_owner', label: 'Occupé par le propriétaire' },
];

const PROPERTY_OCCUPATION = [
  { value: 'PRINCIPALE', label: 'Résidence principale' },
  { value: 'SECONDAIRE', label: 'Résidence secondaire' },
  { value: 'LOCATIF', label: 'Locatif' },
  { value: 'VACANT', label: 'Vacant' },
  { value: 'USAGE_PRO', label: 'Usage professionnel' },
  { value: 'AUTRE', label: 'Autre' },
];

const STATUS_MODE = [
  { value: 'AUTO', label: 'Automatique (recommandé)' },
  { value: 'MANUAL', label: 'Manuel' },
];

export default function PropertyForm({ 
  property, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}: PropertyFormProps) {
  const [statusMode, setStatusMode] = useState(property?.statusMode || 'AUTO');
  const [occupation, setOccupation] = useState(property?.occupation || 'VACANT');
  const [addressData, setAddressData] = useState({
    address: property?.address || '',
    postalCode: property?.postalCode || '',
    city: property?.city || '',
  });
  
  // Synchroniser statusMode et occupation quand property change
  React.useEffect(() => {
    if (property) {
      setStatusMode(property.statusMode || 'AUTO');
      setOccupation(property.occupation || 'VACANT');
      setAddressData({
        address: property.address || '',
        postalCode: property.postalCode || '',
        city: property.city || '',
      });
    }
  }, [property]);
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
          Nom du bien *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          defaultValue={property?.name || ''}
          className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
        />
      </div>
      
      <div>
        <label htmlFor="type" className="block text-sm font-medium text-neutral-700">
          Type de bien *
        </label>
        <select
          id="type"
          name="type"
          required
          defaultValue={property?.type || ''}
          className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
        >
          <option value="">Sélectionner un type</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-neutral-700">
          Adresse *
        </label>
        <AddressAutocomplete
          initialValue={addressData.address}
          onAddressSelect={(address) => {
            setAddressData({
              address: address.street,
              postalCode: address.postcode,
              city: address.city,
            });
          }}
          placeholder="Ex: 123 Rue de la Paix, Paris"
          required
        />
        <input type="hidden" name="address" value={addressData.address} />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="postalCode" className="block text-sm font-medium text-neutral-700">
            Code Postal *
          </label>
          <input
            type="text"
            id="postalCode"
            name="postalCode"
            required
            value={addressData.postalCode}
            onChange={(e) => setAddressData(prev => ({ ...prev, postalCode: e.target.value }))}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-neutral-700">
            Ville *
          </label>
          <input
            type="text"
            id="city"
            name="city"
            required
            value={addressData.city}
            onChange={(e) => setAddressData(prev => ({ ...prev, city: e.target.value }))}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="surface" className="block text-sm font-medium text-neutral-700">
            Surface (m²) *
          </label>
          <input
            type="number"
            id="surface"
            name="surface"
            required
            step="0.01"
            min="0"
            defaultValue={property?.surface || ''}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
        <div>
          <label htmlFor="rooms" className="block text-sm font-medium text-neutral-700">
            Nombre de pièces *
          </label>
          <input
            type="number"
            id="rooms"
            name="rooms"
            required
            min="0"
            defaultValue={property?.rooms || ''}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
      </div>
      
      <div>
        <label htmlFor="acquisitionDate" className="block text-sm font-medium text-neutral-700">
          Date d'acquisition *
        </label>
        <input
          type="date"
          id="acquisitionDate"
          name="acquisitionDate"
          required
          defaultValue={property?.acquisitionDate ? new Date(property.acquisitionDate).toISOString().split('T')[0] : ''}
          className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
        />
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="acquisitionPrice" className="block text-sm font-medium text-neutral-700">
            Prix d'acquisition (€) *
          </label>
          <input
            type="number"
            id="acquisitionPrice"
            name="acquisitionPrice"
            required
            step="0.01"
            min="0"
            defaultValue={property?.acquisitionPrice || ''}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
        <div>
          <label htmlFor="notaryFees" className="block text-sm font-medium text-neutral-700">
            Frais de notaire (€) *
          </label>
          <input
            type="number"
            id="notaryFees"
            name="notaryFees"
            required
            step="0.01"
            min="0"
            defaultValue={property?.notaryFees || ''}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
        <div>
          <label htmlFor="currentValue" className="block text-sm font-medium text-neutral-700">
            Valeur actuelle (€) *
          </label>
          <input
            type="number"
            id="currentValue"
            name="currentValue"
            required
            step="0.01"
            min="0"
            defaultValue={property?.currentValue || ''}
            className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
      </div>
      
      <div>
        <label htmlFor="statusMode" className="block text-sm font-medium text-neutral-700">
          Mode de gestion du statut *
        </label>
        <select
          id="statusMode"
          name="statusMode"
          required
          value={statusMode}
          onChange={(e) => setStatusMode(e.target.value)}
          className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
        >
          {STATUS_MODE.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-neutral-500">
          ℹ️ En mode automatique, le statut est calculé en fonction des baux actifs
        </p>
      </div>

      <div>
        <label htmlFor="occupation" className="block text-sm font-medium text-neutral-700">
          Type d'occupation *
        </label>
        <select
          id="occupation"
          name="occupation"
          required
          disabled={statusMode === 'AUTO'}
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
          className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700 disabled:bg-neutral-100 disabled:cursor-not-allowed"
          title={statusMode === 'AUTO' ? 'Contrôlé automatiquement par les baux actifs' : ''}
        >
          {PROPERTY_OCCUPATION.map((occ) => (
            <option key={occ.value} value={occ.value}>
              {occ.label}
            </option>
          ))}
        </select>
        {statusMode === 'AUTO' ? (
          <p className="mt-1 text-sm text-orange-600">
            🔒 Contrôlé automatiquement par les baux actifs
          </p>
        ) : (
          <p className="mt-1 text-sm text-neutral-500">
            ⚠️ Un seul bien peut être déclaré comme résidence principale
          </p>
        )}
      </div>

      <div>
        <label htmlFor="exitFeesRate" className="block text-sm font-medium text-neutral-700">
          Taux frais de sortie (optionnel)
        </label>
        <input
          type="number"
          id="exitFeesRate"
          name="exitFeesRate"
          step="0.001"
          min="0"
          max="1"
          placeholder="0.07"
          defaultValue={property?.exitFeesRate || ''}
          className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
        />
        <p className="mt-1 text-sm text-neutral-500">
          ℹ️ Par défaut : 7% (frais d'agence, notaire, etc.)
        </p>
      </div>
      
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-neutral-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={property?.notes || ''}
          className="mt-1 block w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
        />
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
          {isLoading ? 'Enregistrement...' : property ? 'Modifier' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
}
