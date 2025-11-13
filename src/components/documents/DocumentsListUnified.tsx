/**
 * Composant réutilisable pour afficher une liste de documents
 * avec filtrage par contexte (GLOBAL, PROPERTY, LEASE, TENANT, TRANSACTION)
 */

import { useState, useEffect } from 'react';
import { DocumentContext, DocumentLink } from '@/types/document-link';
import { Button } from '@/ui/shared/button';
import { Input } from '@/ui/shared/input';
import { Badge } from '@/ui/shared/badge';
import { useAlert } from '@/hooks/useAlert';
import { 
  FileText, 
  Download, 
  Eye, 
  Trash2, 
  Link2, 
  Star, 
  Calendar,
  Search,
  Filter,
  MoreVertical,
  Pencil
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Document {
  id: string;
  filenameOriginal: string;
  mime: string;
  size: number;
  uploadedAt: Date | string;
  documentType?: {
    id: string;
    code: string;
    label: string;
  } | null;
  links?: DocumentLink[];
  // Champs legacy
  propertyId?: string | null;
  leaseId?: string | null;
  tenantId?: string | null;
  transactionId?: string | null;
}

interface DocumentsListUnifiedProps {
  context?: DocumentContext; // Filtre par contexte (optionnel)
  onDocumentClick?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  onDocumentUpdate?: (documentId: string) => void;
  showContextColumn?: boolean; // Afficher la colonne des rattachements
  showActions?: boolean; // Afficher les actions
}

export function DocumentsListUnified({
  context,
  onDocumentClick,
  onDocumentDelete,
  onDocumentUpdate,
  showContextColumn = true,
  showActions = true,
}: DocumentsListUnifiedProps) {
  const { showAlert, showConfirm } = useAlert();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [documentTypes, setDocumentTypes] = useState<Array<{ code: string; label: string }>>([]);

  // Charger les documents
  useEffect(() => {
    loadDocuments();
    loadDocumentTypes();
  }, [context]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      let endpoint = '/api/documents?include=documentType,links';
      
      // Filtrer par contexte si fourni
      if (context) {
        if (context.entityType === 'GLOBAL') {
          endpoint += '&linkedTo=global';
        } else if (context.entityType === 'PROPERTY' && context.entityId) {
          endpoint += `&propertyId=${context.entityId}`;
        } else if (context.entityType === 'LEASE' && context.entityId) {
          endpoint += `&leaseId=${context.entityId}`;
        } else if (context.entityType === 'TENANT' && context.entityId) {
          endpoint += `&tenantId=${context.entityId}`;
        } else if (context.entityType === 'TRANSACTION' && context.entityId) {
          endpoint += `&transactionId=${context.entityId}`;
        }
      }

      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Erreur de chargement');

      const data = await response.json();
      setDocuments(data.documents || data || []);
    } catch (error) {
      console.error('Erreur de chargement des documents:', error);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDocumentTypes = async () => {
    try {
      const response = await fetch('/api/admin/document-types?includeInactive=false');
      const data = await response.json();
      if (data.success) {
        setDocumentTypes(data.data.map((t: any) => ({
          code: t.code,
          label: t.label
        })));
      }
    } catch (error) {
      console.error('Erreur de chargement des types:', error);
    }
  };

  const handleDelete = async (documentId: string) => {
    const confirmed = await showConfirm({
      title: 'Supprimer le document',
      message: 'Êtes-vous sûr de vouloir supprimer ce document ?\n\nCette action est irréversible.',
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erreur de suppression');

      await showAlert({
        type: 'success',
        title: 'Document supprimé',
        message: 'Le document a été supprimé avec succès.',
      });

      // Recharger la liste
      loadDocuments();
      
      if (onDocumentDelete) {
        onDocumentDelete(documentId);
      }
    } catch (error) {
      console.error('Erreur de suppression:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: 'Erreur lors de la suppression du document.',
      });
    }
  };

  const handleSetPrimary = async (documentId: string) => {
    if (!context || context.entityType === 'GLOBAL') return;

    try {
      // Appel API pour mettre à jour isPrimary
      const response = await fetch(`/api/documents/${documentId}/set-primary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: context.entityType,
          entityId: context.entityId,
        }),
      });

      if (!response.ok) throw new Error('Erreur de mise à jour');

      // Recharger la liste
      loadDocuments();
    } catch (error) {
      console.error('Erreur de mise à jour:', error);
      alert('Erreur lors de la mise à jour du document');
    }
  };

  // Filtrer les documents
  const filteredDocuments = documents.filter(doc => {
    // Filtre par recherche
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!doc.filenameOriginal.toLowerCase().includes(search)) {
        return false;
      }
    }

    // Filtre par type
    if (selectedType && doc.DocumentType?.code !== selectedType) {
      return false;
    }

    return true;
  });

  // Obtenir le badge isPrimary pour un document
  const getPrimaryBadge = (doc: Document) => {
    if (!context || context.entityType === 'GLOBAL') return null;
    
    const link = doc.DocumentLink?.find(
      l => l.entityType === context.entityType && l.entityId === (context.entityId || null)
    );
    
    return link?.isPrimary ? (
      <Badge variant="default" className="text-xs">
        <Star className="h-3 w-3 mr-1" />
        Principal
      </Badge>
    ) : null;
  };

  // Obtenir les contextes d'un document
  const getDocumentContexts = (doc: Document): string[] => {
    const contexts: string[] = [];
    
    if (doc.DocumentLink && doc.DocumentLink.length > 0) {
      doc.DocumentLink.forEach(link => {
        if (link.entityType === 'GLOBAL') {
          contexts.push('Global');
        } else {
          contexts.push(link.entityType);
        }
      });
    } else {
      // Fallback sur les champs legacy
      if (doc.propertyId) contexts.push('PROPERTY');
      if (doc.leaseId) contexts.push('LEASE');
      if (doc.tenantId) contexts.push('TENANT');
      if (doc.transactionId) contexts.push('TRANSACTION');
      if (contexts.length === 0) contexts.push('Global');
    }
    
    return contexts;
  };

  const uploadedDate = (date: Date | string) => {
    return typeof date === 'string' ? new Date(date) : date;
  };

  return (
    <div className="space-y-4">
      {/* En-tête avec recherche et filtres */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Rechercher un document..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Tous les types</option>
          {documentTypes.map(type => (
            <option key={type.code} value={type.code}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Liste des documents */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600">Chargement...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            {searchTerm || selectedType ? 'Aucun document trouvé avec ces critères' : 'Aucun document'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                {showContextColumn && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rattachements
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Taille
                </th>
                {showActions && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDocuments.map((doc) => (
                <tr 
                  key={doc.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onDocumentClick && onDocumentClick(doc)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {doc.filenameOriginal}
                        </div>
                        {getPrimaryBadge(doc)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {doc.DocumentType ? (
                      <Badge variant="secondary" className="text-xs">
                        {doc.DocumentType.label}
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-400">Non classé</span>
                    )}
                  </td>
                  {showContextColumn && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {getDocumentContexts(doc).map((ctx, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {ctx}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      {format(uploadedDate(doc.uploadedAt), 'd MMM yyyy', { locale: fr })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatBytes(doc.size)}
                  </td>
                  {showActions && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/api/documents/${doc.id}/file`, '_blank');
                          }}
                          title="Voir"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {context && context.entityType !== 'GLOBAL' && !getPrimaryBadge(doc) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetPrimary(doc.id);
                            }}
                            title="Définir comme principal"
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(doc.id);
                          }}
                          title="Supprimer"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Fonction utilitaire pour formater les octets (si pas dans @/lib/utils)
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 octets';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['octets', 'Ko', 'Mo', 'Go', 'To'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

