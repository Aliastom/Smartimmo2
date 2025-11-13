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
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle
} from 'lucide-react';
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

export function LeasesTableNew({
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
}: LeasesTableNewProps) {
  
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      'BROUILLON': { variant: 'secondary', icon: Edit, label: 'Brouillon' },
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
  );
}

