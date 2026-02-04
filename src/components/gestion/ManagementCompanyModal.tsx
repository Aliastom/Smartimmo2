'use client';

import { useState, useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Save, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SmartSelect, type SmartSelectOption } from '@/components/ui/SmartSelect';
import { toast } from 'sonner';
import type { ManagementCompany, CreateManagementCompanyDto } from '@/lib/gestion/types';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { usePropertiesData } from '@/features/properties/hooks/usePropertiesData';
import { createManagementCompanyServiceWithMode } from '@/domain/services/managementCompanyServiceFactory';

interface ManagementCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  societe: ManagementCompany | null;
  mode?: 'normal' | 'app-shell';
}

export function ManagementCompanyModal({
  isOpen,
  onClose,
  societe,
  mode = 'normal',
}: ManagementCompanyModalProps) {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrganization();
  const isEdit = !!societe;
  const isAppShell = mode === 'app-shell';
  const managementCompanyService = useMemo(
    () => createManagementCompanyServiceWithMode(mode),
    [mode]
  );

  // Charger les propriétés depuis IndexedDB en mode app-shell
  const { properties: appShellProperties } = usePropertiesData({
    mode: isAppShell ? 'app-shell' : 'normal',
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    control,
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

  // Récupérer les propriétés pour l'affectation (mode normal uniquement)
  const { data: normalProperties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const res = await fetch('/api/properties');
      if (!res.ok) throw new Error('Erreur lors de la récupération des biens');
      const data = await res.json();
      return data.data || [];
    },
    enabled: isOpen && !isAppShell,
  });

  // Utiliser les propriétés selon le mode
  const properties = isAppShell ? appShellProperties : normalProperties;

  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [initialPropertyIds, setInitialPropertyIds] = useState<string[]>([]);
  const modeCalculOptions: SmartSelectOption[] = useMemo(() => ([
    { value: 'LOYERS_UNIQUEMENT', label: 'Loyers uniquement' },
    { value: 'REVENUS_TOTAUX', label: 'Revenus totaux (loyer + charges récup)' },
  ]), []);

  // Charger les biens affectés si en mode édition
  useEffect(() => {
    if (societe && isOpen) {
      if (isAppShell) {
        // Mode app-shell : charger depuis IndexedDB
        const loadProperties = async () => {
          if (!organizationId) return;
          const linkedProperties = properties.filter((p: any) => 
            p.managementCompanyId === societe.id
          );
          const ids = linkedProperties.map((p: any) => p.id);
          setSelectedPropertyIds(ids);
          setInitialPropertyIds(ids);
        };
        loadProperties();
      } else {
        // Mode normal : utiliser l'API
        const fetchSociete = async () => {
          const res = await fetch(`/api/gestion/societes/${societe.id}`);
          if (res.ok) {
            const data = await res.json();
            const ids = data.Property?.map((p: any) => p.id) || [];
            setSelectedPropertyIds(ids);
            setInitialPropertyIds(ids);
          }
        };
        fetchSociete();
      }
    } else if (!societe && isOpen) {
      setSelectedPropertyIds([]);
      setInitialPropertyIds([]);
    }
  }, [societe, isOpen, isAppShell, organizationId, properties]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateManagementCompanyDto) => {
      if (!organizationId) {
        throw new Error('OrganizationId requis');
      }
      return managementCompanyService.createCompany({
        organizationId,
        data,
        selectedPropertyIds,
      });
    },
    onSuccess: async () => {
      if (!isAppShell) {
        queryClient.invalidateQueries({ queryKey: ['management-companies'] });
      } else {
        window.dispatchEvent(new CustomEvent('managementCompany:refresh', {
          detail: { reason: 'create' },
        }));
        window.dispatchEvent(new CustomEvent('properties:refresh', {
          detail: { reason: 'management-company-create' },
        }));
      }
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
      if (!organizationId || !societe) {
        throw new Error('OrganizationId requis');
      }
      return managementCompanyService.updateCompany({
        organizationId,
        id: societe.id,
        data,
        selectedPropertyIds,
        previousPropertyIds: initialPropertyIds,
      });
    },
    onSuccess: async () => {
      if (!isAppShell) {
        queryClient.invalidateQueries({ queryKey: ['management-companies'] });
      } else {
        window.dispatchEvent(new CustomEvent('managementCompany:refresh', {
          detail: { reason: 'update' },
        }));
        window.dispatchEvent(new CustomEvent('properties:refresh', {
          detail: { reason: 'management-company-update' },
        }));
      }
      toast.success('Société mise à jour avec succès');
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: CreateManagementCompanyDto) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (!isOpen) return null;

  const modalFooter = (
    <div className="flex gap-3 w-full">
      <Button type="button" variant="outline" onClick={onClose} className="flex-1 sm:flex-initial">
        Annuler
      </Button>
      <Button type="submit" form="management-company-form" disabled={isSubmitting} className="flex-1 sm:flex-initial">
        <Save className="h-4 w-4 mr-2" />
        {isEdit ? 'Mettre à jour' : 'Créer'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifier la société' : 'Nouvelle société de gestion'}
      size="lg"
      className="md:max-w-2xl"
      footer={modalFooter}
    >
        <form id="management-company-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="Nom du contact"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Téléphone</label>
                <input
                  type="text"
                  {...register('telephone')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="01 23 45 67 89"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  {...register('email')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
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
                <Controller
                  name="modeCalcul"
                  control={control}
                  render={({ field }) => (
                    <SmartSelect
                      value={field.value || ''}
                      onChange={field.onChange}
                      options={modeCalculOptions}
                      placeholder="Sélectionner un mode"
                      aria-label="Mode de calcul"
                    />
                  )}
                />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="Ex: 30"
                />
              </div>

              <div className="flex items-center space-x-4 pt-7">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...register('baseSurEncaissement')}
                    className="rounded border-gray-300 accent-orange-500 focus:ring-orange-500 focus:ring-offset-2"
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
                    className="rounded border-gray-300 accent-orange-500 focus:ring-orange-500 focus:ring-offset-2"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
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
                        className="rounded border-gray-300 accent-orange-500 focus:ring-orange-500 focus:ring-offset-2"
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
                className="rounded border-gray-300 accent-orange-500 focus:ring-orange-500 focus:ring-offset-2"
              />
              <span className="text-sm font-medium">Société active</span>
            </label>
          </div>

        </form>
    </Modal>
  );
}

