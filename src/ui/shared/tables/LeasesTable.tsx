'use client';

import React, { useState } from 'react';
import { useLeases, useDeleteLease, type Lease } from '../../hooks/useLeases';
import LeaseRowActions from '../../leases-tenants/LeaseRowActions';
import { formatDateFR, formatCurrencyEUR } from '@/utils/format';
import { getLeaseStatusDisplay } from '../../../domain/leases/status';
import { useDeletionGuard } from '../../hooks/useDeletionGuard';

interface LeasesTableProps {
  context?: 'global' | 'property';
  propertyId?: string;
  initialFilters?: {
    status?: string;
    type?: string;
    year?: number;
  };
  onEdit?: (lease: Lease) => void;
  onDelete?: (lease: Lease) => void;
}

export default function LeasesTable({
  context = 'global',
  propertyId,
  initialFilters = {},
  onEdit,
  onDelete
}: LeasesTableProps) {
  const [filters, setFilters] = useState(initialFilters);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletionGuard = useDeletionGuard('lease');

  // Construire les paramètres de requête
  const queryParams = {
    filters: {
      ...filters,
      ...(context === 'property' && propertyId ? { propertyId } : {})
    },
    search,
    page,
    limit: 10
  };

  const { data, isLoading, error } = useLeases(queryParams);
  const deleteLeaseMutation = useDeleteLease();

  const handleDelete = async (lease: Lease) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le bail de ${lease.Tenant?.firstName} ${lease.Tenant?.lastName} ?`)) {
      setDeletingId(lease.id);
      try {
        const result = await deleteLeaseMutation.mutateAsync(lease.id);
        if (result.status === 409) {
          deletionGuard.openWith(result.payload, lease.id);
        } else {
          onDelete?.(lease);
        }
      } catch (error) {
        // L'erreur est gérée par le hook
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
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
        <p className="text-error">Erreur lors du chargement des baux</p>
      </div>
    );
  }

  if (!data?.Lease.length) {
    return (
      <div className="text-center py-8">
        <p className="text-neutral-500">Aucun bail trouvé</p>
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-lg border border-neutral-200 overflow-hidden">
      {/* Filtres (seulement pour le contexte global) */}
      {context === 'global' && (
        <div className="p-4 border-b border-neutral-200">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Rechercher par locataire, bien..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value || undefined }))}
              className="px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              <option value="ACTIF">Actif</option>
              <option value="SIGNÉ">Signé</option>
              <option value="ENVOYÉ">Envoyé</option>
              <option value="RÉSILIÉ">Résilié</option>
              <option value="ARCHIVÉ">Archivé</option>
              <option value="BROUILLON">Brouillon</option>
            </select>
            <select
              value={filters.type || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value || undefined }))}
              className="px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les types</option>
              <option value="residential">Résidentiel</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0">
            <tr>
              {context === 'global' && (
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Bien
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Locataire
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Période
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Loyer HC
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Charges
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Dépôt
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {data.Lease.map((lease) => (
              <tr key={lease.id} className="hover:bg-neutral-50 transition">
                {context === 'global' && (
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-neutral-900">
                        {lease.Property?.name || 'N/A'}
                      </div>
                      <div className="text-sm text-neutral-500">
                        {lease.Property?.address || 'N/A'}
                      </div>
                    </div>
                  </td>
                )}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-neutral-900">
                      {lease.Tenant?.firstName} {lease.Tenant?.lastName}
                    </div>
                    <div className="text-sm text-neutral-500">
                      {lease.Tenant?.email}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {lease.type === 'residential' ? 'Résidentiel' : 'Commercial'}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {(() => {
                    const runtimeStatus = lease.runtimeStatus || 'draft';
                    const statusDisplay = getLeaseStatusDisplay(runtimeStatus);
                    return (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusDisplay.className}`}>
                        {statusDisplay.label}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral-900">
                  <div>
                    <div>Début: {formatDateFR(lease.startDate)}</div>
                    {lease.endDate && (
                      <div>Fin: {formatDateFR(lease.endDate)}</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral-900">
                  {formatCurrencyEUR(lease.rentAmount)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral-900">
                  {lease.charges ? formatCurrencyEUR(lease.charges) : '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral-900">
                  {lease.deposit ? formatCurrencyEUR(lease.deposit) : '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <LeaseRowActions
                    lease={lease}
                    onEdit={onEdit || (() => {})}
                    onDelete={handleDelete}
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
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-neutral-300 text-sm font-medium rounded-md text-neutral-700 bg-base-100 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
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
                    onClick={() => handlePageChange(page - 1)}
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
                        onClick={() => handlePageChange(pageNum)}
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
                    onClick={() => handlePageChange(page + 1)}
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
