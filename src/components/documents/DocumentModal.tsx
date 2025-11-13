'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Trash2, RefreshCw, AlertCircle, 
  CheckCircle, Clock, Tag, Link2, Calendar, Save
} from 'lucide-react';
import { useDocumentActions } from '@/hooks/useDocumentActions';
import { useToast } from '@/components/ui/Toast';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DocumentModalProps {
  document: any;
  documentTypes: Array<{ id: string; label: string; code: string }>;
  onClose: () => void;
  onUpdate: () => void;
}

export function DocumentModal({ document, documentTypes, onClose, onUpdate }: DocumentModalProps) {
  const { 
    updateDocument, 
    deleteDocument, 
    reclassify, 
    reextract, 
    createReminders,
    classifyLoading,
    saveLoading,
    loading 
  } = useDocumentActions();
  
  const { showToast } = useToast();

  // État local pour la modale
  const [selectedTypeId, setSelectedTypeId] = useState(document.documentTypeId || '');
  const [confidence, setConfidence] = useState(document.typeConfidence || 0);
  const [fields, setFields] = useState(document.DocumentField || []);
  const [originalTypeId, setOriginalTypeId] = useState(document.documentTypeId || '');

  // Mettre à jour l'état local quand le document change
  useEffect(() => {
    setSelectedTypeId(document.documentTypeId || '');
    setConfidence(document.typeConfidence || 0);
    setFields(document.DocumentField || []);
    setOriginalTypeId(document.documentTypeId || '');
  }, [document]);

  const handleDelete = async () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      try {
        await deleteDocument(document.id);
        showToast({
          type: 'success',
          title: 'Document supprimé',
          description: 'Le document a été supprimé avec succès',
        });
        onUpdate();
        onClose();
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Erreur de suppression',
          description: error.message || 'Impossible de supprimer le document',
        });
      }
    }
  };

  const handleReclassify = async () => {
    try {
      const result = await reclassify(document.id);
      
      // Mettre à jour l'état local sans fermer la modale
      setConfidence(result.confidence);
      
      if (result.confidence >= 0.85 && result.typeId) {
        setSelectedTypeId(result.typeId);
        showToast({
          type: 'success',
          title: 'Type suggéré automatiquement',
          description: `${result.label} (${Math.round(result.confidence * 100)}%)`,
        });
      } else {
        showToast({
          type: 'warning',
          title: 'Type à confirmer',
          description: `Confiance : ${Math.round(result.confidence * 100)}% - Veuillez vérifier`,
        });
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Reclassification impossible',
        description: error.message || 'Erreur lors de la reclassification',
      });
    }
  };

  const handleSave = async () => {
    try {
      await updateDocument(document.id, { documentTypeId: selectedTypeId });
      
      // Si le type a changé, relancer l'extraction et recharger les champs
      if (selectedTypeId !== originalTypeId) {
        try {
          await reextract(document.id);
          // Recharger le document pour obtenir les nouveaux champs
          const response = await fetch(`/api/documents/${document.id}`);
          if (response.ok) {
            const updatedDoc = await response.json();
            setFields(updatedDoc.DocumentField || []);
          }
        } catch (extractError) {
          console.warn('Extraction relancée mais échec du rechargement des champs');
        }
      }
      
      showToast({
        type: 'success',
        title: 'Type enregistré',
        description: 'Le type de document a été mis à jour',
      });
      
      onUpdate();
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Échec de l\'enregistrement',
        description: error.message || 'Impossible d\'enregistrer les modifications',
      });
    }
  };

  const handleReextract = async () => {
    try {
      await reextract(document.id);
      showToast({
        type: 'success',
        title: 'Extraction relancée',
        description: 'Les champs seront mis à jour prochainement',
      });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Erreur d\'extraction',
        description: error.message || 'Impossible de relancer l\'extraction',
      });
    }
  };

  const handleCreateReminders = async () => {
    try {
      await createReminders(document.id);
      showToast({
        type: 'success',
        title: 'Rappels créés',
        description: 'Les rappels ont été générés avec succès',
      });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Erreur de création des rappels',
        description: error.message || 'Impossible de créer les rappels',
      });
    }
  };

  const getConfidenceBadge = () => {
    if (confidence === 0) return null;
    
    const percent = Math.round(confidence * 100);
    let badgeClass = 'badge-outline';
    
    if (percent >= 85) badgeClass = 'badge-success';
    else if (percent >= 60) badgeClass = 'badge-warning';
    else badgeClass = 'badge-error';

    return (
      <div className={`badge ${badgeClass} ml-2`}>
        {percent}%
      </div>
    );
  };

  const getOcrStatusBadge = () => {
    switch (document.ocrStatus) {
      case 'success':
        return <div className="badge badge-success"><CheckCircle className="h-3 w-3 mr-1" />OCR OK</div>;
      case 'processing':
        return <div className="badge badge-warning"><Clock className="h-3 w-3 mr-1" />En cours</div>;
      case 'failed':
        return <div className="badge badge-error"><AlertCircle className="h-3 w-3 mr-1" />Échec</div>;
      default:
        return <div className="badge badge-ghost">En attente</div>;
    }
  };

  const truncateFilename = (filename: string, maxLength: number = 50) => {
    if (filename.length <= maxLength) return filename;
    return filename.substring(0, maxLength) + '...';
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box sm:max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-base-content mb-2">
              {truncateFilename(document.filenameNormalized || document.filenameOriginal)}
            </h3>
            <div className="flex items-center gap-2 text-sm text-base-content/70">
              <span>{(document.size / 1024).toFixed(1)} KB</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(document.createdAt), { addSuffix: true, locale: fr })}</span>
            </div>
          </div>
          <button 
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Status Badges */}
        <div className="flex gap-2 mb-4">
          {getOcrStatusBadge()}
          {getConfidenceBadge()}
        </div>

        {/* Document Type Selection */}
        <div className="mb-6">
          <label className="label">
            <span className="label-text font-medium">Type de document</span>
          </label>
          <select 
            className="select select-bordered w-full"
            value={selectedTypeId}
            onChange={(e) => setSelectedTypeId(e.target.value)}
          >
            <option value="">Sélectionner un type...</option>
            {documentTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Actions Bar */}
        <div className="flex gap-2 mb-6">
          <button 
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saveLoading || !selectedTypeId}
          >
            {saveLoading ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Enregistrer
          </button>
          
          <button 
            className="btn btn-outline btn-sm"
            onClick={handleReclassify}
            disabled={classifyLoading}
          >
            {classifyLoading ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Reclassifier (IA)
          </button>
          
          <button 
            className="btn btn-error btn-sm ml-auto"
            onClick={handleDelete}
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Supprimer
          </button>
        </div>

        {/* Preview */}
        {document.previewUrl && (
          <div className="mb-6">
            <h4 className="font-medium text-base-content mb-2">Aperçu</h4>
            <img 
              src={document.previewUrl} 
              alt="Preview" 
              className="w-full border border-base-300 rounded-lg"
            />
          </div>
        )}

        {/* Extracted Fields */}
        {fields.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-base-content">Champs détectés</h4>
              <button 
                className="btn btn-ghost btn-xs"
                onClick={handleReextract}
                disabled={loading}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Réextraire
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((field: any) => (
                <div key={field.id} className="flex justify-between items-start p-3 bg-base-200 rounded-lg">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-base-content/70">{field.fieldName}</p>
                    <p className="text-sm text-base-content mt-1">
                      {field.valueText || field.valueNum || 
                       (field.valueDate && new Date(field.valueDate).toLocaleDateString('fr-FR'))}
                    </p>
                  </div>
                  {field.confidence && (
                    <div className="badge badge-outline text-xs">
                      {Math.round(field.confidence * 100)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {document.tagsArray && document.tagsArray.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium text-base-content mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {document.tagsArray.map((tag: string, i: number) => (
                <div key={i} className="badge badge-outline">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked Entities */}
        {(document.Property || document.lease || document.Tenant) && (
          <div className="mb-6">
            <h4 className="font-medium text-base-content mb-2">Entités liées</h4>
            <div className="space-y-2">
              {document.Property && (
                <div className="flex items-center gap-2 text-sm">
                  <Link2 className="h-4 w-4 text-base-content/50" />
                  <span className="text-base-content/70">Bien:</span>
                  <span className="font-medium">{document.Property.name}</span>
                </div>
              )}
              {document.lease && (
                <div className="flex items-center gap-2 text-sm">
                  <Link2 className="h-4 w-4 text-base-content/50" />
                  <span className="text-base-content/70">Bail:</span>
                  <span className="font-medium">
                    {new Date(document.lease.startDate).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
              {document.Tenant && (
                <div className="flex items-center gap-2 text-sm">
                  <Link2 className="h-4 w-4 text-base-content/50" />
                  <span className="text-base-content/70">Locataire:</span>
                  <span className="font-medium">
                    {document.Tenant.firstName} {document.Tenant.lastName}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reminders */}
        {document.reminders && document.reminders.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-base-content">Rappels</h4>
              <button 
                className="btn btn-ghost btn-xs"
                onClick={handleCreateReminders}
                disabled={loading}
              >
                <Calendar className="h-3 w-3 mr-1" />
                Recréer
              </button>
            </div>
            <div className="space-y-2">
              {document.reminders.map((reminder: any) => (
                <div key={reminder.id} className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <p className="text-sm font-medium text-base-content">{reminder.title}</p>
                  <p className="text-xs text-base-content/70 mt-1">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {new Date(reminder.dueDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="modal-action">
          <button 
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            Fermer
          </button>
          <a 
            href={document.downloadUrl} 
            download
            className="btn btn-primary btn-sm"
          >
            <Download className="h-4 w-4 mr-1" />
            Télécharger
          </a>
        </div>
      </div>
    </div>
  );
}
