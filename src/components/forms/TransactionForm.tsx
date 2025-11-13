'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { z } from 'zod';

const transactionSchema = z.object({
  propertyId: z.string().min(1, 'Le bien est requis'),
  leaseId: z.string().optional(),
  label: z.string().min(1, 'Le libellé est requis'),
  amount: z.number().min(0.01, 'Le montant doit être positif'),
  date: z.string().min(1, 'La date est requise'),
  nature: z.enum(['LOYER', 'CHARGES', 'DEPOT_GARANTIE_RECU', 'DEPOT_GARANTIE_RENDU', 'AVOIR_REGULARISATION', 'PENALITE_RETENUE', 'AUTRE']),
  paidAt: z.string().optional(),
  method: z.string().optional(),
  notes: z.string().optional(),
});

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  title: string;
  propertyId?: string;
  leaseId?: string;
}

export default function TransactionForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData, 
  title, 
  propertyId,
  leaseId 
}: TransactionFormProps) {
  const [formData, setFormData] = useState(initialData || {
    propertyId: propertyId || '',
    leaseId: leaseId || '',
    label: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    nature: 'LOYER',
    paidAt: '',
    method: '',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else if (propertyId) {
      setFormData(prev => ({ ...prev, propertyId }));
    }
    if (leaseId) {
      setFormData(prev => ({ ...prev, leaseId }));
    }
  }, [initialData, propertyId, leaseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const validatedData = transactionSchema.parse({
        ...formData,
        amount: parseFloat(formData.amount.toString()),
        paidAt: formData.paidAt || undefined
      });
      await onSubmit(validatedData);
      onClose();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Libellé *
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => handleChange('label', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.label ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: Loyer janvier 2024"
            />
            {errors.label && <p className="text-red-500 text-sm mt-1">{errors.label}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nature *
            </label>
            <select
              value={formData.nature}
              onChange={(e) => handleChange('nature', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.nature ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="LOYER">Loyer</option>
              <option value="CHARGES">Charges</option>
              <option value="DEPOT_GARANTIE_RECU">Dépôt de garantie reçu</option>
              <option value="DEPOT_GARANTIE_RENDU">Dépôt de garantie rendu</option>
              <option value="AVOIR_REGULARISATION">Avoir/Régularisation</option>
              <option value="PENALITE_RETENUE">Pénalité retenue</option>
              <option value="AUTRE">Autre</option>
            </select>
            {errors.nature && <p className="text-red-500 text-sm mt-1">{errors.nature}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Montant (€) *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.amount ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 850.00"
            />
            {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.date ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de paiement
            </label>
            <input
              type="date"
              value={formData.paidAt}
              onChange={(e) => handleChange('paidAt', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Méthode de paiement
            </label>
            <select
              value={formData.method}
              onChange={(e) => handleChange('method', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Sélectionner...</option>
              <option value="VIREMENT">Virement</option>
              <option value="CHEQUE">Chèque</option>
              <option value="ESPECES">Espèces</option>
              <option value="CARTE">Carte bancaire</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Notes supplémentaires..."
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
