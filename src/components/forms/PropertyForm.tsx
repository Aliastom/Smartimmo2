'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { z } from 'zod';
import AddressAutocomplete from '@/components/forms/AddressAutocomplete';
import { useQuery } from '@tanstack/react-query';
import { TaxParamsService } from '@/services/TaxParamsService';
import { Home, Armchair, Building2, FileText, Settings } from 'lucide-react';

const propertySchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  type: z.enum(['house', 'apartment', 'garage', 'commercial', 'land']),
  address: z.string().min(1, 'L\'adresse est requise'),
  postalCode: z.string().min(1, 'Le code postal est requis'),
  city: z.string().min(1, 'La ville est requise'),
  surface: z.number().positive('La surface doit être positive'),
  rooms: z.number().int().positive('Le nombre de pièces doit être positif'),
  acquisitionDate: z.string().min(1, 'La date d\'acquisition est requise'),
  acquisitionPrice: z.number().positive('Le prix d\'acquisition doit être positif'),
  notaryFees: z.number().min(0, 'Les frais de notaire doivent être positifs'),
  currentValue: z.number().min(0, 'La valeur actuelle doit être positive'),
  status: z.string().optional(),
  occupation: z.string().optional(),
  notes: z.string().optional(),
  managementCompanyId: z.string().optional(),
  fiscalTypeId: z.string().optional(),
  fiscalRegimeId: z.string().optional(),
});

interface PropertyFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  title: string;
}

