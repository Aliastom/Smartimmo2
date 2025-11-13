'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Toaster } from 'sonner';

import TenantsTable from '../../../ui/shared/tables/TenantsTable';
import TenantFormModal from '../../../ui/leases-tenants/TenantFormModal';
import { type Tenant, type TenantFilters } from '../../../ui/hooks/useTenants';
import TenantStatsCards from '../../../ui/components/stats/TenantStatsCards';

export default function LocatairesPage() {
  const [tenantFilters, setTenantFilters] = useState<TenantFilters>({});
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

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
    window.location.href = `/leases-tenants/baux?tenantId=${tenant.id}`;
  };

  const handleCloseTenantModal = () => {
    setTenantModalOpen(false);
    setEditingTenant(null);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">Locataires</h1>
              <p className="mt-2 text-neutral-600">
                Gérez vos locataires et leurs informations
              </p>
            </div>
            <button
              onClick={() => {
                setEditingTenant(null);
                setTenantModalOpen(true);
              }}
              className="bg-primary-700 text-base-100 px-4 py-2 rounded-md shadow-md hover:bg-primary-800 transition-colors flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>Nouveau locataire</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <TenantStatsCards />

        {/* Table des locataires */}
        <TenantsTable
          context="global"
          initialFilters={tenantFilters}
          onEdit={handleEditTenant}
          onDelete={handleDeleteTenant}
          onViewLeases={handleViewTenantLeases}
        />

        {/* Modale */}
        <TenantFormModal
          isOpen={tenantModalOpen}
          onClose={handleCloseTenantModal}
          tenant={editingTenant}
        />

        <Toaster position="top-right" />
      </div>
    </div>
  );
}
