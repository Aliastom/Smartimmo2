'use client';

import React, { useState } from 'react';
import { ArrowLeft, Edit, Trash2, FileText, Receipt } from 'lucide-react';
import Link from 'next/link';
import { Tenant } from '../../domain/entities/Tenant';
import TenantFormModal from '../leases-tenants/TenantFormModal';
import { useDeleteTenant } from '../hooks/useTenants';
import { toast } from 'sonner';

interface TenantDetailClientProps {
  tenant: Tenant;
}

export default function TenantDetailClient({ tenant }: TenantDetailClientProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const deleteTenantMutation = useDeleteTenant();
  const deletionGuard = useDeletionGuard('tenant');

  const handleDelete = async () => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le locataire ${tenant.firstName} ${tenant.lastName} ?`)) {
      try {
        const result = await deleteTenantMutation.mutateAsync(tenant.id);
        if (result.status === 409) {
          deletionGuard.openWith(result.payload, tenant.id);
        } else {
          toast.success('Locataire supprimé avec succès');
          // Rediriger vers la liste des locataires
          window.location.href = '/locataires';
        }
      } catch (error) {
        // L'erreur est gérée par le hook
      }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link 
              href="/locataires"
              className="text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">
                {tenant.firstName} {tenant.lastName}
              </h1>
              <p className="text-neutral-600">Détails du locataire</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="bg-primary text-base-100 px-4 py-2 rounded-md hover:bg-primary transition-colors flex items-center space-x-2"
            >
              <Edit size={16} />
              <span>Modifier</span>
            </button>
            <button
              onClick={handleDelete}
              className="bg-error text-base-100 px-4 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center space-x-2"
            >
              <Trash2 size={16} />
              <span>Supprimer</span>
            </button>
          </div>
        </div>

        {/* Informations principales */}
        <div className="bg-base-100 rounded-lg shadow-sm border border-neutral-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-neutral-900 mb-4">Informations personnelles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Prénom</label>
              <p className="text-neutral-900">{tenant.firstName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Nom</label>
              <p className="text-neutral-900">{tenant.lastName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
              <p className="text-neutral-900">{tenant.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Téléphone</label>
              <p className="text-neutral-900">{tenant.phone || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Date de naissance</label>
              <p className="text-neutral-900">{tenant.birthDate ? new Date(tenant.birthDate).toLocaleDateString('fr-FR') : '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Profession</label>
              <p className="text-neutral-900">{tenant.profession || '-'}</p>
            </div>
          </div>
        </div>

        {/* Adresse */}
        {tenant.address && (
          <div className="bg-base-100 rounded-lg shadow-sm border border-neutral-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">Adresse</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Adresse</label>
                <p className="text-neutral-900">{tenant.address}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Ville</label>
                <p className="text-neutral-900">{tenant.city || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Code postal</label>
                <p className="text-neutral-900">{tenant.postalCode || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Pays</label>
                <p className="text-neutral-900">{tenant.country || 'France'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions rapides */}
        <div className="bg-base-100 rounded-lg shadow-sm border border-neutral-200 p-6">
          <h2 className="text-xl font-semibold text-neutral-900 mb-4">Actions rapides</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/leases-tenants?tab=leases&tenantId=${tenant.id}`}
              className="flex items-center space-x-3 p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <FileText size={20} className="text-primary" />
              <div>
                <p className="font-medium text-neutral-900">Voir les baux</p>
                <p className="text-sm text-neutral-600">Consulter l'historique des baux</p>
              </div>
            </Link>
            <Link
              href={`/transactions?tenantId=${tenant.id}`}
              className="flex items-center space-x-3 p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <Receipt size={20} className="text-success" />
              <div>
                <p className="font-medium text-neutral-900">Voir les transactions</p>
                <p className="text-sm text-neutral-600">Consulter l'historique des paiements</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Modale d'édition */}
        <TenantFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          tenant={tenant}
        />
        
        {/* Dialog de garde */}
        {deletionGuard.dialog}
      </div>
    </div>
  );
}
