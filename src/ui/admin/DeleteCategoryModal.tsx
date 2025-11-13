'use client';

import React, { useState, useEffect } from 'react';
import { X, Trash2, Archive, Merge, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface DeleteCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  Category: {
    id: string;
    label: string;
    type: string;
  } | null;
  compatibleCategories: Array<{
    id: string;
    label: string;
    type: string;
  }>;
}

interface CategoryUsage {
  Category: {
    id: string;
    label: string;
    type: string;
  };
  transactionsCount: number;
  isDefaultFor: Array<{
    natureCode: string;
    natureLabel: string;
  }>;
  hasRefs: boolean;
}

export default function DeleteCategoryModal({
  isOpen,
  onClose,
  onSuccess,
  category,
  compatibleCategories
}: DeleteCategoryModalProps) {
  const [usage, setUsage] = useState<CategoryUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [action, setAction] = useState<'archive' | 'merge' | 'delete'>('archive');
  const [targetCategoryId, setTargetCategoryId] = useState('');
  const [deletePermanently, setDeletePermanently] = useState(false);

  // Charger les informations d'usage de la catégorie
  useEffect(() => {
    if (isOpen && category) {
      loadCategoryUsage();
    }
  }, [isOpen, category]);

  const loadCategoryUsage = async () => {
    if (!category) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/categories/${category.id}/usage`);
      if (response.ok) {
        const usageData = await response.json();
        setUsage(usageData);
      } else {
        throw new Error('Erreur lors du chargement des informations');
      }
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;

    setIsSubmitting(true);

    try {
      let response;

      if (action === 'archive') {
        response = await fetch(`/api/categories/${category.id}/archive`, {
          method: 'POST'
        });
      } else if (action === 'merge') {
        if (!targetCategoryId) {
          throw new Error('Veuillez sélectionner une catégorie cible');
        }
        response = await fetch(`/api/categories/${category.id}/merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetCategoryId })
        });
      } else if (action === 'delete') {
        response = await fetch(`/api/categories/${category.id}`, {
          method: 'DELETE'
        });
      }

      if (!response || !response.ok) {
        const errorData = await response?.json();
        throw new Error(errorData?.error || 'Erreur lors de l\'opération');
      }

      const result = await response.json();
      
      let message = '';
      if (action === 'archive') {
        message = `Catégorie "${category.label}" archivée avec succès.`;
        if (result.removedDefaultsCount > 0) {
          message += ` ${result.removedDefaultsCount} référence(s) par défaut supprimée(s).`;
        }
      } else if (action === 'merge') {
        message = `Fusion terminée: ${result.migrations.transactionsCount} transaction(s) et ${result.migrations.defaultsCount} référence(s) migrée(s).`;
      } else if (action === 'delete') {
        message = `Catégorie "${category.label}" supprimée définitivement.`;
      }

      toast.success(message);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setAction('archive');
    setTargetCategoryId('');
    setDeletePermanently(false);
    setUsage(null);
    onClose();
  };

  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 bg-base-content bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">
            Supprimer / Archiver la catégorie
          </h2>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-neutral-600">Chargement des informations...</span>
            </div>
          ) : usage ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Informations sur la catégorie */}
              <div className="bg-neutral-50 p-4 rounded-md">
                <h3 className="font-medium text-neutral-900 mb-2">
                  Catégorie: "{category.label}"
                </h3>
                <div className="text-sm text-neutral-600 space-y-1">
                  <div>• {usage.transactionsCount} transaction(s) utilisant cette catégorie</div>
                  {usage.isDefaultFor.length > 0 && (
                    <div>• Catégorie par défaut pour {usage.isDefaultFor.length} nature(s)</div>
                  )}
                </div>
              </div>

              {/* Options d'action */}
              {usage.hasRefs ? (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Cette catégorie est utilisée. Choisissez une action :
                  </p>

                  {/* Archiver */}
                  <div className="flex items-start">
                    <input
                      type="radio"
                      id="archive"
                      name="action"
                      value="archive"
                      checked={action === 'archive'}
                      onChange={(e) => setAction(e.target.value as any)}
                      className="mt-1 h-4 w-4 text-primary focus:ring-blue-500 border-neutral-300"
                    />
                    <label htmlFor="archive" className="ml-3">
                      <div className="flex items-center">
                        <Archive className="h-4 w-4 text-primary mr-2" />
                        <span className="font-medium text-neutral-900">Archiver (recommandé)</span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">
                        Désactive la catégorie et supprime les références par défaut. 
                        Les transactions existantes conservent cette catégorie.
                      </p>
                    </label>
                  </div>

                  {/* Fusionner */}
                  {compatibleCategories.length > 0 && (
                    <div className="flex items-start">
                      <input
                        type="radio"
                        id="merge"
                        name="action"
                        value="merge"
                        checked={action === 'merge'}
                        onChange={(e) => setAction(e.target.value as any)}
                        className="mt-1 h-4 w-4 text-primary focus:ring-blue-500 border-neutral-300"
                      />
                      <label htmlFor="merge" className="ml-3 flex-1">
                        <div className="flex items-center">
                          <Merge className="h-4 w-4 text-success mr-2" />
                          <span className="font-medium text-neutral-900">Fusionner vers...</span>
                        </div>
                        <p className="text-sm text-neutral-600 mt-1 mb-2">
                          Migre toutes les transactions et références vers une autre catégorie.
                        </p>
                        {action === 'merge' && (
                          <select
                            value={targetCategoryId}
                            onChange={(e) => setTargetCategoryId(e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-primary"
                            required
                          >
                            <option value="">Sélectionner une catégorie...</option>
                            {compatibleCategories
                              .filter(cat => cat.id !== category.id)
                              .map(cat => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.label} ({cat.type})
                                </option>
                              ))}
                          </select>
                        )}
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Cette catégorie n'est pas utilisée. Vous pouvez l'archiver ou la supprimer définitivement.
                  </p>

                  {/* Archiver */}
                  <div className="flex items-start">
                    <input
                      type="radio"
                      id="archive"
                      name="action"
                      value="archive"
                      checked={action === 'archive'}
                      onChange={(e) => setAction(e.target.value as any)}
                      className="mt-1 h-4 w-4 text-primary focus:ring-blue-500 border-neutral-300"
                    />
                    <label htmlFor="archive" className="ml-3">
                      <div className="flex items-center">
                        <Archive className="h-4 w-4 text-primary mr-2" />
                        <span className="font-medium text-neutral-900">Archiver</span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">
                        Désactive la catégorie (recommandé).
                      </p>
                    </label>
                  </div>

                  {/* Supprimer définitivement */}
                  <div className="flex items-start">
                    <input
                      type="radio"
                      id="delete"
                      name="action"
                      value="delete"
                      checked={action === 'delete'}
                      onChange={(e) => setAction(e.target.value as any)}
                      className="mt-1 h-4 w-4 text-error focus:ring-red-500 border-neutral-300"
                    />
                    <label htmlFor="delete" className="ml-3">
                      <div className="flex items-center">
                        <Trash2 className="h-4 w-4 text-error mr-2" />
                        <span className="font-medium text-red-900">Supprimer définitivement</span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">
                        Supprime la catégorie de la base de données (irréversible).
                      </p>
                    </label>
                  </div>
                </div>
              )}

              {/* Avertissement pour la suppression définitive */}
              {action === 'delete' && (
                <div className="flex items-start p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertTriangle className="h-5 w-5 text-error mr-2 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">Attention !</p>
                    <p>Cette action est irréversible. La catégorie sera définitivement supprimée de la base de données.</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 bg-base-100 border border-neutral-300 rounded-md hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (action === 'merge' && !targetCategoryId)}
                  className={`px-4 py-2 text-sm font-medium text-base-100 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center ${
                    action === 'delete' 
                      ? 'bg-error hover:bg-red-700' 
                      : 'bg-primary hover:bg-primary'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {action === 'archive' ? 'Archivage...' : action === 'merge' ? 'Fusion...' : 'Suppression...'}
                    </>
                  ) : (
                    <>
                      {action === 'archive' ? (
                        <>
                          <Archive className="h-4 w-4 mr-2" />
                          Archiver
                        </>
                      ) : action === 'merge' ? (
                        <>
                          <Merge className="h-4 w-4 mr-2" />
                          Fusionner
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </>
                      )}
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-8">
              <p className="text-neutral-600">Erreur lors du chargement des informations</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
