'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { getLeaseStatusVariant, getLeaseStatusLabel } from '@/utils/leaseStatusBadge';
import { notify2 } from '@/lib/notify2';

// Fonctions utilitaires pour vérifier les statuts (compatibilité FR/EN)
const isDraft = (status: string) => status === 'DRAFT' || status === 'BROUILLON';
const isSent = (status: string) => status === 'SENT' || status === 'ENVOYÉ' || status === 'ENVOYE';
const isSigned = (status: string) => status === 'SIGNED' || status === 'SIGNÉ' || status === 'SIGNE';
const isActiveStatus = (status: string) => status === 'ACTIVE' || status === 'ACTIF';
const isTerminated = (status: string) => status === 'TERMINATED' || status === 'RÉSILIÉ' || status === 'RESILIE';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { AlertModal } from '@/components/ui/AlertModal';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
import { z } from 'zod';
import { 
  Building2,
  Users,
  Calendar,
  Euro,
  FileText,
  Mail,
  Download,
  Eye,
  Edit,
  Trash2,
  X,
  XCircle,
  FileCheck,
  Clock,
  AlertCircle,
  CheckCircle,
  Plus,
  Send,
  Upload,
  TrendingUp,
  History
} from 'lucide-react';

const leaseSchema = z.object({
  propertyId: z.string().min(1, 'Le bien est requis'),
  tenantId: z.string().min(1, 'Le locataire est requis'),
  type: z.enum(['residential', 'commercial', 'garage']),
  furnishedType: z.enum(['vide', 'meuble', 'garage']),
  startDate: z.string().min(1, 'La date de début est requise'),
  endDate: z.string().optional(),
  rentAmount: z.number().min(0, 'Le loyer doit être positif'),
  deposit: z.number().min(0, 'La caution doit être positive'),
  paymentDay: z.number().min(1).max(31, 'Le jour de paiement doit être entre 1 et 31'),
  indexationType: z.enum(['none', 'insee', 'manual']).optional(),
  notes: z.string().optional(),
  status: z.enum(['BROUILLON', 'ENVOYÉ', 'SIGNÉ', 'ACTIF', 'RÉSILIÉ', 'ARCHIVÉ']).optional(),
  // Gestion déléguée
  chargesRecupMensuelles: z.number().min(0).optional(),
  chargesNonRecupMensuelles: z.number().min(0).optional(),
});

interface LeaseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  lease: any;
  properties: any[];
  tenants: any[];
}

