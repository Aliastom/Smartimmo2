'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DocumentTypeSchema, DocumentTypeAdmin } from '@/types/admin-documents';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Label } from '@/ui/shared/label';
import { Textarea } from '@/ui/shared/textarea';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Loader2, Save, X, Eye, EyeOff, Wand2 } from 'lucide-react';
import { DocumentTypeOCRConfig } from '@/components/admin/DocumentTypeOCRConfig';

interface DocumentTypeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType?: DocumentTypeAdmin;
  onSave: (data: DocumentTypeAdmin) => Promise<void>;
  isLoading?: boolean;
}

export default function DocumentTypeEditModal({
  isOpen,
  onClose,
  documentType,
  onSave,
  isLoading = false,
}: DocumentTypeEditModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    setValue,
  } = useForm<DocumentTypeAdmin>({
    resolver: zodResolver(DocumentTypeSchema),
    defaultValues: {
      code: '',
      label: '',
      description: '',
      icon: '📄',
      isActive: true,
      order: 0,
      isSensitive: false,
      autoAssignThreshold: 0.85,
      defaultContexts: '[]',
      suggestionConfig: '{}',
      lockInFlows: '[]',
      metadataSchema: '{}',
      openTransaction: false,
    },
  });

  // Réinitialiser le formulaire quand le documentType change
  useEffect(() => {
    if (documentType) {
      reset({
        ...documentType,
        defaultContexts: documentType.defaultContexts || '[]',
        suggestionConfig: documentType.suggestionConfig || '{}',
        lockInFlows: documentType.lockInFlows || '[]',
        metadataSchema: documentType.metadataSchema || '{}',
      });
      setShowAdvanced(false);
    } else {
      reset({
        code: '',
        label: '',
        description: '',
        icon: '📄',
        isActive: true,
        order: 0,
        isSensitive: false,
        autoAssignThreshold: 0.85,
        defaultContexts: '[]',
        suggestionConfig: '{}',
        lockInFlows: '[]',
        metadataSchema: '{}',
      });
    }
  }, [documentType, reset]);

  const onSubmit = async (data: DocumentTypeAdmin) => {
    try {
      setIsSubmitting(true);
      
      // Validation JSON pour les champs JSON
      try {
        JSON.parse(data.defaultContexts);
        JSON.parse(data.suggestionConfig);
        JSON.parse(data.lockInFlows);
        JSON.parse(data.metadataSchema);
      } catch (error) {
        alert('Erreur dans le format JSON des champs avancés');
        return;
      }

      await onSave(data);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde du type de document');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isDirty && !confirm('Voulez-vous vraiment fermer sans sauvegarder ?')) {
      return;
    }
    onClose();
  };

  const watchedFields = watch(['isActive', 'isSensitive', 'autoAssignThreshold']);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={documentType ? 'Modifier le type de document' : 'Nouveau type de document'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section de base */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Informations de base</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                {...register('code')}
                placeholder="ex: BAIL_SIGNE"
                disabled={!!documentType?.isSystem}
              />
              {errors.code && (
                <p className="text-sm text-red-600 mt-1">{errors.code.message}</p>
              )}
              {documentType?.isSystem && (
                <p className="text-sm text-gray-500 mt-1">Code système, non modifiable</p>
              )}
            </div>

            <div>
              <Label htmlFor="icon">Icône</Label>
              <Input
                id="icon"
                {...register('icon')}
                placeholder="📄"
                maxLength={4}
              />
              {errors.icon && (
                <p className="text-sm text-red-600 mt-1">{errors.icon.message}</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="label">Libellé *</Label>
            <Input
              id="label"
              {...register('label')}
              placeholder="ex: Bail Signé"
            />
            {errors.label && (
              <p className="text-sm text-red-600 mt-1">{errors.label.message}</p>
            )}
          </div>

          <div className="mt-4">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Description du type de document"
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label htmlFor="order">Ordre d'affichage</Label>
              <Input
                id="order"
                type="number"
                {...register('order', { valueAsNumber: true })}
                placeholder="0"
              />
              {errors.order && (
                <p className="text-sm text-red-600 mt-1">{errors.order.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="autoAssignThreshold">Seuil d'auto-assignation</Label>
              <Input
                id="autoAssignThreshold"
                type="number"
                step="0.01"
                min="0"
                max="1"
                {...register('autoAssignThreshold', { valueAsNumber: true })}
                placeholder="0.85"
              />
              {errors.autoAssignThreshold && (
                <p className="text-sm text-red-600 mt-1">{errors.autoAssignThreshold.message}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">Valeur entre 0 et 1 (défaut: 0.85)</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <div className="flex gap-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  {...register('isActive')}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Type actif</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  {...register('isSensitive')}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Type sensible</span>
              </label>
            </div>

            <label className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <input
                type="checkbox"
                {...register('openTransaction')}
                className="rounded border-gray-300"
              />
              <div className="flex-1">
                <span className="text-sm font-medium">🤖 Ouvrir la modale transaction automatiquement</span>
                <p className="text-xs text-gray-600 mt-1">
                  Active l'extraction OCR et l'ouverture automatique de la modale de transaction après upload
                </p>
              </div>
            </label>
          </div>
        </Card>

        {/* 🤖 Configuration OCR → Transaction */}
        {documentType && watch('openTransaction') && (
          <DocumentTypeOCRConfig 
            documentType={documentType}
            onUpdate={() => {
              console.log('Configuration OCR mise à jour');
            }}
          />
        )}

        {/* Section avancée */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Configuration avancée</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showAdvanced ? 'Masquer' : 'Afficher'}
            </Button>
          </div>

          {showAdvanced && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="defaultContexts">Contextes par défaut (JSON)</Label>
                <Textarea
                  id="defaultContexts"
                  {...register('defaultContexts')}
                  placeholder='["property", "lease"]'
                  rows={2}
                />
                {errors.defaultContexts && (
                  <p className="text-sm text-red-600 mt-1">{errors.defaultContexts.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="suggestionConfig">Configuration des suggestions (JSON)</Label>
                <Textarea
                  id="suggestionConfig"
                  {...register('suggestionConfig')}
                  placeholder='{"enabled": true, "threshold": 0.7}'
                  rows={3}
                />
                {errors.suggestionConfig && (
                  <p className="text-sm text-red-600 mt-1">{errors.suggestionConfig.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="lockInFlows">Verrouillage dans les flux (JSON)</Label>
                <Textarea
                  id="lockInFlows"
                  {...register('lockInFlows')}
                  placeholder='["upload", "classification"]'
                  rows={2}
                />
                {errors.lockInFlows && (
                  <p className="text-sm text-red-600 mt-1">{errors.lockInFlows.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="metadataSchema">Schéma de métadonnées (JSON)</Label>
                <Textarea
                  id="metadataSchema"
                  {...register('metadataSchema')}
                  placeholder='{"fields": ["amount", "date"], "required": ["amount"]}'
                  rows={4}
                />
                {errors.metadataSchema && (
                  <p className="text-sm text-red-600 mt-1">{errors.metadataSchema.message}</p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Aperçu en temps réel */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Aperçu</h3>
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">{watch('icon') || '📄'}</span>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium">{watch('label') || 'Nouveau type'}</span>
                <Badge variant={watchedFields[0] ? 'success' : 'secondary'}>
                  {watchedFields[0] ? 'Actif' : 'Inactif'}
                </Badge>
                {watchedFields[1] && (
                  <Badge variant="warning">Sensible</Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {watch('description') || 'Aucune description'}
              </p>
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                <span>Code: {watch('code') || 'N/A'}</span>
                <span>Ordre: {watch('order') || 0}</span>
                <span>Seuil: {((watchedFields[2] || 0.85) * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            <X className="w-4 h-4 mr-2" />
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
