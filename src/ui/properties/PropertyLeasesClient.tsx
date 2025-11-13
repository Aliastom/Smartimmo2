'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Property } from '../../domain/entities/Property';
import { type Lease } from '../hooks/useLeases';
import LeasesTable from '../shared/tables/LeasesTable';
import LeaseStatsCards from '../components/stats/LeaseStatsCards';
import LeaseFormModal from '../leases-tenants/LeaseFormModal';
import { useLeases } from '../hooks/useLeases';

interface PropertyLeasesClientProps {
  property: Property;
  initialLeases: Lease[];
}

export default function PropertyLeasesClient({ property, initialLeases }: PropertyLeasesClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<Lease | null>(null);

  // Récupérer les baux pour les statistiques
  const { data: leasesData } = useLeases({ 
    filters: { propertyId: property.id }, 
    page: 1, 
    limit: 1000 // Récupérer tous les baux pour les stats
  });

  const leases = Array.isArray(leasesData?.Lease) ? leasesData.Lease : 
                 Array.isArray(initialLeases) ? initialLeases : [];

  // Calculs sécurisés pour l'affichage
  const leasesCount = Array.isArray(leases) ? leases.length : 0;
  const activeLeasesCount = Array.isArray(leases) ? leases.filter(l => l.status === 'ACTIF').length : 0;

  const handleEdit = (lease: Lease) => {
    setEditingLease(lease);
    setIsModalOpen(true);
  };

  const handleDelete = (lease: Lease) => {
    // La suppression est gérée par le composant LeasesTable
    console.log('Lease deleted:', lease.id);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingLease(null);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    setEditingLease(null);
    // Les données seront automatiquement revalidées par React Query
  };

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      <LeaseStatsCards propertyId={property.id} />

      {/* En-tête avec bouton CTA */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900">Baux</h3>
          <p className="text-neutral-600 mt-1">
            {leasesCount} bail{leasesCount > 1 ? 'x' : ''} • {activeLeasesCount} actif{activeLeasesCount > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-base-100 px-4 py-2 rounded-md shadow-md hover:bg-primary transition-colors flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Nouveau bail</span>
        </button>
      </div>

      {/* Table des baux */}
      <LeasesTable
        context="property"
        propertyId={property.id}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Modal de création/édition */}
      {isModalOpen && (
        <LeaseFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          lease={editingLease}
          defaultPropertyId={property.id}
        />
      )}
    </div>
  );
}