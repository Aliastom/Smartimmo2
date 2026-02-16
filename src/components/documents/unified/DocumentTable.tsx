'use client';

import React, { memo, useState } from 'react';
import { 
  Table, 
  TableHeader, 
  TableHeaderCell, 
  TableBody, 
  TableRow, 
  TableCell 
} from '@/components/ui/Table';
import { TableV2, TableHeaderV2, TableHeaderCellV2, TableBodyV2, TableRowV2, TableCellV2 } from '@/components/ui2/TableV2';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { 
  FileText, 
  Image, 
  File, 
  Download, 
  MoreVertical,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle,
  Trash2,
  Edit,
  Loader2,
  Star
} from 'lucide-react';
import { useUI2 } from '@/hooks/useUI2';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/utils/cn';

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
  isFavorite?: boolean;
}

interface DocumentTableProps {
  documents: DocumentTableRow[];
  onView?: (doc: DocumentTableRow) => void;
  onEdit?: (doc: DocumentTableRow) => void;
  onDownload?: (doc: DocumentTableRow) => void;
  onDelete?: (doc: DocumentTableRow) => void;
  onToggleFavorite?: (doc: DocumentTableRow, isFavorite: boolean) => void;
  onSelect?: (docId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  selectedIds?: Set<string>;
  showSelection?: boolean;
  showLinkedTo?: boolean;
  showFavorite?: boolean;
  loading?: boolean;
}

/**
 * ✅ OPTIMISATION: Composant mémorisé avec React.memo() pour éviter les re-renders inutiles
 * Ne re-render que si les props changent réellement
 */
function DocumentTableComponent({
  documents,
  onView,
  onEdit,
  onDownload,
  onDelete,
  onToggleFavorite,
  onSelect,
  onSelectAll,
  selectedIds = new Set(),
  showSelection = false,
  showLinkedTo = true,
  showFavorite = true,
  loading = false,
}: DocumentTableProps) {
  const isUI2Active = useUI2();
  const [mobileLimit, setMobileLimit] = useState(3); // Limite initiale sur mobile

  const handleLoadMore = () => {
    setMobileLimit(prev => prev + 10);
  };

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

  // Helper pour générer le contenu hover (info importante)
  const getHoverInfo = (doc: DocumentTableRow) => {
    return null; // Pas d'info supplémentaire à afficher au hover
  };

  // Helper pour générer les actions hover
  const getHoverActions = (doc: DocumentTableRow) => {
    return (
      <div className="flex items-center gap-4">
        {onDownload && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(doc);
            }}
            className="flex items-center gap-1 text-[#ff6b35] hover:text-[#e55a2b] transition-colors underline text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            <span>TÉLÉCHARGER</span>
          </button>
        )}
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(doc);
            }}
            className="flex items-center gap-1 text-[#ff6b35] hover:text-[#e55a2b] transition-colors underline text-sm font-medium"
          >
            <Edit className="h-4 w-4" />
            <span>MODIFIER</span>
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(doc);
            }}
            className="flex items-center gap-1 text-red-600 hover:text-red-700 transition-colors underline text-sm font-medium"
          >
            <Trash2 className="h-4 w-4" />
            <span>SUPPRIMER</span>
          </button>
        )}
      </div>
    );
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
    <>
      {/* Vue mobile : Cards - Limitées à 3 par défaut */}
      <div className="lg:hidden space-y-3">
        {documents.slice(0, mobileLimit).map((doc) => {
          const isSelected = selectedIds.has(doc.id);
          
          return (
            <div
              key={doc.id}
              onClick={(e) => {
                // Ne pas déclencher si on clique directement sur un bouton, input, ou lien
                const target = e.target as HTMLElement;
                const interactiveElement = target.closest('button, input, a, [role="button"]');
                if (interactiveElement) {
                  return;
                }
                // Ouvrir le drawer pour visualiser le document (clic sur la card)
                onView?.(doc);
              }}
              className={cn(
                "bg-white border rounded-lg p-4 shadow-sm transition-all hover:shadow-md cursor-pointer",
                isSelected && "ring-2 ring-orange-500",
                doc.deletedAt && "opacity-50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Header avec checkbox et icône */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {showSelection && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            onSelect?.(doc.id, e.target.checked);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
                          )}
                        />
                      )}
                      {getDocumentIcon(doc.mime)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate" title={doc.filenameOriginal}>
                          {doc.filenameOriginal}
                        </p>
                        {doc.ocrStatus === 'failed' && (
                          <div className="flex items-center gap-1 text-xs text-orange-600 mt-1">
                            <AlertCircle className="h-3 w-3" />
                            <span>OCR échoué</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Badges et infos */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {doc.DocumentType ? (
                      <Badge variant="default" className="text-xs">
                        {doc.DocumentType.label}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Non classé
                      </Badge>
                    )}
                    {doc.userReason === 'doublon_conserve_manuellement' && (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                        Copie autorisée
                      </Badge>
                    )}
                    {getOcrBadge(doc)}
                  </div>
                  
                  {/* Détails */}
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>
                      <span className="text-gray-500">Taille:</span>{' '}
                      {formatFileSize(doc.size)}
                    </div>
                    <div>
                      <span className="text-gray-500">Date:</span>{' '}
                      {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true, locale: fr })}
                    </div>
                  </div>
                </div>
                
                {/* Actions rapides */}
                <div className="flex flex-col gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {showFavorite && onToggleFavorite && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(doc, !doc.isFavorite);
                      }}
                      className="p-1 rounded hover:bg-gray-100"
                      title={doc.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    >
                      {doc.isFavorite ? (
                        <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
                      ) : (
                        <Star className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  )}
                  {onDownload && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload(doc);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  {onEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(doc);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(doc);
                      }}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Bouton "Voir plus" sur mobile si plus de documents */}
        {documents.length > mobileLimit && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Chargement...
                </>
              ) : (
                `Voir plus (${documents.length - mobileLimit} restante${documents.length - mobileLimit > 1 ? 's' : ''})`
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Vue desktop : Tableau */}
      <div className="hidden lg:block">
      {isUI2Active ? (
        // Version UI2 avec TableV2
        <TableV2>
          <TableHeaderV2>
            <tr>
              {showSelection && (
                <TableHeaderCellV2>
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
                </TableHeaderCellV2>
              )}
              <TableHeaderCellV2>Document</TableHeaderCellV2>
              <TableHeaderCellV2>Type</TableHeaderCellV2>
              <TableHeaderCellV2>OCR</TableHeaderCellV2>
              {showFavorite && onToggleFavorite && (
                <TableHeaderCellV2 className="text-center w-10">Favori</TableHeaderCellV2>
              )}
              <TableHeaderCellV2 className="text-center">Actions</TableHeaderCellV2>
            </tr>
          </TableHeaderV2>
          <TableBodyV2>
            {documents.map((doc) => (
              <TableRowV2
                key={doc.id}
                className={doc.deletedAt ? 'opacity-50' : ''}
                onClick={() => onView?.(doc)}
                onHoverInfo={getHoverInfo(doc)}
              >
                {showSelection && (
                  <TableCellV2 onClick={(e) => e.stopPropagation()}>
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
                  </TableCellV2>
                )}
                <TableCellV2>
                  <div className="flex items-center gap-3">
                    {getDocumentIcon(doc.mime)}
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {doc.filenameOriginal}
                      </div>
                      {doc.ocrStatus === 'failed' && (
                        <div className="flex items-center gap-1 text-xs text-orange-600 mt-1 ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                          <AlertCircle className="h-3 w-3" />
                          <span>OCR échoué</span>
                        </div>
                      )}
                    </div>
                  </div>
                </TableCellV2>
                <TableCellV2>
                  <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out flex flex-col gap-1">
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
                </TableCellV2>
                <TableCellV2>
                  <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                    {getOcrBadge(doc)}
                  </div>
                </TableCellV2>
                {showFavorite && onToggleFavorite && (
                  <TableCellV2 className="text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(doc, !doc.isFavorite);
                      }}
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                      title={doc.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    >
                      {doc.isFavorite ? (
                        <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
                      ) : (
                        <Star className="h-5 w-5 text-gray-400 hover:text-amber-500" />
                      )}
                    </button>
                  </TableCellV2>
                )}
                <TableCellV2 className="text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    {onDownload && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(doc);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    {onEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(doc);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(doc);
                        }}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCellV2>
              </TableRowV2>
            ))}
          </TableBodyV2>
        </TableV2>
      ) : (
        // Version normale avec Table
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
          {showFavorite && onToggleFavorite && (
            <TableHeaderCell className="text-center w-10">Favori</TableHeaderCell>
          )}
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
            {showFavorite && onToggleFavorite && (
              <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(doc, !doc.isFavorite);
                  }}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  title={doc.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  {doc.isFavorite ? (
                    <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
                  ) : (
                    <Star className="h-5 w-5 text-gray-400 hover:text-amber-500" />
                  )}
                </button>
              </TableCell>
            )}
            <TableCell onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1">
                {onDownload && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload?.(doc);
                    }}
                    title="Télécharger"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
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
      )}
    </div>
    </>
  );
}

// ✅ OPTIMISATION: Mémoriser le composant pour éviter les re-renders inutiles
export const DocumentTable = memo(DocumentTableComponent);

