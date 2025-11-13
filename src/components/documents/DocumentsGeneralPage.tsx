'use client';

import React, { useState } from 'react';
import { Search, Filter, Upload as UploadIcon, MoreVertical, CheckSquare } from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';
import { useDocumentActions } from '@/hooks/useDocumentActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
import { DocumentModal } from './DocumentModal';
import { useDocumentTypes } from '@/hooks/useDocumentTypes';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function DocumentsGeneralPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | undefined>();
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const { openModalWithFileSelection } = useUploadReviewModal();
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { documents, loading, error, total, hasMore, refetch, fetchMore } = useDocuments({
    query: submittedQuery || undefined,
    type: selectedType,
    includeDeleted,
  });

  const { bulkOperation } = useDocumentActions();
  const { types: documentTypes } = useDocumentTypes();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedQuery(searchQuery);
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map(d => d.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(`Supprimer ${selectedIds.size} documents ?`)) {
      try {
        await bulkOperation(Array.from(selectedIds), 'delete');
        setSelectedIds(new Set());
        refetch();
      } catch (error) {
        console.error('Bulk delete error:', error);
      }
    }
  };

  const getDocumentIcon = (mime: string) => {
    if (mime.includes('pdf')) return '📄';
    if (mime.includes('image')) return '🖼️';
    return '📎';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">
            {total} document{total > 1 ? 's' : ''} au total
          </p>
        </div>
        <Button onClick={() => openModalWithFileSelection({
          scope: 'global',
          onSuccess: () => refetch()
        })}>
          <UploadIcon className="h-4 w-4 mr-2" />
          Uploader
        </Button>
      </div>


      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Recherchez et filtrez vos documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <form onSubmit={handleSearch} className="flex-1 min-w-64">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Rechercher par nom, texte, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="outline">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </form>

            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={selectedType || ''}
              onChange={(e) => setSelectedType(e.target.value || undefined)}
            >
              <option value="">Tous les types</option>
              {documentTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>

            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
              />
              <span className="ml-2 text-sm text-gray-700">Inclure supprimés</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <CheckSquare className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">
                {selectedIds.size} document{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={handleBulkDelete}>
                Supprimer
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Liste de tous vos documents</CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const showLoader = useLoadingDelay(loading);
            
            if (showLoader && documents.length === 0) {
              return (
                <div className="py-6">
                  <SkeletonList items={6} />
                </div>
              );
            }
            
            if (error) {
              return (
                <ErrorState
                  title="Erreur de chargement"
                  description={error}
                  onRetry={() => refetch()}
                />
              );
            }
            
            if (documents.length === 0 && !loading) {
              return (
                <EmptyState
                  title="Aucun document trouvé"
                  description="Commencez par uploader votre premier document"
                  actionLabel="Uploader un document"
                  onCreate={() => openModalWithFileSelection({
                    scope: 'global',
                    onSuccess: () => refetch()
                  })}
                />
              );
            }
            
            return (
            <>
              <Table hover>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={selectedIds.size === documents.length && documents.length > 0}
                        onChange={selectAll}
                      />
                    </TableHeaderCell>
                    <TableHeaderCell>Nom</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Taille</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Statut</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow 
                      key={doc.id}
                      className={`${doc.deletedAt ? 'opacity-50' : ''} cursor-pointer`}
                      onClick={() => setSelectedDocument(doc)}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={selectedIds.has(doc.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelection(doc.id);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getDocumentIcon(doc.mime)}</span>
                          <div>
                            <div className="font-medium text-gray-900">{doc.fileName}</div>
                            {doc.DocumentType && (
                              <Badge variant="secondary" className="text-xs">
                                {doc.DocumentType.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={doc.DocumentType ? "default" : "secondary"}>
                          {doc.DocumentType?.label || 'Non classé'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-500">
                          {(doc.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-500">
                          {formatDistanceToNow(new Date(doc.createdAt), { 
                            addSuffix: true, 
                            locale: fr 
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={doc.deletedAt ? "destructive" : "success"}>
                          {doc.deletedAt ? 'Supprimé' : 'Actif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDocument(doc);
                            }}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Load More */}
              {hasMore && (
                <div className="mt-6 text-center">
                  <Button 
                    variant="outline" 
                    onClick={fetchMore}
                    disabled={loading}
                  >
                    {loading ? 'Chargement...' : 'Charger plus'}
                  </Button>
                </div>
              )}
            </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Document Modal */}
      {selectedDocument && (
        <DocumentModal
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onUpdate={refetch}
        />
      )}
    </div>
  );
}