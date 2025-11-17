'use client';

import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/shared/select';
import { Switch } from '@/components/ui/Switch';
import { echeanceFormSchema, type EcheanceFormSchema } from '@/lib/validations/echeance';
import {
  EcheanceRecurrente,
  ECHEANCE_TYPE_LABELS,
  PERIODICITE_LABELS,
  SENS_LABELS,
} from '@/types/echeance';
import { EcheanceType, Periodicite, SensEcheance } from '@prisma/client';
import { Calendar, X } from 'lucide-react';

interface EcheanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EcheanceFormSchema) => Promise<void>;
  echeance?: EcheanceRecurrente | null;
  properties?: Array<{ id: string; name: string }>;
  leases?: Array<{ id: string; propertyId: string; type: string; status: string }>;
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
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
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
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={errors.type ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ECHEANCE_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={errors.sens ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SENS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.sens && <p className="text-sm text-red-500 mt-1">{errors.sens.message}</p>}
          </div>
        </div>

        {/* Périodicité et Montant */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="periodicite">Périodicité *</Label>
            <Controller
              name="periodicite"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={errors.periodicite ? 'border-red-500' : ''}>
                    <SelectValue>
                      {field.value ? PERIODICITE_LABELS[field.value as Periodicite] : 'Sélectionner'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERIODICITE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.periodicite && <p className="text-sm text-red-500 mt-1">{errors.periodicite.message}</p>}
          </div>

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

        {/* Bien et Bail */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="propertyId">Bien</Label>
            <Controller
              name="propertyId"
              control={control}
              render={({ field }) => (
                <Select value={field.value || ''} onValueChange={(value) => field.onChange(value || null)}>
                  <SelectTrigger>
                    <SelectValue>
                      {field.value 
                        ? properties.find(p => p.id === field.value)?.name || 'Bien sélectionné'
                        : 'Aucun bien'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucun bien</SelectItem>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <Label htmlFor="leaseId">Bail</Label>
            <Controller
              name="leaseId"
              control={control}
              render={({ field }) => {
                const selectedLease = filteredLeases.find(l => l.id === field.value);
                return (
                  <Select value={field.value || ''} onValueChange={(value) => field.onChange(value || null)}>
                    <SelectTrigger>
                      <SelectValue>
                        {field.value && selectedLease
                          ? `${selectedLease.type} - ${selectedLease.status}`
                          : 'Aucun bail'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucun bail</SelectItem>
                      {filteredLeases.map((lease) => (
                        <SelectItem key={lease.id} value={lease.id}>
                          {lease.type} - {lease.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }}
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startAt">Date de début *</Label>
            <Input
              id="startAt"
              type="date"
              {...register('startAt')}
              className={errors.startAt ? 'border-red-500' : ''}
            />
            {errors.startAt && <p className="text-sm text-red-500 mt-1">{errors.startAt.message}</p>}
          </div>

          <div>
            <Label htmlFor="endAt">Date de fin</Label>
            <div className="flex gap-2">
              <Input
                id="endAt"
                type="date"
                {...register('endAt')}
                className={errors.endAt ? 'border-red-500' : ''}
                disabled={!endAt}
              />
              {endAt && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setValue('endAt', null)}
                  title="Aucune fin"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {!endAt && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setValue('endAt', new Date().toISOString().split('T')[0])}
                  title="Définir une fin"
                >
                  <Calendar className="h-4 w-4" />
                </Button>
              )}
            </div>
            {errors.endAt && <p className="text-sm text-red-500 mt-1">{errors.endAt.message}</p>}
            {!endAt && <p className="text-xs text-gray-500 mt-1">Pas de date de fin (récurrence infinie)</p>}
          </div>
        </div>

        {/* Récupérable et Actif */}
        <div className="flex items-center justify-between gap-4 pt-2">
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
      </form>
    </Modal>
  );
}