export default function LeaseEditModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  lease,
  properties: externalProperties,
  tenants: externalTenants
}: LeaseEditModalProps) {
  const [formData, setFormData] = useState({
    id: '',
    propertyId: '',
    tenantId: '',
    type: 'residential',
    furnishedType: 'vide',
    startDate: '',
    endDate: '',
    rentAmount: 0,
    deposit: 0,
    paymentDay: 1,
    indexationType: 'none',
    notes: '',
    status: 'BROUILLON',
    chargesRecupMensuelles: 0,
    chargesNonRecupMensuelles: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [isWorkflowActionLoading, setIsWorkflowActionLoading] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showProfileAlert, setShowProfileAlert] = useState(false);
  const [profileAlertData, setProfileAlertData] = useState<{
    title: string;
    message: string;
    missingFields: string[];
  } | null>(null);
  const [showIndexationModal, setShowIndexationModal] = useState(false);
  const [indexationHistory, setIndexationHistory] = useState<any[]>([]);
  const [isLoadingIndexation, setIsLoadingIndexation] = useState(false);
  
  // Hook pour la modal d'upload unifiée
  const { openModalWithDocumentType } = useUploadReviewModal();
  
  // Charger les données
  const loadData = async () => {
    setIsLoadingData(true);
    try {
      // Augmenter la limite à 1000 pour récupérer tous les biens et locataires
      const [propertiesRes, tenantsRes] = await Promise.all([
        fetch('/api/properties?limit=1000'),
        fetch('/api/tenants?limit=1000')
      ]);

      if (propertiesRes.ok) {
        const propertiesData = await propertiesRes.json();
        // L'API peut retourner { data: [...], total, ... } ou directement un tableau
        const propertiesList = propertiesData.data || propertiesData.properties || propertiesData.items || (Array.isArray(propertiesData) ? propertiesData : []);
        setProperties(Array.isArray(propertiesList) ? propertiesList : []);
      }

      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json();
        // L'API peut retourner { data: [...], total, ... } ou directement un tableau
        const tenantsList = tenantsData.data || tenantsData.tenants || tenantsData.items || (Array.isArray(tenantsData) ? tenantsData : []);
        setTenants(Array.isArray(tenantsList) ? tenantsList : []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Charger l'historique des réindexations
  const loadIndexationHistory = async () => {
    if (!lease?.id) return;
    
    try {
      const response = await fetch(`/api/leases/${lease.id}/index-rent`);
      if (response.ok) {
        const data = await response.json();
        setIndexationHistory(data.indexations || []);
      }
    } catch (error) {
      console.error('Error loading indexation history:', error);
    }
  };

  // Charger les données et initialiser le formulaire
  useEffect(() => {
    if (isOpen) {
      // Utiliser les données externes si disponibles, sinon charger
      if (externalProperties && externalProperties.length > 0 && externalTenants && externalTenants.length > 0) {
        console.log('[LeaseEditModal] Utilisation des données externes - Properties:', externalProperties.length, 'Tenants:', externalTenants.length);
        setProperties(externalProperties);
        setTenants(externalTenants);
        setIsLoadingData(false);
      } else {
        console.log('[LeaseEditModal] Chargement des données depuis l\'API');
        loadData();
      }
      
      // Charger l'historique des réindexations si bail existant
      if (lease?.id) {
        loadIndexationHistory();
      }
      
      if (lease) {
        // Édition d'un bail existant
        console.log('[LeaseEditModal] Mode édition - Lease:', lease);
        console.log('[LeaseEditModal] PropertyId:', lease.propertyId, 'TenantId:', lease.tenantId);
        
        setFormData({
          id: lease.id,
          propertyId: lease.propertyId || lease.Property?.id || '',
          tenantId: lease.tenantId || lease.Tenant?.id || '',
          type: lease.type || 'residential',
          furnishedType: lease.furnishedType || 'vide',
          startDate: lease.startDate ? new Date(lease.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          endDate: lease.endDate ? new Date(lease.endDate).toISOString().split('T')[0] : '',
          rentAmount: lease.rentAmount || 0,
          deposit: lease.deposit || 0,
          paymentDay: lease.paymentDay || 1,
          indexationType: lease.indexationType || 'none',
          notes: lease.notes || '',
          status: lease.status || 'BROUILLON',
          chargesRecupMensuelles: lease.chargesRecupMensuelles || 0,
          chargesNonRecupMensuelles: lease.chargesNonRecupMensuelles || 0,
        });
      } else {
        // Création d'un nouveau bail
        setFormData({
          id: '',
          propertyId: '',
          tenantId: '',
          type: 'residential',
          furnishedType: 'vide',
          startDate: '',
          endDate: '',
          rentAmount: 0,
          deposit: 0,
          paymentDay: 1,
          indexationType: 'none',
          notes: '',
          status: 'BROUILLON',
          chargesRecupMensuelles: 0,
          chargesNonRecupMensuelles: 0,
        });
      }
      setActiveTab('basic'); // Reset to first tab
    }
  }, [lease, isOpen, externalProperties, externalTenants]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const validatedData = leaseSchema.parse({
        ...formData,
        rentAmount: parseFloat(formData.rentAmount.toString()) || 0,
        deposit: parseFloat(formData.deposit.toString()) || 0,
        paymentDay: parseInt(formData.paymentDay.toString()) || 1,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        // Gestion déléguée
        chargesRecupMensuelles: parseFloat(formData.chargesRecupMensuelles.toString()) || 0,
        chargesNonRecupMensuelles: parseFloat(formData.chargesNonRecupMensuelles.toString()) || 0,
      });
      
      await onSubmit({ ...validatedData, id: formData.id });
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

  // Fonction pour déterminer si un bail signé devrait être automatiquement actif
  const isLeaseAutoActive = () => {
    if (formData.status !== 'SIGNÉ') return false;
    
    const startDate = new Date(formData.startDate);
    const now = new Date();
    
    // Si le bail a commencé ou commence dans moins de 30 jours, il devrait être actif
    const daysUntilStart = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilStart <= 30;
  };

  // Fonction pour vérifier si le locataire a un email valide
  const canSendForSignature = () => {
    if (!formData.tenantId) return false;
    
    const tenant = tenants.find(t => t.id === formData.tenantId);
    if (!tenant) return false;
    
    // Vérifier que le locataire a un email valide
    return tenant.email && tenant.email.trim() !== '';
  };

  // Fonction pour vérifier si tous les champs obligatoires sont remplis
  const areRequiredFieldsFilled = () => {
    return (
      formData.propertyId &&
      formData.tenantId &&
      formData.type &&
      formData.startDate &&
      formData.rentAmount > 0
    );
  };

  // Fonction pour vérifier si un onglet a des champs obligatoires manquants
  const hasMissingRequiredFields = (tabId: string) => {
    switch (tabId) {
      case 'basic':
        return !formData.propertyId || !formData.tenantId || !formData.type || !formData.startDate;
      case 'financial':
        return formData.rentAmount <= 0;
      default:
        return false;
    }
  };

  // Fonction pour vérifier si le bail peut être supprimé
  const canDeleteLease = async () => {
    if (isDraft(formData.status)) return { canDelete: true, reason: null };
    
    try {
      // Vérifier s'il y a des transactions liées à ce bail
      const response = await fetch(`/api/transactions?leaseId=${formData.id}`);
      if (response.ok) {
        const data = await response.json();
        const hasTransactions = data.transactions && data.transactions.length > 0;
        
        if (hasTransactions) {
          return { 
            canDelete: false, 
            reason: 'Ce bail ne peut pas être supprimé car il contient des transactions. Résiliez-le à la place.' 
          };
        }
      }
      
      return { canDelete: true, reason: null };
    } catch (error) {
      console.error('Erreur lors de la vérification des transactions:', error);
      return { canDelete: false, reason: 'Erreur lors de la vérification des données.' };
    }
  };

  const handleWorkflowAction = async (action: string) => {
    if (isWorkflowActionLoading) return; // Empêcher les double-clics
    
    setIsWorkflowActionLoading(true);
    try {
      let result = null;
      
      // Messages personnalisés selon l'action
      let successMessage = '';
      let newStatus = '';
      
      switch (action) {
        case 'send-for-signature':
          // Vérifier d'abord le profil utilisateur
          const profileValidation = await fetch('/api/profiles/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!profileValidation.ok) {
            setIsWorkflowActionLoading(false);
            notify2.error('Erreur de validation', 'Impossible de valider le profil utilisateur');
            return; // Ne pas changer le statut en cas d'erreur
          }
          
          const validationResult = await profileValidation.json();
          
          if (!validationResult.isValid) {
            // Afficher une modal d'alerte avec les champs manquants
            const missingFieldsList = validationResult.missingFields.map(field => `• ${field}`).join('\n');
            const alertMessage = `${validationResult.message}\n\nChamps manquants :\n${missingFieldsList}`;
            
            setProfileAlertData({
              title: 'Profil incomplet',
              message: alertMessage,
              missingFields: validationResult.missingFields
            });
            setShowProfileAlert(true);
            setIsWorkflowActionLoading(false);
            return; // Arrêter l'exécution, ne pas changer le statut
          }
          
          // Générer PDF et EML côté serveur
          const response = await fetch(`/api/leases/${formData.id}/send-for-signature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              email: tenants.find(t => t.id === formData.tenantId)?.email,
              message: 'Bail à signer' 
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
            setIsWorkflowActionLoading(false);
            notify2.error('Erreur lors de l\'envoi', errorData.error || 'Impossible d\'envoyer le bail pour signature');
            return; // Ne pas changer le statut en cas d'erreur
          }
          
          result = await response.json();
          
          // Télécharger le fichier EML
          if (result.downloadUrl) {
            const link = document.createElement('a');
            link.href = result.downloadUrl;
            link.download = `bail-signature-${formData.id}.eml`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          
          successMessage = 'Bail envoyé pour signature avec succès';
          newStatus = 'ENVOYÉ';
          notify2.success(successMessage, 'Le fichier EML a été téléchargé automatiquement');
          break;
        case 'mark-active':
          const activeResponse = await fetch(`/api/leases/${formData.id}/mark-active`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          
          if (!activeResponse.ok) {
            const errorData = await activeResponse.json();
            throw new Error(errorData.error || 'Erreur lors de l\'activation');
          }
          
          result = await activeResponse.json();
          successMessage = 'Bail marqué comme actif !';
          newStatus = 'ACTIF';
          break;
        case 'delete':
          // Vérifier si le bail peut être supprimé
          const deleteCheck = await canDeleteLease();
          if (!deleteCheck.canDelete) {
            throw new Error(deleteCheck.reason || 'Suppression non autorisée');
          }
          
          // Demander confirmation spéciale si ce n'est pas un brouillon
          if (formData.status !== 'BROUILLON') {
            const confirmation = prompt(
              `Êtes-vous sûr de vouloir supprimer ce bail ?\n\nCeci est une action irréversible.\n\nTapez "SUPPRIMER" pour confirmer :`
            );
            if (confirmation !== 'SUPPRIMER') {
              throw new Error('Suppression annulée par l\'utilisateur');
            }
          }
          
          const deleteResponse = await fetch(`/api/leases/${formData.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (!deleteResponse.ok) {
            const errorData = await deleteResponse.json();
            throw new Error(errorData.error || 'Erreur lors de la suppression');
          }
          
          successMessage = 'Bail supprimé avec succès !';
          // Fermer la modal et recharger
          window.location.reload();
          return;
        case 'terminate':
          const terminateResponse = await fetch(`/api/leases/${formData.id}/terminate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          
          if (!terminateResponse.ok) {
            const errorData = await terminateResponse.json();
            throw new Error(errorData.error || 'Erreur lors de la résiliation');
          }
          
          result = await terminateResponse.json();
          successMessage = 'Bail résilié avec succès !';
          newStatus = 'RÉSILIÉ';
          break;
        case 'cancel-send':
          if (!formData.id) {
            throw new Error('ID du bail manquant');
          }
          
          const cancelResponse = await fetch(`/api/leases/${formData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'BROUILLON' })
          });
          
          if (!cancelResponse.ok) {
            const errorData = await cancelResponse.json();
            throw new Error(errorData.error || 'Erreur lors de l\'annulation');
          }
          
          result = await cancelResponse.json();
          successMessage = 'Envoi annulé avec succès ! Le bail est revenu en statut BROUILLON.';
          newStatus = 'BROUILLON';
          break;
        case 'mark-unsigned':
          const unsignedResponse = await fetch(`/api/leases/${formData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ENVOYÉ' })
          });
          
          if (!unsignedResponse.ok) {
            const errorData = await unsignedResponse.json();
            throw new Error(errorData.error || 'Erreur lors de la modification');
          }
          
          successMessage = 'Bail marqué comme non signé avec succès ! Le bail est revenu en statut ENVOYÉ.';
          newStatus = 'ENVOYÉ';
          break;
      }
      
      // Mettre à jour le statut localement
      if (newStatus) {
        setFormData(prev => ({ ...prev, status: newStatus as any }));
      }
      
      // Fermer la modal et recharger la page immédiatement pour certaines actions
      if (action === 'terminate' || action === 'delete' || action === 'mark-active' || action === 'send-for-signature' || action === 'cancel-send' || action === 'mark-unsigned') {
        // Attendre un peu pour que le toast soit visible avant le rechargement
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1500);
      } else if (successMessage) {
        // Pour les autres actions, afficher un toast de succès
        notify2.success(successMessage);
      }
      
    } catch (error) {
      console.error('Error executing workflow action:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      notify2.error('Erreur lors de l\'exécution de l\'action', errorMessage);
      // Ne pas changer le statut en cas d'erreur
    } finally {
      setIsWorkflowActionLoading(false);
    }
  };

  const handleUploadSigned = async (file: File) => {
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('signedPdf', file);
      
      const response = await fetch(`/api/leases/${formData.id}/upload-signed`, {
        method: 'POST',
        body: uploadFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'upload');
      }

      const result = await response.json();
      
      // Vérifier si le bail devrait devenir automatiquement actif
      const startDate = new Date(formData.startDate);
      const now = new Date();
      const daysUntilStart = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let newStatus = 'SIGNÉ';
      let alertMessage = 'Bail signé uploadé avec succès ! Le statut a été mis à jour à SIGNÉ.';
      
      if (daysUntilStart <= 30) {
        // Le bail devrait être automatiquement actif
        newStatus = 'ACTIF';
        alertMessage = 'Bail signé uploadé avec succès ! Le statut a été automatiquement mis à jour à ACTIF (bail en cours).';
        
        // Mettre à jour le statut en base de données
        try {
          await fetch(`/api/leases/${formData.id}/mark-active`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Error marking lease as active:', error);
          newStatus = 'SIGNÉ';
          alertMessage = 'Bail signé uploadé avec succès ! Le statut a été mis à jour à SIGNÉ (erreur lors du passage à ACTIF).';
        }
      }
      
      alert(alertMessage);
      
      // Mettre à jour le statut localement
      setFormData(prev => ({ ...prev, status: newStatus as any }));
      
      // Recharger la page pour mettre à jour le tableau
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error uploading signed PDF:', error);
      alert(`Erreur lors de l'upload du bail signé: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const tabs = [
    { id: 'basic', label: 'Informations essentielles', icon: Building2, required: true },
    { id: 'financial', label: 'Conditions financières', icon: Euro, required: false },
    { id: 'terms', label: 'Clauses et conditions', icon: FileText, required: false },
    { id: 'status', label: 'Statut et workflow', icon: CheckCircle, required: false },
  ];

  // Règles de verrouillage selon le statut
  const isContractualFieldLocked = (fieldName: string): boolean => {
    const status = formData.status;
    
    // Statut Résilié : TOUT est verrouillé (lecture seule)
    if (status === 'RÉSILIÉ' || status === 'RESILIE') {
      return true;
    }
    
    // Statut Signé/Actif : champs contractuels verrouillés
    if (status === 'SIGNÉ' || status === 'SIGNE' || status === 'ACTIF') {
      const lockedFields = [
        'propertyId',
        'tenantId',
        'type',
        'furnishedType',
        'startDate',
        'endDate',
        'rentAmount',
        'deposit',
        'chargesRecupMensuelles',
        'chargesNonRecupMensuelles',
        'paymentDay',
        'indexationType',
        'notes'
      ];
      return lockedFields.includes(fieldName);
    }
    
    // Statut Brouillon/Envoyé : édition totale OK
    return false;
  };

  const isReadOnly = formData.status === 'RÉSILIÉ' || formData.status === 'RESILIE';
  const isContractLocked = formData.status === 'SIGNÉ' || formData.status === 'SIGNE' || formData.status === 'ACTIF';

  const renderBasicInfo = () => (
    <div className="space-y-6">
      {/* Banner de verrouillage pour baux Signés/Actifs */}
      {isContractLocked && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-yellow-700" />
            <h3 className="font-medium text-yellow-900">Ce bail est signé</h3>
          </div>
          <p className="text-sm text-yellow-800">
            Les champs contractuels sont verrouillés. Pour modifier le loyer, les dates ou les conditions, créez un avenant ou résiliez puis créez un nouveau bail.
          </p>
        </div>
      )}

      {/* Banner lecture seule pour baux Résiliés */}
      {isReadOnly && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-red-700" />
            <h3 className="font-medium text-red-900">Bail résilié</h3>
          </div>
          <p className="text-sm text-red-800">
            Ce bail est résilié. Toutes les informations sont en lecture seule.
          </p>
        </div>
      )}

      {/* Header avec indication des champs obligatoires (si éditable) */}
      {!isReadOnly && !isContractLocked && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <h3 className="font-medium text-blue-900">Informations obligatoires</h3>
          </div>
          <p className="text-sm text-blue-700">
            Les champs marqués d'un astérisque rouge (*) sont obligatoires pour modifier le bail.
          </p>
        </div>
      )}

      {/* Sélection du bien et locataire */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="text-red-500">*</span> Bien
          </label>
          {lease ? (
            // Mode édition : afficher le nom du bien en lecture seule
            <input
              type="text"
              value={properties && Array.isArray(properties) && properties.length > 0 
                ? properties.find(p => p.id === formData.propertyId)?.name || 'Bien non trouvé'
                : 'Chargement...'}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          ) : (
            // Mode création : dropdown sélectionnable
            <select
              value={formData.propertyId}
              onChange={(e) => handleChange('propertyId', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.propertyId ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Sélectionner un bien</option>
              {properties && Array.isArray(properties) && properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name} - {property.address}
                </option>
              ))}
            </select>
          )}
          {errors.propertyId && <p className="text-red-500 text-sm mt-1">{errors.propertyId}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="text-red-500">*</span> Locataire
          </label>
          {isContractualFieldLocked('tenantId') ? (
            // Verrouillé : afficher en lecture seule
            <input
              type="text"
              value={tenants && Array.isArray(tenants) && tenants.length > 0 
                ? tenants.find(t => t.id === formData.tenantId)
                  ? `${tenants.find(t => t.id === formData.tenantId)?.firstName} ${tenants.find(t => t.id === formData.tenantId)?.lastName}`
                  : 'Locataire non trouvé'
                : 'Chargement...'}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          ) : (
            // Éditable
            <select
              value={formData.tenantId}
              onChange={(e) => handleChange('tenantId', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.tenantId ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Sélectionner un locataire</option>
              {tenants && Array.isArray(tenants) && tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.firstName} {tenant.lastName}
                </option>
              ))}
            </select>
          )}
          {errors.tenantId && <p className="text-red-500 text-sm mt-1">{errors.tenantId}</p>}
        </div>
      </div>

      {/* Type de bail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="text-red-500">*</span> Type de bail
          </label>
          <select
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value)}
            disabled={isContractualFieldLocked('type')}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.type ? 'border-red-500' : 'border-gray-300'
            } ${isContractualFieldLocked('type') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
          >
            <option value="residential">Résidentiel</option>
            <option value="commercial">Commercial</option>
            <option value="garage">Garage</option>
          </select>
          {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de meublé
          </label>
          <select
            value={formData.furnishedType}
            onChange={(e) => handleChange('furnishedType', e.target.value)}
            disabled={isContractualFieldLocked('furnishedType')}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              isContractualFieldLocked('furnishedType') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
            }`}
          >
            <option value="vide">Vide</option>
            <option value="meuble">Meublé</option>
            <option value="garage">Garage</option>
          </select>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="text-red-500">*</span> Date de début
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
            disabled={isContractualFieldLocked('startDate')}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.startDate ? 'border-red-500' : 'border-gray-300'
            } ${isContractualFieldLocked('startDate') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
          />
          {errors.startDate && <p className="text-red-500 text-sm mt-1">{errors.startDate}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date de fin (optionnel)
          </label>
          <div className="relative">
            <input
              type="date"
              value={formData.endDate || ''}
              onChange={(e) => handleChange('endDate', e.target.value)}
              disabled={isContractualFieldLocked('endDate')}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                isContractualFieldLocked('endDate') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
              }`}
            />
            {formData.endDate && !isContractualFieldLocked('endDate') && (
              <button
                type="button"
                onClick={() => handleChange('endDate', undefined)}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 bg-white"
                title="Effacer la date"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loyer obligatoire */}
      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Conditions financières obligatoires</h4>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="text-red-500">*</span> Loyer mensuel (€)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.rentAmount}
              onChange={(e) => handleChange('rentAmount', parseFloat(e.target.value) || 0)}
              disabled={isContractualFieldLocked('rentAmount')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.rentAmount ? 'border-red-500' : 'border-gray-300'
              } ${isContractualFieldLocked('rentAmount') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
            />
            {errors.rentAmount && <p className="text-red-500 text-sm mt-1">{errors.rentAmount}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Caution (€)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.deposit}
              onChange={(e) => handleChange('deposit', parseFloat(e.target.value) || 0)}
              disabled={isContractualFieldLocked('deposit')}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                isContractualFieldLocked('deposit') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* Granularité des charges */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-3">
          Granularité des charges (optionnel)
        </h4>
        <p className="text-xs text-blue-700 mb-4">
          Ces montants permettront de préremplir automatiquement les transactions de loyer mensuelles
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Charges récupérables mensuelles (€)
              <span className="text-xs text-gray-500 block mt-1">
                Refacturées au locataire
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.chargesRecupMensuelles || ''}
              onChange={(e) => handleChange('chargesRecupMensuelles', parseFloat(e.target.value) || 0)}
              disabled={isContractualFieldLocked('chargesRecupMensuelles')}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                isContractualFieldLocked('chargesRecupMensuelles') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
              }`}
              placeholder="Ex: 20.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Charges non récupérables mensuelles (€)
              <span className="text-xs text-gray-500 block mt-1">
                À la charge du propriétaire
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.chargesNonRecupMensuelles || ''}
              onChange={(e) => handleChange('chargesNonRecupMensuelles', parseFloat(e.target.value) || 0)}
              disabled={isContractualFieldLocked('chargesNonRecupMensuelles')}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                isContractualFieldLocked('chargesNonRecupMensuelles') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
              }`}
              placeholder="Ex: 35.00"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderFinancialInfo = () => (
    <div className="space-y-6">
      {/* Information */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <h3 className="font-medium text-yellow-900">Informations financières supplémentaires</h3>
        </div>
        <p className="text-sm text-yellow-700">
          Les montants principaux sont déjà renseignés dans l'onglet "Informations essentielles".
        </p>
      </div>

      {/* Jour de paiement */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Jour de paiement du loyer
        </label>
        <input
          type="number"
          min="1"
          max="31"
          value={formData.paymentDay}
          onChange={(e) => handleChange('paymentDay', parseInt(e.target.value) || 1)}
          disabled={isContractualFieldLocked('paymentDay')}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
            isContractualFieldLocked('paymentDay') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
          }`}
        />
        <p className="text-xs text-gray-500 mt-1">Jour du mois où le loyer doit être payé (1-31)</p>
      </div>

      {/* Indexation */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Type d'indexation
        </label>
        <select
          value={formData.indexationType}
          onChange={(e) => handleChange('indexationType', e.target.value)}
          disabled={isContractualFieldLocked('indexationType')}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
            isContractualFieldLocked('indexationType') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
          }`}
        >
          <option value="none">Aucune indexation</option>
          <option value="insee">Index INSEE</option>
          <option value="manual">Indexation manuelle</option>
        </select>
      </div>

      {/* Résumé financier */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Résumé financier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Loyer mensuel</p>
              <p className="text-2xl font-bold text-blue-900">{formData.rentAmount.toFixed(2)} €</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Charges récup. mensuelles</p>
              <p className="text-2xl font-bold text-green-900">{(formData.chargesRecupMensuelles || 0).toFixed(2)} €</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Total payé par locataire</p>
              <p className="text-2xl font-bold text-purple-900">{(formData.rentAmount + (formData.chargesRecupMensuelles || 0)).toFixed(2)} €</p>
            </div>
          </div>
          <div className="mt-4 text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">Caution demandée</p>
            <p className="text-xl font-bold text-gray-900">{formData.deposit.toFixed(2)} €</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTermsInfo = () => (
    <div className="space-y-6">
      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes et clauses particulières
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          disabled={isContractualFieldLocked('notes')}
          rows={6}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
            isContractualFieldLocked('notes') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
          }`}
          placeholder="Ajoutez ici toutes les clauses particulières, conditions spéciales, ou notes importantes pour ce bail..."
        />
      </div>

      {/* Clauses standard */}
      <Card>
        <CardHeader>
          <CardTitle>Clauses standard incluses</CardTitle>
          <CardDescription>
            Ces clauses seront automatiquement incluses dans le bail généré
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Obligation de paiement du loyer et des charges</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Interdiction de sous-location sans autorisation</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Obligation d'assurance habitation</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Respect des règles de copropriété</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Conditions de résiliation</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStatusInfo = () => (
    <div className="space-y-6">
      {/* Statut du bail (lecture seule) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Statut du bail
        </label>
        <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
          <Badge variant={getLeaseStatusVariant(formData.status)}>
            {getLeaseStatusLabel(formData.status)}
          </Badge>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Le statut avance automatiquement via les actions (Envoi, Upload signé, etc.)
        </p>
        
        {/* Avertissement pour baux SIGNÉ qui devraient être ACTIF */}
        {isSigned(formData.status) && isLeaseAutoActive() && (
          <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
            <p className="text-xs text-orange-700">
              ⚠️ Ce bail devrait être ACTIF (commence dans moins de 30 jours). 
              Utilisez l'action "Marquer comme actif" ci-dessous.
            </p>
          </div>
        )}
      </div>

      {/* Informations du bail */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du bail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">ID du bail</p>
              <p className="font-medium font-mono text-xs">{lease?.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date de création</p>
              <p className="font-medium">
                {lease?.createdAt ? new Date(lease.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Dernière modification</p>
              <p className="font-medium">
                {lease?.updatedAt ? new Date(lease.updatedAt).toLocaleDateString('fr-FR') : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Statut actuel</p>
              <Badge variant={getLeaseStatusVariant(formData.status)}>
                {getLeaseStatusLabel(formData.status)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow du bail */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow du bail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {[
              { status: 'BROUILLON', label: 'Brouillon' },
              { status: 'ENVOYÉ', label: 'Envoyé' },
              { status: 'SIGNÉ', label: 'Signé' },
              { status: 'ACTIF', label: 'Actif' }
            ].map((step, index) => {
              const statusOrder = ['BROUILLON', 'ENVOYÉ', 'SIGNÉ', 'ACTIF'];
              const currentIndex = statusOrder.indexOf(formData.status);
              const stepIndex = statusOrder.indexOf(step.status);
              
              const isActive = formData.status === step.status;
              const isCompleted = currentIndex > stepIndex;
              
              let circleClass = 'w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-400';
              let lineClass = 'flex-1 h-0.5 mx-2 bg-gray-200';
              
              if (isActive) {
                if (isDraft(formData.status)) {
                  circleClass = 'w-8 h-8 rounded-full flex items-center justify-center bg-blue-500 text-white';
                } else if (isSent(formData.status)) {
                  circleClass = 'w-8 h-8 rounded-full flex items-center justify-center bg-yellow-500 text-white';
                } else if (isSigned(formData.status)) {
                  circleClass = 'w-8 h-8 rounded-full flex items-center justify-center bg-green-500 text-white';
                } else if (isActiveStatus(formData.status)) {
                  circleClass = 'w-8 h-8 rounded-full flex items-center justify-center bg-purple-500 text-white';
                }
              } else if (isCompleted) {
                circleClass = 'w-8 h-8 rounded-full flex items-center justify-center bg-green-500 text-white';
                lineClass = 'flex-1 h-0.5 mx-2 bg-green-500';
              }
              
              return (
                <React.Fragment key={step.status}>
                  <div className="flex flex-col items-center">
                    <div className={circleClass}>
                      <span className="font-medium text-sm">{index + 1}</span>
                    </div>
                    <span className="text-xs mt-2 text-center">{step.label}</span>
                  </div>
                  {index < 3 && <div className={lineClass} />}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions du Workflow */}
      <Card>
        <CardHeader>
          <CardTitle>Actions du Workflow</CardTitle>
          <CardDescription>
            Utilisez ces actions pour faire avancer le statut du bail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Envoyer pour signature */}
            {isDraft(formData.status) && (
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={() => handleWorkflowAction('send-for-signature')}
                disabled={isWorkflowActionLoading || !canSendForSignature()}
              >
                <Mail className="h-6 w-6 text-blue-500" />
                <span className="font-medium">
                  {isWorkflowActionLoading ? 'Envoi en cours...' : 'Envoyer pour signature'}
                </span>
                <span className="text-xs text-gray-500">Statut → ENVOYÉ</span>
                {!canSendForSignature() && (
                  <span className="text-xs text-red-500 mt-1">
                    ⚠️ Locataire sans email
                  </span>
                )}
              </Button>
            )}

            {/* Upload bail signé - seulement pour ENVOYÉ */}
            {isSent(formData.status) && (
              <Button
                type="button"
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 w-full cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openModalWithDocumentType('BAIL_SIGNE', 'Bail signé', {
                    autoLinkingContext: {
                      leaseId: formData.id,
                      propertyId: formData.propertyId,
                      tenantsIds: formData.tenantId ? [formData.tenantId] : []
                    },
                    onSuccess: () => {
                      // Mettre à jour le statut du bail après upload
                      // Le statut sera déterminé par l'API (ACTIF si dans la période active, sinon SIGNÉ)
                      const updatedFormData = { ...formData, status: 'ACTIF' };
                      setFormData(updatedFormData);
                      onSubmit?.(updatedFormData);
                    }
                  });
                }}
              >
                <Upload className="h-6 w-6 text-green-500" />
                <span className="font-medium">Upload bail signé</span>
                <span className="text-xs text-gray-500">Statut → SIGNÉ</span>
              </Button>
            )}

            {/* Marquer comme actif - seulement pour SIGNÉ et si devrait être actif automatiquement */}
            {isSigned(formData.status) && isLeaseAutoActive() && (
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={() => handleWorkflowAction('mark-active')}
              >
                <CheckCircle className="h-6 w-6 text-green-500" />
                <span className="font-medium">Marquer comme actif</span>
                <span className="text-xs text-gray-500">Statut → ACTIF</span>
              </Button>
            )}

            {/* Supprimer le bail - seulement pour BROUILLON */}
            {isDraft(formData.status) && (
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (confirm('Êtes-vous sûr de vouloir supprimer définitivement ce bail ? Cette action est irréversible.')) {
                    handleWorkflowAction('delete');
                  }
                }}
              >
                <Trash2 className="h-6 w-6 text-red-500" />
                <span className="font-medium">Supprimer le bail</span>
                <span className="text-xs text-red-500">Suppression définitive</span>
              </Button>
            )}

            {/* Annuler l'envoi - retour arrière depuis ENVOYÉ vers BROUILLON */}
            {isSent(formData.status) && (
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 border-orange-200 text-orange-600 hover:bg-orange-50"
                onClick={() => handleWorkflowAction('cancel-send')}
                disabled={isWorkflowActionLoading}
              >
                <X className="h-6 w-6 text-orange-500" />
                <span className="font-medium">Annuler l'envoi</span>
                <span className="text-xs text-gray-500">Statut → BROUILLON</span>
              </Button>
            )}

            {/* Marquer non signé - retour arrière depuis SIGNÉ vers ENVOYÉ */}
            {isSigned(formData.status) && (
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 border-orange-200 text-orange-600 hover:bg-orange-50"
                onClick={() => {
                  if (confirm('Êtes-vous sûr de vouloir marquer ce bail comme non signé ? Il reviendra en statut ENVOYÉ.')) {
                    handleWorkflowAction('mark-unsigned');
                  }
                }}
              >
                <X className="h-6 w-6 text-orange-500" />
                <span className="font-medium">Marquer non signé</span>
                <span className="text-xs text-gray-500">Statut → ENVOYÉ</span>
              </Button>
            )}

            {/* Résilier le bail - pour tous sauf BROUILLON et RÉSILIÉ */}
            {formData.status !== 'RÉSILIÉ' && formData.status !== 'BROUILLON' && (
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={() => {
                  if (confirm('Êtes-vous sûr de vouloir résilier ce bail ? Cette action est irréversible.')) {
                    handleWorkflowAction('terminate');
                  }
                }}
              >
                <Trash2 className="h-6 w-6 text-red-500" />
                <span className="font-medium">Résilier le bail</span>
                <span className="text-xs text-gray-500">Statut → RÉSILIÉ</span>
              </Button>
            )}

            {/* Réindexer le loyer - pour baux ACTIF ou SIGNÉ */}
            {(formData.status === 'ACTIF' || formData.status === 'SIGNÉ' || formData.status === 'SIGNE') && lease && (
              <Button
                type="button"
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  loadIndexationHistory();
                  setShowIndexationModal(true);
                }}
              >
                <TrendingUp className="h-6 w-6 text-blue-500" />
                <span className="font-medium">Réindexer le loyer</span>
                <span className="text-xs text-gray-500">Mettre à jour le montant</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Historique des réindexations */}
      {lease && indexationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historique des réindexations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {indexationHistory.map((indexation, idx) => (
                <div key={indexation.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-sm">
                        {new Date(indexation.effectiveDate).toLocaleDateString('fr-FR')}
                      </span>
                      {indexation.indexType && (
                        <Badge variant="outline" className="text-xs">
                          {indexation.indexType}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(indexation.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Ancien loyer :</span>
                      <span className="ml-2 font-medium">{indexation.previousRentAmount.toFixed(2)} €</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Nouveau loyer :</span>
                      <span className="ml-2 font-medium text-green-600">{indexation.newRentAmount.toFixed(2)} €</span>
                    </div>
                  </div>
                  {indexation.reason && (
                    <p className="text-xs text-gray-500 mt-2">{indexation.reason}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic': return renderBasicInfo();
      case 'financial': return renderFinancialInfo();
      case 'terms': return renderTermsInfo();
      case 'status': return renderStatusInfo();
      default: return renderBasicInfo();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lease ? `Modifier le bail - ${lease.Tenant?.firstName} ${lease.Tenant?.lastName}` : 'Nouveau bail'}
      size="xl"
      footer={
        <div className="flex gap-3 items-center">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          
          <div className="flex-1" />
          
          {/* Bouton Créer un avenant (si bail Signé/Actif) */}
          {isContractLocked && !isReadOnly && (
            <Button 
              variant="outline"
              onClick={() => {
                notify2.info('🪄 Fonctionnalité à venir : Wizard de création d\'avenant');
              }}
              disabled={isSubmitting}
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
            >
              <Edit className="h-4 w-4 mr-2" />
              🪄 Créer un avenant / renouvellement
            </Button>
          )}
          
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !areRequiredFieldsFilled() || isReadOnly || isContractLocked}
            title={
              isReadOnly ? 'Bail résilié - lecture seule' :
              isContractLocked ? 'Bail signé - champs verrouillés. Utilisez "Créer un avenant" pour modifier.' :
              !areRequiredFieldsFilled() ? 'Veuillez remplir tous les champs obligatoires' : 
              ''
            }
          >
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
          {!areRequiredFieldsFilled() && (
            <div className="text-sm text-amber-600 mt-2">
              <p>⚠️ Champs obligatoires manquants :</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                {!formData.propertyId && <li>Bien</li>}
                {!formData.tenantId && <li>Locataire</li>}
                {!formData.type && <li>Type de bail</li>}
                {!formData.startDate && <li>Date de début</li>}
                {formData.rentAmount <= 0 && <li>Montant du loyer (onglet "Conditions financières")</li>}
              </ul>
            </div>
          )}
        </div>
      }
    >
      {isLoadingData ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des données...</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tabs Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const hasMissing = hasMissingRequiredFields(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 relative ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {tab.required && <span className="text-red-500 text-xs">*</span>}
                    {hasMissing && (
                      <div className="w-2 h-2 bg-red-500 rounded-full ml-1"></div>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="min-h-[500px]">
            {renderTabContent()}
          </div>
        </form>
      )}
      
      {/* Modal d'alerte pour le profil incomplet */}
      {showProfileAlert && profileAlertData && (
        <AlertModal
          isOpen={showProfileAlert}
          onClose={() => setShowProfileAlert(false)}
          onConfirm={() => {
            setShowProfileAlert(false);
            window.location.href = '/profil';
          }}
          title={profileAlertData.title}
          message={profileAlertData.message}
          type="warning"
          confirmText="Aller au profil"
          cancelText="Annuler"
          showCancel={true}
        />
      )}

      {/* Modal de réindexation */}
      {showIndexationModal && lease && (
        <RentIndexationModal
          isOpen={showIndexationModal}
          onClose={() => setShowIndexationModal(false)}
          lease={lease}
          currentRentAmount={formData.rentAmount}
          onSuccess={async () => {
            // Recharger les données du bail
            const leaseResponse = await fetch(`/api/leases/${lease.id}`);
            if (leaseResponse.ok) {
              const updatedLease = await leaseResponse.json();
              setFormData(prev => ({
                ...prev,
                rentAmount: updatedLease.rentAmount || prev.rentAmount
              }));
            }
            // Recharger l'historique
            await loadIndexationHistory();
            notify2.success('Réindexation effectuée', 'Le loyer a été mis à jour avec succès');
          }}
        />
      )}
    </Modal>
  );
}

// Composant modal de réindexation
interface RentIndexationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lease: any;
  currentRentAmount: number;
  onSuccess: () => void;
}

function RentIndexationModal({ isOpen, onClose, lease, currentRentAmount, onSuccess }: RentIndexationModalProps) {
  const [formData, setFormData] = useState({
    newRentAmount: currentRentAmount,
    effectiveDate: new Date().toISOString().split('T')[0],
    indexType: 'MANUAL' as 'IRL' | 'ILAT' | 'ICC' | 'MANUAL' | '',
    indexValue: undefined as number | undefined,
    indexDate: undefined as string | undefined,
    reason: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mettre à jour le nouveau loyer quand le loyer actuel change
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        newRentAmount: currentRentAmount
      }));
    }
  }, [currentRentAmount, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      // Validation
      if (formData.newRentAmount <= 0) {
        setErrors({ newRentAmount: 'Le nouveau loyer doit être positif' });
        setIsSubmitting(false);
        return;
      }

      if (!formData.effectiveDate) {
        setErrors({ effectiveDate: 'La date d\'effet est requise' });
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`/api/leases/${lease.id}/index-rent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newRentAmount: formData.newRentAmount,
          effectiveDate: formData.effectiveDate,
          indexType: formData.indexType || undefined,
          indexValue: formData.indexValue || undefined,
          indexDate: formData.indexDate || undefined,
          reason: formData.reason || undefined,
          notes: formData.notes || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la réindexation');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error indexing rent:', error);
      notify2.error('Erreur', error instanceof Error ? error.message : 'Erreur lors de la réindexation');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Réindexer le loyer"
      size="md"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer la réindexation'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations actuelles */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Loyer actuel</h4>
          <p className="text-2xl font-bold text-blue-900">{currentRentAmount.toFixed(2)} €</p>
        </div>

        {/* Nouveau loyer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="text-red-500">*</span> Nouveau loyer mensuel (€)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.newRentAmount}
            onChange={(e) => setFormData(prev => ({ ...prev, newRentAmount: parseFloat(e.target.value) || 0 }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.newRentAmount ? 'border-red-500' : 'border-gray-300'
            }`}
            required
          />
          {errors.newRentAmount && <p className="text-red-500 text-sm mt-1">{errors.newRentAmount}</p>}
        </div>

        {/* Date d'effet */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="text-red-500">*</span> Date d'effet
          </label>
          <input
            type="date"
            value={formData.effectiveDate}
            onChange={(e) => setFormData(prev => ({ ...prev, effectiveDate: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.effectiveDate ? 'border-red-500' : 'border-gray-300'
            }`}
            required
          />
          {errors.effectiveDate && <p className="text-red-500 text-sm mt-1">{errors.effectiveDate}</p>}
        </div>

        {/* Type d'indice */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type d'indice (optionnel)
          </label>
          <select
            value={formData.indexType}
            onChange={(e) => setFormData(prev => ({ ...prev, indexType: e.target.value as any }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Aucun indice</option>
            <option value="IRL">IRL (Indice de Référence des Loyers)</option>
            <option value="ILAT">ILAT (Indice des Loyers à l'Ancien)</option>
            <option value="ICC">ICC (Indice du Coût de la Construction)</option>
            <option value="MANUAL">Manuel</option>
          </select>
        </div>

        {/* Valeur de l'indice (si indice sélectionné) */}
        {formData.indexType && formData.indexType !== '' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valeur de l'indice
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.indexValue || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, indexValue: parseFloat(e.target.value) || undefined }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Ex: 123.45"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de référence de l'indice
              </label>
              <input
                type="date"
                value={formData.indexDate || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, indexDate: e.target.value || undefined }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        )}

        {/* Raison */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Raison de la réindexation (optionnel)
          </label>
          <input
            type="text"
            value={formData.reason}
            onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Ex: Révision annuelle selon IRL"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optionnel)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Notes supplémentaires..."
          />
        </div>

        {/* Aperçu de la variation */}
        {formData.newRentAmount !== currentRentAmount && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">Variation</h4>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-sm text-gray-600">Ancien :</span>
                <span className="ml-2 font-medium">{currentRentAmount.toFixed(2)} €</span>
              </div>
              <div>→</div>
              <div>
                <span className="text-sm text-gray-600">Nouveau :</span>
                <span className="ml-2 font-medium text-green-600">{formData.newRentAmount.toFixed(2)} €</span>
              </div>
              <div className="ml-auto">
                <span className="text-sm text-gray-600">Différence :</span>
                <span className={`ml-2 font-medium ${formData.newRentAmount > currentRentAmount ? 'text-green-600' : 'text-red-600'}`}>
                  {formData.newRentAmount > currentRentAmount ? '+' : ''}
                  {(formData.newRentAmount - currentRentAmount).toFixed(2)} €
                </span>
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