export default function PropertyForm({ isOpen, onClose, onSubmit, initialData, title }: PropertyFormProps) {
  const [formData, setFormData] = useState(initialData || {
    name: '',
    type: 'apartment',
    address: '',
    postalCode: '',
    city: '',
    surface: 1,
    rooms: 1,
    acquisitionDate: '',
    acquisitionPrice: 1,
    notaryFees: 0,
    currentValue: 0,
    status: 'vacant',
    occupation: 'VACANT',
    notes: '',
    managementCompanyId: '',
    fiscalTypeId: '',
    fiscalRegimeId: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fiscalTypes, setFiscalTypes] = useState<any[]>([]);
  const [fiscalRegimes, setFiscalRegimes] = useState<any[]>([]);
  const [loadingRegimes, setLoadingRegimes] = useState(false);

  // Charger les sociétés de gestion
  const { data: gestionData } = useQuery({
    queryKey: ['management-companies'],
    queryFn: async () => {
      const res = await fetch('/api/gestion/societes');
      if (!res.ok) throw new Error('Erreur lors de la récupération des sociétés');
      return res.json();
    },
  });

  const societes = gestionData?.societes?.filter((s: any) => s.actif) || [];
  const isGestionEnabled = gestionData?.enabled ?? false;

  // Charger les types fiscaux au mount
  useEffect(() => {
    const loadFiscalTypes = async () => {
      try {
        const service = new TaxParamsService();
        const types = await service.getTypes(true);
        setFiscalTypes(types);
      } catch (error) {
        console.error('Erreur chargement types fiscaux:', error);
      }
    };
    
    if (isOpen) {
      loadFiscalTypes();
    }
  }, [isOpen]);

  // Charger les régimes quand le type fiscal change
  useEffect(() => {
    const loadRegimesForType = async () => {
      if (!formData.fiscalTypeId) {
        setFiscalRegimes([]);
        return;
      }

      setLoadingRegimes(true);
      try {
        const service = new TaxParamsService();
        const regimes = await service.getRegimesForType(formData.fiscalTypeId);
        setFiscalRegimes(regimes);

        // Si le régime actuel n'est plus compatible, le réinitialiser
        if (formData.fiscalRegimeId) {
          const isCompatible = regimes.some((r: any) => r.id === formData.fiscalRegimeId);
          if (!isCompatible) {
            handleChange('fiscalRegimeId', '');
          }
        }
      } catch (error) {
        console.error('Erreur chargement régimes:', error);
      } finally {
        setLoadingRegimes(false);
      }
    };

    loadRegimesForType();
  }, [formData.fiscalTypeId]);

  // Mettre à jour le formulaire quand initialData change
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        type: initialData.type || 'apartment',
        address: initialData.address || '',
        postalCode: initialData.postalCode || '',
        city: initialData.city || '',
        surface: initialData.surface || 1,
        rooms: initialData.rooms || 1,
        acquisitionDate: initialData.acquisitionDate ? 
          new Date(initialData.acquisitionDate).toISOString().split('T')[0] : '',
        acquisitionPrice: initialData.acquisitionPrice || 1,
        notaryFees: initialData.notaryFees || 0,
        currentValue: initialData.currentValue || 0,
        status: initialData.status || 'vacant',
        occupation: initialData.occupation || 'VACANT',
        notes: initialData.notes || '',
        managementCompanyId: initialData.managementCompanyId || '',
        fiscalTypeId: initialData.fiscalTypeId || '',
        fiscalRegimeId: initialData.fiscalRegimeId || '',
      });
    } else {
      // Reset form for new property
      setFormData({
        name: '',
        type: 'apartment',
        address: '',
        postalCode: '',
        city: '',
        surface: 1,
        rooms: 1,
        acquisitionDate: '',
        acquisitionPrice: 1,
        notaryFees: 0,
        currentValue: 0,
        status: 'vacant',
        occupation: 'VACANT',
        notes: '',
        managementCompanyId: '',
        fiscalTypeId: '',
        fiscalRegimeId: '',
      });
    }
    
    // Reset errors when form data changes
    setErrors({});
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      // Convertir les dates et nombres
      const submitData = {
        ...formData,
        acquisitionDate: new Date(formData.acquisitionDate).toISOString(),
        surface: Number(formData.surface),
        rooms: Number(formData.rooms),
        acquisitionPrice: Number(formData.acquisitionPrice),
        notaryFees: Number(formData.notaryFees),
        currentValue: Number(formData.currentValue),
      };

      // Validation avec Zod
      const validatedData = propertySchema.parse(submitData);
      await onSubmit(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        console.error('Error submitting form:', error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
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
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Navigation par onglets */}
        <Tabs defaultValue="essentials" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="essentials" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Informations essentielles
            </TabsTrigger>
            <TabsTrigger value="options" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Options avancées
            </TabsTrigger>
          </TabsList>

          {/* ========== ONGLET 1 : ESSENTIELS ========== */}
          <TabsContent value="essentials">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du bien *
                </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: Appartement T3 - Paris"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.type ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="apartment">Appartement</option>
              <option value="house">Maison</option>
              <option value="garage">Garage</option>
              <option value="commercial">Commercial</option>
              <option value="land">Terrain</option>
            </select>
            {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type}</p>}
          </div>

          <div className="md:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Type Fiscal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type fiscal
                </label>
                <select
                  value={formData.fiscalTypeId}
                  onChange={(e) => handleChange('fiscalTypeId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">-- Sélectionner un type fiscal --</option>
                  {fiscalTypes.map((type: any) => (
                    <option key={type.id} value={type.id}>
                      {type.category === 'FONCIER' && '🏠'} 
                      {type.category === 'BIC' && '🪑'} 
                      {type.category === 'IS' && '🏢'} 
                      {' '}{type.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Définit la catégorie fiscale de ce bien (Foncier, BIC, IS)
                </p>
              </div>

              {/* Régime Fiscal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Régime fiscal
                </label>
                <select
                  value={formData.fiscalRegimeId}
                  onChange={(e) => handleChange('fiscalRegimeId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={!formData.fiscalTypeId || loadingRegimes}
                >
                  {!formData.fiscalTypeId && (
                    <option value="">-- Sélectionnez d'abord un type fiscal --</option>
                  )}
                  {formData.fiscalTypeId && loadingRegimes && (
                    <option value="">Chargement...</option>
                  )}
                  {formData.fiscalTypeId && !loadingRegimes && fiscalRegimes.length === 0 && (
                    <option value="">Aucun régime disponible</option>
                  )}
                  {formData.fiscalTypeId && !loadingRegimes && fiscalRegimes.length > 0 && (
                    <>
                      <option value="">-- Sélectionner un régime --</option>
                      {fiscalRegimes.map((regime: any) => (
                        <option key={regime.id} value={regime.id}>
                          {regime.label}
                          {regime.engagementYears ? ` (${regime.engagementYears} ans)` : ''}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {formData.fiscalRegimeId && (
                  <p className="text-xs text-gray-500 mt-1">
                    {fiscalRegimes.find((r: any) => r.id === formData.fiscalRegimeId)?.description}
                  </p>
                )}
                {!formData.fiscalTypeId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Sélectionnez d'abord un type fiscal
                  </p>
                )}
              </div>

              {/* Affichage des informations fiscales si sélection faite */}
              {formData.fiscalTypeId && formData.fiscalRegimeId && (
                <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {(() => {
                        const type = fiscalTypes.find((t: any) => t.id === formData.fiscalTypeId);
                        if (type?.category === 'FONCIER') return <Home className="h-5 w-5 text-blue-600" />;
                        if (type?.category === 'BIC') return <Armchair className="h-5 w-5 text-green-600" />;
                        if (type?.category === 'IS') return <Building2 className="h-5 w-5 text-purple-600" />;
                        return null;
                      })()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">
                        Configuration fiscale sélectionnée
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="default">
                          {fiscalTypes.find((t: any) => t.id === formData.fiscalTypeId)?.label}
                        </Badge>
                        <Badge variant="secondary">
                          {fiscalRegimes.find((r: any) => r.id === formData.fiscalRegimeId)?.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adresse *
            </label>
            <AddressAutocomplete
              initialValue={formData.address}
              onAddressSelect={(address) => {
                handleChange('address', address.street);
                handleChange('postalCode', address.postcode);
                handleChange('city', address.city);
              }}
              placeholder="Ex: 123 Rue de la Paix, Paris"
              required
              error={errors.address}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Code postal *
            </label>
            <input
              type="text"
              value={formData.postalCode}
              onChange={(e) => handleChange('postalCode', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.postalCode ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 75001"
            />
            {errors.postalCode && <p className="text-red-500 text-sm mt-1">{errors.postalCode}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ville *
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.city ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: Paris"
            />
            {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Surface (m²) *
            </label>
            <input
              type="number"
              value={formData.surface}
              onChange={(e) => handleChange('surface', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.surface ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 75"
              min="1"
            />
            {errors.surface && <p className="text-red-500 text-sm mt-1">{errors.surface}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de pièces *
            </label>
            <input
              type="number"
              value={formData.rooms}
              onChange={(e) => handleChange('rooms', parseInt(e.target.value) || 1)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.rooms ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 3"
              min="1"
            />
            {errors.rooms && <p className="text-red-500 text-sm mt-1">{errors.rooms}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date d'acquisition *
            </label>
            <input
              type="date"
              value={formData.acquisitionDate}
              onChange={(e) => handleChange('acquisitionDate', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.acquisitionDate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.acquisitionDate && <p className="text-red-500 text-sm mt-1">{errors.acquisitionDate}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prix d'acquisition (€) *
            </label>
            <input
              type="number"
              value={formData.acquisitionPrice}
              onChange={(e) => handleChange('acquisitionPrice', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.acquisitionPrice ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 250000"
              min="1"
            />
            {errors.acquisitionPrice && <p className="text-red-500 text-sm mt-1">{errors.acquisitionPrice}</p>}
          </div>
            </div>
          </TabsContent>

          {/* ========== ONGLET 2 : OPTIONS AVANCÉES ========== */}
          <TabsContent value="options">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frais de notaire (€)
                </label>
            <input
              type="number"
              value={formData.notaryFees}
              onChange={(e) => handleChange('notaryFees', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.notaryFees ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 15000"
              min="0"
            />
            {errors.notaryFees && <p className="text-red-500 text-sm mt-1">{errors.notaryFees}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Valeur actuelle (€)
            </label>
            <input
              type="number"
              value={formData.currentValue}
              onChange={(e) => handleChange('currentValue', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.currentValue ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 300000"
              min="0"
            />
            {errors.currentValue && <p className="text-red-500 text-sm mt-1">{errors.currentValue}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statut
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupé</option>
              <option value="renovation">En rénovation</option>
              <option value="maintenance">En maintenance</option>
            </select>
          </div>

          {/* Champ de sélection de société de gestion */}
          {isGestionEnabled && societes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Société de gestion
              </label>
              <select
                value={formData.managementCompanyId}
                onChange={(e) => handleChange('managementCompanyId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Aucune (gestion directe)</option>
                {societes.map((societe: any) => (
                  <option key={societe.id} value={societe.id}>
                    {societe.nom} ({(societe.taux * 100).toFixed(2)}%)
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Si vous sélectionnez une société de gestion, les commissions seront calculées automatiquement sur les loyers.
              </p>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Notes additionnelles sur le bien..."
              rows={3}
            />
          </div>
            </div>
          </TabsContent>
        </Tabs>
      </form>
    </Modal>
  );
}