'use client';

import React, { useState, useEffect } from 'react';
import { Paperclip } from 'lucide-react';
import DocumentUpload from './DocumentUpload';
import DocumentList from './DocumentList';
import { Document } from '../../domain/entities/Document';

interface PropertyDocumentsPanelProps {
  propertyId: string;
  className?: string;
}

export default function PropertyDocumentsPanel({ 
  propertyId, 
  className = '' 
}: PropertyDocumentsPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, [propertyId]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/documents?propertyId=${propertyId}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: File[]) => {
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('propertyId', propertyId);
        formData.append('docType', 'other'); // Default type

        const response = await fetch('/api/uploads', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }
      }
      
      // Refresh documents list
      await fetchDocuments();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Erreur lors de l\'upload des fichiers');
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchDocuments();
      } else {
        alert('Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <Paperclip className="h-5 w-5 text-neutral-500" />
          <h3 className="text-lg font-medium text-neutral-900">Documents</h3>
        </div>
        <div className="text-center py-4 text-neutral-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-2">
        <Paperclip className="h-5 w-5 text-neutral-500" />
        <h3 className="text-lg font-medium text-neutral-900">Documents</h3>
        <span className="text-sm text-neutral-500">({documents.length})</span>
      </div>

      <DocumentUpload onUpload={handleUpload} />
      <DocumentList 
        documents={documents} 
        onDelete={handleDelete}
        showActions={true}
      />
    </div>
  );
}
