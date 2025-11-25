'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Upload, FileText, Eye, Link, Plus, Edit, Trash2, UserPlus, Info } from 'lucide-react';
import { notify2 } from '@/lib/notify2';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { useUploadStaging } from '@/hooks/useUploadStaging';
import { UploadReviewModal } from '@/components/documents/UploadReviewModal';
import { DuplicateDetectedModal } from '@/components/documents/DuplicateDetectedModal';
import { ConfirmDeleteDocumentModal } from '@/components/documents/ConfirmDeleteDocumentModal';
import { buildSchedule, crdAtDate } from '@/lib/finance/amortization';

// Schéma de validation pour le formulaire de prêt
const loanFormSchema = z.object({
  propertyId: z.string().min(1, 'Veuillez sélectionner un bien'),
  label: z.string().min(1, 'Le libellé est requis'),
  principal: z.number().positive('Le capital doit être positif'),
  annualRatePct: z.number().min(0, 'Le taux doit être positif ou nul'),
  durationMonths: z.number().int().positive('La durée doit être positive'),
  defermentMonths: z.number().int().min(0, 'Le différé ne peut pas être négatif').default(0),
  insurancePct: z.number().min(0, 'L\'assurance doit être positive').optional().nullable(),
  feesUpfront: z.number().min(0, 'Les frais doivent être positifs').optional().nullable(),
  startDate: z.string().min(1, 'La date de début est requise'),
  loanType: z.string().optional().nullable(),
  repaymentType: z.string().optional().nullable(),
  amortizationProfile: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

type LoanFormData = z.infer<typeof loanFormSchema>;

// Schéma pour les co-emprunteurs
const borrowerSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  birthDate: z.string().optional().nullable(),
  email: z.string().email('Email invalide').optional().nullable(),
  phone: z.string().optional().nullable(),
  responsibilityPct: z.number().min(0).max(100).optional().nullable(),
});

type BorrowerFormData = z.infer<typeof borrowerSchema>;

interface Property {
  id: string;
  name: string;
}

interface LoanBorrower {
  id?: string;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  email?: string | null;
  phone?: string | null;
  responsibilityPct?: number | null;
}

interface LoanModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LoanFormData & { 
    id?: string;
    stagedDocumentIds?: string[];
    stagedLinkItemIds?: string[];
    borrowers?: LoanBorrower[];
  }) => Promise<void>;
  properties: Property[];
  initialData?: Partial<LoanFormData> & { 
    id?: string;
    borrowers?: LoanBorrower[];
  };
  mode?: 'create' | 'edit';
  title?: string;
}

