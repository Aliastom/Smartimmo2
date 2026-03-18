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
import { format, formatDistanceToNow } from 'date-fns';
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
  /** Ouvre la sidebar en ciblant une section (ex. impact) */
  onViewWithSection?: (doc: DocumentTableRow, section: 'impact') => void;
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
  showImpact?: boolean;
  loading?: boolean;
}

/**
 * ✅ OPTIMISATION: Composant mémorisé avec React.memo() pour éviter les re-renders inutiles
 * Ne re-render que si les props changent réellement
 */
function DocumentTableComponent({
  documents,
  onView,
  onViewWithSection,
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
  showImpact = true,
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

  const getLinksBreakdown = (doc: DocumentTableRow) => {
    const links = (doc as { DocumentLink?: Array<{ linkedType?: string }> }).DocumentLink ?? doc.links ?? [];
    if (links.length === 0) return { count: 0, tooltip: 'Aucune liaison' };
    const byType: Record<string, number> = {};
    links.forEach((l: { linkedType?: string }) => {
      const t = (l.linkedType || 'global').toLowerCase();
      byType[t] = (byType[t] || 0) + 1;
    });
    const labels: Record<string, string> = {
      property: 'Bien',
      lease: 'Bail',
      transaction: 'Transaction',
      tenant: 'Locataire',
      global: 'Global',
    };
    const parts = Object.entries(byType)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([t, n]) => (n > 1 ? `${labels[t] || t} (${n})` : labels[t] || t));
    return { count: links.length, tooltip: parts.join('\n') };
  };

  /** Impact patrimonial : loyers liés, bail, bien + détails pour tooltip */
  const getDocumentImpact = (doc: DocumentTableRow) => {
    const links = (doc as { DocumentLink?: Array<{ linkedType?: string; entityName?: string }> }).DocumentLink ?? doc.links ?? [];
    let rentsCount = 0;
    let hasLease = false;
    let hasProperty = false;
    let propertyName: string | null = null;
    const transactionLabels: string[] = [];
    links.forEach((l: { linkedType?: string; entityName?: string }) => {
      const t = (l.linkedType || '').toLowerCase();
      if (t === 'transaction') {
        rentsCount += 1;
        if (l.entityName) transactionLabels.push(l.entityName);
      }
      if (t === 'lease') hasLease = true;
      if (t === 'property') {
        hasProperty = true;
        if (l.entityName) propertyName = l.entityName;
      }
    });
    return { rentsCount, hasLease, hasProperty, propertyName, transactionLabels };
  };

  const getImpactTooltip = (impact: ReturnType<typeof getDocumentImpact>, statut?: string, niveau?: string) => {
    const lines: string[] = [];
    if (statut) lines.push(`Statut : ${statut}`);
    if (niveau) lines.push(`Priorisation : ${niveau}`);
    if (impact.rentsCount > 0) {
      const detail = impact.transactionLabels.length > 0
        ? impact.transactionLabels.slice(0, 5).join(', ') + (impact.transactionLabels.length > 5 ? '…' : '')
        : `${impact.rentsCount} transaction(s)`;
      lines.push(`Transactions : ${impact.rentsCount} — ${detail}`);
    }
    lines.push(`Bail : ${impact.hasLease ? 'Oui' : 'Non'}`);
    lines.push(`Bien : ${impact.hasProperty ? (impact.propertyName || 'Oui') : 'Non'}`);
    return lines.join('\n');
  };

  /** Statut métier : OK (cohérent), Partiel (incomplet), Problème (écart/orphelin) */
  const getStatutMetier = (doc: DocumentTableRow) => {
    const hasType = !!(doc.DocumentType || (doc as { documentType?: unknown }).documentType);
    const links = (doc as { DocumentLink?: unknown[] }).DocumentLink ?? doc.links ?? [];
    const hasLinks = links.length > 0;
    const ocrFailed = doc.ocrStatus === 'failed';
    if (!hasType && !hasLinks) return 'probleme'; // orphelin, non classé
    if (ocrFailed) return 'partiel'; // données incomplètes (OCR)
    if (hasType && hasLinks) return 'ok'; // tout cohérent
    return 'partiel'; // type sans liens ou liens sans type
  };

  /** Priorisation : impact élevé (plusieurs transactions), moyen, faible */
  const getImpactLevel = (impact: ReturnType<typeof getDocumentImpact>) => {
    const { rentsCount, hasLease, hasProperty } = impact;
    if (rentsCount >= 3) return 'eleve';
    if (rentsCount >= 1 || hasLease || hasProperty) return 'moyen';
    return 'faible';
  };

  const statutMetierLabels: Record<string, string> = {
    ok: '✔ Données cohérentes',
    partiel: '⚠ Données partielles',
    probleme: '✖ Écart détecté',
  };
  const impactLevelLabels: Record<string, string> = {
    eleve: 'Critique',
    moyen: 'Important',
    faible: 'Secondaire',
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
    const skeletonRows = 8;
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              {showSelection && <th className="px-6 py-3 text-left w-10" />}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OCR</th>
              {showLinkedTo && <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Liens</th>}
              {showImpact && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Impact</th>}
              {showFavorite && <th className="px-6 py-3 text-center w-10" />}
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {showSelection && <td className="px-6 py-4"><div className="h-4 w-4 rounded bg-gray-200" /></td>}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded bg-gray-200" />
                    <div className="space-y-1">
                      <div className="h-4 w-32 bg-gray-200 rounded" />
                      <div className="h-3 w-24 bg-gray-100 rounded" />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4"><div className="h-5 w-20 bg-gray-200 rounded" /></td>
                <td className="px-6 py-4"><div className="h-5 w-16 bg-gray-200 rounded" /></td>
                {showLinkedTo && <td className="px-6 py-4 text-center"><div className="h-4 w-8 bg-gray-100 rounded mx-auto" /></td>}
                {showImpact && <td className="px-6 py-4"><div className="h-4 w-20 bg-gray-100 rounded" /></td>}
                {showFavorite && <td className="px-6 py-4" />}
                <td className="px-6 py-4">
                  <div className="flex justify-center gap-2">
                    <div className="h-8 w-8 rounded bg-gray-100" />
                    <div className="h-8 w-8 rounded bg-gray-100" />
                    <div className="h-8 w-8 rounded bg-gray-100" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
              {showLinkedTo && (
                <TableHeaderCellV2 className="text-center w-16">Liens</TableHeaderCellV2>
              )}
              {showImpact && (
                <TableHeaderCellV2 className="w-32">Impact</TableHeaderCellV2>
              )}
              {showFavorite && onToggleFavorite && (
                <TableHeaderCellV2 className="text-center w-10">Favori</TableHeaderCellV2>
              )}
              <TableHeaderCellV2 className="text-center">Actions</TableHeaderCellV2>
            </tr>
          </TableHeaderV2>
          <TableBodyV2>
            {documents.map((doc) => {
              const statut = getStatutMetier(doc);
              const rowHighlight = doc.deletedAt ? 'opacity-50' : statut === 'probleme' ? 'bg-red-50/50' : statut === 'partiel' ? 'bg-amber-50/30' : '';
              return (
              <TableRowV2
                key={doc.id}
                className={rowHighlight}
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
                      <div className="text-xs text-gray-500 mt-0.5">
                        {doc.createdAt ? format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr }) : '—'} • {formatFileSize(doc.size ?? 0)}
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
                {showLinkedTo && (() => {
                  const { count, tooltip } = getLinksBreakdown(doc);
                  return (
                    <TableCellV2 className="text-center" title={tooltip}>
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                        <LinkIcon className="h-3.5 w-3.5" />
                        {count} liaison{count !== 1 ? 's' : ''}
                      </span>
                    </TableCellV2>
                  );
                })()}
                {showImpact && (() => {
                  const impact = getDocumentImpact(doc);
                  const niveau = getImpactLevel(impact);
                  const statutLabel = statutMetierLabels[statut] ?? statut;
                  const niveauLabel = impactLevelLabels[niveau] ?? niveau;
                  const tooltip = getImpactTooltip(impact, statutLabel, niveauLabel);
                  const handleClick = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (onViewWithSection) onViewWithSection(doc, 'impact');
                    else onView?.(doc);
                  };
                  const hasAny = impact.rentsCount > 0 || impact.hasLease || impact.hasProperty;
                  const clickable = hasAny && (onViewWithSection || onView);
                  return (
                    <TableCellV2
                      className={cn('text-sm align-middle', clickable && 'cursor-pointer hover:bg-gray-50')}
                      title={tooltip}
                      onClick={clickable ? handleClick : undefined}
                    >
                      <div className="flex flex-col gap-1 max-w-[200px]">
                        {/* Ligne 1 : priorisation (couleur) + statut métier */}
                        <div className="flex items-center gap-1.5 min-h-0">
                          <span
                            className={cn(
                              'shrink-0 w-1.5 h-1.5 rounded-full',
                              niveau === 'eleve' && 'bg-red-500',
                              niveau === 'moyen' && 'bg-amber-500',
                              niveau === 'faible' && 'bg-gray-300'
                            )}
                            title={niveauLabel}
                          />
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border truncate',
                              statut === 'ok' && 'bg-emerald-100 text-emerald-700 border-emerald-200',
                              statut === 'partiel' && 'bg-amber-100 text-amber-800 border-amber-200',
                              statut === 'probleme' && 'bg-red-100 text-red-700 border-red-200'
                            )}
                          >
                            {statutLabel}
                          </span>
                        </div>
                        {/* Ligne 2 : nb transactions uniquement (Bail/Bien dans la sidebar) */}
                        <div className="flex items-center min-h-0">
                          {impact.rentsCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                              <span>💰</span>
                              {impact.rentsCount} transaction{impact.rentsCount > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-400">—</span>
                          )}
                        </div>
                      </div>
                    </TableCellV2>
                  );
                })()}
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
                  <div className="flex items-center justify-center gap-2">
                    {onDownload && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(doc);
                        }}
                        className="h-8 w-8 p-0"
                        title="Télécharger"
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
                        title="Modifier"
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
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCellV2>
              </TableRowV2>
              );
            })}
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
          {showLinkedTo && (
            <TableHeaderCell className="text-center w-16">Liens</TableHeaderCell>
          )}
          {showImpact && (
            <TableHeaderCell className="w-32">Impact</TableHeaderCell>
          )}
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
            className={`${doc.deletedAt ? 'opacity-50' : ''} cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors`}
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
                  <div className="text-xs text-gray-500 mt-0.5">
                    {doc.createdAt ? format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr }) : '—'} • {formatFileSize(doc.size ?? 0)}
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
            {showLinkedTo && (() => {
              const { count, tooltip } = getLinksBreakdown(doc);
              return (
                <TableCell className="text-center" title={tooltip}>
                  <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                    <LinkIcon className="h-3.5 w-3.5" />
                    {count} liaison{count !== 1 ? 's' : ''}
                  </span>
                </TableCell>
              );
            })()}
            {showImpact && (() => {
              const impact = getDocumentImpact(doc);
              const tooltip = getImpactTooltip(impact);
              const handleClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (onViewWithSection) onViewWithSection(doc, 'impact');
                else onView?.(doc);
              };
              const hasAny = impact.rentsCount > 0 || impact.hasLease || impact.hasProperty;
              const clickable = hasAny && (onViewWithSection || onView);
              return (
                <TableCell
                  className={cn('text-sm', clickable && 'cursor-pointer hover:bg-gray-50')}
                  title={tooltip}
                  onClick={clickable ? handleClick : undefined}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {impact.rentsCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span>💰</span>
                        {impact.rentsCount} transaction{impact.rentsCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {impact.hasLease && (
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        <span>📄</span> Bail
                      </span>
                    )}
                    {impact.hasProperty && (
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-gray-50 text-gray-500 border border-gray-100">
                        <span>🏠</span> Bien
                      </span>
                    )}
                    {!hasAny && <span className="text-gray-400">—</span>}
                  </div>
                </TableCell>
              );
            })()}
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
              <div className="flex items-center gap-2">
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

