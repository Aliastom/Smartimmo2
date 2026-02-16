'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Search, FileText, Link as LinkIcon, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useDocumentsForLinkModal } from '@/features/documents/hooks/useDocumentsForLinkModal';
import type { DocumentForLink } from '@/features/documents/hooks/useDocumentsForLinkModal';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';

const PAGE_SIZE = 20;

export interface LinkExistingDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (document: DocumentForLink) => void;
  /** IDs déjà liés (exclus de la liste) */
  excludeDocumentIds?: string[];
  mode?: 'normal' | 'app-shell';
}

export function LinkExistingDocumentModal({
  isOpen,
  onClose,
  onSelect,
  excludeDocumentIds = [],
  mode = typeof window !== 'undefined' && window.location.pathname.startsWith('/app') ? 'app-shell' : 'normal',
}: LinkExistingDocumentModalProps) {
  const { organizationId } = useCurrentOrganization();
  const [selectedDoc, setSelectedDoc] = useState<DocumentForLink | null>(null);
  const [queryInput, setQueryInput] = useState('');

  const {
    documents,
    documentTypes,
    loading,
    error,
    page,
    total,
    totalPages,
    hasMore,
    setPage,
    setQuery,
    setTypeId,
    query,
    typeId,
    refetch,
  } = useDocumentsForLinkModal({
    mode,
    organizationId,
    excludeIds: excludeDocumentIds,
    enabled: isOpen && !!organizationId,
  });

  const typeLabel = useMemo(() => {
    if (!typeId) return 'Tous les types';
    return documentTypes.find((t) => t.id === typeId)?.label ?? 'Tous les types';
  }, [typeId, documentTypes]);

  const handleSearch = () => {
    setQuery(queryInput);
    setPage(1);
  };

  const handleLink = () => {
    if (selectedDoc) {
      onSelect(selectedDoc);
      onClose();
      setSelectedDoc(null);
    }
  };

  const handleClose = () => {
    setSelectedDoc(null);
    setQueryInput('');
    setQuery('');
    setTypeId('');
    setPage(1);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="flex flex-col max-w-2xl md:max-w-3xl max-h-[90vh] p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Lier un document existant
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-600 mb-4">
          Recherchez un document puis sélectionnez-le pour le lier.
        </p>

        {/* Barre de recherche + filtre type */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom, type..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
          <select
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-w-[180px]"
          >
            <option value="">Tous les types</option>
            {documentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={handleSearch}
            className="shrink-0"
          >
            Rechercher
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Liste des documents */}
          <div className="md:col-span-2 flex flex-col min-h-0 border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex-1 overflow-y-auto min-h-[240px]">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500 text-sm">
                  <FileText className="h-10 w-10 mb-2 opacity-50" />
                  Aucun document trouvé
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {documents.map((doc) => (
                    <li key={doc.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedDoc(doc)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                          selectedDoc?.id === doc.id
                            ? 'bg-orange-50 border-l-4 border-orange-500'
                            : 'hover:bg-gray-50 border-l-4 border-transparent'
                        }`}
                      >
                        <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {doc.fileName || doc.filenameOriginal || doc.id}
                          </p>
                          <p className="text-xs text-gray-500">
                            {doc.typeLabel} • {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50 text-sm">
                <span className="text-gray-600">
                  {total} document{total > 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-gray-700">
                    {page} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!hasMore}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Aperçu du document sélectionné */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex flex-col">
            <p className="text-sm font-medium text-gray-700 mb-2">Aperçu</p>
            {selectedDoc ? (
              <>
                <div className="flex items-start gap-2 mb-3">
                  <FileText className="h-8 w-8 text-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 break-words">
                      {selectedDoc.fileName || selectedDoc.filenameOriginal}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {selectedDoc.typeLabel} • {new Date(selectedDoc.uploadedAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start text-blue-600 hover:text-blue-800"
                  onClick={() => window.open(`/api/documents/${selectedDoc.id}/file`, '_blank')}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ouvrir le fichier
                </Button>
              </>
            ) : (
              <p className="text-sm text-gray-500 italic">Sélectionnez un document dans la liste.</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 mt-4">
          <Button type="button" variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleLink}
            disabled={!selectedDoc}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            Lier
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
