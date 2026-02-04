'use client';

/**
 * Core Component pour la page Gestion Déléguée
 * 
 * Une seule source de vérité utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 */

import { useState, useCallback, useMemo } from 'react';
import { Plus, Edit, Building2, Percent, Euro, AlertTriangle, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { ManagementCompanyModal } from '@/components/gestion/ManagementCompanyModal';
import type { ManagementCompany } from '@/lib/gestion/types';
import { useGestionDelegueeData } from './hooks/useGestionDelegueeData';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { usePropertiesData } from '@/features/properties/hooks/usePropertiesData';
import { createManagementCompanyServiceWithMode } from '@/domain/services/managementCompanyServiceFactory';
import { useAlert } from '@/hooks/useAlert';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import Link from 'next/link';

export interface GestionDelegueePageCoreProps {
  mode: 'normal' | 'app-shell';
}

export function GestionDelegueePageCore({
  mode,
}: GestionDelegueePageCoreProps) {
  const { organizationId } = useCurrentOrganization();
  const { showAlert } = useAlert();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSociete, setSelectedSociete] = useState<ManagementCompany | null>(null);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const sidebarContext = useSidebarOptional();
  const managementCompanyService = useMemo(
    () => createManagementCompanyServiceWithMode(mode),
    [mode]
  );

  // Charger les données via le hook unifié
  const { societes, enabled, loading, error } = useGestionDelegueeData({
    mode,
  });

  // Charger les propriétés pour compter les biens liés
  const { properties } = usePropertiesData({
    mode,
  });

  // Compter les biens liés pour chaque société
  const societesWithCount = societes.map(societe => {
    const propertiesCount = properties.filter((p: any) => 
      p.managementCompanyId === societe.id
    ).length;
    return {
      ...societe,
      propertiesCount,
    };
  });

  const handleCreateSociete = useCallback(() => {
    setSelectedSociete(null);
    setIsModalOpen(true);
  }, []);

  const handleEditSociete = useCallback((societe: ManagementCompany) => {
    setSelectedSociete(societe);
    setIsModalOpen(true);
  }, []);

  const toggleActiveStatus = useCallback(async (societe: ManagementCompany) => {
    if (!organizationId) {
      toast.error('Organisation requise pour cette action.');
      return;
    }
    setIsTogglingActive(true);
    try {
      await managementCompanyService.toggleActive({
        organizationId,
        id: societe.id,
        actif: societe.actif,
      });

      if (mode === 'app-shell') {
        window.dispatchEvent(new CustomEvent('managementCompany:refresh', {
          detail: { scope: 'global', reason: 'toggle-active' },
        }));
        window.dispatchEvent(new CustomEvent('properties:refresh', {
          detail: { reason: 'management-company-toggle' },
        }));
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          showAlert({
            type: 'info',
            title: 'Modification enregistrée localement',
            message: 'Le statut sera synchronisé dès que la connexion sera rétablie.',
          });
        }
      }

      toast.success(`Société ${societe.actif ? 'désactivée' : 'activée'} avec succès.`);
    } catch (err: any) {
      console.error('Erreur lors du changement de statut:', err);
      toast.error(`Erreur lors du changement de statut: ${err.message || 'Une erreur est survenue.'}`);
    } finally {
      setIsTogglingActive(false);
    }
  }, [organizationId, mode, managementCompanyService, showAlert]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Erreur : {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header - même style que Biens */}
      <div className="mb-4 sm:mb-6 space-y-3">
        {/* Ligne 1 : Hamburger + Titre + Bouton "+" */}
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Bouton hamburger mobile - Discret, aligné à gauche du titre */}
            {sidebarContext && (
              <button
                onClick={sidebarContext.toggleSidebar}
                className="lg:hidden flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] flex-shrink-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label={sidebarContext.sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
              >
                {sidebarContext.sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            )}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate min-w-0">Gestion déléguée</h1>
            <div className="flex-shrink-0">
              <button
                onClick={handleCreateSociete}
                disabled={!enabled}
                className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-orange-600"
                aria-label="Nouvelle société"
                title={!enabled ? 'Activez la gestion déléguée dans Paramètres pour créer une société' : 'Nouvelle société'}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Ligne 2 : Description */}
        <p className="text-sm sm:text-base text-gray-600">Gérez vos sociétés de gestion et les commissions automatiques</p>
      </div>

      {/* Badge d'alerte si la fonctionnalité est désactivée */}
      {!enabled && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-orange-900 mb-1">
                Fonctionnalité désactivée
              </h3>
              <p className="text-sm text-orange-700 mb-3">
                La gestion déléguée est actuellement désactivée. Les commissions ne seront pas générées automatiquement lors de la création de transactions de loyer.
              </p>
              {mode === 'normal' && (
                <Link href="/parametres/gestion-deleguee">
                  <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                    Activer dans les paramètres
                  </Button>
                </Link>
              )}
              {mode === 'app-shell' && (
                <Link href="/app?view=parametres">
                  <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                    Activer dans les paramètres
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Liste des sociétés */}
      {societesWithCount.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucune société de gestion
          </h3>
          <p className="text-gray-600 mb-6">
            Créez votre première société de gestion pour automatiser les commissions
          </p>
          <Button onClick={handleCreateSociete}>
            <Plus className="h-4 w-4 mr-2" />
            Créer une société
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {societesWithCount.map((societe: any) => (
            <div
              key={societe.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
            >
              {/* En-tête de la carte */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {societe.nom}
                  </h3>
                  {societe.contact && (
                    <p className="text-sm text-gray-600 mt-1">{societe.contact}</p>
                  )}
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    societe.actif
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {societe.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>

              {/* Informations */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center text-sm">
                  <Percent className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Taux:</span>
                  <span className="ml-auto font-medium">
                    {(societe.taux * 100).toFixed(2)}%
                  </span>
                </div>

                <div className="flex items-center text-sm">
                  <span className="text-gray-600">Mode:</span>
                  <span className="ml-auto font-medium text-xs">
                    {societe.modeCalcul === 'LOYERS_UNIQUEMENT'
                      ? 'Loyers uniquement'
                      : 'Revenus totaux'}
                  </span>
                </div>

                {societe.fraisMin && (
                  <div className="flex items-center text-sm">
                    <Euro className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Minimum:</span>
                    <span className="ml-auto font-medium">
                      {societe.fraisMin.toFixed(2)}€
                    </span>
                  </div>
                )}

                {societe.tvaApplicable && (
                  <div className="flex items-center text-sm">
                    <span className="text-gray-600">TVA:</span>
                    <span className="ml-auto font-medium">
                      {societe.tauxTva}%
                    </span>
                  </div>
                )}

                <div className="flex items-center text-sm">
                  <Building2 className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Biens liés:</span>
                  <span className="ml-auto font-medium">
                    {societe.propertiesCount || 0}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEditSociete(societe)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Modifier
                </Button>
                <Button
                  variant={societe.actif ? 'outline' : 'default'}
                  size="sm"
                  className="flex-1"
                  onClick={() => toggleActiveStatus(societe)}
                  disabled={isTogglingActive}
                >
                  {societe.actif ? 'Désactiver' : 'Activer'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modale de création/édition */}
      <ManagementCompanyModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSociete(null);
          // Refresh si en mode app-shell
          if (mode === 'app-shell') {
            window.dispatchEvent(new CustomEvent('managementCompany:refresh', {
              detail: { reason: 'modal-close' },
            }));
          }
        }}
        societe={selectedSociete}
        mode={mode}
      />
    </div>
  );
}

