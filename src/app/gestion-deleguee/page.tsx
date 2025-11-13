'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Building2, Percent, Euro, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { ManagementCompanyModal } from '@/components/gestion/ManagementCompanyModal';
import type { ManagementCompany } from '@/lib/gestion/types';
import Link from 'next/link';

interface GestionApiResponse {
  societes: ManagementCompany[];
  enabled: boolean;
}

export default function GestionDelegueePage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSociete, setSelectedSociete] = useState<ManagementCompany | null>(null);

  // Récupérer les sociétés de gestion + statut d'activation
  const { data, isLoading } = useQuery<GestionApiResponse>({
    queryKey: ['management-companies'],
    queryFn: async () => {
      const res = await fetch('/api/gestion/societes');
      if (!res.ok) throw new Error('Erreur lors de la récupération des sociétés');
      return res.json();
    },
  });

  const societes = data?.societes || [];
  const isEnabled = data?.enabled ?? true;

  const handleCreateSociete = () => {
    setSelectedSociete(null);
    setIsModalOpen(true);
  };

  const handleEditSociete = (societe: ManagementCompany) => {
    setSelectedSociete(societe);
    setIsModalOpen(true);
  };

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) => {
      const res = await fetch(`/api/gestion/societes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif }),
      });
      if (!res.ok) throw new Error('Erreur lors de la mise à jour');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management-companies'] });
      toast.success('Société mise à jour avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour de la société');
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion déléguée</h1>
          <p className="text-gray-600 mt-1">
            Gérez vos sociétés de gestion et les commissions automatiques
          </p>
        </div>
        <div className="relative">
          <Button 
            onClick={handleCreateSociete}
            disabled={!isEnabled}
            className={!isEnabled ? 'opacity-50 cursor-not-allowed' : ''}
            title={!isEnabled ? 'Activez la gestion déléguée dans Paramètres pour créer une société' : ''}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle société
          </Button>
        </div>
      </div>

      {/* Badge d'alerte si la fonctionnalité est désactivée */}
      {!isEnabled && (
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
              <Link href="/parametres/gestion-deleguee">
                <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                  Activer dans les paramètres
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Liste des sociétés */}
      {societes.length === 0 ? (
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
          {societes.map((societe: any) => (
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
                  onClick={() =>
                    toggleActiveMutation.mutate({
                      id: societe.id,
                      actif: !societe.actif,
                    })
                  }
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
        }}
        societe={selectedSociete}
      />
    </div>
  );
}

