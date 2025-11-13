'use client';

import React, { useState } from 'react';
import { Plus, User } from 'lucide-react';
import { getLeaseStatusDisplay } from '../../domain/leases/status';
import { Property } from '../../domain/entities/Property';
import { Lease } from '../../domain/entities/Lease';
import { Tenant } from '../../domain/entities/Tenant';
import DataTable from './DataTable';
import FormModal from './FormModal';
import ActionButtons from './ActionButtons';
import { formatCurrencyEUR, formatDateShort } from '@/utils/format';
import { useToast } from '../../hooks/useToast';
import { useRouter } from 'next/navigation';
import { useLeases } from '../../hooks/useLeases';

interface PropertyLeasesTabProps {
  property: Property;
  tenants: Tenant[];
  onUpdate: () => void;
  selectedLease?: any;
}

export default function PropertyLeasesTab({ property, tenants, onUpdate, selectedLease }: PropertyLeasesTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'tenants' | 'leases'>('leases');
  const { showSuccess, showError } = useToast();
  const router = useRouter();
  
  // Utiliser le hook useLeases avec le propertyId pour filtrer
  const { data: leasesData, isLoading: leasesLoading, error: leasesError } = useLeases({
    filters: { propertyId: property.id }
  });
  const leases = leasesData?.Lease || [];

  const getTenantName = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant ? `${tenant.firstName} ${tenant.lastName}` : 'Locataire inconnu';
  };

  const getLeaseStatus = (lease: Lease) => {
    // Utiliser le statut calculé côté serveur si disponible, sinon calculer côté client
    const runtimeStatus = lease.runtimeStatus || 'draft';
    return getLeaseStatusDisplay(runtimeStatus);
  };

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    try {
      formData.append('propertyId', property.id);
      
      const response = editingLease 
        ? await fetch(`/api/leases/${editingLease.id}`, {
            method: 'PUT',
            body: formData,
          })
        : await fetch('/api/leases', {
            method: 'POST',
            body: formData,
          });

      if (response.ok) {
        showSuccess('Bail sauvegardé', 'Le bail a été sauvegardé avec succès');
        setIsModalOpen(false);
        setEditingLease(null);
        onUpdate();
        router.refresh();
      } else {
        showError('Erreur', 'Erreur lors de la sauvegarde du bail');
      }
    } catch (error) {
      console.error('Error saving lease:', error);
      showError('Erreur', 'Une erreur inattendue est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (lease: Lease, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingLease(lease);
    setIsModalOpen(true);
  };

  const handleDelete = async (lease: Lease) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce bail ?')) {
      try {
        const response = await fetch(`/api/leases/${lease.id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          showSuccess('Bail supprimé', 'Le bail a été supprimé avec succès');
          onUpdate();
          router.refresh();
        } else {
          showError('Erreur', 'Erreur lors de la suppression du bail');
        }
      } catch (error) {
        console.error('Error deleting lease:', error);
        showError('Erreur', 'Une erreur inattendue est survenue');
      }
    }
  };

  const columns = [
    {
      key: 'tenantId' as keyof Lease,
      label: 'Locataire',
      render: (lease: Lease) => (
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-neutral-500" />
          <span>{getTenantName(lease.tenantId)}</span>
        </div>
      ),
    },
    {
      key: 'startDate' as keyof Lease,
      label: 'Début',
      sortable: true,
      render: (lease: Lease) => formatDateShort(lease.startDate)
    },
    {
      key: 'endDate' as keyof Lease,
      label: 'Fin',
      sortable: true,
      render: (lease: Lease) => lease.endDate ? formatDateShort(lease.endDate) : 'En cours'
    },
    {
      key: 'rentAmount' as keyof Lease,
      label: 'Loyer HC',
      sortable: true,
      render: (lease: Lease) => formatCurrencyEUR(lease.rentAmount)
    },
    {
      key: 'chargesAmount' as keyof Lease,
      label: 'Charges',
      sortable: true,
      render: (lease: Lease) => formatCurrencyEUR(lease.chargesAmount)
    },
    {
      key: 'depositAmount' as keyof Lease,
      label: 'Dépôt',
      sortable: true,
      render: (lease: Lease) => formatCurrencyEUR(lease.depositAmount)
    },
    {
      key: 'status' as keyof Lease,
      label: 'Statut',
      render: (lease: Lease) => {
        const status = getLeaseStatus(lease);
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        );
      },
    },
    {
      key: 'actions' as keyof Lease,
      label: 'Actions',
      render: (lease: Lease) => (
        <ActionButtons
          onEdit={(e) => handleEdit(lease, e)}
          onDelete={() => handleDelete(lease)}
        />
      ),
    },
  ];

  const tenantColumns = [
    { key: 'firstName' as keyof Tenant, label: 'Prénom', sortable: true },
    { key: 'lastName' as keyof Tenant, label: 'Nom', sortable: true },
    { key: 'email' as keyof Tenant, label: 'Email' },
    { key: 'phone' as keyof Tenant, label: 'Téléphone' },
    {
      key: 'actions' as keyof Tenant,
      label: 'Actions',
      render: (tenant: Tenant) => (
        <ActionButtons
          onEdit={() => console.log('Edit tenant:', tenant.id)}
          onDelete={() => console.log('Delete tenant:', tenant.id)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex space-x-4 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('tenants')}
          className={`py-2 px-4 text-sm font-medium ${
            activeTab === 'tenants'
              ? 'border-b-2 border-blue-600 text-primary'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Locataires ({tenants.length})
        </button>
        <button
          onClick={() => setActiveTab('leases')}
          className={`py-2 px-4 text-sm font-medium ${
            activeTab === 'leases'
              ? 'border-b-2 border-blue-600 text-primary'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Baux ({leases.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'tenants' ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-neutral-900">Locataires</h3>
            <button
              onClick={() => console.log('Add tenant')}
              className="flex items-center space-x-2 px-3 py-2 bg-primary text-base-100 rounded-md hover:bg-primary transition"
            >
              <Plus className="h-4 w-4" />
              <span>Locataire</span>
            </button>
          </div>
          {tenants.length > 0 ? (
            <DataTable
              columns={tenantColumns}
              data={tenants}
              searchPlaceholder="Rechercher un locataire..."
            />
          ) : (
            <div className="text-center py-8 bg-neutral-50 rounded-lg border border-neutral-200">
              <p className="text-neutral-500">Aucun locataire</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-neutral-900">Baux</h3>
            <button
              onClick={() => {
                setEditingLease(null);
                setIsModalOpen(true);
              }}
              className="flex items-center space-x-2 px-3 py-2 bg-primary text-base-100 rounded-md hover:bg-primary transition"
            >
              <Plus className="h-4 w-4" />
              <span>Nouveau bail</span>
            </button>
          </div>

          {/* Leases Table */}
          {leasesLoading ? (
            <div className="text-center py-8">
              <p className="text-neutral-500">Chargement des baux...</p>
            </div>
          ) : leasesError ? (
            <div className="text-center py-8">
              <p className="text-error">Erreur lors du chargement des baux</p>
            </div>
          ) : leases.length > 0 ? (
            <DataTable
              columns={columns}
              data={leases}
              searchPlaceholder="Rechercher un bail..."
            />
          ) : (
            <div className="text-center py-8 bg-neutral-50 rounded-lg border border-neutral-200">
              <p className="text-neutral-500">Aucun bail pour ce bien</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-2 text-primary hover:text-blue-800 font-medium"
              >
                Créer le premier bail
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <FormModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingLease(null);
        }} 
        title={editingLease ? "Modifier le bail" : "Nouveau bail"}
      >
        <LeaseForm
          property={property}
          tenants={tenants}
          lease={editingLease}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingLease(null);
          }}
          isLoading={isSubmitting}
        />
      </FormModal>
    </div>
  );
}

// Composant LeaseForm simplifié
function LeaseForm({ 
  property,
  tenants, 
  lease, 
  onSubmit, 
  onCancel, 
  isLoading 
}: {
  property: Property;
  tenants: Tenant[];
  lease: Lease | null;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    tenantId: lease?.tenantId || '',
    leaseType: lease?.leaseType || 'empty',
    startDate: lease?.startDate ? new Date(lease.startDate).toISOString().split('T')[0] : '',
    endDate: lease?.endDate ? new Date(lease.endDate).toISOString().split('T')[0] : '',
    rentAmount: lease?.rentAmount || 0,
    chargesAmount: lease?.chargesAmount || 0,
    depositAmount: lease?.depositAmount || 0,
    paymentDay: lease?.paymentDay || 1,
    status: lease?.status || 'active',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData();
    // Ajouter le propertyId en premier
    form.append('propertyId', property.id);
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        form.append(key, value.toString());
      }
    });
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Propriété *</label>
          <input
            type="text"
            value={`${property.name} - ${property.address}`}
            disabled
            className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-neutral-100 text-neutral-600 cursor-not-allowed"
          />
          <input type="hidden" name="propertyId" value={property.id} />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Locataire</label>
          <select
            value={formData.tenantId}
            onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
            required
          >
            <option value="">Sélectionner un locataire</option>
            {tenants.map(tenant => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.firstName} {tenant.lastName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Type de bail</label>
          <select
            value={formData.leaseType}
            onChange={(e) => setFormData({ ...formData, leaseType: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          >
            <option value="empty">Vide</option>
            <option value="furnished">Meublé</option>
            <option value="lmnp">LMNP</option>
            <option value="commercial">Commercial</option>
            <option value="garage">Garage</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Date de début</label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Date de fin (optionnel)</label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Loyer HC (€)</label>
          <input
            type="number"
            step="0.01"
            value={formData.rentAmount}
            onChange={(e) => setFormData({ ...formData, rentAmount: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Charges (€)</label>
          <input
            type="number"
            step="0.01"
            value={formData.chargesAmount}
            onChange={(e) => setFormData({ ...formData, chargesAmount: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Dépôt de garantie (€)</label>
          <input
            type="number"
            step="0.01"
            value={formData.depositAmount}
            onChange={(e) => setFormData({ ...formData, depositAmount: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Jour de paiement</label>
          <input
            type="number"
            min="1"
            max="31"
            value={formData.paymentDay}
            onChange={(e) => setFormData({ ...formData, paymentDay: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-neutral-700 bg-neutral-100 rounded-md hover:bg-neutral-200 transition"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-primary text-base-100 rounded-md hover:bg-primary transition disabled:opacity-50"
        >
          {isLoading ? 'Sauvegarde...' : (lease ? 'Modifier' : 'Créer')}
        </button>
      </div>
    </form>
  );
}
