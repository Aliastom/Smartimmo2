'use client';

import React, { useState, useEffect } from 'react';
import { Property } from '../../domain/entities/Property';
import { Transaction } from '../../domain/entities/Transaction';
import DocumentUpload from './DocumentUpload';

interface DocumentUploadFormProps {
  properties: Property[];
  transactions: Transaction[];
  docTypes: Array<{ value: string; label: string }>;
  onUpload: (files: File[], docType: string, propertyId?: string, transactionId?: string) => void;
  onCancel: () => void;
  lockedPropertyId?: string; // Nouvelle prop pour verrouiller la propriété
  defaultDocType?: string; // Type de document par défaut
}

export default function DocumentUploadForm({ 
  properties, 
  transactions, 
  docTypes, 
  onUpload, 
  onCancel,
  lockedPropertyId,
  defaultDocType = 'other'
}: DocumentUploadFormProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [docType, setDocType] = useState(defaultDocType);
  const [propertyId, setPropertyId] = useState(lockedPropertyId || '');
  const [transactionId, setTransactionId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>(transactions);

  // Filtrer les transactions quand une propriété est sélectionnée
  useEffect(() => {
    if (propertyId) {
      const filtered = transactions.filter(t => t.propertyId === propertyId);
      setFilteredTransactions(filtered);
      // Réinitialiser la transaction sélectionnée si elle n'appartient pas à la propriété
      if (transactionId && !filtered.find(t => t.id === transactionId)) {
        setTransactionId('');
      }
    } else {
      setFilteredTransactions(transactions);
    }
  }, [propertyId, transactions, transactionId]);

  // Récupérer la propriété liée quand une transaction est sélectionnée
  useEffect(() => {
    if (transactionId) {
      const transaction = transactions.find(t => t.id === transactionId);
      if (transaction) {
        setPropertyId(transaction.propertyId);
      }
    }
  }, [transactionId, transactions]);

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) {
      // Si aucun fichier sélectionné, appeler onUpload avec un tableau vide
      await onUpload([], docType, propertyId || undefined, transactionId || undefined);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const totalFiles = selectedFiles.length;
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (!file) continue;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('docType', docType || 'other');
        if (propertyId) formData.append('propertyId', propertyId);
        if (transactionId) formData.append('transactionId', transactionId);

        const response = await fetch('/api/uploads', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        // Mettre à jour la progression
        setUploadProgress(((i + 1) / totalFiles) * 100);
      }
      
      await onUpload(
        selectedFiles, 
        docType, 
        propertyId || undefined, 
        transactionId || undefined
      );
      
      // Reset du formulaire
      setSelectedFiles([]);
      setPropertyId(lockedPropertyId || '');
      setTransactionId('');
      setDocType(defaultDocType);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Type de document */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Type de document
        </label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-primary-700 focus:border-primary-700"
        >
          {docTypes.filter(type => type.value !== '').map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {/* Association optionnelle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Bien associé (optionnel)
          </label>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            disabled={!!transactionId || !!lockedPropertyId}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-primary-700 focus:border-primary-700 disabled:bg-base-200 disabled:cursor-not-allowed"
          >
            <option value="">Aucun bien</option>
            {properties.map(property => (
              <option key={property.id} value={property.id}>{property.name}</option>
            ))}
          </select>
          {transactionId && (
            <p className="text-xs text-base-content opacity-70 mt-1">Le bien est automatiquement lié à la transaction sélectionnée</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Transaction associée (optionnel)
          </label>
          <select
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-primary-700 focus:border-primary-700"
          >
            <option value="">Aucune transaction</option>
            {filteredTransactions.map(transaction => (
              <option key={transaction.id} value={transaction.id}>{transaction.label}</option>
            ))}
          </select>
          {propertyId && (
            <p className="text-xs text-base-content opacity-70 mt-1">Seules les transactions de ce bien sont affichées</p>
          )}
        </div>
      </div>

      {/* Zone d'upload */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Fichiers à uploader
        </label>
        <DocumentUpload onUpload={handleFilesSelected} />
        {selectedFiles.length > 0 && (
          <div className="mt-2 text-sm text-neutral-600">
            {selectedFiles.length} fichier(s) sélectionné(s)
          </div>
        )}
      </div>

      {/* Barre de progression */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-neutral-600">
            <span>Upload en cours...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full bg-base-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Boutons d'action */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-neutral-700 bg-neutral-100 rounded-md hover:bg-neutral-200 transition"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          disabled={isUploading}
          className="px-4 py-2 bg-primary text-base-100 rounded-md hover:bg-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Upload en cours...' : `Uploader ${selectedFiles.length} fichier(s)`}
        </button>
      </div>
    </div>
  );
}
