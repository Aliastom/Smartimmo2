'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getAccountingTypeStyle } from '@/utils/accountingStyles';
import { useAccountingMapping } from '../hooks/useAccountingMapping';
import { TransactionDocumentUpload } from './TransactionDocumentUpload';
import { useDocumentTypes } from '@/hooks/useDocuments';
import { DocumentType } from '@/types/document';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdPayments?: any[]) => void;
  mode: 'create' | 'edit';
  paymentId?: string;
  context: 'global' | 'property' | 'lease';
  defaultPropertyId?: string;
  defaultLeaseId?: string;
  duplicatingPayment?: any;
  currentFilters?: {
    propertyId?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

// NATURES importées depuis utils/accountingStyles

const METHODS = [
  { value: 'virement', label: 'Virement' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'especes', label: 'Espèces' },
  { value: 'carte', label: 'Carte bancaire' },
  { value: 'autre', label: 'Autre' },
];

const months = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function TransactionModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  paymentId,
  context,
  defaultPropertyId,
  defaultLeaseId,
  duplicatingPayment,
  currentFilters,
}: TransactionModalProps) {
  const queryClient = useQueryClient();
  const { data: documentTypes = [] } = useDocumentTypes();
  const [propertyId, setPropertyId] = useState(defaultPropertyId || '');
  const [leaseId, setLeaseId] = useState(defaultLeaseId || '');
  const [nature, setNature] = useState<string>('');
  const [accountingCategoryId, setAccountingCategoryId] = useState<string>('');
  const [categoryDirty, setCategoryDirty] = useState(false);
  const [categoryAdjusted, setCategoryAdjusted] = useState(false);
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('virement');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [periodStart, setPeriodStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [periodCount, setPeriodCount] = useState(1);
  const [autoDistribute, setAutoDistribute] = useState(true);
  const [attachments, setAttachments] = useState<Array<{ 
    id?: string; 
    name: string; 
    size: number; 
    mime: string; 
    base64: string; 
    documentTypeId?: string;
    documentType?: DocumentType;
    classification?: any;
    isClassifying?: boolean;
  }>>([]);
  const [existingAttachments, setExistingAttachments] = useState<Array<{ id: string; filename: string; mimeType: string; size: number; url: string }>>([]);
  const [removeAttachmentIds, setRemoveAttachmentIds] = useState<string[]>([]);
  
  const [properties, setProperties] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [natures, setNatures] = useState<Array<{ value: string; label: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [labelDirty, setLabelDirty] = useState(false);

  // Charger le mapping comptable selon la nature
  const { 
    data: mappingData, 
    isLoading: isCategoriesLoading, 
    error: categoriesError 
  } = useAccountingMapping(nature);

  const allowedCategories = mappingData?.allowedCategories || [];
  const defaultCategoryId = mappingData?.defaultCategoryId;
  const hasRules = mappingData?.hasRules || false;


  // Gérer la sélection automatique de catégorie quand la nature change
  useEffect(() => {
    if (nature && mappingData && !categoryDirty) {
      // Vérifier si la catégorie actuelle est encore autorisée
      const currentCategoryStillAllowed = !accountingCategoryId || 
        allowedCategories.some(cat => cat.id === accountingCategoryId);
      
      if (!currentCategoryStillAllowed) {
        // La catégorie actuelle n'est plus autorisée, la remplacer
        setAccountingCategoryId(defaultCategoryId || '');
        setCategoryAdjusted(true);
      } else if (defaultCategoryId && !accountingCategoryId) {
        // Aucune catégorie sélectionnée et il y a une catégorie par défaut
        setAccountingCategoryId(defaultCategoryId);
      }
    }
  }, [nature, mappingData, accountingCategoryId, categoryDirty, defaultCategoryId, allowedCategories]);

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'create') {
        if (duplicatingPayment) {
          // Mode duplication - pré-remplir avec les données du paiement à dupliquer
          setPropertyId(duplicatingPayment.propertyId);
          setLeaseId(duplicatingPayment.leaseId || '');
          setNature(duplicatingPayment.nature || 'AUTRE');
          setAccountingCategoryId(duplicatingPayment.accountingCategoryId || '');
          setCategoryDirty(false);
          setAmount(duplicatingPayment.amount.toString());
          setLabel(duplicatingPayment.label);
          setLabelDirty(true);
          setDate(new Date().toISOString().split('T')[0]); // Date actuelle pour la duplication
          setMethod(duplicatingPayment.method || 'virement');
          setReference('');
          setNotes(duplicatingPayment.notes || '');
          setPeriodStart(`${duplicatingPayment.periodYear}-${String(duplicatingPayment.periodMonth).padStart(2, '0')}`);
          setPeriodCount(1);
          setAutoDistribute(false);
          setAttachments([]);
          setExistingAttachments([]);
          setRemoveAttachmentIds([]);
          loadProperties();
        } else {
          // Mode création normal
          setPropertyId(defaultPropertyId || '');
          setLeaseId(defaultLeaseId || '');
          setNature(context === 'lease' ? 'LOYER' : 'AUTRE');
          setAccountingCategoryId('');
          setCategoryDirty(false);
          setAmount('');
          setLabel('');
          setLabelDirty(false);
          setDate(new Date().toISOString().split('T')[0]);
          setMethod('virement');
          setReference('');
          setNotes('');
          const now = new Date();
          setPeriodStart(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
          setPeriodCount(1);
          setAutoDistribute(true);
          setAttachments([]);
          setExistingAttachments([]);
          setRemoveAttachmentIds([]);
          loadProperties();
        }
      } else if (mode === 'edit' && paymentId) {
        loadPayment(paymentId);
      }
    } else {
      // Modal fermé - réinitialiser le loading
      setIsLoadingData(false);
    }
  }, [isOpen, mode, paymentId, defaultPropertyId, defaultLeaseId, duplicatingPayment]);

  // Load leases when property changes
  useEffect(() => {
    if (isOpen && propertyId) {
      loadLeases(propertyId);
    } else {
      setLeases([]);
      setLeaseId('');
    }
  }, [isOpen, propertyId]);

  // Load leases when defaultPropertyId is provided and modal opens
  useEffect(() => {
    if (isOpen && defaultPropertyId && !propertyId) {
      setPropertyId(defaultPropertyId);
      loadLeases(defaultPropertyId);
    }
  }, [isOpen, defaultPropertyId]);

  // Auto-select lease if only one active lease
  useEffect(() => {
    if (leases.length === 1 && !leaseId) {
      setLeaseId(leases[0].id);
    }
  }, [leases]);

  // When lease is selected: set nature to LOYER if empty, prefill amount
  useEffect(() => {
    if (leaseId && leases.length > 0) {
      const selectedLease = leases.find(l => l.id === leaseId);
      if (selectedLease) {
        // Si nature vide → LOYER (mais pas si AUTRE est explicitement choisi)
        if (!nature || nature === '') {
          setNature('LOYER');
        }
        // Préremplir montant si nature = LOYER (seulement en mode création)
        if (nature === 'LOYER' && mode === 'create') {
          const total = (selectedLease.rentAmount || 0) + (selectedLease.charges || 0);
          setAmount(total.toString());
        }
      }
    }
  }, [leaseId, leases, nature]);

  // When nature changes to LOYER with lease: prefill amount (seulement en mode création)
  useEffect(() => {
    if (nature === 'LOYER' && leaseId && leases.length > 0 && mode === 'create') {
      const selectedLease = leases.find(l => l.id === leaseId);
      if (selectedLease) {
        const total = (selectedLease.rentAmount || 0) + (selectedLease.charges || 0);
        setAmount(total.toString());
      }
    }
  }, [nature, leaseId, leases, mode]);

  // Auto-sélectionner la catégorie par défaut selon la nature
  useEffect(() => {
    if (defaultCategoryId && allowedCategories.length > 0) {
      // Vérifier que la catégorie par défaut est dans la liste des catégories autorisées
      const compatibleDefault = allowedCategories.find(c => c.id === defaultCategoryId);
      if (compatibleDefault) {
        setAccountingCategoryId(defaultCategoryId);
      } else {
        // Si la catégorie par défaut n'est pas compatible, prendre la première
        setAccountingCategoryId(allowedCategories[0]?.id || '');
      }
    } else if (allowedCategories.length > 0) {
      // Pas de catégorie par défaut définie, prendre la première compatible
      setAccountingCategoryId(allowedCategories[0]?.id || '');
    } else {
      // Aucune catégorie compatible
      setAccountingCategoryId('');
    }
  }, [nature, allowedCategories, defaultCategoryId]);

  // Auto-generate label if not dirty OR when nature/category changes
  useEffect(() => {
    if (propertyId && properties.length > 0) {
      const property = properties.find(p => p.id === propertyId);
      const [year, month] = periodStart.split('-');
      const monthName = months[parseInt(month) - 1];
      const monthAbbr = monthName.slice(0, 4);
      
      let newLabel = '';
      if (nature === 'LOYER' && leaseId) {
        newLabel = `Loyer ${monthAbbr}. ${year} – ${property?.name || ''}`;
      } else if (nature && property) {
        const natureLabel = natures.find(c => c.value === nature)?.label || nature;
        newLabel = `${natureLabel} ${monthAbbr}. ${year} – ${property.name}`;
      } else if (property) {
        newLabel = `Transaction ${monthAbbr}. ${year} – ${property.name}`;
      }
      
      if (newLabel) {
        setLabel(newLabel);
        // Marquer comme dirty seulement si l'utilisateur a modifié manuellement
        if (!labelDirty) {
          setLabelDirty(false);
        }
      }
    }
  }, [propertyId, leaseId, nature, periodStart, properties, accountingCategoryId]);

  const loadProperties = async () => {
    setIsLoadingData(true);
    try {
      const [propsRes, naturesRes] = await Promise.all([
        fetch('/api/properties'),
        fetch('/api/natures')
      ]);
      
      if (propsRes.ok) {
        const propsData = await propsRes.json();
        setProperties(propsData);
      }
      
      if (naturesRes.ok) {
        const naturesData = await naturesRes.json();
        if (naturesData.success && naturesData.data) {
          const transformedNatures = naturesData.data.map((nature: any) => ({
            value: nature.key,
            label: nature.label
          }));
          setNatures(transformedNatures);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadPayment = async (id: string) => {
    setIsLoadingData(true);
    try {
      const [paymentRes, propsRes] = await Promise.all([
        fetch(`/api/payments/${id}`),
        fetch('/api/properties'),
      ]);

      if (paymentRes.ok && propsRes.ok) {
        const paymentData = await paymentRes.json();
        const propsData = await propsRes.json();
        
        setProperties(propsData);
        
        // Populate form with payment data
        setPropertyId(paymentData.propertyId);
        setLeaseId(paymentData.leaseId || '');
        setNature(paymentData.nature || 'AUTRE');
        setAccountingCategoryId(paymentData.accountingCategoryId || '');
        setCategoryDirty(true);
        setAmount(paymentData.amount.toString());
        setLabel(paymentData.label);
        setLabelDirty(true); // Mark as dirty since it's pre-filled
        setDate(paymentData.date.split('T')[0]);
        setMethod(paymentData.method || 'virement');
        setReference(paymentData.reference || '');
        setNotes(paymentData.notes || '');
        
        // Set period from payment data
        const periodDate = new Date(paymentData.periodYear, paymentData.periodMonth - 1, 1);
        setPeriodStart(`${paymentData.periodYear}-${String(paymentData.periodMonth).padStart(2, '0')}`);
        setPeriodCount(1);
        setAutoDistribute(false);
        
        // Set attachments
        setExistingAttachments(paymentData.attachments || []);
        setAttachments([]);
        setRemoveAttachmentIds([]);
        
        // Load leases for the property
        if (paymentData.propertyId) {
          await loadLeases(paymentData.propertyId);
        }
      }
    } catch (error) {
      console.error('Error loading payment:', error);
      toast.error('Erreur lors du chargement du paiement');
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadLeases = async (propId: string) => {
    try {
      const leasesRes = await fetch(`/api/leases?propertyId=${propId}`);
      if (leasesRes.ok) {
        const leasesData = await leasesRes.json();
        const leases = leasesData.Lease || leasesData; // Support both formats
        const activeLeases = leases.filter((l: any) => l.status === 'ACTIF' || l.status === 'SIGNÉ');
        setLeases(activeLeases);
        console.log('Loaded leases for property:', propId, activeLeases.length, 'active leases');
      }
    } catch (error) {
      console.error('Error loading leases:', error);
    }
  };



  const removeExistingAttachment = (attachmentId: string) => {
    setRemoveAttachmentIds(prev => [...prev, attachmentId]);
    setExistingAttachments(prev => prev.filter(att => att.id !== attachmentId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!propertyId || !amount || !date || !nature) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Validation de la catégorie comptable
    if (accountingCategoryId && !allowedCategories.some(cat => cat.id === accountingCategoryId)) {
      toast.error('La catégorie sélectionnée n\'est pas autorisée pour cette nature');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        // Mode création - logique existante
        const totalAmount = parseFloat(amount);
        let periods: Array<{ year: number; month: number; amount: number }> = [];
        
        // Si "Mois couverts" est caché : créer 1 seule période basée sur la date de paiement
        if ((nature !== 'LOYER' && nature !== 'CHARGES') || !leaseId) {
          const paymentDate = new Date(date);
          periods = [{
            year: paymentDate.getFullYear(),
            month: paymentDate.getMonth() + 1,
            amount: totalAmount,
          }];
        } else {
          // Sinon : utiliser la logique multi-mois
          const [startYear, startMonth] = periodStart.split('-').map(Number);
          
          if (autoDistribute && periodCount > 1 && leaseId) {
          // Répartition automatique
          const selectedLease = leases.find(l => l.id === leaseId);
          const monthlyExpected = selectedLease ? (selectedLease.rentAmount || 0) + (selectedLease.charges || 0) : 0;
          
          let remaining = totalAmount;
          for (let i = 0; i < periodCount; i++) {
            const currentMonth = (startMonth + i - 1) % 12 + 1;
            const currentYear = startYear + Math.floor((startMonth + i - 1) / 12);
            
            let monthAmount;
            if (i === periodCount - 1) {
              // Dernier mois : ajuster avec le restant
              monthAmount = remaining;
            } else if (monthlyExpected > 0) {
              monthAmount = Math.min(monthlyExpected, remaining);
            } else {
              monthAmount = Math.round((totalAmount / periodCount) * 100) / 100;
            }
            
            periods.push({
              year: currentYear,
              month: currentMonth,
              amount: monthAmount,
            });
            
            remaining -= monthAmount;
          }
        } else {
          // Pas de répartition : 1 seul paiement ou N paiements égaux
          const monthAmount = autoDistribute ? Math.round((totalAmount / periodCount) * 100) / 100 : totalAmount;
          
          for (let i = 0; i < periodCount; i++) {
            const currentMonth = (startMonth + i - 1) % 12 + 1;
            const currentYear = startYear + Math.floor((startMonth + i - 1) / 12);
            
            periods.push({
              year: currentYear,
              month: currentMonth,
              amount: i === periodCount - 1 && autoDistribute ? 
                totalAmount - (monthAmount * (periodCount - 1)) : monthAmount,
            });
          }
          }
        }

        // Préparer la requête
        const payload = {
          base: {
            propertyId: defaultPropertyId || propertyId,
            leaseId: leaseId || null,
            date,
            nature,
            accountingCategoryId: accountingCategoryId || null,
            label,
            method: method || null,
            reference: reference || null,
            notes: notes || null,
          },
          periods,
          attachments: attachments.map(a => ({
            name: a.name,
            mime: a.mime,
            size: a.size,
            base64: a.base64,
            documentTypeId: a.documentTypeId || null,
          })),
        };

        console.log('[TransactionModal] Sending payload:', {
          base: payload.base,
          periodsCount: payload.periods.length,
          attachmentsCount: payload.attachments.length,
          attachments: payload.attachments.map(a => ({ name: a.name, documentTypeId: a.documentTypeId }))
        });

        const response = await fetch('/api/payments/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erreur lors de la création');
        }

        const result = await response.json();

        // Vérifier si la transaction est masquée par les filtres
        let isFiltered = false;
        if (currentFilters) {
          // Filtre par bien
          if (currentFilters.propertyId && currentFilters.propertyId !== propertyId) {
            isFiltered = true;
          }
          // Filtre par nature
          if (currentFilters.Category && currentFilters.Category !== nature) {
            isFiltered = true;
          }
          // Filtre par date
          if (currentFilters.dateFrom && date < currentFilters.dateFrom) {
            isFiltered = true;
          }
          if (currentFilters.dateTo && date > currentFilters.dateTo) {
            isFiltered = true;
          }
        }

        if (isFiltered) {
          toast.info('La transaction a été créée mais vos filtres actuels la masquent.');
        } else {
          toast.success(`${periods.length} paiement(s) créé(s) avec succès`);
        }

        // Invalider les caches pour mettre à jour les cartes KPI
        await queryClient.invalidateQueries({ queryKey: ['transaction-stats'] });
        await queryClient.invalidateQueries({ queryKey: ['payments'] });
        await queryClient.invalidateQueries({ queryKey: ['property-summary', propertyId] });

        onSuccess?.(result.payments);
        onClose();
      } else {
        // Mode édition
        const [periodYear, periodMonth] = periodStart.split('-').map(Number);
        
        const payload = {
          propertyId,
          leaseId: leaseId || null,
          date,
          periodYear,
          periodMonth,
          amount: parseFloat(amount),
          nature,
          accountingCategoryId: accountingCategoryId || null,
          label,
          method: method || null,
          reference: reference || null,
          notes: notes || null,
          addAttachments: attachments.map(a => ({
            filename: a.name,
            mime: a.mime,
            base64: a.base64,
            documentTypeId: a.documentTypeId,
          })),
          removeAttachmentIds: removeAttachmentIds,
        };

        console.log('[TransactionModal] PATCH payload:', payload);

        const response = await fetch(`/api/payments/${paymentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erreur lors de la modification');
        }

        const result = await response.json();
        toast.success('Transaction modifiée avec succès');
        
        // Invalider les caches pour mettre à jour les cartes KPI
        await queryClient.invalidateQueries({ queryKey: ['transaction-stats'] });
        await queryClient.invalidateQueries({ queryKey: ['payments'] });
        await queryClient.invalidateQueries({ queryKey: ['property-summary', propertyId] });
        
        onSuccess?.([result]);
        onClose();
      }
    } catch (error: any) {
      console.error(`Error ${mode === 'create' ? 'creating' : 'updating'} payment:`, error);
      toast.error(error.message || `Erreur lors de la ${mode === 'create' ? 'création' : 'modification'} du paiement`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedProperty = properties.find(p => p.id === propertyId);
  const selectedLease = leases.find(l => l.id === leaseId);
  const showMonthsCovered = (nature === 'LOYER' || nature === 'CHARGES') && leaseId;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-base-100 rounded-2xl shadow-2xl border border-base-300 p-6 w-full max-w-2xl mx-4 my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-neutral-900">
            {mode === 'create' ? 'Ajouter une transaction' : 'Modifier la transaction'}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X size={24} />
          </button>
        </div>

        {isLoadingData ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-neutral-600">Chargement...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Bien concerné */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Bien concerné <span className="text-error">*</span>
              </label>
              {defaultPropertyId ? (
                <div>
                  <input
                    type="text"
                    value={properties.find(p => p.id === defaultPropertyId)?.name || 'Propriété sélectionnée'}
                    disabled
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-neutral-100 text-neutral-600 cursor-not-allowed"
                  />
                  <input type="hidden" name="propertyId" value={defaultPropertyId} />
                </div>
              ) : (
                <select
                  value={propertyId}
                  onChange={(e) => {
                    setPropertyId(e.target.value);
                    setLeaseId(''); // Reset lease when property changes
                  }}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
                >
                  <option value="">Sélectionner un bien</option>
                  {properties.map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Bail (optionnel) */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Bail (optionnel)
              </label>
              <select
                value={leaseId}
                onChange={(e) => setLeaseId(e.target.value)}
                disabled={!propertyId}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary disabled:bg-neutral-100 disabled:cursor-not-allowed"
              >
                <option value="">Aucun bail</option>
                {leases.map((lease) => (
                  <option key={lease.id} value={lease.id}>
                    {lease.Tenant?.firstName} {lease.Tenant?.lastName} – {new Date(lease.startDate).toLocaleDateString('fr-FR')}
                  </option>
                ))}
              </select>
              {propertyId && leases.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  ⚠ Aucun bail actif pour ce bien
                </p>
              )}
            </div>

            {/* Nature */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Nature <span className="text-error">*</span>
              </label>
              <select
                value={nature}
                onChange={(e) => {
                  setNature(e.target.value);
                  setCategoryDirty(false); // Réinitialiser le flag pour permettre la sélection auto
                  setCategoryAdjusted(false);
                }}
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
              >
                {natures.map((nat) => (
                  <option key={nat.value} value={nat.value}>
                    {nat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Montant */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Montant (€) <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
                />
              </div>

              {/* Catégorie comptable (optionnelle) */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Catégorie comptable
                </label>
                <select
                  value={accountingCategoryId}
                  onChange={(e) => {
                    setAccountingCategoryId(e.target.value);
                    setCategoryDirty(true);
                    setCategoryAdjusted(false);
                  }}
                  disabled={isCategoriesLoading || !nature}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary disabled:bg-neutral-50"
                >
                  <option value="">Aucune (à classer)</option>
                  {allowedCategories
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label} ({cat.type === 'REVENU' ? 'REVENU' : cat.type === 'DEPENSE' ? 'DEPENSE' : 'NON_DEFINI'})
                      </option>
                    ))}
                </select>
                {!hasRules && nature && (
                  <p className="mt-1 text-xs text-amber-600">
                    Aucune règle trouvée pour cette nature
                  </p>
                )}
                {categoryAdjusted && (
                  <p className="mt-1 text-xs text-primary">
                    Catégorie ajustée selon les règles de mapping
                  </p>
                )}
                {accountingCategoryId && (
                  <div className="mt-1 text-xs text-neutral-500">
                    {(() => {
                      const cat = allowedCategories.find(c => c.id === accountingCategoryId);
                      if (!cat) return null;
                      const typeStyle = getAccountingTypeStyle(cat.type as any);
                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                            {typeStyle.label}
                          </span>
                          {cat.deductible && (
                            <span className="text-success">✓ Déductible</span>
                          )}
                          {cat.capitalizable && (
                            <span className="text-primary">✓ Capitalisable</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Libellé */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Libellé <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setLabelDirty(true);
                }}
                placeholder={
                  nature === 'LOYER' && leaseId 
                    ? `Loyer ${months[new Date(periodStart).getMonth()].slice(0, 4)}. ${periodStart.split('-')[0]} – ${selectedProperty?.name || ''}` 
                    : `Transaction ${months[new Date(periodStart).getMonth()].slice(0, 4)}. ${periodStart.split('-')[0]} – ${selectedProperty?.name || ''}`
                }
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Date de paiement */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Date de paiement <span className="text-error">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
                />
              </div>

              {/* Méthode */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Méthode
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
                >
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Référence */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Référence (optionnel)
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Numéro de chèque, référence virement..."
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
              />
            </div>

            {/* Mois couverts (visible uniquement pour LOYER/CHARGES avec bail) */}
            {showMonthsCovered && (
              <div className="border-t border-neutral-200 pt-4 mt-4">
                <h3 className="text-sm font-medium text-neutral-700 mb-3">Mois couverts</h3>
              
                {mode === 'edit' ? (
                  // Mode édition : MonthPicker simple
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Période couverte (AAAA-MM)
                    </label>
                    <input
                      type="month"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-primary"
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      Pour un paiement multi-mois, modifiez chaque ligne séparément.
                    </p>
                  </div>
                ) : (
                  // Mode création : logique multi-mois
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      {/* Début */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Début (mois)
                        </label>
                        <input
                          type="month"
                          value={periodStart}
                          onChange={(e) => setPeriodStart(e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-primary"
                        />
                      </div>

                      {/* Nombre de mois */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Nombre de mois
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={periodCount}
                          onChange={(e) => setPeriodCount(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="autoDistribute"
                        checked={autoDistribute}
                        onChange={(e) => setAutoDistribute(e.target.checked)}
                        className="w-4 h-4 text-primary"
                      />
                      <label htmlFor="autoDistribute" className="text-sm text-neutral-700">
                        Répartir automatiquement le montant sur {periodCount} mois
                      </label>
                    </div>
                    
                    {periodCount > 1 && (
                      <p className="mt-2 text-xs text-neutral-600">
                        {autoDistribute ? 
                          `Le montant sera réparti sur ${periodCount} mois (${(parseFloat(amount) / periodCount).toFixed(2)}€/mois en moyenne)` :
                          `Un seul paiement sera créé pour le premier mois`
                        }
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Pièces jointes */}
            <div className="border-t border-neutral-200 pt-4 mt-4">
              <h3 className="text-sm font-medium text-neutral-700 mb-3">Pièces jointes</h3>
              

            {/* Gestion des documents avec classification automatique */}
            <TransactionDocumentUpload
              attachments={attachments}
              onAttachmentsChange={(newAttachments) => {
                console.log('[TransactionModal] Attachments changed:', newAttachments.length);
                setAttachments(newAttachments);
              }}
              documentTypes={documentTypes}
              propertyId={propertyId}
              leaseId={leaseId}
              tenantId={selectedLease?.tenantId}
              disabled={isSubmitting}
              existingAttachments={existingAttachments.map(att => ({
                id: att.id,
                filename: att.filename,
                mimeType: att.mimeType,
                size: att.size,
                url: att.url,
                documentType: att.DocumentType,
              }))}
              onRemoveExisting={(id) => {
                setRemoveAttachmentIds([...removeAttachmentIds, id]);
                setExistingAttachments(existingAttachments.filter(att => att.id !== id));
              }}
            />

            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Notes (optionnel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Informations complémentaires..."
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-neutral-700 bg-neutral-100 rounded-md hover:bg-neutral-200 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary text-base-100 rounded-md hover:bg-primary transition-colors disabled:bg-neutral-300 disabled:cursor-not-allowed flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {mode === 'create' ? 'Création...' : 'Modification...'}
                  </>
                ) : (
                  mode === 'create' ? 'Enregistrer' : 'Enregistrer les modifications'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
