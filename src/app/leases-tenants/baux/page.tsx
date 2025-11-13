'use client';

import React, { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Toaster } from 'sonner';

import LeasesTable from '../../../ui/shared/tables/LeasesTable';
import LeaseFormModal from '../../../ui/leases-tenants/LeaseFormModal';
import { type Lease, type LeaseFilters } from '../../../ui/hooks/useLeases';
import LeaseStatsCards from '../../../ui/components/stats/LeaseStatsCards';
import { useLeaseStatusSync } from '../../../ui/hooks/useLeaseStatusSync';

export default function BauxPage() {
  const [leaseFilters, setLeaseFilters] = useState<LeaseFilters>({});
  const [leaseModalOpen, setLeaseModalOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const syncLeaseStatuses = useLeaseStatusSync();

  const handleEditLease = (lease: Lease) => {
    setEditingLease(lease);
    setLeaseModalOpen(true);
  };

  const handleDeleteLease = (lease: Lease) => {
    // La suppression est gérée par le composant LeasesTable
    console.log('Lease deleted:', lease.id);
  };

  const handleCloseLeaseModal = () => {
    setLeaseModalOpen(false);
    setEditingLease(null);
  };

  const handleSyncStatuses = () => {
    syncLeaseStatuses.mutate();
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">Baux</h1>
              <p className="mt-2 text-neutral-600">
                Gérez vos baux et contrats de location
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleSyncStatuses}
                disabled={syncLeaseStatuses.isPending}
                className="btn btn-secondary hover-pop press flex items-center space-x-2 disabled:opacity-50"
              >
                <RefreshCw size={20} className={syncLeaseStatuses.isPending ? 'animate-spin' : ''} />
                <span>Synchroniser</span>
              </button>
              <button
                onClick={() => {
                  setEditingLease(null);
                  setLeaseModalOpen(true);
                }}
                className="btn btn-primary btn-primary-animated flex items-center space-x-2"
              >
                <Plus size={20} />
                <span>Nouveau bail</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <LeaseStatsCards />

        {/* Table des baux */}
        <LeasesTable
          context="global"
          initialFilters={leaseFilters}
          onEdit={handleEditLease}
          onDelete={handleDeleteLease}
        />

        {/* Modale */}
        <LeaseFormModal
          isOpen={leaseModalOpen}
          onClose={handleCloseLeaseModal}
          lease={editingLease}
        />

        <Toaster position="top-right" />
      </div>
    </div>
  );
}
