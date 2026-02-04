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
import { TableV2, TableHeaderV2, TableHeaderCellV2, TableBodyV2, TableRowV2, TableCellV2 } from '@/components/ui2/TableV2';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { 
  FileText, 
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Eye
} from 'lucide-react';
import { useUI2 } from '@/hooks/useUI2';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { formatLeasePeriod } from '@/utils/leaseUtils';

interface LeasesTableNewProps {
  leases: LeaseWithDetails[];
  onView?: (lease: LeaseWithDetails) => void;
  onEdit?: (lease: LeaseWithDetails) => void;
  onDelete?: (lease: LeaseWithDetails) => void;
  onActions?: (lease: LeaseWithDetails) => void;
  onSelect?: (leaseId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  selectedIds?: Set<string>;
  showSelection?: boolean;
  loading?: boolean;
}

const LeasesTableNewComponent: React.FC<LeasesTableNewProps> = ({
  leases,
  onView,
  onEdit,
  onDelete,
  onActions,
  onSelect,
  onSelectAll,
  selectedIds = new Set(),
  showSelection = true,
  loading = false,
}) => {
  // ✅ [DEV-ONLY] Logs de debug (isolés derrière flag DEV)
  if (process.env.NODE_ENV === 'development' && (window as any).__SMARTIMMO_DEBUG_LEASES_TABLE__) {
    console.count('LeasesTableNew render');
    console.log('[LeasesTableNew] [DEV] Props reçues:', {
      leasesCount: leases.length,
      premierLeaseId: leases[0]?.id?.slice(0, 8),
      premierLeaseStatus: leases[0]?.status,
      selectedIdsSize: selectedIds.size,
      loading
    });
  }
  
  const isUI2Active = useUI2();
  
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      'BROUILLON': { variant: 'secondary', icon: Edit, label: 'Brouillon' },
      'À_ENVOYER': { variant: 'warning', icon: AlertTriangle, label: 'À envoyer' },
      'A_ENVOYER': { variant: 'warning', icon: AlertTriangle, label: 'À envoyer' },
      'TO_SEND': { variant: 'warning', icon: AlertTriangle, label: 'À envoyer' },
      'ENVOYÉ': { variant: 'warning', icon: Clock, label: 'Envoyé' },
      'ENVOYE': { variant: 'warning', icon: Clock, label: 'Envoyé' },
      'SIGNÉ': { variant: 'success', icon: CheckCircle, label: 'Signé' },
      'SIGNE': { variant: 'success', icon: CheckCircle, label: 'Signé' },
      'ACTIF': { variant: 'success', icon: CheckCircle, label: 'Actif' },
      'RÉSILIÉ': { variant: 'destructive', icon: XCircle, label: 'Résilié' },
      'RESILIE': { variant: 'destructive', icon: XCircle, label: 'Résilié' },
    };

    const config = statusConfig[status] || { variant: 'secondary', icon: FileText, label: status };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getFurnishedBadge = (furnishedType: string | null) => {
    const types: Record<string, string> = {
      'VIDE': 'Vide',
      'MEUBLE': 'Meublé',
      'COLOCATION_MEUBLEE': 'Coloc. meublée',
      'COLOCATION_VIDE': 'Coloc. vide',
    };
    
    return <Badge variant="outline">{types[furnishedType || 'VIDE'] || 'Vide'}</Badge>;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getExpirationWarning = (endDate: string | null) => {
    if (!endDate) return null;
    
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return <Badge variant="destructive">Expiré</Badge>;
    } else if (diffDays <= 30) {
      return <Badge variant="destructive">Fin dans {diffDays}j</Badge>;
    } else if (diffDays <= 90) {
      return <Badge variant="warning">Expire bientôt</Badge>;
    }
    
    return null;
  };

  // Helper pour générer le contenu hover (info importante)
  const getHoverInfo = (lease: LeaseWithDetails) => {
    return null; // Pas d'info supplémentaire à afficher au hover
  };

