'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useUnifiedTransactionModal } from '@/hooks/useUnifiedTransactionModal';
import UnifiedTransactionModal from '@/components/forms/UnifiedTransactionModal';

interface PropertyTransactionsWithUnifiedModalProps {
  propertyId: string;
  transactions: any[];
  leases: any[];
  onRefresh: () => void;
}

export default function PropertyTransactionsWithUnifiedModal({
  propertyId,
  transactions,
  leases,
  onRefresh
}: PropertyTransactionsWithUnifiedModalProps) {
  const {
    isOpen,
    context,
    mode,
    transactionId,
    title,
    openForProperty,
    openForEdit,
    close,
    handleSubmit
  } = useUnifiedTransactionModal({ onSuccess: onRefresh });

  const handleCreateTransaction = () => {
    openForProperty(propertyId);
  };

  const handleCreateTransactionFromLease = (leaseId: string) => {
    openForProperty(propertyId, leaseId, true);
  };

  const handleEditTransaction = (transaction: any) => {
    openForEdit(transaction.id, {
      type: 'property',
      propertyId: propertyId
    });
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
      try {
        await fetch(`/api/transactions/${transactionId}`, {
          method: 'DELETE',
        });
        onRefresh();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header avec boutons d'action */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Transactions</h3>
        <div className="flex gap-2">
          <Button
            onClick={handleCreateTransaction}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouvelle transaction
          </Button>
        </div>
      </div>

      {/* Liste des baux avec boutons pour créer des transactions */}
      {leases.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Créer une transaction pour un bail</h4>
          <div className="space-y-2">
            {leases.map((lease) => (
              <div key={lease.id} className="flex items-center justify-between bg-white p-3 rounded border">
                <div>
                  <span className="font-medium">
                    {lease.Tenant?.firstName} {lease.Tenant?.lastName}
                  </span>
                  <span className="text-gray-500 ml-2">
                    ({lease.status}) - {lease.rentAmount}€/mois
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreateTransactionFromLease(lease.id)}
                >
                  Créer transaction
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des transactions */}
      <div className="space-y-4">
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucune transaction pour ce bien
          </div>
        ) : (
          transactions.map((transaction) => (
            <div key={transaction.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900">{transaction.label}</h4>
                    <span className={`px-2 py-1 text-xs rounded ${
                      transaction.nature === 'LOYER' ? 'bg-green-100 text-green-800' :
                      transaction.nature === 'CHARGES' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {transaction.nature}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Date: {new Date(transaction.date).toLocaleDateString('fr-FR')}</div>
                    <div>Montant: {transaction.amount}€</div>
                    {transaction.lease && (
                      <div>Bail: {transaction.lease.Tenant?.firstName} {transaction.lease.Tenant?.lastName}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditTransaction(transaction)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTransaction(transaction.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal unifiée */}
      <UnifiedTransactionModal
        isOpen={isOpen}
        onClose={close}
        onSubmit={handleSubmit}
        context={context}
        mode={mode}
        transactionId={transactionId}
        title={title}
      />
    </div>
  );
}

