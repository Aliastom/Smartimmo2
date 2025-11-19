'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { z } from 'zod';
import { useGestionDelegueStatus } from '@/hooks/useGestionDelegueStatus';
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
  FileCheck,
  Clock,
  AlertCircle,
  CheckCircle,
  Plus,
  Send
} from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';

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
  // indexationRate: z.number().min(0).max(100).optional(), // Champ non disponible dans le schéma Prisma
  notes: z.string().optional(),
  status: z.enum(['BROUILLON', 'ENVOYÉ', 'SIGNÉ', 'ACTIF', 'RÉSILIÉ', 'ARCHIVÉ']).optional(),
  // Gestion déléguée - charges détaillées
  chargesRecupMensuelles: z.number().min(0).optional(),
  chargesNonRecupMensuelles: z.number().min(0).optional(),
});

interface LeaseFormCompleteProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  title: string;
  defaultPropertyId?: string;
  defaultTenantId?: string;
}

export default function LeaseFormComplete({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData, 
  title,
  defaultPropertyId,
  defaultTenantId
}: LeaseFormCompleteProps) {
  // Vérifier si la gestion déléguée est activée via la BDD
  const { isEnabled: isGestionEnabled } = useGestionDelegueStatus();
  
  const [formData, setFormData] = useState({
    propertyId: defaultPropertyId || '',
    tenantId: defaultTenantId || '',
    type: 'residential',
    furnishedType: 'vide',
    startDate: '',
    endDate: '',
    rentAmount: 0,
    deposit: 0,
    paymentDay: 1,
    indexationType: 'none',
    // indexationRate: 0, // Champ non disponible dans le schéma Prisma
    notes: '',
    status: 'BROUILLON',
    // Gestion déléguée
    chargesRecupMensuelles: 0,
    chargesNonRecupMensuelles: 0,
  });

  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  }>({
    isOpen: false,
    message: ''
  });

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
        propertyId: initialData.propertyId || defaultPropertyId || '',
        tenantId: initialData.tenantId || defaultTenantId || '',
        type: initialData.type || 'residential',
        furnishedType: initialData.furnishedType || 'vide',
        startDate: initialData.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] as string : '',
        endDate: initialData.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] as string : '',
        rentAmount: initialData.rentAmount || 0,
        deposit: initialData.deposit || 0,
        paymentDay: initialData.paymentDay || 1,
        indexationType: (initialData.indexationType as any) || 'none',
        // indexationRate: initialData.indexationRate || 0, // Champ non disponible dans le schéma Prisma
        notes: initialData.notes || '',
        status: (initialData.status as any) || 'DRAFT',
        // Gestion déléguée
        chargesRecupMensuelles: initialData.chargesRecupMensuelles || 0,
        chargesNonRecupMensuelles: initialData.chargesNonRecupMensuelles || 0,
      });
    }
  }, [initialData, defaultPropertyId, defaultTenantId]);

  const loadInitialData = async () => {
    setIsLoadingData(true);
    try {
      // Augmenter la limite à 10000 pour récupérer tous les biens et locataires
      const [propertiesRes, tenantsRes] = await Promise.all([
        fetch('/api/properties?limit=10000'),
        fetch('/api/tenants?limit=10000')
      ]);

      if (propertiesRes.ok) {
        const propertiesData = await propertiesRes.json();
        // L'API retourne { data: [...], pagination: {...} }
        const propertiesList = propertiesData.data || propertiesData.properties || propertiesData.items || (Array.isArray(propertiesData) ? propertiesData : []);
        const finalList = Array.isArray(propertiesList) ? propertiesList : [];
        console.log('[LeaseFormComplete] Propriétés chargées:', finalList.length, 'sur', propertiesData?.pagination?.total || '?');
        setProperties(finalList);
      }

      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json();
        // L'API retourne { data: [...], pagination: {...} }
        const tenantsList = tenantsData.data || tenantsData.tenants || tenantsData.items || (Array.isArray(tenantsData) ? tenantsData : []);
        const finalList = Array.isArray(tenantsList) ? tenantsList : [];
        console.log('[LeaseFormComplete] Locataires chargés:', finalList.length, 'sur', tenantsData?.pagination?.total || '?');
        setTenants(finalList);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

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
        // indexationRate: parseFloat(formData.indexationRate.toString()) || 0, // Champ non disponible dans le schéma Prisma
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        // Gestion déléguée
        chargesRecupMensuelles: parseFloat(formData.chargesRecupMensuelles.toString()) || 0,
        chargesNonRecupMensuelles: parseFloat(formData.chargesNonRecupMensuelles.toString()) || 0,
      });
      
      await onSubmit(validatedData);
      onClose();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        const errorDetails = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        
        setErrors(fieldErrors);
        setErrorModal({
          isOpen: true,
          title: 'Erreur de validation',
          message: 'Veuillez corriger les erreurs suivantes :',
          details: errorDetails
        });
      } else if (error instanceof Error) {
        setErrorModal({
          isOpen: true,
          title: 'Erreur',
          message: error.message
        });
      } else {
        setErrorModal({
          isOpen: true,
          title: 'Erreur',
          message: 'Une erreur inattendue s\'est produite'
        });
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

  const tabs = [
    { id: 'basic', label: 'Informations essentielles', icon: Building2, required: true },
    { id: 'financial', label: 'Conditions financières', icon: Euro, required: false },
    { id: 'terms', label: 'Clauses et conditions', icon: FileText, required: false },
    { id: 'actions', label: 'Actions', icon: Send, required: false },
  ];

  const renderBasicInfo = () => (
    <div className="space-y-6">
      {/* Header avec indication des champs obligatoires */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <h3 className="font-medium text-blue-900">Informations obligatoires</h3>
        </div>
        <p className="text-sm text-blue-700">
          Les champs marqués d'un astérisque rouge (*) sont obligatoires pour créer le bail.
        </p>
      </div>

      {/* Sélection du bien et locataire */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="text-red-500">*</span> Bien
          </label>
          {defaultPropertyId ? (
            <input
              type="text"
              value={properties.find(p => p.id === defaultPropertyId)?.name || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          ) : (
            <SearchableSelect
              options={(properties && Array.isArray(properties) ? properties : []).map(p => ({
                id: p.id,
                value: p.id,
                label: `${p.name} - ${p.address}`
              }))}
              value={formData.propertyId}
              onChange={(value) => handleChange('propertyId', value)}
              placeholder="Rechercher un bien..."
              required
              className={errors.propertyId ? 'border-red-500' : ''}
            />
          )}
          {errors.propertyId && <p className="text-red-500 text-sm mt-1">{errors.propertyId}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="text-red-500">*</span> Locataire
          </label>
          <SearchableSelect
            options={(tenants && Array.isArray(tenants) ? tenants : []).map(t => ({
              id: t.id,
              value: t.id,
              label: `${t.firstName} ${t.lastName}${t.email ? ` - ${t.email}` : ''}`
            }))}
            value={formData.tenantId}
            onChange={(value) => handleChange('tenantId', value)}
            placeholder="Rechercher un locataire..."
            required
            className={errors.tenantId ? 'border-red-500' : ''}
          />
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
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.type ? 'border-red-500' : 'border-gray-300'
            }`}
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.startDate ? 'border-red-500' : 'border-gray-300'
            }`}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {formData.endDate && (
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
              step="0.01"
              value={formData.rentAmount}
              onChange={(e) => handleChange('rentAmount', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.rentAmount ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 850.00"
            />
            {errors.rentAmount && <p className="text-red-500 text-sm mt-1">{errors.rentAmount}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Caution (€)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.deposit}
              onChange={(e) => handleChange('deposit', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Ex: 1700.00"
            />
          </div>
        </div>
      </div>

      {/* Granularité des charges */}
      {isGestionEnabled && (
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Ex: 35.00"
              />
            </div>
          </div>
        </div>
      )}

      {/* Statut - seulement en édition */}
      {initialData && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Statut du bail
          </label>
          <select
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="DRAFT">Brouillon</option>
            <option value="SENT">Envoyé</option>
            <option value="SIGNED">Signé</option>
            <option value="ACTIVE">Actif</option>
            <option value="TERMINATED">Terminé</option>
          </select>
        </div>
      )}
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <p className="text-xs text-gray-500 mt-1">Jour du mois où le loyer doit être payé (1-31)</p>
      </div>

      {/* Indexation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type d'indexation
          </label>
          <select
            value={formData.indexationType}
            onChange={(e) => handleChange('indexationType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="none">Aucune indexation</option>
            <option value="insee">Index INSEE</option>
            <option value="manual">Indexation manuelle</option>
          </select>
        </div>

        {/* Note: Le taux d'indexation n'est pas encore supporté dans la base de données */}
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
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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

  const renderActionsInfo = () => (
    <div className="space-y-6">
      {/* Actions disponibles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Actions disponibles
          </CardTitle>
          <CardDescription>
            Une fois le bail créé, vous pourrez effectuer ces actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <FileCheck className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Générer le PDF</span>
              </div>
              <p className="text-sm text-gray-600">Créer le document PDF du bail avec signature</p>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="h-5 w-5 text-green-500" />
                <span className="font-medium">Envoyer par email</span>
              </div>
              <p className="text-sm text-gray-600">Envoyer le bail au locataire pour signature</p>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Download className="h-5 w-5 text-purple-500" />
                <span className="font-medium">Générer quittance</span>
              </div>
              <p className="text-sm text-gray-600">Créer une quittance de loyer</p>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Eye className="h-5 w-5 text-orange-500" />
                <span className="font-medium">Voir les détails</span>
              </div>
              <p className="text-sm text-gray-600">Consulter toutes les informations du bail</p>
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
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-medium text-sm">1</span>
              </div>
              <span className="text-xs mt-2 text-center">Création</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 font-medium text-sm">2</span>
              </div>
              <span className="text-xs mt-2 text-center">Envoi</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-medium text-sm">3</span>
              </div>
              <span className="text-xs mt-2 text-center">Signature</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-medium text-sm">4</span>
              </div>
              <span className="text-xs mt-2 text-center">Actif</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic': return renderBasicInfo();
      case 'financial': return renderFinancialInfo();
      case 'terms': return renderTermsInfo();
      case 'actions': return renderActionsInfo();
      default: return renderBasicInfo();
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
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer le bail'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tabs Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {tab.required && <span className="text-red-500 text-xs">*</span>}
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

      {/* Modal d'erreur */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
        title={errorModal.title}
        message={errorModal.message}
        details={errorModal.details}
      />
    </Modal>
  );
}