export const LoanModalV2: React.FC<LoanModalV2Props> = ({
  isOpen,
  onClose,
  onSubmit,
  properties,
  initialData,
  mode = 'create',
  title,
}) => {
  const [activeTab, setActiveTab] = useState('informations');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // États pour les co-emprunteurs
  const [borrowers, setBorrowers] = useState<LoanBorrower[]>(initialData?.borrowers || []);
  const [showBorrowerModal, setShowBorrowerModal] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState<LoanBorrower | null>(null);
  const [borrowerFormData, setBorrowerFormData] = useState<BorrowerFormData>({
    firstName: '',
    lastName: '',
    birthDate: null,
    email: null,
    phone: null,
    responsibilityPct: null,
  });

  // Hook pour le staging des documents
  const {
    uploadSessionId,
    stagedDocuments,
    setStagedDocuments,
    loading: stagingLoading,
    createUploadSession,
    loadStagedDocuments,
    addStagedDocument,
    removeStagedDocument,
    clearStaging
  } = useUploadStaging();

  // États pour les documents
  const [linkedDocuments, setLinkedDocuments] = useState<any[]>([]);
  const [stagedLinks, setStagedLinks] = useState<any[]>([]);
  const [showReviewDraftModal, setShowReviewDraftModal] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [showDeleteDocModal, setShowDeleteDocModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateData, setDuplicateData] = useState<any>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      propertyId: initialData?.propertyId || '',
      label: initialData?.label || '',
      principal: initialData?.principal || 0,
      annualRatePct: initialData?.annualRatePct || 0,
      durationMonths: initialData?.durationMonths || 240,
      defermentMonths: initialData?.defermentMonths || 0,
      insurancePct: initialData?.insurancePct || null,
      feesUpfront: initialData?.feesUpfront || null,
      startDate: initialData?.startDate
        ? new Date(initialData.startDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      loanType: (initialData as any)?.loanType || null,
      repaymentType: (initialData as any)?.repaymentType || null,
      amortizationProfile: (initialData as any)?.amortizationProfile || null,
      notes: (initialData as any)?.notes || null,
      isActive: initialData?.isActive !== undefined ? initialData.isActive : true,
    },
  });

  // Réinitialiser le formulaire quand initialData change (mode édition)
  useEffect(() => {
    if (isOpen && initialData) {
      reset({
        propertyId: initialData.propertyId || '',
        label: initialData.label || '',
        principal: initialData.principal || 0,
        annualRatePct: initialData.annualRatePct || 0,
        durationMonths: initialData.durationMonths || 240,
        defermentMonths: initialData.defermentMonths || 0,
        insurancePct: initialData.insurancePct || null,
        feesUpfront: initialData.feesUpfront || null,
        startDate: initialData.startDate
          ? new Date(initialData.startDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        loanType: (initialData as any)?.loanType || null,
        repaymentType: (initialData as any)?.repaymentType || null,
        amortizationProfile: (initialData as any)?.amortizationProfile || null,
        notes: (initialData as any)?.notes || null,
        isActive: initialData.isActive !== undefined ? initialData.isActive : true,
      });
      
      // Réinitialiser les co-emprunteurs
      if (initialData.borrowers) {
        setBorrowers(initialData.borrowers);
      } else {
        setBorrowers([]);
      }
    } else if (isOpen && !initialData) {
      // Mode création : réinitialiser le formulaire
      reset({
        propertyId: '',
        label: '',
        principal: 0,
        annualRatePct: 0,
        durationMonths: 240,
        defermentMonths: 0,
        insurancePct: null,
        feesUpfront: null,
        startDate: new Date().toISOString().split('T')[0],
        loanType: null,
        repaymentType: null,
        amortizationProfile: null,
        notes: null,
        isActive: true,
      });
      setBorrowers([]);
    }
  }, [isOpen, initialData, reset]);

  // Initialiser la session d'upload à l'ouverture
  useEffect(() => {
    if (isOpen && !uploadSessionId) {
      createUploadSession('loan').then((sessionId) => {
        if (sessionId) {
          // Charger les documents et liens existants de la session
          loadStagedDocuments(sessionId).then(() => {
            // Charger aussi les liens vers documents existants
            fetch(`/api/upload-session/${sessionId}`)
              .then(res => res.json())
              .then(data => {
                if (data.success) {
                  setStagedLinks(data.DocumentLink || []);
                }
              })
              .catch(err => console.error('Erreur chargement liens:', err));
          });
        }
      });
    } else if (isOpen && uploadSessionId) {
      // Recharger les documents et liens si la session existe déjà
      loadStagedDocuments(uploadSessionId).then(() => {
        fetch(`/api/upload-session/${uploadSessionId}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setStagedLinks(data.DocumentLink || []);
            }
          })
          .catch(err => console.error('Erreur chargement liens:', err));
      });
    }
  }, [isOpen, uploadSessionId, createUploadSession, loadStagedDocuments]);

  // Charger les documents liés en mode édition
  useEffect(() => {
    if (isOpen && mode === 'edit' && initialData?.id) {
      loadLinkedDocuments(initialData.id);
      loadBorrowers(initialData.id);
    }
  }, [isOpen, mode, initialData?.id]);

  // Charger les co-emprunteurs
  const loadBorrowers = async (loanId: string) => {
    try {
      const response = await fetch(`/api/loans/${loanId}/borrowers`);
      if (response.ok) {
        const data = await response.json();
        setBorrowers(data.borrowers || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des co-emprunteurs:', error);
    }
  };

  // Charger les documents liés
  const loadLinkedDocuments = async (loanId: string) => {
    try {
      const response = await fetch(`/api/loans/${loanId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setLinkedDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des documents:', error);
    }
  };

  // Gestion des co-emprunteurs
  const handleAddBorrower = () => {
    setEditingBorrower(null);
    setBorrowerFormData({
      firstName: '',
      lastName: '',
      birthDate: null,
      email: null,
      phone: null,
      responsibilityPct: null,
    });
    setShowBorrowerModal(true);
  };

  const handleEditBorrower = (borrower: LoanBorrower) => {
    setEditingBorrower(borrower);
    setBorrowerFormData({
      firstName: borrower.firstName,
      lastName: borrower.lastName,
      birthDate: borrower.birthDate || null,
      email: borrower.email || null,
      phone: borrower.phone || null,
      responsibilityPct: borrower.responsibilityPct || null,
    });
    setShowBorrowerModal(true);
  };

  const handleSaveBorrower = () => {
    if (!borrowerFormData.firstName || !borrowerFormData.lastName) {
      notify2.error('Le prénom et le nom sont requis');
      return;
    }

    if (editingBorrower) {
      // Modifier
      setBorrowers(prev => prev.map(b => 
        b.id === editingBorrower.id 
          ? { ...b, ...borrowerFormData }
          : b
      ));
    } else {
      // Ajouter
      setBorrowers(prev => [...prev, borrowerFormData as LoanBorrower]);
    }
    setShowBorrowerModal(false);
    setEditingBorrower(null);
  };

  const handleDeleteBorrower = (borrower: LoanBorrower) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce co-emprunteur ?')) {
      if (borrower.id) {
        // Supprimer via API si déjà sauvegardé
        fetch(`/api/loans/borrowers/${borrower.id}`, {
          method: 'DELETE',
        }).then(() => {
          setBorrowers(prev => prev.filter(b => b.id !== borrower.id));
        });
      } else {
        // Supprimer de la liste locale
        setBorrowers(prev => prev.filter(b => b !== borrower));
      }
    }
  };

  // Gestion de l'upload de fichiers (identique à TransactionModalV2)
  const handleFileUpload = async (files: File[]) => {
    if (!uploadSessionId) {
      await createUploadSession('loan');
      return;
    }

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadSessionId', uploadSessionId);
      formData.append('intendedContextType', 'loan');
      formData.append('intendedContextTempKey', mode === 'create' ? 'loan:new' : (initialData?.id || 'loan:edit'));

      try {
        const response = await fetch('/api/upload-staged', {
          method: 'POST',
          body: formData,
        });

        if (response.status === 409) {
          // Doublon détecté
          const duplicateInfo = await response.json();
          setDuplicateData(duplicateInfo);
          setShowDuplicateModal(true);
          return; // Arrêter l'upload des autres fichiers
        } else if (response.ok) {
          // Upload réussi
          const result = await response.json();
          if (result.success) {
            // Recharger la liste des documents et liens
            await loadStagedDocuments(uploadSessionId);
            
            // Recharger aussi les liens vers documents existants
            try {
              const sessionResponse = await fetch(`/api/upload-session/${uploadSessionId}`);
              if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                if (sessionData.success) {
                  setStagedLinks(sessionData.DocumentLink || []);
                }
              }
            } catch (error) {
              console.error('Erreur lors du rechargement des liens:', error);
            }
            
            notify2.success(`Document "${file.name}" ajouté en brouillon`);
          }
        } else {
          let errorMessage = `Erreur lors de l'upload de "${file.name}"`;
          try {
            const errorData = await response.json();
            if (errorData?.error) {
              errorMessage = errorData.error;
            }
          } catch (err) {
            console.warn('Impossible de parser la réponse d\'erreur', err);
          }
          notify2.error(errorMessage);
        }
      } catch (error) {
        console.error('Erreur lors de l\'upload:', error);
        notify2.error(`Erreur lors de l'upload de "${file.name}"`);
      }
    }
  };

  // Fonction pour lier un document existant (doublon)
  const handleLinkExisting = async () => {
    if (!duplicateData || !uploadSessionId) return;

    try {
      const response = await fetch('/api/upload-staged/link-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadSessionId,
          existingDocumentId: duplicateData.id,
          context: {
            type: 'loan',
            tempKey: mode === 'create' ? 'loan:new' : (initialData?.id || 'loan:edit'),
            refId: mode === 'edit' ? initialData?.id : undefined
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Recharger la liste des documents et liens
          await loadStagedDocuments(uploadSessionId);
          
          try {
            const sessionResponse = await fetch(`/api/upload-session/${uploadSessionId}`);
            if (sessionResponse.ok) {
              const sessionData = await sessionResponse.json();
              if (sessionData.success) {
                setStagedLinks(sessionData.DocumentLink || []);
              }
            }
          } catch (error) {
            console.error('Erreur lors du rechargement des liens:', error);
          }
          
          notify2.success('Document lié avec succès');
          setShowDuplicateModal(false);
          setDuplicateData(null);
        }
      } else {
        notify2.error('Erreur lors de la liaison du document');
      }
    } catch (error) {
      console.error('Erreur lors de la liaison:', error);
      notify2.error('Erreur lors de la liaison du document');
    }
  };

  // Soumission du formulaire
  const onSubmitForm = async (data: LoanFormData) => {
    setIsSubmitting(true);
    try {
      const stagedDocumentIds = stagedDocuments.map(doc => doc.id);
      const stagedLinkItemIds = stagedLinks.map(link => link.id);

      await onSubmit({
        ...data,
        id: initialData?.id,
        stagedDocumentIds,
        stagedLinkItemIds,
        borrowers,
      });

      // Nettoyer après succès
      reset();
      setBorrowers([]);
      clearStaging();
      setStagedLinks([]);
      onClose();
    } catch (error: any) {
      console.error('Erreur lors de la soumission:', error);
      notify2.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPropertyId = watch('propertyId');
  
  // Calculs automatiques (mensualité, date de fin, CRD)
  const principal = watch('principal') || 0;
  const annualRatePct = watch('annualRatePct') || 0;
  const durationMonths = watch('durationMonths') || 0;
  const defermentMonths = watch('defermentMonths') || 0;
  const insurancePct = watch('insurancePct') || 0;
  const startDate = watch('startDate');
  
  // Calculer la mensualité et la date de fin
  const [calculatedMonthlyPayment, setCalculatedMonthlyPayment] = useState<number | null>(null);
  const [calculatedEndDate, setCalculatedEndDate] = useState<string | null>(null);
  const [calculatedCRD, setCalculatedCRD] = useState<number | null>(null);
  
  useEffect(() => {
    if (principal > 0 && durationMonths > 0 && startDate) {
      try {
        const schedule = buildSchedule({
          principal,
          annualRatePct,
          durationMonths,
          defermentMonths,
          insurancePct,
          startDate: new Date(startDate),
        });
        
        if (schedule.length > 0) {
          // Mensualité (hors période de différé)
          const firstPaymentAfterDeferment = schedule.find(row => row.month > defermentMonths) || schedule[schedule.length - 1];
          setCalculatedMonthlyPayment(firstPaymentAfterDeferment.paymentTotal);
          
          // Date de fin
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + durationMonths);
          setCalculatedEndDate(endDate.toLocaleDateString('fr-FR'));
          
          // CRD actuel (aujourd'hui)
          const today = new Date();
          const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          const crd = crdAtDate(schedule, todayMonth);
          setCalculatedCRD(crd);
        }
      } catch (error) {
        console.error('Erreur lors du calcul:', error);
        setCalculatedMonthlyPayment(null);
        setCalculatedEndDate(null);
        setCalculatedCRD(null);
      }
    } else {
      setCalculatedMonthlyPayment(null);
      setCalculatedEndDate(null);
      setCalculatedCRD(null);
    }
  }, [principal, annualRatePct, durationMonths, defermentMonths, insurancePct, startDate]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {title || (mode === 'edit' ? 'Modifier le prêt' : 'Nouveau prêt')}
            </DialogTitle>
            <DialogDescription>
              {mode === 'edit'
                ? 'Modifiez les informations du prêt immobilier'
                : 'Ajoutez un nouveau prêt immobilier à votre patrimoine'}
            </DialogDescription>
          </DialogHeader>

          {/* Navigation des onglets */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                type="button"
                onClick={() => setActiveTab('informations')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'informations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Informations
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('co-emprunteurs')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'co-emprunteurs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Co-emprunteurs
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'documents'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Documents
              </button>
            </nav>
          </div>

          {/* Contenu scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
              {activeTab === 'informations' && (
                <div className="space-y-4">
                  {/* Bien */}
                  <div className="space-y-2">
                    <Label htmlFor="propertyId">Bien *</Label>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setValue('propertyId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner un bien</option>
                      {properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.name}
                        </option>
                      ))}
                    </select>
                    {errors.propertyId && (
                      <p className="text-sm text-red-500">{errors.propertyId.message}</p>
                    )}
                  </div>

                  {/* Libellé */}
                  <div className="space-y-2">
                    <Label htmlFor="label">Nom du prêt *</Label>
                    <Input
                      id="label"
                      {...register('label')}
                      placeholder="Ex: Prêt immobilier principal"
                    />
                    {errors.label && (
                      <p className="text-sm text-red-500">{errors.label.message}</p>
                    )}
                  </div>

                  {/* Type de prêt */}
                  <div className="space-y-2">
                    <Label htmlFor="loanType">Type de prêt</Label>
                    <select
                      {...register('loanType')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner un type</option>
                      <option value="IMMOBILIER">Prêt immobilier</option>
                      <option value="TRAVAUX">Prêt travaux</option>
                      <option value="PERSONNEL">Prêt personnel</option>
                      <option value="AUTRE">Autre</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Type de remboursement */}
                    <div className="space-y-2">
                      <Label htmlFor="repaymentType">Type de remboursement</Label>
                      <select
                        {...register('repaymentType')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sélectionner un type</option>
                        <option value="CLASSIC">Prêt classique (remboursement progressif)</option>
                        <option value="IN_FINE">Prêt in fine</option>
                      </select>
                    </div>

                    {/* Profil d'amortissement */}
                    <div className="space-y-2">
                      <Label htmlFor="amortizationProfile">Profil d'amortissement</Label>
                      <select
                        {...register('amortizationProfile')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sélectionner un profil</option>
                        <option value="CONSTANT_PAYMENT">Mensualités constantes (annuité classique)</option>
                        <option value="CONSTANT_AMORTIZATION">Amortissement constant (mensualités dégressives)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Capital */}
                    <div className="space-y-2">
                      <Label htmlFor="principal">Capital emprunté (€) *</Label>
                      <Input
                        id="principal"
                        type="number"
                        step="0.01"
                        {...register('principal', { valueAsNumber: true })}
                        placeholder="200000"
                      />
                      {errors.principal && (
                        <p className="text-sm text-red-500">{errors.principal.message}</p>
                      )}
                    </div>

                    {/* Taux annuel */}
                    <div className="space-y-2">
                      <Label htmlFor="annualRatePct">Taux annuel (%) *</Label>
                      <Input
                        id="annualRatePct"
                        type="number"
                        step="0.001"
                        {...register('annualRatePct', { valueAsNumber: true })}
                        placeholder="1.5"
                      />
                      {errors.annualRatePct && (
                        <p className="text-sm text-red-500">{errors.annualRatePct.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Durée */}
                    <div className="space-y-2">
                      <Label htmlFor="durationMonths">Durée (mois) *</Label>
                      <Input
                        id="durationMonths"
                        type="number"
                        {...register('durationMonths', { valueAsNumber: true })}
                        placeholder="240"
                      />
                      {errors.durationMonths && (
                        <p className="text-sm text-red-500">{errors.durationMonths.message}</p>
                      )}
                    </div>

                    {/* Différé */}
                    <div className="space-y-2">
                      <Label htmlFor="defermentMonths">Différé (mois)</Label>
                      <Input
                        id="defermentMonths"
                        type="number"
                        {...register('defermentMonths', { valueAsNumber: true })}
                        placeholder="0"
                      />
                      {errors.defermentMonths && (
                        <p className="text-sm text-red-500">{errors.defermentMonths.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Assurance */}
                    <div className="space-y-2">
                      <Label htmlFor="insurancePct">Assurance (%/an)</Label>
                      <Input
                        id="insurancePct"
                        type="number"
                        step="0.001"
                        {...register('insurancePct', { 
                          setValueAs: (v) => v === '' || v === null ? null : parseFloat(v),
                        })}
                        placeholder="0.35"
                      />
                      {errors.insurancePct && (
                        <p className="text-sm text-red-500">{errors.insurancePct.message}</p>
                      )}
                    </div>

                    {/* Frais de dossier */}
                    <div className="space-y-2">
                      <Label htmlFor="feesUpfront">Frais de dossier (€)</Label>
                      <Input
                        id="feesUpfront"
                        type="number"
                        step="0.01"
                        {...register('feesUpfront', { 
                          setValueAs: (v) => v === '' || v === null ? null : parseFloat(v),
                        })}
                        placeholder="1000"
                      />
                      {errors.feesUpfront && (
                        <p className="text-sm text-red-500">{errors.feesUpfront.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Date de début */}
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Date de début *</Label>
                    <Input id="startDate" type="date" {...register('startDate')} />
                    {errors.startDate && (
                      <p className="text-sm text-red-500">{errors.startDate.message}</p>
                    )}
                  </div>

                  {/* Calculs automatiques - Badges informatifs */}
                  {(calculatedMonthlyPayment !== null || calculatedEndDate !== null || calculatedCRD !== null) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Info className="h-5 w-5 text-blue-600" />
                        <h4 className="text-sm font-medium text-blue-900">Calculs automatiques</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {calculatedMonthlyPayment !== null && (
                          <div className="bg-white rounded-md p-3 border border-blue-100">
                            <p className="text-xs text-gray-600 mb-1">Mensualité</p>
                            <p className="text-lg font-semibold text-blue-900">
                              {calculatedMonthlyPayment.toFixed(2)} €
                            </p>
                          </div>
                        )}
                        {calculatedEndDate !== null && (
                          <div className="bg-white rounded-md p-3 border border-blue-100">
                            <p className="text-xs text-gray-600 mb-1">Date de fin</p>
                            <p className="text-lg font-semibold text-blue-900">
                              {calculatedEndDate}
                            </p>
                          </div>
                        )}
                        {calculatedCRD !== null && (
                          <div className="bg-white rounded-md p-3 border border-blue-100">
                            <p className="text-xs text-gray-600 mb-1">Capital restant dû</p>
                            <p className="text-lg font-semibold text-blue-900">
                              {calculatedCRD.toFixed(2)} €
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <textarea
                      id="notes"
                      {...register('notes')}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Notes additionnelles sur ce prêt..."
                    />
                  </div>

                  {/* Actif */}
                  <div className="flex items-center space-x-2">
                    <input
                      id="isActive"
                      type="checkbox"
                      {...register('isActive')}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="isActive" className="font-normal">
                      Prêt actif
                    </Label>
                  </div>
                </div>
              )}

              {activeTab === 'co-emprunteurs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Co-emprunteurs</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Gérez les co-emprunteurs associés à ce prêt
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddBorrower}
                      className="flex items-center gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      Ajouter un co-emprunteur
                    </Button>
                  </div>

                  {borrowers.length > 0 ? (
                    <div className="space-y-3">
                      {borrowers.map((borrower, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">
                              {borrower.firstName} {borrower.lastName}
                            </p>
                            <div className="text-sm text-gray-500 mt-1">
                              {borrower.email && <span>{borrower.email}</span>}
                              {borrower.phone && <span className="ml-2">{borrower.phone}</span>}
                              {borrower.responsibilityPct && (
                                <span className="ml-2">• {borrower.responsibilityPct}%</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditBorrower(borrower)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBorrower(borrower)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <UserPlus className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">Aucun co-emprunteur</p>
                      <p className="text-xs mt-1">Cliquez sur "Ajouter un co-emprunteur" pour en ajouter</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Documents liés</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Ajoutez des documents justificatifs à ce prêt
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
                        input.multiple = true;
                        input.onchange = (e) => {
                          const files = Array.from((e.target as HTMLInputElement).files || []);
                          if (files.length > 0) {
                            handleFileUpload(files);
                          }
                        };
                        input.click();
                      }}
                      className="flex items-center gap-2"
                      disabled={stagingLoading}
                    >
                      <Upload className="h-4 w-4" />
                      {stagingLoading ? 'Chargement...' : 'Ajouter des documents'}
                    </Button>
                  </div>

                  {(stagedDocuments.length > 0 || stagedLinks.length > 0 || linkedDocuments.length > 0) ? (
                    <div className="space-y-3">
                      {/* Documents en staging (brouillon) */}
                      {stagedDocuments.map((doc) => {
                        const documentType = String(doc.type || 'Type inconnu');
                        const isUnclassified = documentType === 'Non classé' || documentType === 'Type inconnu';
                        
                        return (
                          <div key={doc.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-yellow-600" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                                  <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                                    Brouillon
                                  </Badge>
                                </div>
                                <p className="text-xs text-gray-500">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDraftId(doc.id);
                                      setShowReviewDraftModal(true);
                                    }}
                                    className={isUnclassified 
                                      ? "text-orange-600 hover:text-orange-800 font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid transition-all"
                                      : "text-gray-600 hover:text-gray-800 font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid transition-all"
                                    }
                                    title="Cliquer pour modifier le type du document"
                                  >
                                    {documentType}
                                  </button>
                                  <span className="text-gray-400"> • {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(`/api/documents/${doc.id}/file`, '_blank')}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  await removeStagedDocument(doc.id);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Liens vers documents existants */}
                      {stagedLinks.map((link) => (
                        <div key={link.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Link className="h-5 w-5 text-blue-600" />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900">{link.existingDocument?.fileName || link.existingDocument?.filename}</p>
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                                  Lien existant
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500">
                                {link.existingDocument?.typeLabel || 'Type inconnu'} • {new Date(link.existingDocument?.uploadedAt || link.createdAt).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                window.open(`/api/documents/${link.existingDocument?.id}/file`, '_blank');
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (confirm('Êtes-vous sûr de vouloir supprimer ce lien ?')) {
                                  try {
                                    const response = await fetch(`/api/upload-staged-item/${link.id}`, {
                                      method: 'DELETE'
                                    });
                                    
                                    if (response.ok) {
                                      setStagedLinks(prev => prev.filter(l => l.id !== link.id));
                                      notify2.success('Lien supprimé avec succès');
                                    } else {
                                      notify2.error('Erreur lors de la suppression du lien');
                                    }
                                  } catch (error) {
                                    console.error('Erreur lors de la suppression du lien:', error);
                                    notify2.error('Erreur lors de la suppression du lien');
                                  }
                                }
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Documents liés (en mode édition) */}
                      {linkedDocuments.map((doc) => {
                        const documentType = String(doc.DocumentType?.label || 'Type inconnu');
                        const isUnclassified = documentType === 'Non classé' || documentType === 'Type inconnu';
                        
                        return (
                          <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-gray-500" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{doc.fileName || doc.filename}</p>
                                <p className="text-xs text-gray-500">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      window.open(`/api/documents/${doc.id}/file`, '_blank');
                                    }}
                                    className={isUnclassified 
                                      ? "text-orange-600 hover:text-orange-800 font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid transition-all"
                                      : "text-gray-600 hover:text-gray-800 font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid transition-all"
                                    }
                                    title="Cliquer pour voir le document"
                                  >
                                    {documentType}
                                  </button>
                                  <span className="text-gray-400"> • {new Date(doc.uploadedAt || doc.createdAt).toLocaleDateString('fr-FR')}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(`/api/documents/${doc.id}/file`, '_blank')}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDocumentToDelete(doc);
                                  setShowDeleteDocModal(true);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">Aucun document lié à ce prêt</p>
                      <p className="text-xs mt-1">Cliquez sur "Ajouter des documents" pour en associer</p>
                    </div>
                  )}

                  {/* Information sur le contexte */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm text-blue-900 font-medium">
                          Contexte de liaison automatique
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          Les documents uploadés seront automatiquement liés à ce prêt.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer avec boutons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : mode === 'edit' ? 'Mettre à jour' : 'Créer'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal pour ajouter/modifier un co-emprunteur */}
      {showBorrowerModal && (
        <Dialog open={showBorrowerModal} onOpenChange={setShowBorrowerModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingBorrower ? 'Modifier le co-emprunteur' : 'Ajouter un co-emprunteur'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="borrowerFirstName">Prénom *</Label>
                  <Input
                    id="borrowerFirstName"
                    value={borrowerFormData.firstName}
                    onChange={(e) => setBorrowerFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="borrowerLastName">Nom *</Label>
                  <Input
                    id="borrowerLastName"
                    value={borrowerFormData.lastName}
                    onChange={(e) => setBorrowerFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="borrowerBirthDate">Date de naissance</Label>
                <Input
                  id="borrowerBirthDate"
                  type="date"
                  value={borrowerFormData.birthDate || ''}
                  onChange={(e) => setBorrowerFormData(prev => ({ ...prev, birthDate: e.target.value || null }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="borrowerEmail">Email</Label>
                  <Input
                    id="borrowerEmail"
                    type="email"
                    value={borrowerFormData.email || ''}
                    onChange={(e) => setBorrowerFormData(prev => ({ ...prev, email: e.target.value || null }))}
                  />
                </div>
                <div>
                  <Label htmlFor="borrowerPhone">Téléphone</Label>
                  <Input
                    id="borrowerPhone"
                    type="tel"
                    value={borrowerFormData.phone || ''}
                    onChange={(e) => setBorrowerFormData(prev => ({ ...prev, phone: e.target.value || null }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="borrowerResponsibilityPct">Part de responsabilité (%)</Label>
                <Input
                  id="borrowerResponsibilityPct"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={borrowerFormData.responsibilityPct || ''}
                  onChange={(e) => setBorrowerFormData(prev => ({ ...prev, responsibilityPct: e.target.value ? parseFloat(e.target.value) : null }))}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowBorrowerModal(false)}>
                  Annuler
                </Button>
                <Button type="button" onClick={handleSaveBorrower}>
                  {editingBorrower ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modals pour les documents */}
      {/* Modale de review-draft pour modifier les documents en brouillon */}
      <UploadReviewModal
        isOpen={showReviewDraftModal}
        onClose={() => {
          setShowReviewDraftModal(false);
          setSelectedDraftId(null);
        }}
        files={[]} // Pas de fichiers pour le mode review-draft
        scope="global"
        strategy={{
          mode: 'review-draft',
          draftId: selectedDraftId || undefined,
          onStagedUpdate: async () => {
            // Recharger la liste des documents en staging
            if (uploadSessionId) {
              await loadStagedDocuments(uploadSessionId);
            }
          }
        }}
      />

      {duplicateData && (
        <DuplicateDetectedModal
          isOpen={showDuplicateModal}
          onClose={() => {
            setShowDuplicateModal(false);
            setDuplicateData(null);
          }}
          existing={duplicateData}
          onLink={handleLinkExisting}
        />
      )}

      {documentToDelete && (
        <ConfirmDeleteDocumentModal
          isOpen={showDeleteDocModal}
          onClose={() => {
            setShowDeleteDocModal(false);
            setDocumentToDelete(null);
          }}
          document={documentToDelete}
          onConfirm={async () => {
            // Supprimer le document
            setShowDeleteDocModal(false);
            setDocumentToDelete(null);
            if (initialData?.id) {
              await loadLinkedDocuments(initialData.id);
            }
          }}
        />
      )}
    </>
  );
};