  // Helper pour générer les actions hover
  const getHoverActions = (lease: LeaseWithDetails) => {
    return (
      <div className="flex items-center gap-4">
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(lease);
            }}
            className="flex items-center gap-1 text-[#ff6b35] hover:text-[#e55a2b] transition-colors underline text-sm font-medium"
          >
            <Edit className="h-4 w-4" />
            <span>MODIFIER</span>
          </button>
        )}
        {onActions && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onActions(lease);
            }}
            className="flex items-center gap-1 text-[#ff6b35] hover:text-[#e55a2b] transition-colors underline text-sm font-medium"
          >
            <FileText className="h-4 w-4" />
            <span>ACTIONS</span>
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(lease);
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

  if (leases.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Aucun bail trouvé</p>
        <p className="text-sm text-gray-400 mt-1">Ajustez vos filtres ou créez un nouveau bail</p>
      </div>
    );
  }

  return (
    <>
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
                    checked={selectedIds.size === leases.length && leases.length > 0}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = selectedIds.size > 0 && selectedIds.size < leases.length;
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      const shouldSelectAll = e.target.checked;
                      if (onSelectAll) {
                        onSelectAll(shouldSelectAll);
                      }
                    }}
                  />
                </TableHeaderCellV2>
              )}
              <TableHeaderCellV2>Bien</TableHeaderCellV2>
              <TableHeaderCellV2>Locataire(s)</TableHeaderCellV2>
              <TableHeaderCellV2>Type</TableHeaderCellV2>
              <TableHeaderCellV2>Période</TableHeaderCellV2>
              <TableHeaderCellV2>€ Loyer (€)</TableHeaderCellV2>
              <TableHeaderCellV2>Statut</TableHeaderCellV2>
              <TableHeaderCellV2>Prochaine action / Échéance</TableHeaderCellV2>
              <TableHeaderCellV2 className="text-center">Actions</TableHeaderCellV2>
            </tr>
          </TableHeaderV2>
          <TableBodyV2>
            {leases.map((lease) => (
              <TableRowV2
                key={lease.id}
                onClick={() => onView?.(lease)}
                onHoverInfo={getHoverInfo(lease)}
              >
                {showSelection && (
                  <TableCellV2 onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      checked={selectedIds.has(lease.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        onSelect?.(lease.id, e.target.checked);
                      }}
                    />
                  </TableCellV2>
                )}
                <TableCellV2>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {lease.Property.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                      {lease.Property.address}
                    </div>
                  </div>
                </TableCellV2>
                <TableCellV2>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">
                      {lease.Tenant.firstName} {lease.Tenant.lastName}
                    </div>
                    <div className="text-xs text-gray-500 truncate ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                      {lease.Tenant.email}
                    </div>
                  </div>
                </TableCellV2>
                <TableCellV2>
                  <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out flex flex-col gap-1">
                    <span className="text-sm">{lease.type}</span>
                    {getFurnishedBadge(lease.furnishedType)}
                  </div>
                </TableCellV2>
                <TableCellV2>
                  <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out text-sm">
                    {(() => {
                      const period = formatLeasePeriod(lease.startDate, lease.endDate, lease.furnishedType);
                      return (
                        <>
                          <div>{period.startText}</div>
                          <div className={period.calculated ? 'text-gray-500 italic' : ''}>
                            {period.endText}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </TableCellV2>
                <TableCellV2>
                  <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                    <div className="font-medium text-gray-900">
                      {formatCurrency(lease.rentAmount)}
                    </div>
                    {lease.chargesRecupMensuelles && lease.chargesRecupMensuelles > 0 && (
                      <div className="text-xs text-gray-500">
                        + {formatCurrency(lease.chargesRecupMensuelles)} charges
                      </div>
                    )}
                  </div>
                </TableCellV2>
                <TableCellV2>
                  <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                    {getStatusBadge(lease.status)}
                  </div>
                </TableCellV2>
                <TableCellV2>
                  <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out flex flex-col gap-1">
                    {getExpirationWarning(lease.endDate)}
                    {/* TODO: Ajouter indexation à prévoir */}
                  </div>
                </TableCellV2>
                <TableCellV2 className="text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    {onEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(lease);
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
                          onDelete(lease);
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
                    checked={selectedIds.size === leases.length && leases.length > 0}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = selectedIds.size > 0 && selectedIds.size < leases.length;
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      const shouldSelectAll = e.target.checked;
                      if (onSelectAll) {
                        onSelectAll(shouldSelectAll);
                      }
                    }}
                  />
                </TableHeaderCell>
              )}
              <TableHeaderCell>Bien</TableHeaderCell>
              <TableHeaderCell>Locataire(s)</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Période</TableHeaderCell>
              <TableHeaderCell>€ Loyer (€)</TableHeaderCell>
              <TableHeaderCell>Statut</TableHeaderCell>
              <TableHeaderCell>Prochaine action / Échéance</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leases.map((lease) => (
              <TableRow 
                key={lease.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => onView?.(lease)}
              >
                {showSelection && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      checked={selectedIds.has(lease.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        onSelect?.(lease.id, e.target.checked);
                      }}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {lease.Property.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {lease.Property.address}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">
                      {lease.Tenant.firstName} {lease.Tenant.lastName}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {lease.Tenant.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm">{lease.type}</span>
                    {getFurnishedBadge(lease.furnishedType)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {(() => {
                      const period = formatLeasePeriod(lease.startDate, lease.endDate, lease.furnishedType);
                      return (
                        <>
                          <div>{period.startText}</div>
                          <div className={period.calculated ? 'text-gray-500 italic' : ''}>
                            {period.endText}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-gray-900">
                    {formatCurrency(lease.rentAmount)}
                  </div>
                  {lease.chargesRecupMensuelles && lease.chargesRecupMensuelles > 0 && (
                    <div className="text-xs text-gray-500">
                      + {formatCurrency(lease.chargesRecupMensuelles)} charges
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {getStatusBadge(lease.status)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {getExpirationWarning(lease.endDate)}
                    {/* TODO: Ajouter indexation à prévoir */}
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit?.(lease);
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
                        onDelete?.(lease);
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
    </>
  );
}

// ✅ React.memo avec comparaison optimisée incluant les champs mutables (status, updatedAt)
// ⚠️ CRITIQUE : La comparaison DOIT inclure status et updatedAt pour détecter les changements
// ⚠️ OPTIMISATION : Comparaison rapide (length check d'abord, puis signature uniquement si nécessaire)
export const LeasesTableNew = React.memo(LeasesTableNewComponent, (prevProps, nextProps) => {
  // Comparaison basique (rapide)
  if (prevProps.loading !== nextProps.loading) return false;
  if (prevProps.leases.length !== nextProps.leases.length) return false;
  if (prevProps.selectedIds.size !== nextProps.selectedIds.size) return false;
  if (prevProps.showSelection !== nextProps.showSelection) return false;
  
  // ✅ OPTIMISATION : Si même nombre de leases, comparer uniquement les signatures
  // ⚠️ ROBUSTE AUX STRING ISO : updatedAt peut être string ISO ou Date, normaliser en string
  const normalizeUpdatedAt = (updatedAt: string | Date | undefined): string => {
    if (!updatedAt) return '';
    if (typeof updatedAt === 'string') return updatedAt;
    if (updatedAt instanceof Date) return updatedAt.toISOString();
    return String(updatedAt);
  };
  
  // ✅ Comparaison optimisée : signature id:status:updatedAt pour chaque lease
  // Permet de détecter les changements de status ou updatedAt même si l'ID reste identique
  const prevLeasesSignature = prevProps.leases.map(l => `${l.id}:${l.status}:${normalizeUpdatedAt(l.updatedAt)}`).join('|');
  const nextLeasesSignature = nextProps.leases.map(l => `${l.id}:${l.status}:${normalizeUpdatedAt(l.updatedAt)}`).join('|');
  if (prevLeasesSignature !== nextLeasesSignature) {
    if (process.env.NODE_ENV === 'development' && (window as any).__SMARTIMMO_DEBUG_LEASES_TABLE__) {
      console.log('[LeasesTableNew] [DEV] Re-render nécessaire (signature changée):', {
        prevCount: prevProps.leases.length,
        nextCount: nextProps.leases.length,
        prevSignature: prevLeasesSignature.substring(0, 100),
        nextSignature: nextLeasesSignature.substring(0, 100)
      });
    }
    return false;
  }
  
  // Comparer les IDs sélectionnés
  const prevSelected = Array.from(prevProps.selectedIds).sort().join(',');
  const nextSelected = Array.from(nextProps.selectedIds).sort().join(',');
  if (prevSelected !== nextSelected) return false;
  
  // Si tout est identique, on peut skip le re-render
  return true;
});

