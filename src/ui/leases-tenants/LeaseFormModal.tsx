'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useCreateLease, useUpdateLease, useLeases, type Lease, type CreateLeaseData } from '../hooks/useLeases';
import { useTenants } from '../hooks/useTenants';
import { getLeaseStatusDisplay } from '../../domain/leases/status';

interface LeaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  lease?: Lease | null;
  defaultPropertyId?: string;
  onSuccess?: () => void;
}

export default function LeaseFormModal({
  isOpen,
  onClose,
  lease,
  defaultPropertyId,
  onSuccess
}: LeaseFormModalProps) {
  const [formData, setFormData] = useState<CreateLeaseData>({
    propertyId: defaultPropertyId || '',
    tenantId: '',
    type: 'residential',
    furnishedType: 'vide',
    startDate: '',
    endDate: '',
    rentAmount: 0,
    charges: 0,
    deposit: 0,
    paymentDay: 1,
    notes: ''
  });

  const createLeaseMutation = useCreateLease();
  const updateLeaseMutation = useUpdateLease();
  
  // Charger les propriétés et locataires pour les selects
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  
  useEffect(() => {
    if (isOpen) {
      // Charger les propriétés avec une limite élevée pour récupérer tous les biens
      fetch('/api/properties?limit=1000')
        .then(res => res.json())
        .then(data => {
          // L'API peut retourner { data: [...], total, ... } ou directement un tableau
          const propertiesList = data?.data || data?.properties || data?.items || (Array.isArray(data) ? data : []);
          setProperties(Array.isArray(propertiesList) ? propertiesList : []);
        })
        .catch(err => console.error('Error loading properties:', err));
      
      // Charger les locataires avec une limite élevée pour récupérer tous les locataires
      fetch('/api/tenants?limit=1000')
        .then(res => res.json())
        .then(data => {
          // L'API peut retourner { data: [...], total, ... } ou directement un tableau
          const tenantsList = data?.data || data?.tenants || data?.items || (Array.isArray(data) ? data : []);
          setTenants(Array.isArray(tenantsList) ? tenantsList : []);
        })
        .catch(err => console.error('Error loading tenants:', err));
    }
  }, [isOpen]);

  // Mettre à jour le propertyId quand defaultPropertyId change
  useEffect(() => {
    if (defaultPropertyId) {
      setFormData(prev => ({ ...prev, propertyId: defaultPropertyId }));
    }
  }, [defaultPropertyId]);

  useEffect(() => {
    if (lease) {
      setFormData({
        propertyId: lease.propertyId,
        tenantId: lease.tenantId,
        type: lease.type,
        furnishedType: lease.furnishedType || 'vide',
        startDate: lease.startDate.split('T')[0], // Format YYYY-MM-DD
        endDate: lease.endDate ? lease.endDate.split('T')[0] : '',
        rentAmount: lease.rentAmount,
        charges: lease.charges || 0,
        deposit: lease.deposit || 0,
        paymentDay: lease.paymentDay || 1,
        notes: lease.notes || ''
      });
    } else {
      setFormData({
        propertyId: '',
        tenantId: '',
        type: 'residential',
        furnishedType: 'vide',
        startDate: '',
        endDate: '',
        rentAmount: 0,
        charges: 0,
        deposit: 0,
        paymentDay: 1,
        notes: ''
      });
    }
  }, [lease, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // S'assurer que le propertyId est correct
      const dataToSubmit = {
        ...formData,
        propertyId: defaultPropertyId || formData.propertyId
      };
      
      if (lease) {
        await updateLeaseMutation.mutateAsync({
          id: lease.id,
          ...dataToSubmit
        });
      } else {
        await createLeaseMutation.mutateAsync(dataToSubmit);
      }
      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      // L'erreur est gérée par le hook
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'rentAmount' || name === 'charges' || name === 'deposit' || name === 'paymentDay' 
        ? parseFloat(value) || 0 
        : value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-base-content bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            {lease ? 'Modifier le bail' : 'Nouveau bail'}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Propriété */}
            <div>
              <label htmlFor="propertyId" className="block text-sm font-medium text-neutral-700 mb-2">
                Propriété *
              </label>
              {defaultPropertyId ? (
                <div>
                  <input
                    type="text"
                    value={properties.find(p => p.id === defaultPropertyId)?.name + ' - ' + properties.find(p => p.id === defaultPropertyId)?.address || 'Propriété sélectionnée'}
                    disabled
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-neutral-100 text-neutral-600 cursor-not-allowed"
                  />
                  <input type="hidden" name="propertyId" value={defaultPropertyId} />
                </div>
              ) : (
                <select
                  id="propertyId"
                  name="propertyId"
                  value={formData.propertyId}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
                >
                  <option value="">Sélectionner une propriété</option>
                  {properties.map(property => (
                    <option key={property.id} value={property.id}>
                      {property.name} - {property.address}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Locataire */}
            <div>
              <label htmlFor="tenantId" className="block text-sm font-medium text-neutral-700 mb-2">
                Locataire *
              </label>
              <select
                id="tenantId"
                name="tenantId"
                value={formData.tenantId}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
              >
                <option value="">Sélectionner un locataire</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.firstName} {tenant.lastName} - {tenant.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Type de bail */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-neutral-700 mb-2">
                Type de bail *
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
              >
                <option value="residential">Résidentiel</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>

            {/* Type de bail (vide/meublé/garage) */}
            <div>
              <label htmlFor="furnishedType" className="block text-sm font-medium text-neutral-700 mb-2">
                Catégorie de bail *
              </label>
              <select
                id="furnishedType"
                name="furnishedType"
                value={formData.furnishedType || 'vide'}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
              >
                <option value="vide">Location vide</option>
                <option value="meuble">Location meublée</option>
                <option value="garage">Garage / Parking</option>
              </select>
            </div>

            {/* Date de début */}
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-neutral-700 mb-2">
                Date de début *
              </label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
              />
            </div>

            {/* Date de fin */}
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-neutral-700 mb-2">
                Date de fin
              </label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
              />
            </div>

            {/* Loyer HC */}
            <div>
              <label htmlFor="rentAmount" className="block text-sm font-medium text-neutral-700 mb-2">
                Loyer HC (€) *
              </label>
              <input
                type="number"
                id="rentAmount"
                name="rentAmount"
                value={formData.rentAmount}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
              />
            </div>

            {/* Charges */}
            <div>
              <label htmlFor="charges" className="block text-sm font-medium text-neutral-700 mb-2">
                Charges (€)
              </label>
              <input
                type="number"
                id="charges"
                name="charges"
                value={formData.charges ?? 0}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
              />
            </div>

            {/* Dépôt de garantie */}
            <div>
              <label htmlFor="deposit" className="block text-sm font-medium text-neutral-700 mb-2">
                Dépôt de garantie (€)
              </label>
              <input
                type="number"
                id="deposit"
                name="deposit"
                value={formData.deposit ?? 0}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
              />
            </div>

            {/* Jour de paiement */}
            <div>
              <label htmlFor="paymentDay" className="block text-sm font-medium text-neutral-700 mb-2">
                Jour de paiement
              </label>
              <input
                type="number"
                id="paymentDay"
                name="paymentDay"
                value={formData.paymentDay}
                onChange={handleChange}
                min="1"
                max="31"
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-neutral-700 mb-2">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
            />
          </div>

          {/* Boutons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-700 bg-base-100 border border-neutral-300 rounded-md hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createLeaseMutation.isPending || updateLeaseMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-base-100 bg-primary border border-transparent rounded-md hover:bg-primary focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createLeaseMutation.isPending || updateLeaseMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
