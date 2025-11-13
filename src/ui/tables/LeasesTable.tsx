'use client';

import React from 'react';
import { Edit, Copy, Trash2, FileText, DollarSign, Download, Upload } from 'lucide-react';
import { Lease } from '../../domain/entities/Lease';
import { formatCurrencyEUR, formatDateFR } from '@/utils/format';
import { calculatePaymentStatus } from '../../lib/paymentStatus';

interface LeasesTableProps {
  leases: Lease[];
  loading?: boolean;
  onEdit?: (lease: Lease) => void;
  onDuplicate?: (lease: Lease) => void;
  onDelete?: (id: string) => void;
  onGeneratePdf?: (lease: Lease) => void;
  onGenerateReceipt?: (lease: Lease) => void;
  onAddPayment?: (lease: Lease) => void;
  onUploadSignedPdf?: (lease: Lease) => void;
  showPropertyColumn?: boolean;
  showPaymentStatus?: boolean;
}

export default function LeasesTable({
  leases,
  loading = false,
  onEdit,
  onDuplicate,
  onDelete,
  onGeneratePdf,
  onGenerateReceipt,
  onAddPayment,
  onUploadSignedPdf,
  showPropertyColumn = true,
  showPaymentStatus = true,
}: LeasesTableProps) {

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIF':
        return 'bg-green-100 text-green-800';
      case 'SIGNE':
        return 'bg-blue-100 text-blue-800';
      case 'TERMINE':
        return 'bg-base-200 text-base-content';
      case 'RESILIE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-base-200 text-base-content';
    }
  };

  const getPaymentStatusBadge = (status: 'paid' | 'partial' | 'unpaid') => {
    switch (status) {
      case 'paid':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Payé</span>;
      case 'partial':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">Partiel</span>;
      case 'unpaid':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Impayé</span>;
    }
  };

  if (loading) {
    return (
      <div className="bg-base-100 rounded-lg shadow-card p-6">
        <p className="text-neutral-500">Chargement...</p>
      </div>
    );
  }

  if (leases.length === 0) {
    return (
      <div className="bg-base-100 rounded-lg shadow-card p-6">
        <p className="text-neutral-500">Aucun bail trouvé.</p>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="bg-base-100 rounded-lg shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              {showPropertyColumn && (
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Bien
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Locataire
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Début
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Fin
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Loyer
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Statut
              </th>
              {showPaymentStatus && (
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Paiement
                </th>
              )}
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {leases.map((lease) => {
              const paymentStatus = showPaymentStatus 
                ? calculatePaymentStatus(
                    (lease as any).payments || [],
                    (lease.rent || 0) + (lease.charges || 0),
                    currentYear,
                    currentMonth
                  )
                : 'unpaid';

              return (
                <tr key={lease.id} className="hover:bg-neutral-50 transition-colors">
                  {showPropertyColumn && (
                    <td className="px-4 py-3 text-sm text-neutral-900">
                      {(lease as any).Property?.name || '-'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-neutral-900 font-medium">
                    {lease.tenantName || 'Locataire inconnu'}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600 whitespace-nowrap">
                    {formatDateFR(lease.startDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600 whitespace-nowrap">
                    {formatDateFR(lease.endDate)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-right whitespace-nowrap">
                    {formatCurrencyEUR((lease.rent || 0) + (lease.charges || 0))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lease.status)}`}>
                      {lease.status}
                    </span>
                  </td>
                  {showPaymentStatus && (
                    <td className="px-4 py-3 text-center">
                      {getPaymentStatusBadge(paymentStatus)}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center space-x-2">
                      {onGeneratePdf && (
                        <button
                          onClick={() => onGeneratePdf(lease)}
                          className="text-primary hover:text-blue-800 transition-colors"
                          title="Générer PDF"
                        >
                          <FileText size={16} />
                        </button>
                      )}
                      {onGenerateReceipt && lease.status === 'ACTIF' && (
                        <button
                          onClick={() => onGenerateReceipt(lease)}
                          className="text-success hover:text-green-800 transition-colors"
                          title="Quittance"
                        >
                          <Download size={16} />
                        </button>
                      )}
                      {onAddPayment && lease.status === 'ACTIF' && (
                        <button
                          onClick={() => onAddPayment(lease)}
                          className="text-purple-600 hover:text-purple-800 transition-colors"
                          title="Ajouter un paiement"
                        >
                          <DollarSign size={16} />
                        </button>
                      )}
                      {onUploadSignedPdf && ['SIGNE', 'ACTIF'].includes(lease.status) && (
                        <button
                          onClick={() => onUploadSignedPdf(lease)}
                          className="text-orange-600 hover:text-orange-800 transition-colors"
                          title="Téléverser PDF signé"
                        >
                          <Upload size={16} />
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(lease)}
                          className="text-primary hover:text-blue-800 transition-colors"
                          title="Éditer"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(lease.id)}
                          className="text-error hover:text-red-800 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

