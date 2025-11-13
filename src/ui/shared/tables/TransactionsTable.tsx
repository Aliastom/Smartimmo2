'use client';

import React, { useState } from 'react';
import { Edit, Copy, Trash2, Paperclip } from 'lucide-react';
import { formatCurrencyEUR, formatDateFR } from '@/utils/format';
import TransactionCategoryBadge from '../components/TransactionCategoryBadge';
import AttachmentManager from '../components/AttachmentManager';
import { getAccountingTypeStyle } from '@/utils/accountingStyles';

interface TransactionsTableProps {
  payments: any[];
  loading?: boolean;
  context: 'global' | 'property';
  onEdit?: (payment: any) => void;
  onDuplicate?: (payment: any) => void;
  onDelete?: (id: string) => void;
  onAttachmentsChange?: () => void;
}

export default function TransactionsTable({
  payments,
  loading = false,
  context,
  onEdit,
  onDuplicate,
  onDelete,
  onAttachmentsChange,
}: TransactionsTableProps) {
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);

  const handleViewAttachments = (payment: any) => {
    setSelectedPayment(payment);
    setIsAttachmentModalOpen(true);
  };

  if (loading) {
    return (
      <div className="bg-base-100 rounded-lg shadow-card p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-neutral-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="bg-base-100 rounded-lg shadow-card p-6">
        <div className="text-center py-8">
          <p className="text-neutral-500">Aucune transaction trouvée</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-lg shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Date
              </th>
              {context === 'global' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Bien
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Libellé
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Catégorie
              </th>
              {context === 'property' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Période
                </th>
              )}
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Montant
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                PJ
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-base-100 divide-y divide-neutral-200">
            {payments.map((payment) => {
              const hasAttachments = payment.attachments && payment.attachments.length > 0;
              const attachmentCount = payment.attachments?.length || 0;

              return (
                <tr key={payment.id} className="hover:bg-neutral-50 transition-colors">
                  {/* Date */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                    {formatDateFR(new Date(payment.date))}
                  </td>

                  {/* Bien (global uniquement) */}
                  {context === 'global' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {payment.Property?.name || '-'}
                    </td>
                  )}

                  {/* Libellé + sous-libellés (locataire, catégorie) */}
                  <td className="px-6 py-4 text-sm text-neutral-900">
                    <div>{payment.label}</div>
                    {payment.lease && (
                      <div className="text-xs text-neutral-500 mt-1">
                        {payment.lease.tenantName || 'Locataire'}
                      </div>
                    )}
                    {payment.accountingCategory && (
                      <div className="text-xs text-neutral-600 mt-1 font-medium">
                        Catégorie : {payment.accountingCategory.name}
                      </div>
                    )}
                  </td>

                  {/* Nature + Catégorie */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      {/* Badge Nature (toujours affiché) */}
                      <TransactionCategoryBadge category={payment.nature} />
                      
                      {/* Catégorie comptable (si présente) */}
                      {payment.accountingCategory && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-neutral-700 font-medium">
                            {payment.accountingCategory.name}
                          </span>
                          {(() => {
                            const typeStyle = getAccountingTypeStyle(payment.accountingCategory.type);
                            return (
                              <span 
                                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}
                                title={`Type: ${typeStyle.label} • Déductible: ${payment.accountingCategory.isDeductible ? 'Oui' : 'Non'} • Capitalisable: ${payment.accountingCategory.isCapitalizable ? 'Oui' : 'Non'}`}
                              >
                                {typeStyle.label}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Période (property uniquement) */}
                  {context === 'property' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                      {new Date(payment.periodYear, payment.periodMonth - 1).toLocaleDateString('fr-FR', {
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                  )}

                  {/* Montant */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                    <span className={
                      ['LOYER', 'DEPOT_RECU', 'AVOIR'].includes(payment.Category)
                        ? 'text-success'
                        : 'text-error'
                    }>
                      {formatCurrencyEUR(payment.amount)}
                    </span>
                  </td>

                  {/* PJ */}
                  <td className="px-6 py-4 text-center">
                    {hasAttachments ? (
                      <button
                        onClick={() => handleViewAttachments(payment)}
                        className="inline-flex items-center space-x-1 text-violet-700 hover:text-violet-800 transition-colors"
                        title="Voir les pièces jointes"
                      >
                        <Paperclip size={14} />
                        <span className="text-xs font-medium">{attachmentCount}</span>
                      </button>
                    ) : (
                      <span className="text-neutral-300">–</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(payment)}
                          className="text-primary hover:text-blue-800 transition-colors"
                          title="Éditer"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      {onDuplicate && (
                        <button
                          onClick={() => onDuplicate(payment)}
                          className="text-base-content opacity-80 hover:text-base-content transition-colors"
                          title="Dupliquer"
                        >
                          <Copy size={16} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(payment.id)}
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

      {/* Modal AttachmentManager */}
      {selectedPayment && (
        <AttachmentManager
          isOpen={isAttachmentModalOpen}
          onClose={() => {
            setIsAttachmentModalOpen(false);
            setSelectedPayment(null);
          }}
          paymentId={selectedPayment.id}
          attachments={selectedPayment.attachments || []}
          title={`Pièces jointes - ${selectedPayment.label}`}
          onAttachmentsChange={() => {
            setIsAttachmentModalOpen(false);
            setSelectedPayment(null);
            if (onAttachmentsChange) onAttachmentsChange();
          }}
        />
      )}
    </div>
  );
}

