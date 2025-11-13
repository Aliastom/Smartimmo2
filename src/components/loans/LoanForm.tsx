'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

const loanFormSchema = z.object({
  propertyId: z.string().min(1, 'Veuillez sélectionner un bien'),
  label: z.string().min(1, 'Le libellé est requis'),
  principal: z.number().positive('Le capital doit être positif'),
  annualRatePct: z.number().min(0, 'Le taux doit être positif ou nul'),
  durationMonths: z.number().int().positive('La durée doit être positive'),
  defermentMonths: z.number().int().min(0, 'Le différé ne peut pas être négatif'),
  insurancePct: z.number().min(0, 'L\'assurance doit être positive').optional().nullable(),
  feesUpfront: z.number().min(0, 'Les frais doivent être positifs').optional().nullable(),
  startDate: z.string().min(1, 'La date de début est requise'),
  isActive: z.boolean(),
});

type LoanFormData = z.infer<typeof loanFormSchema>;

interface Property {
  id: string;
  name: string;
}

interface LoanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  initialData?: Partial<LoanFormData> & { id?: string };
  onSubmit: (data: LoanFormData & { id?: string }) => Promise<void>;
  mode?: 'create' | 'edit';
}

export function LoanForm({
  open,
  onOpenChange,
  properties,
  initialData,
  onSubmit,
  mode = 'create',
}: LoanFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
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
      isActive: initialData?.isActive !== undefined ? initialData.isActive : true,
    },
  });

  const selectedPropertyId = watch('propertyId');

  React.useEffect(() => {
    if (initialData) {
      Object.entries(initialData).forEach(([key, value]) => {
        if (key === 'startDate' && value) {
          setValue(key as any, new Date(value as string).toISOString().split('T')[0]);
        } else if (value !== undefined) {
          setValue(key as any, value);
        }
      });
    }
  }, [initialData, setValue]);

  const handleFormSubmit = async (data: LoanFormData) => {
    try {
      await onSubmit({ ...data, id: initialData?.id });
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Modifier le prêt' : 'Nouveau prêt'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Modifiez les informations du prêt immobilier'
              : 'Ajoutez un nouveau prêt immobilier à votre patrimoine'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Bien */}
          <div className="space-y-2">
            <Label htmlFor="propertyId">Bien *</Label>
            <Select
              value={selectedPropertyId}
              onChange={(e) => setValue('propertyId', e.target.value)}
            >
              <option value="">Sélectionner un bien</option>
              {Array.isArray(properties) && properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </Select>
            {errors.propertyId && (
              <p className="text-sm text-destructive">{errors.propertyId.message}</p>
            )}
          </div>

          {/* Libellé */}
          <div className="space-y-2">
            <Label htmlFor="label">Libellé *</Label>
            <Input
              id="label"
              {...register('label')}
              placeholder="Ex: Prêt immobilier principal"
            />
            {errors.label && (
              <p className="text-sm text-destructive">{errors.label.message}</p>
            )}
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
                <p className="text-sm text-destructive">{errors.principal.message}</p>
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
                <p className="text-sm text-destructive">{errors.annualRatePct.message}</p>
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
                <p className="text-sm text-destructive">{errors.durationMonths.message}</p>
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
                <p className="text-sm text-destructive">{errors.defermentMonths.message}</p>
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
                <p className="text-sm text-destructive">{errors.insurancePct.message}</p>
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
                <p className="text-sm text-destructive">{errors.feesUpfront.message}</p>
              )}
            </div>
          </div>

          {/* Date de début */}
          <div className="space-y-2">
            <Label htmlFor="startDate">Date de début *</Label>
            <Input id="startDate" type="date" {...register('startDate')} />
            {errors.startDate && (
              <p className="text-sm text-destructive">{errors.startDate.message}</p>
            )}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'En cours...' : mode === 'edit' ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

