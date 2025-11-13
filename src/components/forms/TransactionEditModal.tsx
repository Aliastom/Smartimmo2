// src/components/forms/TransactionEditModal.tsx
'use client';

import React from 'react';
import TransactionFormTabs from './TransactionFormTabs'; // Assuming this is the correct path

interface TransactionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>; // This onSubmit will be for updating
  transaction: any; // The transaction data to pre-fill
  properties?: any[]; // Pass properties, tenants, leases if available from parent
  tenants?: any[];
  leases?: any[];
}

export default function TransactionEditModal({
  isOpen,
  onClose,
  onSubmit,
  transaction,
  properties,
  tenants,
  leases
}: TransactionEditModalProps) {
  const [isDataReady, setIsDataReady] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && transaction) {
      setIsDataReady(false);
      
      // Attendre que toutes les données nécessaires soient disponibles
      const checkDataReady = async () => {
        try {
          // Vérifier que la transaction a toutes les données nécessaires
          if (!transaction.id || !transaction.propertyId || !transaction.nature) {
            return;
          }

          // Charger les catégories compatibles pour vérifier qu'elles sont disponibles
          const response = await fetch(`/api/categories?natureId=${transaction.nature}`);
          if (!response.ok) {
            return;
          }
          
          const categories = await response.json();
          if (!Array.isArray(categories) || categories.length === 0) {
            return;
          }

          // Attendre un petit délai pour s'assurer que tout est stable
          setTimeout(() => {
            setIsDataReady(true);
          }, 300);
          
        } catch (error) {
          console.error('Error preparing data for edit modal:', error);
          // En cas d'erreur, afficher quand même après un délai
          setTimeout(() => {
            setIsDataReady(true);
          }, 1000);
        }
      };

      checkDataReady();
    } else {
      setIsDataReady(false);
    }
  }, [isOpen, transaction]);

  if (!isOpen) return null;

  if (!isDataReady) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 max-w-sm w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mr-3"></div>
            <span className="text-gray-700">Préparation des données...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TransactionFormTabs
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit} // This onSubmit will be called by TransactionFormTabs
      title="Modifier la transaction"
      initialData={transaction} // Pass the existing transaction data
      properties={properties}
      tenants={tenants}
      leases={leases}
      isEditMode={true} // Indicate that it's an edit mode
    />
  );
}
