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
import { EcheanceRecurrente, PERIODICITE_LABELS } from '@/types/echeance';
import { Periodicite, SensEcheance } from '@prisma/client';
import { X } from 'lucide-react';
import { useEcheanceReferential } from '@/features/echeances/hooks/useEcheanceReferential';
import { resolveNatureCodeForEcheance } from '@/lib/echeances/echeanceTypeMigration';

interface EcheanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EcheanceFormSchema) => Promise<void>;
  echeance?: EcheanceRecurrente | null;
  properties?: Array<{ id: string; name: string }>;
  leases?: Array<{ id: string; propertyId: string; type: string; status: string; tenantName?: string }>;
  mode?: 'create' | 'edit' | 'duplicate';
  defaultPropertyId?: string | null;
  /** Mode de chargement des données : app-shell utilise IndexedDB */
  dataMode?: 'normal' | 'app-shell';
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
  dataMode = 'normal',
}: EcheanceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filteredLeases, setFilteredLeases] = useState(leases);
  const [isLibelleDirty, setIsLibelleDirty] = useState(false);

  const { natures, categories, loading: refLoading, getCompatibleCategories, getDefaultCategoryId, getNatureFlow } =
    useEcheanceReferential(dataMode);

  const natureOptions: SmartSelectOption[] = natures.map((n) => ({
    value: n.key,
    label: n.label,
  }));

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
      natureCode: '',
      categoryId: '',
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
  const natureCode = watch('natureCode');
  const categoryId = watch('categoryId');

  const compatibleCategories = natureCode ? getCompatibleCategories(natureCode) : [];
  const categoryOptions: SmartSelectOption[] = [
    { value: '', label: 'Sélectionner une catégorie' },
    ...compatibleCategories.map((c) => ({ value: c.id, label: c.label })),
  ];

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

  // Sync sens depuis la nature (flow RECETTE/INCOME → CREDIT)
  useEffect(() => {
    if (!natureCode) return;
    const flow = getNatureFlow(natureCode);
    const sensFromFlow = flow === 'INCOME' || flow === 'RECETTE' ? SensEcheance.CREDIT : SensEcheance.DEBIT;
    setValue('sens', sensFromFlow);
  }, [natureCode, getNatureFlow, setValue]);

  // Quand la nature change : réinitialiser catégorie si incompatible, sinon préremplir par défaut si vide
  useEffect(() => {
    if (!natureCode || compatibleCategories.length === 0) return;
    const defaultId = getDefaultCategoryId(natureCode);
    const currentCompatible = compatibleCategories.some((c) => c.id === categoryId);
    if (!currentCompatible) {
      setValue('categoryId', (defaultId && compatibleCategories.some((c) => c.id === defaultId)) ? defaultId : (compatibleCategories[0]?.id ?? ''));
    } else if (!categoryId && defaultId && compatibleCategories.some((c) => c.id === defaultId)) {
      setValue('categoryId', defaultId);
    }
  }, [natureCode, getDefaultCategoryId, compatibleCategories, categoryId, setValue]);

  // Auto-suggestion libellé : quand nature + catégorie sélectionnés et libellé vide, remplir avec le label catégorie
  const labelValue = watch('label');
  useEffect(() => {
    if (isLibelleDirty) return;
    if (!categoryId || !natureCode) return;
    const selectedCategory = compatibleCategories.find((c) => c.id === categoryId);
    if (!selectedCategory?.label) return;
    const currentLabel = labelValue?.trim() || '';
    if (!currentLabel) {
      setValue('label', selectedCategory.label);
    }
  }, [natureCode, categoryId, compatibleCategories, labelValue, isLibelleDirty, setValue]);

  // Charger les données en mode édition/duplication
  useEffect(() => {
    if (!isOpen) return;
    if (echeance) {
      const startDate =
        typeof echeance.startAt === 'string'
          ? echeance.startAt.split('T')[0]
          : new Date(echeance.startAt).toISOString().split('T')[0];
      const endDate = echeance.endAt
        ? typeof echeance.endAt === 'string'
          ? echeance.endAt.split('T')[0]
          : new Date(echeance.endAt).toISOString().split('T')[0]
        : null;

      const nat = echeance.natureCode || resolveNatureCodeForEcheance(echeance);
      const cat = echeance.defaultCategoryId || getDefaultCategoryId(echeance.natureCode || nat) || '';

      setIsLibelleDirty(true);
      reset({
        label: echeance.label,
        natureCode: nat,
        categoryId: cat,
        periodicite: echeance.periodicite,
        montant: Number(echeance.montant),
        recuperable: echeance.recuperable,
        sens: echeance.sens,
        propertyId: echeance.propertyId,
        leaseId: echeance.leaseId,
        startAt: startDate,
        endAt: endDate,
        isActive: mode === 'duplicate' ? true : echeance.isActive,
      });
    } else {
      setIsLibelleDirty(false);
      reset({
        label: '',
        natureCode: '',
        categoryId: '',
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
    mode === 'create' ? 'Créer une échéance' : mode === 'duplicate' ? 'Dupliquer une échéance' : 'Modifier une échéance';

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
          <Button onClick={handleSubmit(handleFormSubmit)} disabled={isSubmitting || refLoading}>
            {isSubmitting ? 'Enregistrement...' : mode === 'create' || mode === 'duplicate' ? 'Créer' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 md:space-y-4">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 md:hidden">Essentiel</h3>

          {/* Libellé */}
          <div>
            <Label htmlFor="label">Libellé *</Label>
            <Input
              id="label"
              {...register('label')}
              placeholder="Ex: Assurance PNO, Taxe foncière, Loyer mensuel..."
              className={errors.label ? 'border-red-500' : ''}
              onFocus={() => setIsLibelleDirty(true)}
            />
            {errors.label && <p className="text-sm text-red-500 mt-1">{errors.label.message}</p>}
          </div>

          {/* Nature */}
          <div>
            <Label htmlFor="natureCode">Nature *</Label>
            <Controller
              name="natureCode"
              control={control}
              render={({ field }) => (
                <SmartSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={[{ value: '', label: 'Sélectionner une nature' }, ...natureOptions]}
                  placeholder="Sélectionner une nature"
                  error={!!errors.natureCode}
                  id="natureCode"
                  aria-label="Nature de l'échéance"
                  disabled={refLoading}
                />
              )}
            />
            <p className="text-xs text-gray-500 mt-1">Nature comptable (recette ou dépense)</p>
            {errors.natureCode && <p className="text-sm text-red-500 mt-1">{errors.natureCode.message}</p>}
          </div>

          {/* Catégorie */}
          <div>
            <Label htmlFor="categoryId">Catégorie *</Label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <SmartSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={categoryOptions}
                  placeholder="Sélectionner une catégorie"
                  error={!!errors.categoryId}
                  id="categoryId"
                  aria-label="Catégorie de l'échéance"
                  disabled={refLoading || !natureCode}
                />
              )}
            />
            <p className="text-xs text-gray-500 mt-1">Catégories disponibles selon la nature sélectionnée</p>
            {errors.categoryId && <p className="text-sm text-red-500 mt-1">{errors.categoryId.message}</p>}
          </div>

          {/* Sens (dérivé automatiquement de la nature, lecture seule) */}
          <div>
            <Label htmlFor="sens">Sens *</Label>
            <Controller
              name="sens"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-2 py-2 px-3 rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-700">
                  {field.value === 'DEBIT' ? 'Charge' : 'Revenu'}
                </div>
              )}
            />
            <p className="text-xs text-gray-500 mt-1">Défini automatiquement selon la nature (DEPENSE_* → Charge, RECETTE_* → Revenu)</p>
          </div>

          {/* Montant */}
          <div>
            <Label htmlFor="montant">Montant par occurrence (€) *</Label>
            <Input
              id="montant"
              type="number"
              step="0.01"
              {...register('montant', { valueAsNumber: true })}
              placeholder="0.00"
              className={errors.montant ? 'border-red-500' : ''}
            />
            <p className="text-xs text-gray-500 mt-1">
              Montant pour chaque occurrence ; la périodicité définit la répétition (mensuel, annuel, etc.).
            </p>
            {errors.montant && <p className="text-sm text-red-500 mt-1">{errors.montant.message}</p>}
          </div>
        </div>

        {/* Période */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 md:hidden">Période</h3>
          <div>
            <Label htmlFor="periodicite">Périodicité *</Label>
            <Controller
              name="periodicite"
              control={control}
              render={({ field }) => (
                <SmartSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={Object.entries(PERIODICITE_LABELS).map(([key, label]) => ({ value: key, label }))}
                  placeholder="Sélectionner"
                  error={!!errors.periodicite}
                  id="periodicite"
                  aria-label="Périodicité"
                />
              )}
            />
            {errors.periodicite && <p className="text-sm text-red-500 mt-1">{errors.periodicite.message}</p>}
          </div>

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
                  <Button type="button" variant="ghost" size="sm" onClick={() => setValue('endAt', null)} title="Aucune fin" className="flex-shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {errors.endAt && <p className="text-sm text-red-500 mt-1">{errors.endAt.message}</p>}
              {!endAt && <p className="text-xs text-gray-500 mt-1">Pas de date de fin (récurrence infinie)</p>}
            </div>
          </div>
        </div>

        {defaultPropertyId ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Bien et bail</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Bien</Label>
                <p className="mt-1.5 text-sm font-medium text-gray-900 py-2 px-3 rounded-lg bg-white border border-gray-200">
                  {properties.find((p) => p.id === defaultPropertyId)?.name || 'Ce bien'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Contexte verrouillé sur ce bien.</p>
              </div>
              <div>
                <Label htmlFor="leaseId">Bail lié</Label>
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
                          label: lease.tenantName || `${lease.type} — ${lease.status}`,
                        })),
                      ]}
                      placeholder={filteredLeases.length ? 'Associer un bail' : 'Aucun bail'}
                      id="leaseId"
                      aria-label="Bail"
                    />
                  )}
                />
                {filteredLeases.length === 0 ? (
                  <p className="text-xs text-amber-700 mt-1.5">Aucun bail enregistré sur ce bien pour l'instant.</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Optionnel : lie l'échéance à un bail précis.</p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 md:hidden">Options</h3>
          <Accordion title={defaultPropertyId ? 'Autres options' : 'Options'} defaultOpen={!defaultPropertyId} className="md:border md:border-gray-200 md:rounded-lg">
            <div className="p-3 space-y-4">
              {!defaultPropertyId && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="propertyId">Bien</Label>
                    <Controller
                      name="propertyId"
                      control={control}
                      render={({ field }) => {
                        const validProperties = properties.filter((p) => p.name && p.name !== 'Chargement...');
                        const isLoading = properties.length > 0 && properties.some((p) => !p.name || p.name === 'Chargement...');
                        return (
                          <SmartSelect
                            value={field.value || ''}
                            onChange={(value) => field.onChange(value || null)}
                            options={[
                              { value: '', label: 'Aucun bien' },
                              ...validProperties.map((property) => ({ value: property.id, label: property.name })),
                            ]}
                            placeholder={isLoading ? 'Chargement...' : 'Aucun bien'}
                            disabled={isLoading}
                            id="propertyId"
                            aria-label="Bien"
                          />
                        );
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="leaseId-global">Bail</Label>
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
                              label: lease.tenantName || `${lease.type} — ${lease.status}`,
                            })),
                          ]}
                          placeholder="Aucun bail"
                          id="leaseId-global"
                          aria-label="Bail"
                        />
                      )}
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-2">
                <div className="flex items-center gap-3">
                  <Controller
                    name="recuperable"
                    control={control}
                    render={({ field }) => <Switch id="recuperable" checked={field.value} onCheckedChange={field.onChange} />}
                  />
                  <Label htmlFor="recuperable" className="cursor-pointer">
                    Charge récupérable
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Controller
                    name="isActive"
                    control={control}
                    render={({ field }) => <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />}
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    Échéance active
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
