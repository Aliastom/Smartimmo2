'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { z } from 'zod';
import { 
  Upload, 
  X, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Calendar,
  Euro,
  Building2,
  Users,
  FileCheck,
  Mail,
  Receipt
} from 'lucide-react';
import DocumentUploadManager from './DocumentUploadManager';

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
  reference: z.string().optional(),
  periodStart: z.string().optional(),
  periodCount: z.number().optional(),
  autoDistribute: z.boolean().optional(),
  attachments: z.array(z.any()).optional(),
  generateReceipt: z.boolean().optional(),
  sendEmail: z.boolean().optional(),
});

interface DocumentAttachment {
  id?: string;
  name: string;
  size: number;
  mime: string;
  base64: string;
  documentTypeId?: string;
  documentType?: any;
  classification?: any;
  isClassifying?: boolean;
}

interface TransactionFormCompleteProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  title: string;
  propertyId?: string;
  leaseId?: string;
  defaultPropertyId?: string;
  defaultLeaseId?: string;
}

const NATURES = [
  { value: 'LOYER', label: 'Loyer' },
  { value: 'CHARGES', label: 'Charges' },
  { value: 'DEPOT_GARANTIE_RECU', label: 'Dépôt de garantie reçu' },
  { value: 'DEPOT_GARANTIE_RENDU', label: 'Dépôt de garantie rendu' },
  { value: 'AVOIR_REGULARISATION', label: 'Avoir/Régularisation' },
  { value: 'PENALITE_RETENUE', label: 'Pénalité retenue' },
  { value: 'AUTRE', label: 'Autre' },
];

const METHODS = [
  { value: 'virement', label: 'Virement' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'especes', label: 'Espèces' },
  { value: 'carte', label: 'Carte bancaire' },
  { value: 'autre', label: 'Autre' },
];

