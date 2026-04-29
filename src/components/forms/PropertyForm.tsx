'use client';

import React, { useId, useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormShellStandard, FormShellStandardFooter } from '@/components/ui/standards';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList } from '@/components/ui/Tabs';
import { SmartSelect, SmartSelectOption } from '@/components/ui/SmartSelect';
import { z } from 'zod';
import AddressAutocomplete from '@/components/forms/AddressAutocomplete';
import { useQuery } from '@tanstack/react-query';
import { TaxParamsService } from '@/services/TaxParamsService';
import { Home, Armchair, Building2, FileText, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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
  rentalMode: z.enum(['LONG_TERM', 'SEASONAL_AIRBNB']).optional(),
  airbnbListingId: z.string().optional(),
  lmnpActivityId: z.string().optional(),
});

export interface PropertySummaryMetrics {
  cashflowMensuel?: number;
  score?: number;
  rendementPct?: number;
  scoreLabel?: string;
}

interface PropertyFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  summaryMetrics?: PropertySummaryMetrics;
  title: string;
}

const PROPERTY_TYPE_EMOJI: Record<string, string> = {
  house: '🏠',
  apartment: '🏢',
  garage: '🚗',
  commercial: '🏬',
  land: '🌳',
};

function formatEur(value: number): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
}

