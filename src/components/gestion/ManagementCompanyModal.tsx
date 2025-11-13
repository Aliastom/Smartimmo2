'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, Save, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import type { ManagementCompany, CreateManagementCompanyDto } from '@/lib/gestion/types';

interface ManagementCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  societe: ManagementCompany | null;
}

export function ManagementCompanyModal({
  isOpen,
  onClose,
  societe,
}: ManagementCompanyModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!societe;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateManagementCompanyDto>({
    defaultValues: societe
      ? {
          nom: societe.nom,
          contact: societe.contact || '',
          email: societe.email || '',
          telephone: societe.telephone || '',
          modeCalcul: societe.modeCalcul,
          taux: societe.taux * 100, // Convertir en pourcentage pour affichage
          fraisMin: societe.fraisMin || undefined,
          baseSurEncaissement: societe.baseSurEncaissement,
          tvaApplicable: societe.tvaApplicable,
          tauxTva: societe.tauxTva || undefined,
          actif: societe.actif,
        }
      : {
          nom: '',
          modeCalcul: 'LOYERS_UNIQUEMENT',
          taux: 6, // 6% au lieu de 0.06
          baseSurEncaissement: true,
          tvaApplicable: false,
          actif: true,
        },
  });

  const tvaApplicable = watch('tvaApplicable');

  // Réinitialiser le formulaire quand la société change
  useEffect(() => {
    if (isOpen) {
      if (societe) {
        reset({
          nom: societe.nom,
          contact: societe.contact || '',
          email: societe.email || '',
          telephone: societe.telephone || '',
          modeCalcul: societe.modeCalcul,
          taux: societe.taux * 100, // Convertir en pourcentage pour affichage
          fraisMin: societe.fraisMin || undefined,
          baseSurEncaissement: societe.baseSurEncaissement,
          tvaApplicable: societe.tvaApplicable,
          tauxTva: societe.tauxTva || undefined,
          actif: societe.actif,
        });
      } else {
        reset({
          nom: '',
          modeCalcul: 'LOYERS_UNIQUEMENT',
          taux: 6,
          baseSurEncaissement: true,
          tvaApplicable: false,
          actif: true,
        });
      }
    }
  }, [societe, isOpen, reset]);

  // Récupérer les propriétés pour l'affectation
  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const res = await fetch('/api/properties');
      if (!res.ok) throw new Error('Erreur lors de la récupération des biens');
      const data = await res.json();
      return data.data || [];
    },
    enabled: isOpen,
  });

  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);

  // Charger les biens affectés si en mode édition
  useEffect(() => {
    if (societe && isOpen) {
      const fetchSociete = async () => {
        const res = await fetch(`/api/gestion/societes/${societe.id}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedPropertyIds(data.Property?.map((p: any) => p.id) || []);
        }
      };
      fetchSociete();
    } else if (!societe && isOpen) {
      setSelectedPropertyIds([]);
    }
  }, [societe, isOpen]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateManagementCompanyDto) => {
      // Convertir les pourcentages en décimaux pour l'API
      const payload = {
        ...data,
        taux: data.taux / 100, // 6 -> 0.06
        tauxTva: data.tauxTva ? data.tauxTva : undefined, // TVA reste en pourcentage (20 = 20%)
      };
      
      const res = await fetch('/api/gestion/societes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erreur lors de la création');
      }
      return res.json();
    },
    onSuccess: async (newSociete) => {
      // Affecter les biens si nécessaire
      if (selectedPropertyIds.length > 0) {
        const affectationRes = await fetch(`/api/gestion/societes/${newSociete.id}/affecter-biens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyIds: selectedPropertyIds }),
        });
        
        if (!affectationRes.ok) {
          const error = await affectationRes.json();
          toast.error(error.error || 'Erreur lors de l\'affectation des biens');
          return;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['management-companies'] });
      toast.success('Société créée avec succès');
      onClose();
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CreateManagementCompanyDto) => {
      // Convertir les pourcentages en décimaux pour l'API
      const payload = {
        ...data,
        taux: data.taux / 100, // 6 -> 0.06
        tauxTva: data.tauxTva ? data.tauxTva : undefined, // TVA reste en pourcentage (20 = 20%)
      };
      
      const res = await fetch(`/api/gestion/societes/${societe!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erreur lors de la mise à jour');
      }
      return res.json();
    },
    onSuccess: async () => {
      // Mettre à jour les affectations de biens
      const affectationRes = await fetch(`/api/gestion/societes/${societe!.id}/affecter-biens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyIds: selectedPropertyIds }),
      });

      if (!affectationRes.ok) {
        const error = await affectationRes.json();
        toast.error(error.error || 'Erreur lors de l\'affectation des biens');
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['management-companies'] });
      toast.success('Société mise à jour avec succès');
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: CreateManagementCompanyDto) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-semibold">
            {isEdit ? 'Modifier la société' : 'Nouvelle société de gestion'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Informations générales */}
          <div>
            <h3 className="text-lg font-medium mb-4">Informations générales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Nom de la société <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('nom', { required: 'Le nom est requis' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: ImmoGest"
                />
                {errors.nom && (
                  <p className="text-red-500 text-sm mt-1">{errors.nom.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Contact</label>
                <input
                  type="text"
                  {...register('contact')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom du contact"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Téléphone</label>
                <input
                  type="text"
                  {...register('telephone')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="01 23 45 67 89"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  {...register('email')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="contact@societe.fr"
                />
              </div>
            </div>
          </div>

          {/* Règles de calcul */}
          <div>
            <h3 className="text-lg font-medium mb-4">Règles de calcul</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Mode de calcul <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('modeCalcul')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="LOYERS_UNIQUEMENT">Loyers uniquement</option>
                  <option value="REVENUS_TOTAUX">Revenus totaux (loyer + charges récup)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Taux de commission (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('taux', {
                    required: 'Le taux est requis',
                    min: { value: 0, message: 'Le taux doit être positif' },
                    max: { value: 100, message: 'Le taux doit être entre 0 et 100' },
                    valueAsNumber: true,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 6 pour 6%"
                />
                {errors.taux && (
                  <p className="text-red-500 text-sm mt-1">{errors.taux.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Frais minimum (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('fraisMin', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 30"
                />
              </div>

              <div className="flex items-center space-x-4 pt-7">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...register('baseSurEncaissement')}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Base sur encaissement</span>
                </label>
              </div>
            </div>
          </div>

          {/* TVA */}
          <div>
            <h3 className="text-lg font-medium mb-4">TVA</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...register('tvaApplicable')}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">TVA applicable</span>
                </label>
              </div>

              {tvaApplicable && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Taux de TVA (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('tauxTva', { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 20"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Biens affectés */}
          <div>
            <h3 className="text-lg font-medium mb-4">Biens affectés</h3>
            <div className="border border-gray-300 rounded-md p-4 max-h-48 overflow-y-auto">
              {properties.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun bien disponible</p>
              ) : (
                <div className="space-y-2">
                  {properties.map((property: any) => (
                    <label
                      key={property.id}
                      className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPropertyIds.includes(property.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPropertyIds([...selectedPropertyIds, property.id]);
                          } else {
                            setSelectedPropertyIds(
                              selectedPropertyIds.filter((id) => id !== property.id)
                            );
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">
                        {property.name} - {property.city}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                {...register('actif')}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium">Société active</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {isEdit ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

