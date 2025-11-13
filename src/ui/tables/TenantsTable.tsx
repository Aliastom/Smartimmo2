'use client';

import React from 'react';
import { Edit, Trash2, Mail, Phone } from 'lucide-react';
import { Tenant } from '../../domain/entities/Tenant';

interface TenantsTableProps {
  tenants: Tenant[];
  loading?: boolean;
  onEdit?: (tenant: Tenant) => void;
  onDelete?: (id: string) => void;
  showPropertyColumn?: boolean;
}

export default function TenantsTable({
  tenants,
  loading = false,
  onEdit,
  onDelete,
  showPropertyColumn = true,
}: TenantsTableProps) {

  if (loading) {
    return (
      <div className="bg-base-100 rounded-lg shadow-card p-6">
        <p className="text-neutral-500">Chargement...</p>
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="bg-base-100 rounded-lg shadow-card p-6">
        <p className="text-neutral-500">Aucun locataire trouvé.</p>
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-lg shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Nom
              </th>
              {showPropertyColumn && (
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Bien
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Téléphone
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Statut
              </th>
              {(onEdit || onDelete) && (
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-4 py-3 text-sm text-neutral-900 font-medium">
                  {tenant.firstName} {tenant.lastName}
                </td>
                {showPropertyColumn && (
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {(tenant as any).Property?.name || '-'}
                  </td>
                )}
                <td className="px-4 py-3 text-sm text-neutral-600">
                  {tenant.email ? (
                    <a
                      href={`mailto:${tenant.email}`}
                      className="flex items-center space-x-1 text-primary hover:text-blue-800"
                    >
                      <Mail size={14} />
                      <span>{tenant.email}</span>
                    </a>
                  ) : (
                    <span className="text-neutral-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-neutral-600">
                  {tenant.phone ? (
                    <a
                      href={`tel:${tenant.phone}`}
                      className="flex items-center space-x-1 text-primary hover:text-blue-800"
                    >
                      <Phone size={14} />
                      <span>{tenant.phone}</span>
                    </a>
                  ) : (
                    <span className="text-neutral-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center space-y-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      (tenant as any).Lease?.some((l: any) => l.status === 'ACTIF')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-base-200 text-base-content'
                    }`}>
                      {(tenant as any).Lease?.some((l: any) => l.status === 'ACTIF') ? 'Actif' : 'Inactif'}
                    </span>
                    {(tenant as any).Lease && (tenant as any).Lease.length > 0 && (
                      <span className="text-xs text-neutral-500">
                        {(tenant as any).Lease.filter((l: any) => l.status === 'ACTIF').length} bail
                        {(tenant as any).Lease.filter((l: any) => l.status === 'ACTIF').length > 1 ? 'x' : ''} actif
                        {(tenant as any).Lease.filter((l: any) => l.status === 'ACTIF').length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </td>
                {(onEdit || onDelete) && (
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(tenant)}
                          className="text-primary hover:text-blue-800 transition-colors"
                          title="Éditer"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(tenant.id)}
                          className="text-error hover:text-red-800 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

