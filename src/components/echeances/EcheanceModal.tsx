'use client';

import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { SmartSelect, SmartSelectOption } from '@/components/ui/SmartSelect';
import { SmartDatePicker } from '@/components/ui/SmartDatePicker';
import { Switch } from '@/components/ui/Switch';
import { Accordion } from '@/components/ui/Accordion';
import { echeanceFormSchema, type EcheanceFormSchema } from '@/lib/validations/echeance';
import {
  EcheanceRecurrente,
  ECHEANCE_TYPE_LABELS,
  PERIODICITE_LABELS,
  SENS_LABELS,
} from '@/types/echeance';
import { EcheanceType, Periodicite, SensEcheance } from '@prisma/client';
import { X } from 'lucide-react';

interface EcheanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EcheanceFormSchema) => Promise<void>;
  echeance?: EcheanceRecurrente | null;
  properties?: Array<{ id: string; name: string }>;
  leases?: Array<{ id: string; propertyId: string; type: string; status: string; tenantName?: string }>;
  mode?: 'create' | 'edit' | 'duplicate';
  defaultPropertyId?: string | null;
}

export function EcheanceModal({
  isOpen,
  onClose,
  onSubmit,
  echeance,
  properties = [],
  leases = [],
  mode = 'create',
  defaultPropertyId = null,
}: EcheanceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filteredLeases, setFilteredLeases] = useState(leases);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<EcheanceFormSchema>({
    resolver: zodResolver(echeanceFormSchema),
    defaultValues: {
      label: '',
      type: EcheanceType.AUTRE,
      periodicite: Periodicite.MONTHLY,
      montant: 0,
      recuperable: false,
      sens: SensEcheance.DEBIT,
      propertyId: null,
      leaseId: null,
      startAt: new Date().toISOString().split('T')[0],
      endAt: null,
      isActive: true,
    },
  });

  const propertyId = watch('propertyId');
  const endAt = watch('endAt');

  // Filtrer les baux selon le bien sélectionné
  useEffect(() => {
    if (propertyId) {
      const filtered = leases.filter((lease) => lease.propertyId === propertyId);
      setFilteredLeases(filtered);
      
      const currentLeaseId = watch('leaseId');
      if (currentLeaseId && !filtered.find((l) => l.id === currentLeaseId)) {
        setValue('leaseId', null);
      }
    } else {
      setFilteredLeases(leases);
    }
  }, [propertyId, leases, setValue, watch]);

  // Charger les données en mode édition/duplication
  useEffect(() => {
    if (isOpen && echeance) {
      const startDate = typeof echeance.startAt === 'string'
        ? echeance.startAt.split('T')[0]
        : new Date(echeance.startAt).toISOString().split('T')[0];
      
      const endDate = echeance.endAt
        ? (typeof echeance.endAt === 'string'
          ? echeance.endAt.split('T')[0]
          : new Date(echeance.endAt).toISOString().split('T')[0])
        : null;

      reset({
        label: echeance.label,
        type: echeance.type,
        periodicite: echeance.periodicite,
        montant: echeance.montant,
        recuperable: echeance.recuperable,
        sens: echeance.sens,
        propertyId: echeance.propertyId,
        leaseId: echeance.leaseId,
        startAt: startDate,
        endAt: endDate,
        isActive: mode === 'duplicate' ? true : echeance.isActive,
      });
    } else if (isOpen && !echeance) {
      reset({
        label: '',
        type: EcheanceType.AUTRE,
        periodicite: Periodicite.MONTHLY,
        montant: 0,
        recuperable: false,
        sens: SensEcheance.DEBIT,
        propertyId: defaultPropertyId || null,
        leaseId: null,
        startAt: new Date().toISOString().split('T')[0],
        endAt: null,
        isActive: true,
      });
    }
  }, [isOpen, echeance, mode, reset, defaultPropertyId]);

  const handleFormSubmit = async (data: EcheanceFormSchema) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const title =
    mode === 'create'
      ? 'Créer une échéance'
      : mode === 'duplicate'
      ? 'Dupliquer une échéance'
      : 'Modifier une échéance';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit(handleFormSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement...' : mode === 'create' || mode === 'duplicate' ? 'Créer' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 md:space-y-4">
        {/* Section Essentiel */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 md:hidden">Essentiel</h3>
        {/* Libellé */}
        <div>
          <Label htmlFor="label">Libellé *</Label>
          <Input
            id="label"
            {...register('label')}
            placeholder="Ex: Loyer mensuel, Charges copropriété..."
            className={errors.label ? 'border-red-500' : ''}
          />
          {errors.label && <p className="text-sm text-red-500 mt-1">{errors.label.message}</p>}
        </div>

        {/* Type et Sens */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="type">Type *</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                    <SmartSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={Object.entries(ECHEANCE_TYPE_LABELS).map(([key, label]) => ({
                        value: key,
                        label,
                      }))}
                      placeholder="Sélectionner un type"
                      error={!!errors.type}
                      id="type"
                      aria-label="Type d'échéance"
                    />
              )}
            />
            {errors.type && <p className="text-sm text-red-500 mt-1">{errors.type.message}</p>}
          </div>

          <div>
            <Label htmlFor="sens">Sens *</Label>
            <Controller
              name="sens"
              control={control}
              render={({ field }) => (
                    <SmartSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={Object.entries(SENS_LABELS).map(([key, label]) => ({
                        value: key,
                        label,
                      }))}
                      placeholder="Sélectionner"
                      error={!!errors.sens}
                      id="sens"
                      aria-label="Sens de l'échéance"
                    />
              )}
            />
            {errors.sens && <p className="text-sm text-red-500 mt-1">{errors.sens.message}</p>}
          </div>
        </div>

            {/* Montant */}
          <div>
            <Label htmlFor="montant">Montant (€) *</Label>
            <Input
              id="montant"
              type="number"
              step="0.01"
              {...register('montant', { valueAsNumber: true })}
              placeholder="0.00"
              className={errors.montant ? 'border-red-500' : ''}
            />
            {errors.montant && <p className="text-sm text-red-500 mt-1">{errors.montant.message}</p>}
          </div>
        </div>

        {/* Section Période */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 md:hidden">Période</h3>
            {/* Périodicité */}
            <div>
              <Label htmlFor="periodicite">Périodicité *</Label>
              <Controller
                name="periodicite"
                control={control}
                render={({ field }) => (
                  <SmartSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={Object.entries(PERIODICITE_LABELS).map(([key, label]) => ({
                      value: key,
                      label,
                    }))}
                    placeholder="Sélectionner"
                    error={!!errors.periodicite}
                    id="periodicite"
                    aria-label="Périodicité"
                  />
                )}
              />
              {errors.periodicite && <p className="text-sm text-red-500 mt-1">{errors.periodicite.message}</p>}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startAt">Date de début *</Label>
                <Controller
                  name="startAt"
                  control={control}
                  render={({ field }) => (
                    <SmartDatePicker
                      value={field.value || ''}
                      onChange={(value) => field.onChange(value)}
                      placeholder="Sélectionner une date"
                      error={!!errors.startAt}
                      id="startAt"
                      aria-label="Date de début"
                    />
                  )}
                />
                {errors.startAt && <p className="text-sm text-red-500 mt-1">{errors.startAt.message}</p>}
              </div>

              <div>
                <Label htmlFor="endAt">Date de fin</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Controller
                      name="endAt"
                      control={control}
                      render={({ field }) => (
                        <SmartDatePicker
                          value={field.value || ''}
                          onChange={(value) => field.onChange(value || null)}
                          placeholder="Pas de date de fin"
                          id="endAt"
                          aria-label="Date de fin"
                        />
                      )}
                    />
                  </div>
                  {endAt && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setValue('endAt', null)}
                      title="Aucune fin"
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {errors.endAt && <p className="text-sm text-red-500 mt-1">{errors.endAt.message}</p>}
                {!endAt && <p className="text-xs text-gray-500 mt-1">Pas de date de fin (récurrence infinie)</p>}
              </div>
            </div>
        </div>

        {/* Section Options (Accordion) */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 md:hidden">Options</h3>
          <Accordion title="Options" defaultOpen={false} className="md:border md:border-gray-200 md:rounded-lg">
            <div className="p-3 space-y-4">
        {/* Bien et Bail */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="propertyId">Bien</Label>
            <Controller
              name="propertyId"
              control={control}
              render={({ field }) => {
                // ✅ CORRECTION: Ne pas afficher "Chargement..." comme option, attendre que le nom soit chargé
                const validProperties = properties.filter(p => p.name && p.name !== 'Chargement...');
                const isLoading = properties.length > 0 && properties.some(p => !p.name || p.name === 'Chargement...');
                
                return (
                  <SmartSelect
                    value={field.value || ''} 
                    onChange={(value) => field.onChange(value || null)}
                    options={[
                      { value: '', label: 'Aucun bien' },
                      ...validProperties.map((property) => ({
                        value: property.id,
                        label: property.name,
                      })),
                    ]}
                    placeholder={isLoading ? 'Chargement...' : 'Aucun bien'}
                    disabled={!!defaultPropertyId || isLoading}
                    id="propertyId"
                    aria-label="Bien"
                  />
                );
              }}
            />
            {defaultPropertyId && (
              <p className="text-xs text-gray-500 mt-1">Le bien est verrouillé car vous êtes dans un contexte de bien</p>
            )}
          </div>

          <div>
            <Label htmlFor="leaseId">Bail</Label>
            <Controller
              name="leaseId"
              control={control}
                      render={({ field }) => (
                    <SmartSelect
                      value={field.value || ''}
                      onChange={(value) => field.onChange(value || null)}
                      options={[
                        { value: '', label: 'Aucun bail' },
                        ...filteredLeases.map((lease) => ({
                          value: lease.id,
                          label: lease.tenantName || `${lease.type} - ${lease.status}`,
                        })),
                      ]}
                      placeholder="Aucun bail"
                      id="leaseId"
                      aria-label="Bail"
                    />
                      )}
            />
          </div>
        </div>

        {/* Récupérable et Actif */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <Controller
              name="recuperable"
              control={control}
              render={({ field }) => (
                <Switch
                  id="recuperable"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="recuperable" className="cursor-pointer">
              Charge récupérable
            </Label>
          </div>

          <div className="flex items-center gap-3">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch
                  id="isActive"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Actif
            </Label>
          </div>
                </div>
            </div>
          </Accordion>
        </div>
      </form>
    </Modal>
  );
}

