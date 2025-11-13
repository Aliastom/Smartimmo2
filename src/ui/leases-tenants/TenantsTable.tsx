'use client';

import React, { useState } from 'react';
import { useTenants, useDeleteTenant, type Tenant } from '../hooks/useTenants';
import ActionButtons from '../components/ActionButtons';
import { useDeletionGuard } from '../hooks/useDeletionGuard';
import { getTenantStatusStyle } from '@/utils/tenantStatus';

interface TenantsTableProps {
  filters: any;
  search: string;
  page: number;
  onPageChange: (page: number) => void;
  onEdit: (tenant: Tenant) => void;
  onDelete: (tenant: Tenant) => void;
  onViewLeases: (tenant: Tenant) => void;
}

export default function TenantsTable({
  filters,
  search,
  page,
  onPageChange,
  onEdit,
  onDelete,
  onViewLeases
}: TenantsTableProps) {
  const { data, isLoading, error } = useTenants({ filters, search, page, limit: 10 });
  const deleteTenantMutation = useDeleteTenant();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletionGuard = useDeletionGuard('tenant');

  const handleDelete = async (tenant: Tenant) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le locataire ${tenant.firstName} ${tenant.lastName} ?`)) {
      setDeletingId(tenant.id);
      try {
        const result = await deleteTenantMutation.mutateAsync(tenant.id);
        if (result.status === 409) {
          deletionGuard.openWith(result.payload, tenant.id);
        } else {
          onDelete(tenant);
        }
      } catch (error) {
        // L'erreur est gérée par le hook
      } finally {
        setDeletingId(null);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-error">Erreur lors du chargement des locataires</p>
      </div>
    );
  }

  if (!data?.tenants.length) {
    return (
      <div className="text-center py-8">
        <p className="text-neutral-500">Aucun locataire trouvé</p>
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-lg border border-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Nom
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Téléphone
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Baux actifs
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {data.tenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-neutral-50 transition">
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-neutral-900">
                    {tenant.firstName} {tenant.lastName}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-neutral-900">
                    {tenant.email}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-neutral-900">
                    {tenant.phone || '-'}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const status = (tenant as any).computedStatus || 'INACTIF';
                      const style = getTenantStatusStyle(status);
                      const activeCount = (tenant as any).activeLeaseCount || 0;
                      const futureCount = (tenant as any).futureLeaseCount || 0;
                      const draftCount = (tenant as any).draftLeaseCount || 0;
                      const totalCount = activeCount + futureCount + draftCount;
                      
                      return (
                        <>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                          {totalCount > 0 && (
                            <button
                              onClick={() => onViewLeases(tenant)}
                              className="text-primary hover:text-blue-800 text-xs underline"
                            >
                              Voir les baux ({totalCount})
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <ActionButtons
                    onEdit={() => onEdit(tenant)}
                    onDelete={() => handleDelete(tenant)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.pages > 1 && (
        <div className="bg-base-100 px-4 py-3 border-t border-neutral-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-neutral-300 text-sm font-medium rounded-md text-neutral-700 bg-base-100 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page === data.pages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-neutral-300 text-sm font-medium rounded-md text-neutral-700 bg-base-100 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-neutral-700">
                  Affichage de <span className="font-medium">{(page - 1) * 10 + 1}</span> à{' '}
                  <span className="font-medium">{Math.min(page * 10, data.total)}</span> sur{' '}
                  <span className="font-medium">{data.total}</span> résultats
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-neutral-300 bg-base-100 text-sm font-medium text-neutral-500 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Précédent
                  </button>
                  {Array.from({ length: Math.min(5, data.pages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(data.pages - 4, page - 2)) + i;
                    if (pageNum > data.pages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => onPageChange(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          pageNum === page
                            ? 'z-10 bg-blue-50 border-primary text-primary'
                            : 'bg-base-100 border-neutral-300 text-neutral-500 hover:bg-neutral-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === data.pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-neutral-300 bg-base-100 text-sm font-medium text-neutral-500 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}
      {deletionGuard.dialog}
    </div>
  );
}