export default function PropertyForm({ isOpen, onClose, onSubmit, initialData, summaryMetrics, title }: PropertyFormProps) {
  const formId = useId();
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
    rentalMode: 'LONG_TERM',
    airbnbListingId: '',
    lmnpActivityId: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fiscalTypes, setFiscalTypes] = useState<any[]>([]);
  const [fiscalRegimes, setFiscalRegimes] = useState<any[]>([]);
  const [loadingRegimes, setLoadingRegimes] = useState(false);
  const [activeTab, setActiveTab] = useState('essentials');
  const [lmnpActivities, setLmnpActivities] = useState<Array<{ id: string; name: string; siret: string; fiscalRegime: string }>>([]);

  // ✅ Détecter le mode app-shell
  const isAppShell = typeof window !== 'undefined' && window.location.pathname.startsWith('/app');

  // ✅ APP-SHELL: Charger les sociétés de gestion depuis IndexedDB uniquement
  const [societes, setSocietes] = useState<any[]>([]);
  const [isGestionEnabled, setIsGestionEnabled] = useState(false);

  useEffect(() => {
    const loadManagementCompanies = async () => {
      if (!isOpen) return;

      if (isAppShell) {
        // ✅ APP-SHELL: Charger UNIQUEMENT depuis IndexedDB (pas de fetch réseau)
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          const cached = await db.ManagementCompany.toArray();
          
          const societesActives = cached
            .map(c => {
              const { cachedAt, ...rest } = c;
              return rest;
            })
            .filter((s: any) => s.actif);
          
          setSocietes(societesActives);
          setIsGestionEnabled(societesActives.length > 0);
        } catch (error) {
          console.error('[PropertyForm] Erreur lecture IndexedDB sociétés:', error);
          setSocietes([]);
          setIsGestionEnabled(false);
        }
      } else {
        // Mode normal : utiliser useQuery avec fetch (comportement existant)
        // Ce code sera géré par le useQuery ci-dessous
      }
    };

    loadManagementCompanies();
  }, [isOpen, isAppShell]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/lmnp/activities')
      .then((r) => r.json())
      .then((json) => {
        setLmnpActivities((json?.data || []) as any[]);
      })
      .catch(() => setLmnpActivities([]));
  }, [isOpen]);

  // Mode normal : charger les sociétés de gestion (avec fallback offline)
  const { data: gestionData } = useQuery({
    queryKey: ['management-companies'],
    queryFn: async () => {
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      
      // Essayer de charger depuis le réseau
      if (isOnline) {
        try {
          const res = await fetch('/api/gestion/societes');
          if (res.ok) {
            const data = await res.json();
            
            // Mettre en cache local
            if (typeof window !== 'undefined') {
              const { getLocalDB } = await import('@/lib/offline/db');
              const db = await getLocalDB();
              const now = new Date().toISOString();
              
              if (data.societes && Array.isArray(data.societes)) {
                await Promise.all(
                  data.societes.map((societe: any) =>
                    db.ManagementCompany.put({
                      ...societe,
                      cachedAt: now,
                    })
                  )
                );
              }
            }
            
            return data;
          }
        } catch (error) {
          console.warn('[PropertyForm] Erreur réseau, utilisation du cache:', error);
        }
      }
      
      // Fallback sur le cache local
      if (typeof window !== 'undefined') {
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          const cached = await db.ManagementCompany.toArray();
          
          if (cached.length > 0) {
            const societes = cached
              .map(c => {
                const { cachedAt, ...rest } = c;
                return rest;
              })
              .filter((s: any) => s.actif);
            
            return {
              societes,
              enabled: true, // Par défaut en offline
            };
          }
        } catch (error) {
          console.error('[PropertyForm] Erreur lecture cache sociétés:', error);
        }
      }
      
      // Retourner une structure vide si pas de cache
      return { societes: [], enabled: false };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !isAppShell && isOpen, // ✅ Désactiver en app-shell
  });

  // Mode normal : utiliser les données du useQuery
  const societesNormal = gestionData?.societes?.filter((s: any) => s.actif) || [];
  const isGestionEnabledNormal = gestionData?.enabled ?? false;

  // ✅ Utiliser les données selon le mode
  const finalSocietes = isAppShell ? societes : societesNormal;
  const finalIsGestionEnabled = isAppShell ? isGestionEnabled : isGestionEnabledNormal;

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
        rentalMode: initialData.rentalMode || 'LONG_TERM',
        airbnbListingId: initialData.airbnbListingId || '',
        lmnpActivityId: initialData.lmnpActivityId || '',
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
        rentalMode: 'LONG_TERM',
        airbnbListingId: '',
        lmnpActivityId: '',
      });
    }
    
    // Reset errors when form data changes
    setErrors({});
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      if (requiresLmnpActivity && !formData.lmnpActivityId) {
        setErrors((prev) => ({
          ...prev,
          lmnpActivityId: 'Une activité LMNP/SIRET est requise pour un bien LMNP au réel.',
        }));
        return;
      }
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

  const selectedFiscalType = fiscalTypes.find((t: any) => t.id === formData.fiscalTypeId) || null;
  const selectedFiscalTypeText = `${selectedFiscalType?.id || ''} ${selectedFiscalType?.label || ''}`.toLowerCase();
  const selectedRegime = fiscalRegimes.find((r: any) => r.id === formData.fiscalRegimeId) || null;
  const selectedRegimeText = `${selectedRegime?.id || formData.fiscalRegimeId || ''} ${selectedRegime?.label || ''}`.toLowerCase();
  const requiresLmnpActivity =
    /(lmnp|lmp|meuble|meublé)/i.test(selectedFiscalTypeText) &&
    /(reel|réel)/i.test(selectedRegimeText) &&
    /(simplifie|simplifié)/i.test(selectedRegimeText);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      footerAlreadyStandardized
      footer={
        <FormShellStandardFooter
          formId={formId}
          onCancel={onClose}
          saveActionProps={{
            mode: initialData?.id ? 'edit' : 'create',
            isLoading: isSubmitting,
            labelCreate: 'Créer le bien',
            labelEdit: 'Sauvegarder',
            loadingLabel: 'Sauvegarde...',
          }}
        />
      }
    >
      <FormShellStandard id={formId} onSubmit={handleSubmit} className="space-y-4">
        {/* Résumé du bien : identité / action / KPI */}
        {initialData?.id && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm space-y-3">
            {/* Ligne 1 : identité à gauche, bouton dashboard à droite */}
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none" aria-hidden>{PROPERTY_TYPE_EMOJI[initialData.type] || '🏠'}</span>
                  <span className="font-semibold text-gray-900">{initialData.name}</span>
                </div>
                <div className="text-gray-500 mt-1 text-xs">
                  {[initialData.address, initialData.postalCode, initialData.city].filter(Boolean).join(', ') || '—'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  const isAppShell = typeof window !== 'undefined' && window.location.pathname.startsWith('/app');
                  const url = isAppShell
                    ? `/app?view=property&propertyId=${initialData.id}`
                    : `/biens/${initialData.id}`;
                  window.location.href = url;
                }}
                className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
              >
                <span aria-hidden>📊</span>
                Voir le dashboard du bien
              </button>
            </div>
            {/* Ligne 2 : grille KPI 3 lignes × 2 colonnes — label + valeur sur une ligne */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {/* Ligne 1 */}
              <div className="grid grid-cols-[auto_1fr] gap-x-2 items-baseline">
                <span className="text-gray-500 text-xs font-normal">Loyer</span>
                <span className="text-gray-900 font-semibold">
                  {initialData.Lease?.[0]?.rentAmount != null ? formatEur(Number(initialData.Lease[0].rentAmount)) : '—'}
                </span>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 items-baseline min-w-0">
                <span className="text-gray-500 text-xs font-normal flex-shrink-0">Locataire</span>
                <span className="text-gray-900 font-semibold truncate">
                  {initialData.Lease?.[0]?.Tenant
                    ? `${initialData.Lease[0].Tenant.firstName} ${initialData.Lease[0].Tenant.lastName}`
                    : '—'}
                </span>
              </div>
              {/* Ligne 2 */}
              <div className="grid grid-cols-[auto_1fr] gap-x-2 items-baseline">
                <span className="text-gray-500 text-xs font-normal">Statut</span>
                <span className="text-gray-900 font-semibold">
                  {initialData.occupation === 'OCCUPIED' || (initialData.Lease?.length ?? 0) > 0 ? 'Occupé' : 'Vacant'}
                </span>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 items-baseline">
                <span className="text-gray-500 text-xs font-normal">Rendement</span>
                <span className="text-gray-900 font-semibold">
                  {summaryMetrics?.rendementPct != null
                    ? `${Number(summaryMetrics.rendementPct).toFixed(1)} %`
                    : (() => {
                        const rent = initialData.Lease?.[0]?.rentAmount;
                        const value = initialData.currentValue ?? initialData.acquisitionPrice;
                        if (rent && value && Number(value) > 0) {
                          return `${((Number(rent) * 12 / Number(value)) * 100).toFixed(1)} %`;
                        }
                        return '—';
                      })()}
                </span>
              </div>
              {/* Ligne 3 */}
              <div className="grid grid-cols-[auto_1fr] gap-x-2 items-baseline">
                <span className="text-gray-500 text-xs font-normal">Cashflow</span>
                <span className="text-gray-900 font-semibold">
                  {summaryMetrics?.cashflowMensuel != null
                    ? (summaryMetrics.cashflowMensuel >= 0 ? '+' : '') + formatEur(summaryMetrics.cashflowMensuel)
                    : '—'}
                </span>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 items-baseline">
                <span className="text-gray-500 text-xs font-normal">Score</span>
                <span>
                  {summaryMetrics?.score != null ? (
                    <span
                      className={cn(
                        'inline-flex items-center rounded px-1 py-0.5 text-xs font-medium text-white',
                        summaryMetrics.score >= 90 && 'bg-emerald-600',
                        summaryMetrics.score >= 70 && summaryMetrics.score < 90 && 'bg-emerald-500',
                        summaryMetrics.score >= 50 && summaryMetrics.score < 70 && 'bg-amber-500',
                        summaryMetrics.score < 50 && 'bg-red-500'
                      )}
                    >
                      {summaryMetrics.score} — {({ excellent: 'Excellent', tres_bon: 'Très bon', correct: 'Correct', faible: 'Faible' } as Record<string, string>)[summaryMetrics.scoreLabel ?? ''] ?? summaryMetrics.scoreLabel ?? '—'}
                    </span>
                  ) : (
                    <span className="text-gray-900 font-semibold">—</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation par onglets - Style Smartimmo */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 border-b border-gray-200">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'essentials'}
                    onClick={() => setActiveTab('essentials')}
                    className={`
                      flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors
                      border-b-2 -mb-px focus:outline-none
                      ${activeTab === 'essentials'
                        ? 'border-orange-600 text-orange-600' 
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }
                      cursor-pointer
                    `}
                  >
              <FileText className="h-4 w-4" />
              Informations essentielles
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'options'}
              onClick={() => setActiveTab('options')}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors
                border-b-2 -mb-px focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
                ${activeTab === 'options'
                  ? 'border-orange-600 text-orange-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }
                cursor-pointer
              `}
            >
              <Settings className="h-4 w-4" />
              Options avancées
            </button>
          </TabsList>

          {/* ========== ONGLET 1 : ESSENTIELS ========== */}
          <TabsContent value="essentials">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nom du bien *
                </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: Appartement T3 - Paris"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Type *
            </label>
            <SmartSelect
              value={formData.type}
              onChange={(value) => handleChange('type', value)}
              options={[
                { value: 'apartment', label: 'Appartement' },
                { value: 'house', label: 'Maison' },
                { value: 'garage', label: 'Garage' },
                { value: 'commercial', label: 'Commercial' },
                { value: 'land', label: 'Terrain' },
              ]}
              placeholder="Sélectionner un type"
              error={!!errors.type}
            />
            {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type}</p>}
          </div>

          <div className="md:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Type fiscal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Type fiscal
                </label>
                <SmartSelect
                  value={formData.fiscalTypeId}
                  onChange={(value) => handleChange('fiscalTypeId', value)}
                  options={[
                    { value: '', label: '-- Sélectionner un type fiscal --' },
                    ...fiscalTypes.map((type: any): SmartSelectOption => ({
                      value: type.id,
                      label: type.label,
                      icon: type.category === 'FONCIER' ? '🏠' : 
                            type.category === 'BIC' ? '🪑' : 
                            type.category === 'IS' ? '🏢' : undefined,
                    })),
                  ]}
                  placeholder="-- Sélectionner un type fiscal --"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Définit la catégorie fiscale de ce bien (Foncier, BIC, IS)
                </p>
              </div>

              {/* Régime */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Régime
                </label>
                <SmartSelect
                  value={formData.fiscalRegimeId}
                  onChange={(value) => handleChange('fiscalRegimeId', value)}
                  disabled={!formData.fiscalTypeId || loadingRegimes}
                  options={
                    !formData.fiscalTypeId
                      ? [{ value: '', label: '-- Sélectionnez d\'abord un type fiscal --', disabled: true }]
                      : loadingRegimes
                      ? [{ value: '', label: 'Chargement...', disabled: true }]
                      : fiscalRegimes.length === 0
                      ? [{ value: '', label: 'Aucun régime disponible', disabled: true }]
                      : [
                          { value: '', label: '-- Sélectionner un régime --' },
                          ...fiscalRegimes.map((regime: any): SmartSelectOption => ({
                            value: regime.id,
                            label: `${regime.label}${regime.engagementYears ? ` (${regime.engagementYears} ans)` : ''}`,
                          })),
                        ]
                  }
                  placeholder={
                    !formData.fiscalTypeId
                      ? '-- Sélectionnez d\'abord un type fiscal --'
                      : loadingRegimes
                      ? 'Chargement...'
                      : fiscalRegimes.length === 0
                      ? 'Aucun régime disponible'
                      : '-- Sélectionner un régime --'
                  }
                />
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

              {/* Résumé fiscal */}
              {formData.fiscalTypeId && formData.fiscalRegimeId && (
                <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500">Résumé fiscal</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">
                    {fiscalTypes.find((t: any) => t.id === formData.fiscalTypeId)?.label}
                    {' · '}
                    {fiscalRegimes.find((r: any) => r.id === formData.fiscalRegimeId)?.label}
                  </p>
                </div>
              )}

              {requiresLmnpActivity && (
                <div className="md:col-span-2 rounded-lg border border-orange-200 bg-orange-50/40 p-3 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Activité LMNP *
                    </label>
                    <SmartSelect
                      value={formData.lmnpActivityId || ''}
                      onChange={(value) => handleChange('lmnpActivityId', value)}
                      options={[
                        { value: '', label: '-- Sélectionner une activité --' },
                        ...lmnpActivities.map((a): SmartSelectOption => ({
                          value: a.id,
                          label: `${a.name} (${a.siret})`,
                        })),
                      ]}
                      placeholder="-- Sélectionner une activité --"
                    />
                    {errors.lmnpActivityId && <p className="text-red-500 text-sm mt-1">{errors.lmnpActivityId}</p>}
                    <div className="mt-1">
                      <Link
                        href="/app?view=lmnp-activities"
                        className="text-xs text-orange-700 hover:text-orange-800 underline"
                      >
                        Gérer mes activités LMNP
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode d'exploitation : distinct du type fiscal (canal location vs catégorie IR/IS) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mode d&apos;exploitation
                </label>
                <SmartSelect
                  value={formData.rentalMode || 'LONG_TERM'}
                  onChange={(value) => handleChange('rentalMode', value)}
                  options={[
                    { value: 'LONG_TERM', label: 'Location classique (bail)' },
                    { value: 'SEASONAL_AIRBNB', label: 'Location saisonnière (Airbnb)' },
                  ]}
                  placeholder="Sélectionner un mode"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Indépendant du type fiscal. En saisonnière / Airbnb, pas de bail et import CSV Airbnb possible sur la page Transactions.
                </p>
              </div>

              {formData.rentalMode === 'SEASONAL_AIRBNB' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    ID de l&apos;annonce Airbnb (optionnel)
                  </label>
                  <input
                    type="text"
                    value={formData.airbnbListingId || ''}
                    onChange={(e) => handleChange('airbnbListingId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors"
                    placeholder="Ex: 12345678"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Identifiant de votre annonce Airbnb (optionnel, pour référence)
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Adresse *
            </label>
            <AddressAutocomplete
              initialValue={formData.address}
              onAddressSelect={(address) => {
                // ✅ Mettre à jour tous les champs en une seule opération pour éviter les problèmes de timing
                setFormData(prev => ({
                  ...prev,
                  address: address.street || prev.address,
                  postalCode: address.postcode || prev.postalCode,
                  city: address.city || prev.city,
                }));
                
                // Clear errors si présents
                if (errors.address || errors.postalCode || errors.city) {
                  setErrors(prev => {
                    const newErrors = { ...prev };
                    if (address.street) delete newErrors.address;
                    if (address.postcode) delete newErrors.postalCode;
                    if (address.city) delete newErrors.city;
                    return newErrors;
                  });
                }
              }}
              placeholder="Ex: 123 Rue de la Paix, Paris"
              required
              error={errors.address}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Code postal *
            </label>
            <input
              type="text"
              value={formData.postalCode}
              onChange={(e) => handleChange('postalCode', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
                errors.postalCode ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 75001"
            />
            {errors.postalCode && <p className="text-red-500 text-sm mt-1">{errors.postalCode}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Ville *
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
                errors.city ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: Paris"
            />
            {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Surface (m²) *
            </label>
            <input
              type="number"
              value={formData.surface}
              onChange={(e) => handleChange('surface', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
                errors.surface ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 75"
              min="1"
            />
            {errors.surface && <p className="text-red-500 text-sm mt-1">{errors.surface}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nombre de pièces *
            </label>
            <input
              type="number"
              value={formData.rooms}
              onChange={(e) => handleChange('rooms', parseInt(e.target.value) || 1)}
              className={`w-full px-3 py-2 border rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
                errors.rooms ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 3"
              min="1"
            />
            {errors.rooms && <p className="text-red-500 text-sm mt-1">{errors.rooms}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Date d'acquisition *
            </label>
            <input
              type="date"
              value={formData.acquisitionDate}
              onChange={(e) => handleChange('acquisitionDate', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
                errors.acquisitionDate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.acquisitionDate && <p className="text-red-500 text-sm mt-1">{errors.acquisitionDate}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Prix d'acquisition (€) *
            </label>
            <input
              type="number"
              value={formData.acquisitionPrice}
              onChange={(e) => handleChange('acquisitionPrice', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
                errors.acquisitionPrice ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 250 000"
              min="1"
            />
            {errors.acquisitionPrice && <p className="text-red-500 text-sm mt-1">{errors.acquisitionPrice}</p>}
          </div>
            </div>
          </TabsContent>

          {/* ========== ONGLET 2 : OPTIONS AVANCÉES ========== */}
          <TabsContent value="options">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Frais de notaire (€)
                </label>
            <input
              type="number"
              value={formData.notaryFees}
              onChange={(e) => handleChange('notaryFees', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
                errors.notaryFees ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 15 000"
              min="0"
            />
            {errors.notaryFees && <p className="text-red-500 text-sm mt-1">{errors.notaryFees}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Valeur actuelle (€)
            </label>
            <input
              type="number"
              value={formData.currentValue}
              onChange={(e) => handleChange('currentValue', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
                errors.currentValue ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: 300 000"
              min="0"
            />
            {errors.currentValue && <p className="text-red-500 text-sm mt-1">{errors.currentValue}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Statut
            </label>
            <SmartSelect
              value={formData.status}
              onChange={(value) => handleChange('status', value)}
              options={[
                { value: 'vacant', label: 'Vacant' },
                { value: 'occupied', label: 'Occupé' },
                { value: 'renovation', label: 'En rénovation' },
                { value: 'maintenance', label: 'En maintenance' },
              ]}
              placeholder="Sélectionner un statut"
            />
          </div>

          {/* Champ de sélection de société de gestion */}
          {finalIsGestionEnabled && finalSocietes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Société de gestion
              </label>
              <SmartSelect
                value={formData.managementCompanyId}
                onChange={(value) => handleChange('managementCompanyId', value)}
                options={[
                  { value: '', label: 'Aucune (gestion directe)' },
                  ...finalSocietes.map((societe: any): SmartSelectOption => ({
                    value: societe.id,
                    label: `${societe.nom} (${(societe.taux * 100).toFixed(2)}%)`,
                  })),
                ]}
                placeholder="Aucune (gestion directe)"
              />
              <p className="text-sm text-gray-500 mt-1">
                Si vous sélectionnez une société de gestion, les commissions seront calculées automatiquement sur les loyers.
              </p>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Notes additionnelles sur le bien..."
              rows={3}
            />
          </div>
            </div>
          </TabsContent>
        </Tabs>
      </FormShellStandard>
    </Modal>
  );
}