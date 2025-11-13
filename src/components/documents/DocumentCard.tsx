'use client';

import React, { useState } from 'react';
import { 
  FileText, Download, Trash2, RefreshCw, AlertCircle, 
  CheckCircle, Clock, Tag, Link2, Calendar 
} from 'lucide-react';
import { Button } from '@/ui/shared/button';
import { Badge } from '@/ui/shared/badge';
import { useDocumentActions } from '@/hooks/useDocumentActions';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DocumentCardProps {
  document: any;
  onClose?: () => void;
  onUpdate?: () => void;
}

export function DocumentCard({ document, onClose, onUpdate }: DocumentCardProps) {
  const { 
    deleteDocument, 
    reclassify, 
    reextract, 
    createReminders,
    loading 
  } = useDocumentActions();

  const [selectedType, setSelectedType] = useState(document.documentTypeId);

  const handleDelete = async () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      try {
        await deleteDocument(document.id);
        onUpdate?.();
        onClose?.();
      } catch (error) {
        console.error('Error deleting document:', error);
      }
    }
  };

  const handleReclassify = async () => {
    try {
      await reclassify(document.id);
      onUpdate?.();
    } catch (error) {
      console.error('Error reclassifying:', error);
    }
  };

  const handleReextract = async () => {
    try {
      await reextract(document.id);
      onUpdate?.();
    } catch (error) {
      console.error('Error re-extracting:', error);
    }
  };

  const handleCreateReminders = async () => {
    try {
      await createReminders(document.id);
      onUpdate?.();
    } catch (error) {
      console.error('Error creating reminders:', error);
    }
  };

  const getConfidenceBadge = (confidence: number | null) => {
    if (confidence === null) return null;
    
    const percent = Math.round(confidence * 100);
    let variant: 'default' | 'secondary' | 'destructive' = 'default';
    
    if (percent >= 85) variant = 'default';
    else if (percent >= 60) variant = 'secondary';
    else variant = 'destructive';

    return (
      <Badge variant={variant} className="ml-2">
        {percent}%
      </Badge>
    );
  };

  const getOcrStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />OCR OK</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />En cours</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Échec</Badge>;
      default:
        return <Badge variant="secondary">En attente</Badge>;
    }
  };

  const tags = document.tagsArray || [];
  const alternatives = document.typeAlternativesArray || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {document.filenameNormalized || document.filenameOriginal}
            </h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{(document.size / 1024).toFixed(1)} KB</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(document.createdAt), { addSuffix: true, locale: fr })}</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={document.downloadUrl} download>
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </a>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleReclassify}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-classifier
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDelete}
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Preview */}
        {document.previewUrl && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Aperçu</h3>
            <img 
              src={document.previewUrl} 
              alt="Preview" 
              className="w-full border rounded-lg"
            />
          </div>
        )}

        {/* OCR Status */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Statut OCR</h3>
          {getOcrStatusBadge(document.ocrStatus)}
          {document.ocrError && (
            <p className="text-sm text-red-600 mt-2">{document.ocrError}</p>
          )}
        </div>

        {/* Type & Classification */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Type de document</h3>
          {document.DocumentType ? (
            <div>
              <div className="flex items-center">
                <span className="text-sm">{document.DocumentType.label}</span>
                {getConfidenceBadge(document.typeConfidence)}
              </div>
              
              {alternatives.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2">Alternatives suggérées:</p>
                  <div className="space-y-1">
                    {alternatives.map((alt: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{alt.typeLabel}</span>
                        <Badge variant="secondary">{Math.round(alt.confidence * 100)}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Type non déterminé</p>
          )}
        </div>

        {/* Extracted Fields */}
        {document.DocumentField && document.DocumentField.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-900">Champs détectés</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleReextract}
                disabled={loading}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Réextraire
              </Button>
            </div>
            <div className="space-y-2">
              {document.DocumentField.map((field: any) => (
                <div key={field.id} className="flex justify-between items-start p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-700">{field.fieldName}</p>
                    <p className="text-sm text-gray-900 mt-1">
                      {field.valueText || field.valueNum || 
                       (field.valueDate && new Date(field.valueDate).toLocaleDateString('fr-FR'))}
                    </p>
                  </div>
                  {field.confidence && (
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(field.confidence * 100)}%
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Tags</h3>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: string, i: number) => (
                <Badge key={i} variant="outline">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucun tag</p>
          )}
        </div>

        {/* Linked Entities */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Entités liées</h3>
          <div className="space-y-2">
            {document.Property && (
              <div className="flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Bien:</span>
                <span className="font-medium">{document.Property.name}</span>
              </div>
            )}
            {document.lease && (
              <div className="flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Bail:</span>
                <span className="font-medium">
                  {new Date(document.lease.startDate).toLocaleDateString('fr-FR')}
                </span>
              </div>
            )}
            {document.Tenant && (
              <div className="flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Locataire:</span>
                <span className="font-medium">
                  {document.Tenant.firstName} {document.Tenant.lastName}
                </span>
              </div>
            )}
            {!document.Property && !document.lease && !document.Tenant && (
              <p className="text-sm text-gray-500">Aucune entité liée</p>
            )}
          </div>
        </div>

        {/* Reminders */}
        {document.reminders && document.reminders.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-900">Rappels</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCreateReminders}
                disabled={loading}
              >
                <Calendar className="h-3 w-3 mr-1" />
                Recréer
              </Button>
            </div>
            <div className="space-y-2">
              {document.reminders.map((reminder: any) => (
                <div key={reminder.id} className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm font-medium text-gray-900">{reminder.title}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {new Date(reminder.dueDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

