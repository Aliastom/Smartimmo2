'use client';

import React, { useState } from 'react';
import { useLeases, useDeleteLease, type Lease } from '../hooks/useLeases';
import LeaseRowActions from './LeaseRowActions';
import { useDeletionGuard } from '../hooks/useDeletionGuard';

interface LeasesTableProps {
  filters: any;
  search: string;
  page: number;
  onPageChange: (page: number) => void;
  onEdit: (lease: Lease) => void;
  onDelete: (lease: Lease) => void;
}

export default function LeasesTable({
  filters,
  search,
  page,
  onPageChange,
  onEdit,
  onDelete
}: LeasesTableProps) {
  const { data, isLoading, error } = useLeases({ filters, search, page, limit: 10 });
  const deleteLeaseMutation = useDeleteLease();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletionGuard = useDeletionGuard('lease');

  const handleDelete = async (lease: Lease) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le bail de ${lease.Tenant?.firstName} ${lease.Tenant?.lastName} ?`)) {
      setDeletingId(lease.id);
      try {
        const result = await deleteLeaseMutation.mutateAsync(lease.id);
        if (result.status === 409) {
          deletionGuard.openWith(result.payload, lease.id);
        } else {
          onDelete(lease);
        }
      } catch (error) {
        // L'erreur est gérée par le hook
      } finally {
        setDeletingId(null);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
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
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Bien
              </th>
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
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      lease.status === 'ACTIF' ? 'bg-green-100 text-green-800' :
                      lease.status === 'SIGNÉ' ? 'bg-blue-100 text-blue-800' :
                      lease.status === 'ENVOYÉ' ? 'bg-purple-100 text-purple-800' :
                      lease.status === 'RÉSILIÉ' ? 'bg-red-100 text-red-800' :
                      lease.status === 'ARCHIVÉ' ? 'bg-base-200 text-base-content' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {lease.status || 'BROUILLON'}
                    </span>
                    {lease.signedPdfUrl && (
                      <a
                        href={lease.signedPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:text-blue-800 underline"
                        title="Voir le PDF signé"
                      >
                        📄
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral-900">
                  <div>
                    <div>Début: {formatDate(lease.startDate)}</div>
                    {lease.endDate && (
                      <div>Fin: {formatDate(lease.endDate)}</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral-900">
                  {formatCurrency(lease.rentAmount)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral-900">
                  {lease.charges ? formatCurrency(lease.charges) : '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-neutral-900">
                  {lease.deposit ? formatCurrency(lease.deposit) : '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <LeaseRowActions
                    lease={lease}
                    onEdit={onEdit}
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
