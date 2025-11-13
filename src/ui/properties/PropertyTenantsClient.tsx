'use client';

import React, { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { Property } from '../../domain/entities/Property';
import { Tenant } from '../../domain/entities/Tenant';
import TenantsTable from '../shared/tables/TenantsTable';
import TenantFormModal from '../leases-tenants/TenantFormModal';
import TenantStatsCards from '../components/stats/TenantStatsCards';
import { useTenantsByProperty } from '../hooks/useTenants';
import LeaseFormModal from '../leases-tenants/LeaseFormModal';
import { useOccupancyHistory } from '../hooks/useOccupancyHistory';
import { getLeaseRuntimeStatus } from '../../domain/leases/status';

interface PropertyTenantsClientProps {
  property: Property;
}

export default function PropertyTenantsClient({ property }: PropertyTenantsClientProps) {
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [leaseModalOpen, setLeaseModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  
  // Charger les occupants actuels (baux ACTIFS uniquement)
  const { data: currentTenants = [], isLoading: loadingCurrent } = useTenantsByProperty({ 
    propertyId: property.id, 
    activeOnly: true 
  });
  
  // Charger l'historique persistant
  const { data: occupancyHistory = [], isLoading: loadingHistory } = useOccupancyHistory(property.id);

  const handleEditTenant = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setTenantModalOpen(true);
  };

  const handleDeleteTenant = (tenant: Tenant) => {
    // La suppression est gérée par le composant TenantsTable
    console.log('Tenant deleted:', tenant.id);
  };

  const handleViewTenantLeases = (tenant: Tenant) => {
    // Rediriger vers la page baux avec un filtre sur ce locataire
    window.location.href = `/biens/${property.id}/baux?tenantId=${tenant.id}`;
  };

  const handleCloseTenantModal = () => {
    setTenantModalOpen(false);
    setEditingTenant(null);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <TenantStatsCards propertyId={property.id} />

      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Occupants</h2>
          <p className="text-neutral-600">
            {currentTenants.length} occupant{currentTenants.length > 1 ? 's' : ''} actuel{currentTenants.length > 1 ? 's' : ''}
            {occupancyHistory.length > 0 && ` • ${occupancyHistory.length} dans l'historique`}
          </p>        </div>
        <button
          onClick={() => setLeaseModalOpen(true)}
          className="bg-primary-700 text-base-100 px-4 py-2 rounded-md shadow-md hover:bg-primary-800 transition-colors flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Créer un bail</span>
        </button>
      </div>

      {/* Section Occupants actuels */}
      <div className="bg-base-100 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Occupants actuels
        </h3>
        {loadingCurrent ? (
          <p className="text-neutral-500">Chargement...</p>
        ) : currentTenants.length > 0 ? (
          <div className="space-y-4">
            {currentTenants.map((tenant: any) => (
              <div key={tenant.id} className="border border-neutral-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-neutral-900">
                      {tenant.firstName} {tenant.lastName}
                    </h4>
                    <p className="text-sm text-neutral-600">{tenant.email}</p>
                    {tenant.phone && <p className="text-sm text-neutral-600">{tenant.phone}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditTenant(tenant)}
                      className="text-primary hover:text-primary text-sm"
                    >
                      Voir
                    </button>
                  </div>
                </div>
                {tenant.Lease && tenant.Lease.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-neutral-100">
                    <p className="text-xs text-neutral-500 mb-2">Baux actifs :</p>
                    {tenant.Lease.filter((l: any) => getLeaseRuntimeStatus(l) === 'active').map((lease: any) => (
                      <div key={lease.id} className="text-sm text-neutral-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                          ACTIF
                        </span>
                        Du {new Date(lease.startDate).toLocaleDateString()} 
                        {lease.endDate && ` au ${new Date(lease.endDate).toLocaleDateString()}`}
                        {' - '}{lease.rentAmount}€/mois
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-500 text-center py-8">
            Aucun occupant actuellement
          </p>
        )}
      </div>

      {/* Section Historique Persistant */}
      {(occupancyHistory.length > 0 || !loadingHistory) && (
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Historique des occupants
          </h3>
          {loadingHistory ? (
            <p className="text-neutral-500">Chargement...</p>
          ) : occupancyHistory.length > 0 ? (
            <div className="space-y-4">
              {occupancyHistory.map((item: any) => (
                <div key={item.Tenant.id} className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-neutral-700">
                        {item.Tenant.firstName} {item.Tenant.lastName}
                      </h4>
                      <p className="text-sm text-neutral-500">{item.Tenant.email}</p>
                    </div>
                  </div>
                  {item.periods && item.periods.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-neutral-100">
                      <p className="text-xs text-neutral-400 mb-2">Périodes d'occupation :</p>
                      {item.periods.map((period: any) => (
                        <div key={period.id} className="text-sm text-neutral-500 mb-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-base-200 text-base-content opacity-80 mr-2">
                            TERMINÉ
                          </span>
                          Du {new Date(period.startDate).toLocaleDateString()} 
                          {period.endDate && ` au ${new Date(period.endDate).toLocaleDateString()}`}
                          {' - '}{period.monthlyRent}€/mois
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500 text-center py-8">
              Aucun historique d'occupation
            </p>
          )}
        </div>
      )}

      {/* Modale Locataire */}
      <TenantFormModal
        isOpen={tenantModalOpen}
        onClose={handleCloseTenantModal}
        tenant={editingTenant}
      />

      {/* Modale Bail */}
      <LeaseFormModal
        isOpen={leaseModalOpen}
        onClose={() => setLeaseModalOpen(false)}
        defaultPropertyId={property.id}
        onSuccess={() => {
          setLeaseModalOpen(false);
        }}
      />
    </div>
  );
}