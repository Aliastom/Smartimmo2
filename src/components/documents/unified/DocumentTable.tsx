'use client';

import React from 'react';
import { 
  Table, 
  TableHeader, 
  TableHeaderCell, 
  TableBody, 
  TableRow, 
  TableCell 
} from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { 
  FileText, 
  Image, 
  File, 
  Download, 
  Eye, 
  MoreVertical,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle,
  Trash2,
  Edit
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface DocumentTableRow {
  id: string;
  fileName: string;
  filenameOriginal: string;
  documentType?: {
    id: string;
    label: string;
    code: string;
  };
  status: string;
  size: number;
  mime: string;
  createdAt: Date | string;
  linkedTo?: string;
  linkedId?: string;
  property?: { id: string; name: string };
  lease?: { id: string; rentAmount: number };
  transaction?: { id: string; label: string };
  links?: Array<{
    id: string;
    linkedType: string;
    linkedId?: string;
    entityName?: string;
    role?: string;
  }>;
  ocrStatus?: string;
  deletedAt?: Date | string | null;
  userReason?: string; // Raison utilisateur (ex: "doublon_conserve_manuellement")
}

interface DocumentTableProps {
  documents: DocumentTableRow[];
  onView?: (doc: DocumentTableRow) => void;
  onEdit?: (doc: DocumentTableRow) => void;
  onDownload?: (doc: DocumentTableRow) => void;
  onDelete?: (doc: DocumentTableRow) => void;
  onSelect?: (docId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  selectedIds?: Set<string>;
  showSelection?: boolean;
  showLinkedTo?: boolean;
  loading?: boolean;
}

export function DocumentTable({
  documents,
  onView,
  onEdit,
  onDownload,
  onDelete,
  onSelect,
  onSelectAll,
  selectedIds = new Set(),
  showSelection = false,
  showLinkedTo = true,
  loading = false,
}: DocumentTableProps) {
  const getDocumentIcon = (mime: string) => {
    if (mime.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (mime.includes('image')) return <Image className="h-5 w-5 text-blue-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const getOcrBadge = (doc: DocumentTableRow) => {
    const ocrStatus = doc.ocrStatus || 'unknown';
    
    // Mapper les statuts OCR
    const statusMap: Record<string, { variant: any; label: string; icon?: any }> = {
      completed: { variant: 'success', label: 'Traité', icon: CheckCircle },
      processed: { variant: 'success', label: 'Traité', icon: CheckCircle },
      success: { variant: 'success', label: 'Traité', icon: CheckCircle }, // Alias
      failed: { variant: 'destructive', label: 'Échoué', icon: AlertCircle },
      pending: { variant: 'warning', label: 'En attente', icon: AlertCircle },
      unknown: { variant: 'secondary', label: 'N/A', icon: null },
    };

    const config = statusMap[ocrStatus] || { variant: 'secondary', label: 'Non traité', icon: null };
    const Icon = config.icon;

    return (
      <div className="flex flex-col gap-1">
        <Badge variant={config.variant}>
          {Icon && <Icon className="h-3 w-3 mr-1" />}
          {config.label}
        </Badge>
      </div>
    );
  };

  const getLinkedToLabel = (doc: DocumentTableRow) => {
    // Utiliser le nouveau système de liens polymorphiques
    if (doc.DocumentLink && doc.DocumentLink.length > 0) {
      if (doc.DocumentLink.length === 1) {
        // Une seule liaison - afficher le détail
        const link = doc.DocumentLink[0];
        const getEntityLabel = (linkedType: string) => {
          switch (linkedType) {
            case 'property': return 'Bien';
            case 'lease': return 'Bail';
            case 'tenant': return 'Locataire';
            case 'transaction': return 'Transaction';
            case 'global': return 'Global';
            default: return linkedType;
          }
        };

        return (
          <div className="flex items-center gap-1 text-sm">
            <LinkIcon className="h-3 w-3" />
            <span className="text-gray-600">{getEntityLabel(link.linkedType)}:</span>
            {link.entityName ? (
              <span className="font-medium">{link.entityName}</span>
            ) : (
              <span className="font-medium">{link.linkedType}</span>
            )}
          </div>
        );
      } else {
        // Plusieurs liaisons - afficher "Multiple"
        return (
          <div className="flex items-center gap-1 text-sm">
            <LinkIcon className="h-3 w-3" />
            <span className="font-medium text-blue-600">Multiple</span>
            <span className="text-gray-500 text-xs">({doc.DocumentLink.length})</span>
          </div>
        );
      }
    }

    // Fallback sur l'ancien système pour compatibilité
    if (doc.Property) {
      return (
        <div className="flex items-center gap-1 text-sm">
          <LinkIcon className="h-3 w-3" />
          <span className="text-gray-600">Bien:</span>
          <span className="font-medium">{doc.Property.name}</span>
        </div>
      );
    }
    if (doc.lease) {
      return (
        <div className="flex items-center gap-1 text-sm">
          <LinkIcon className="h-3 w-3" />
          <span className="text-gray-600">Bail</span>
        </div>
      );
    }
    if (doc.transaction) {
      return (
        <div className="flex items-center gap-1 text-sm">
          <LinkIcon className="h-3 w-3" />
          <span className="text-gray-600">Transaction:</span>
          <span className="font-medium">{doc.transaction.label}</span>
        </div>
      );
    }
    
    return <span className="text-gray-400 text-sm">Global</span>;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
        <p className="text-gray-500 mt-4">Chargement...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Aucun document trouvé</p>
      </div>
    );
  }

  return (
    <Table hover>
      <TableHeader>
        <TableRow>
          {showSelection && (
            <TableHeaderCell>
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={selectedIds.size === documents.length && documents.length > 0}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = selectedIds.size > 0 && selectedIds.size < documents.length;
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  const shouldSelectAll = e.target.checked;
                  if (onSelectAll) {
                    onSelectAll(shouldSelectAll);
                  } else {
                    // Fallback: utiliser l'ancienne logique si onSelectAll n'est pas fourni
                    documents.forEach(doc => {
                      const isCurrentlySelected = selectedIds.has(doc.id);
                      if (shouldSelectAll && !isCurrentlySelected) {
                        onSelect?.(doc.id, true);
                      } else if (!shouldSelectAll && isCurrentlySelected) {
                        onSelect?.(doc.id, false);
                      }
                    });
                  }
                }}
              />
            </TableHeaderCell>
          )}
          <TableHeaderCell>Document</TableHeaderCell>
          <TableHeaderCell>Type</TableHeaderCell>
          <TableHeaderCell>OCR</TableHeaderCell>
          {showLinkedTo && <TableHeaderCell>Lié à</TableHeaderCell>}
          <TableHeaderCell>Taille</TableHeaderCell>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow 
            key={doc.id}
            className={`${doc.deletedAt ? 'opacity-50' : ''} cursor-pointer hover:bg-gray-50`}
            onClick={() => onView?.(doc)}
          >
            {showSelection && (
              <TableCell onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={selectedIds.has(doc.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelect?.(doc.id, e.target.checked);
                  }}
                />
              </TableCell>
            )}
            <TableCell>
              <div className="flex items-center gap-3">
                {getDocumentIcon(doc.mime)}
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {doc.filenameOriginal}
                  </div>
                  {doc.ocrStatus === 'failed' && (
                    <div className="flex items-center gap-1 text-xs text-orange-600 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>OCR échoué</span>
                    </div>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                {doc.DocumentType ? (
                  <Badge variant="default">{doc.DocumentType.label}</Badge>
                ) : (
                  <Badge variant="secondary">Non classé</Badge>
                )}
                {doc.userReason === 'doublon_conserve_manuellement' && (
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                    Copie autorisée manuellement
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              {getOcrBadge(doc)}
            </TableCell>
            {showLinkedTo && (
              <TableCell>
                {getLinkedToLabel(doc)}
              </TableCell>
            )}
            <TableCell>
              <span className="text-sm text-gray-500">
                {formatFileSize(doc.size)}
              </span>
            </TableCell>
            <TableCell>
              <span className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(doc.createdAt), {
                  addSuffix: true,
                  locale: fr,
                })}
              </span>
            </TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(doc);
                  }}
                  title="Modifier"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(doc);
                  }}
                  title="Supprimer"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