export default function TransactionFormComplete({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData, 
  title, 
  propertyId,
  leaseId,
  defaultPropertyId,
  defaultLeaseId 
}: TransactionFormCompleteProps) {
  const [formData, setFormData] = useState({
    propertyId: propertyId || defaultPropertyId || '',
    leaseId: leaseId || defaultLeaseId || '',
    label: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    nature: 'LOYER',
    paidAt: '',
    method: 'virement',
    reference: '',
    notes: '',
    periodStart: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    periodCount: 1,
    autoDistribute: true,
    attachments: [] as DocumentAttachment[],
    generateReceipt: false,
    sendEmail: false,
  });

  const [properties, setProperties] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Charger les données initiales
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  // Mettre à jour le formulaire quand initialData change
  useEffect(() => {
    if (initialData) {
      setFormData({
        propertyId: initialData.propertyId || propertyId || defaultPropertyId || '',
        leaseId: initialData.leaseId || leaseId || defaultLeaseId || '',
        label: initialData.label || '',
        amount: initialData.amount || 0,
        date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        nature: initialData.nature || 'LOYER',
        paidAt: initialData.paidAt ? new Date(initialData.paidAt).toISOString().split('T')[0] : '',
        method: initialData.method || 'virement',
        reference: initialData.reference || '',
        notes: initialData.notes || '',
        periodStart: initialData.periodStart || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        periodCount: initialData.periodCount || 1,
        autoDistribute: initialData.autoDistribute ?? true,
        attachments: initialData.attachments || [],
        generateReceipt: initialData.generateReceipt || false,
        sendEmail: initialData.sendEmail || false,
      });
    }
  }, [initialData, propertyId, leaseId, defaultPropertyId, defaultLeaseId]);

  // Charger les baux quand le bien change
  useEffect(() => {
    if (formData.propertyId) {
      loadLeases(formData.propertyId);
    } else {
      setLeases([]);
    }
  }, [formData.propertyId]);

  const loadInitialData = async () => {
    setIsLoadingData(true);
    try {
      const [propertiesRes, documentTypesRes] = await Promise.all([
        fetch('/api/properties'),
        fetch('/api/document-types')
      ]);

      if (propertiesRes.ok) {
        const propertiesData = await propertiesRes.json();
        setProperties(propertiesData.data || propertiesData);
      }

      if (documentTypesRes.ok) {
        const documentTypesData = await documentTypesRes.json();
        setDocumentTypes(documentTypesData.data || documentTypesData);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadLeases = async (propertyId: string) => {
    try {
      const response = await fetch(`/api/leases?propertyId=${propertyId}`);
      if (response.ok) {
        const leasesData = await response.json();
        setLeases(leasesData.data || leasesData || []);
      } else {
        // En cas d'erreur, s'assurer que leases reste un tableau vide
        setLeases([]);
      }
    } catch (error) {
      console.error('Error loading leases:', error);
      // En cas d'erreur, s'assurer que leases reste un tableau vide
      setLeases([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const validatedData = transactionSchema.parse({
        ...formData,
        amount: parseFloat(formData.amount.toString()),
        paidAt: formData.paidAt || undefined,
        periodCount: parseInt(formData.periodCount.toString()) || 1,
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
      size="xl"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isLoadingData}>
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Colonne gauche - Informations de base */}
          <div className="space-y-6">
            {/* Sélection du bien et bail */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Contexte
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bien *
                  </label>
                  <select
                    value={formData.propertyId}
                    onChange={(e) => handleChange('propertyId', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.propertyId ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Sélectionner un bien</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name} - {property.address}
                      </option>
                    ))}
                  </select>
                  {errors.propertyId && <p className="text-red-500 text-sm mt-1">{errors.propertyId}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bail (optionnel)
                  </label>
                  <select
                    value={formData.leaseId}
                    onChange={(e) => handleChange('leaseId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Aucun bail</option>
                    {leases && Array.isArray(leases) && leases.map((lease) => (
                      <option key={lease.id} value={lease.id}>
                        {lease.Tenant?.firstName} {lease.Tenant?.lastName} - {lease.rentAmount}€/mois
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Informations de la transaction */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Euro className="h-5 w-5" />
                  Transaction
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="grid grid-cols-2 gap-4">
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
                      {NATURES.map((nature) => (
                        <option key={nature.value} value={nature.value}>
                          {nature.label}
                        </option>
                      ))}
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
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Méthode de paiement
                    </label>
                    <select
                      value={formData.method}
                      onChange={(e) => handleChange('method', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {METHODS.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Référence
                    </label>
                    <input
                      type="text"
                      value={formData.reference}
                      onChange={(e) => handleChange('reference', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Ex: VIREMENT-2024-001"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Période et répartition */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Période & Répartition
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Période de début
                    </label>
                    <input
                      type="month"
                      value={formData.periodStart}
                      onChange={(e) => handleChange('periodStart', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre de périodes
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.periodCount}
                      onChange={(e) => handleChange('periodCount', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoDistribute"
                    checked={formData.autoDistribute}
                    onChange={(e) => handleChange('autoDistribute', e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="autoDistribute" className="text-sm font-medium text-gray-700">
                    Répartition automatique
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Colonne droite - Documents et options */}
          <div className="space-y-6">
            {/* Upload de documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents
                </CardTitle>
                <CardDescription>
                  Joindre des documents à cette transaction avec reconnaissance automatique du type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentUploadManager
                  attachments={formData.attachments}
                  onAttachmentsChange={(attachments) => handleChange('attachments', attachments)}
                  documentTypes={documentTypes}
                  propertyId={formData.propertyId}
                  leaseId={formData.leaseId}
                  disabled={isSubmitting}
                />
              </CardContent>
            </Card>

            {/* Options avancées */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="generateReceipt"
                      checked={formData.generateReceipt}
                      onChange={(e) => handleChange('generateReceipt', e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor="generateReceipt" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Générer une quittance automatiquement
                    </label>
                  </div>

                  {formData.generateReceipt && (
                    <div className="ml-6">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="sendEmail"
                          checked={formData.sendEmail}
                          onChange={(e) => handleChange('sendEmail', e.target.checked)}
                          className="mr-2"
                        />
                        <label htmlFor="sendEmail" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Envoyer par email au locataire
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Notes supplémentaires sur cette transaction..."
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Modal>
  );
}
