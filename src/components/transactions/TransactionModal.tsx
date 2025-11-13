'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Euro, Calendar, FileText, Building2, Users, Zap, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/Button';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  context: {
    type: 'property' | 'global';
    propertyId?: string;
    isFromLease?: boolean;
  };
  mode: 'create' | 'edit';
  transactionId?: string;
  title?: string;
}

interface TransactionFormData {
  propertyId: string;
  leaseId: string;
  tenantId: string;
  date: string;
  natureId: string;
  categoryId: string;
  label: string;
  amount: number;
  reference: string;
  paymentDate: string;
  paymentMethod: string;
  notes: string;
  periodStart: string;
  monthsCovered: number;
  autoDistribution: boolean;
}

// Les natures seront chargées depuis la BDD

const PAYMENT_METHODS = [
  { id: 'virement', label: 'Virement' },
  { id: 'cheque', label: 'Chèque' },
  { id: 'especes', label: 'Espèces' },
  { id: 'carte', label: 'Carte bancaire' },
  { id: 'prelevement', label: 'Prélèvement' }
];

export default function TransactionModal({
  isOpen,
  onClose,
  onSubmit,
  context,
  mode,
  transactionId,
  title
}: TransactionModalProps) {
  const [activeTab, setActiveTab] = useState('essentielles');
  const [formData, setFormData] = useState<TransactionFormData>({
    propertyId: '',
    leaseId: '',
    tenantId: '',
    date: new Date().toISOString().split('T')[0],
    natureId: '',
    categoryId: '',
    label: '',
    amount: 0,
    reference: '',
    paymentDate: '',
    paymentMethod: '',
    notes: '',
    periodStart: '',
    monthsCovered: 1,
    autoDistribution: false
  });

  // États pour les données
  const [properties, setProperties] = useState<any[]>([]);
  const [natures, setNatures] = useState<Array<{ id: string; label: string }>>([]);
  const [loadingNatures, setLoadingNatures] = useState(false);
  const [leases, setLeases] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  // États pour l'UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [autoFields, setAutoFields] = useState<Set<string>>(() => new Set());
  const [manuallyEditedFields, setManuallyEditedFields] = useState<Set<string>>(() => new Set());
  const [lockedFields, setLockedFields] = useState<Set<string>>(() => new Set());


  // Initialisation des champs verrouillés
  useEffect(() => {
    const newLockedFields = new Set<string>();
    
    if (context.type === 'property' && context.propertyId) {
      newLockedFields.add('propertyId');
    }
    
    if (mode === 'edit') {
      newLockedFields.add('propertyId');
    }
    
    setLockedFields(newLockedFields);
  }, [context, mode]);

  // Chargement initial des données
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Charger les propriétés
        const propertiesResponse = await fetch('/api/properties');
        const propertiesData = await propertiesResponse.json();
        setProperties(propertiesData.data || []);

        // Préremplissage selon le contexte
        if (context.type === 'property' && context.propertyId) {
          setFormData(prev => ({
            ...prev,
            propertyId: context.propertyId!
          }));
          
          // Charger les baux du bien
          const leasesResponse = await fetch(`/api/properties/${context.propertyId}/leases`);
          const leasesData = await leasesResponse.json();
          setLeases(leasesData.data || leasesData || []);
        }

        // Charger les natures depuis la BDD
        setLoadingNatures(true);
        const naturesResponse = await fetch('/api/natures');
        const naturesData = await naturesResponse.json();
        if (naturesData.success && naturesData.data) {
          const transformedNatures = naturesData.data.map((nature: any) => ({
            id: nature.key,
            label: nature.label
          }));
          setNatures(transformedNatures);
        }
        setLoadingNatures(false);

        // Si mode édition, charger la transaction existante
        if (mode === 'edit' && transactionId) {
          const response = await fetch(`/api/transactions/${transactionId}`);
          const transaction = await response.json();
          
          setFormData({
            propertyId: transaction.propertyId || '',
            leaseId: transaction.leaseId || '',
            tenantId: transaction.tenantId || '',
            date: transaction.date || '',
            natureId: transaction.natureId || '',
            categoryId: transaction.categoryId || '',
            label: transaction.label || '',
            amount: transaction.amount || 0,
            reference: transaction.reference || '',
            paymentDate: transaction.paymentDate || '',
            paymentMethod: transaction.paymentMethod || '',
            notes: transaction.notes || '',
            periodStart: transaction.periodStart || '',
            monthsCovered: transaction.monthsCovered || 1,
            autoDistribution: transaction.autoDistribution || false
          });

          if (transaction.propertyId) {
            const leasesResponse = await fetch(`/api/properties/${transaction.propertyId}/leases`);
            const leasesData = await leasesResponse.json();
            setLeases(leasesData.data || leasesData || []);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        toast.error('Erreur lors du chargement des données');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, context, mode, transactionId]);

  const handleFieldChange = (field: keyof TransactionFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Marquer comme modifié manuellement
    setManuallyEditedFields(prev => new Set(prev).add(field));

    // Charger les baux si on change de propriété
    if (field === 'propertyId' && value) {
      fetch(`/api/properties/${value}/leases`)
        .then(response => response.json())
        .then(data => setLeases(data.data || data || []))
        .catch(error => console.error('Erreur lors du chargement des baux:', error));
    }

    // Charger les catégories si on change de nature
    if (field === 'natureId' && value) {
      fetch(`/api/accounting/categories?nature=${value}`)
        .then(response => response.json())
        .then(data => setCategories(data.data || data || []))
        .catch(error => console.error('Erreur lors du chargement des catégories:', error));
    }

    // Logique de réactivité
    if (field === 'propertyId') {
      // Réinitialiser les champs dépendants
      setFormData(prev => ({
        ...prev,
        leaseId: '',
        tenantId: '',
        categoryId: '',
        label: '',
        amount: 0
      }));
    }

    if (field === 'leaseId') {
      // Proposer "Loyer" comme nature et calculer le montant
      const selectedLease = leases.find(lease => lease.id === value);
      if (selectedLease) {
        setFormData(prev => ({
          ...prev,
          natureId: 'LOYER',
          amount: (selectedLease.rent || 0) + (selectedLease.charges || 0)
        }));
        setAutoFields(prev => new Set(prev).add('natureId').add('amount'));
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.propertyId) newErrors.propertyId = 'Le bien est requis';
    if (!formData.date) newErrors.date = 'La date est requise';
    if (!formData.natureId) newErrors.natureId = 'La nature est requise';
    if (!formData.categoryId) newErrors.categoryId = 'La catégorie est requise';
    if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Le montant doit être supérieur à 0';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      toast.success(mode === 'create' ? 'Transaction créée avec succès' : 'Transaction modifiée avec succès');
      onClose();
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      toast.error('Erreur lors de la sauvegarde de la transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 max-w-sm w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mr-3"></div>
            <span className="text-gray-700">Chargement...</span>
          </div>
        </div>
      </div>
    );
  }

  // Retourner null si la modal n'est pas ouverte
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl mx-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {title || (mode === 'create' ? 'Nouvelle transaction' : 'Modifier la transaction')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'essentielles', label: 'Informations essentielles', icon: FileText },
              { id: 'paiement', label: 'Paiement', icon: Euro },
              { id: 'periode', label: 'Période', icon: Calendar }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {activeTab === 'essentielles' && (
            <div className="space-y-6">
              {/* Bien */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Bien <span className="text-red-500">*</span>
                  {lockedFields.has('propertyId') && (
                    <Lock className="h-4 w-4 inline ml-2 text-gray-400" />
                  )}
                </label>
                <select
                  value={formData.propertyId}
                  onChange={(e) => handleFieldChange('propertyId', e.target.value)}
                  disabled={lockedFields.has('propertyId')}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.propertyId ? 'border-red-500' : 'border-gray-300'
                  } ${lockedFields.has('propertyId') ? 'bg-gray-100' : ''}`}
                >
                  <option value="">Sélectionner un bien</option>
                  {(properties || []).map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name} - {property.address}
                    </option>
                  ))}
                </select>
                {errors.propertyId && (
                  <p className="text-sm text-red-600">{errors.propertyId}</p>
                )}
              </div>

              {/* Bail */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Bail
                </label>
                <select
                  value={formData.leaseId}
                  onChange={(e) => handleFieldChange('leaseId', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.leaseId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Aucun bail</option>
                  {(leases || []).map((lease) => (
                    <option key={lease.id} value={lease.id}>
                      {lease.Tenant?.firstName} {lease.Tenant?.lastName} - {lease.status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleFieldChange('date', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.date && (
                  <p className="text-sm text-red-600">{errors.date}</p>
                )}
              </div>

              {/* Nature */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Nature <span className="text-red-500">*</span>
                  {autoFields.has('natureId') && (
                    <Zap className="h-4 w-4 inline ml-2 text-blue-500" />
                  )}
                </label>
                <select
                  value={formData.natureId}
                  onChange={(e) => handleFieldChange('natureId', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.natureId ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loadingNatures}
                >
                  <option value="">
                    {loadingNatures ? 'Chargement...' : 'Sélectionner une nature'}
                  </option>
                  {natures.map((nature) => (
                    <option key={nature.id} value={nature.id}>
                      {nature.label}
                    </option>
                  ))}
                </select>
                {errors.natureId && (
                  <p className="text-sm text-red-600">{errors.natureId}</p>
                )}
              </div>

              {/* Catégorie */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Catégorie <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => handleFieldChange('categoryId', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.categoryId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Sélectionner une catégorie</option>
                  {(categories || []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
                {errors.categoryId && (
                  <p className="text-sm text-red-600">{errors.categoryId}</p>
                )}
              </div>

              {/* Montant */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Montant <span className="text-red-500">*</span>
                  {autoFields.has('amount') && (
                    <Zap className="h-4 w-4 inline ml-2 text-blue-500" />
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.amount ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.amount && (
                  <p className="text-sm text-red-600">{errors.amount}</p>
                )}
              </div>

              {/* Libellé */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Libellé
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => handleFieldChange('label', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Libellé de la transaction"
                />
              </div>

              {/* Référence */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Référence
                </label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => handleFieldChange('reference', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Référence (optionnel)"
                />
              </div>
            </div>
          )}

          {activeTab === 'paiement' && (
            <div className="space-y-6">
              {/* Date de paiement */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Date de paiement
                </label>
                <input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => handleFieldChange('paymentDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Mode de paiement */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Mode de paiement
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Sélectionner un mode de paiement</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Notes additionnelles (optionnel)"
                />
              </div>
            </div>
          )}

          {activeTab === 'periode' && (
            <div className="space-y-6">
              {/* Début de période */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Début de période
                </label>
                <input
                  type="month"
                  value={formData.periodStart}
                  onChange={(e) => handleFieldChange('periodStart', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Nombre de mois couverts */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Nombre de mois couverts
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.monthsCovered}
                  onChange={(e) => handleFieldChange('monthsCovered', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Distribution automatique */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoDistribution"
                  checked={formData.autoDistribution}
                  onChange={(e) => handleFieldChange('autoDistribution', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="autoDistribution" className="text-sm font-medium text-gray-700">
                  Distribution automatique
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enregistrement...' : (mode === 'create' ? 'Créer' : 'Modifier')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
