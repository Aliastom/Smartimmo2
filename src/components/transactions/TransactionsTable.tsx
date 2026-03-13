'use client';

import React, { useState, useMemo } from 'react';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { TableV2, TableHeaderV2, TableHeaderCellV2, TableBodyV2, TableRowV2, TableCellV2 } from '@/components/ui2/TableV2';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkeletonTable, EmptyState, useLoadingDelay } from '@/components/ui';
import { Edit, Trash2, CheckCircle, AlertTriangle, FileText, X, ArrowUpDown, ArrowUp, ArrowDown, Loader2, Eye } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useUI2 } from '@/hooks/useUI2';

interface Transaction {
  id: string;
  date: string;
  accountingMonth?: string; // Format YYYY-MM
  label: string;
  Property: {
    id: string;
    name: string;
    address: string;
  };
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  nature: {
    id: string;
    label: string;
    type: 'RECETTE' | 'DEPENSE';
  };
  Category: {
    id: string;
    label: string;
  };
  amount: number;
  hasDocument: boolean;
  documentsCount: number;
  status: 'rapprochee' | 'nonRapprochee';
  paidAt?: string | null;
  reference?: string;
  // Gestion déléguée
  parentTransactionId?: string | null;
  isAuto?: boolean;
  autoSource?: string | null;
}

interface TransactionsTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onDeleteMultiple: (transactions: Transaction[]) => void;
  onRowClick: (transaction: Transaction) => void;
  isLoading?: boolean;
  totalCount?: number; // Nombre total de transactions (avant filtres)
  groupByParent?: boolean; // Active/désactive le groupement parent-enfant
  hidePropertyColumn?: boolean; // Masquer la colonne "Bien" (pour l'onglet bien)
  // Props pour externaliser la sélection (comme DocumentTable)
  selectedTransactionIds?: string[];
  onSelectTransaction?: (id: string) => void;
  onSelectAll?: (selected: boolean) => void;
  loadingTransactionId?: string | null; // ID de la transaction en cours de chargement
  /** Tri contrôlé (pour pagination côté serveur) : quand fourni, le parent gère le tri */
  sortField?: SortField;
  sortOrder?: SortOrder;
  onSortChange?: (field: SortField, order: SortOrder) => void;
}

const NATURE_COLORS = {
  RECETTE: 'success',
  DEPENSE: 'danger'
} as const;

const STATUS_COLORS = {
  rapprochee: 'success',
  nonRapprochee: 'warning'
} as const;

type SortField = 'date' | 'amount' | 'nature' | 'accountingMonth';
type SortOrder = 'asc' | 'desc';

export default function TransactionsTable({ 
  transactions, 
  onEdit, 
  onDelete, 
  onDeleteMultiple,
  onRowClick, 
  isLoading = false,
  totalCount,
  groupByParent = false,
  hidePropertyColumn = false,
  selectedTransactionIds = [],
  onSelectTransaction,
  onSelectAll,
  loadingTransactionId = null,
  sortField: sortFieldProp,
  sortOrder: sortOrderProp,
  onSortChange
}: TransactionsTableProps) {
  const [sortFieldInternal, setSortFieldInternal] = useState<SortField>('accountingMonth');
  const [sortOrderInternal, setSortOrderInternal] = useState<SortOrder>('desc');
  const isControlled = sortFieldProp !== undefined && sortOrderProp !== undefined;
  const sortField = isControlled ? sortFieldProp! : sortFieldInternal;
  const sortOrder = isControlled ? sortOrderProp! : sortOrderInternal;
  const [mobileLimit, setMobileLimit] = useState(3); // Limite initiale sur mobile
  const isUI2Active = useUI2();

  // Utiliser selectedTransactionIds passé en prop au lieu de l'état local
  const selectedTransactions = selectedTransactionIds;

  // ⚠️ PROBLÈME 1: Helper pour identifier les commissions auto (non sélectionnables)
  const isAutoCommission = (transaction: Transaction): boolean => {
    return (
      transaction.isAuto === true &&
      transaction.autoSource === 'gestion' &&
      transaction.parentTransactionId !== null &&
      transaction.parentTransactionId !== undefined
    );
  };

  // Fonctions de gestion de sélection - déléguer au parent
  const handleSelectAll = () => {
    if (onSelectAll) {
      // ⚠️ PROBLÈME 1: Exclure les commissions auto du calcul "toutes sélectionnées"
      const selectableTransactions = transactions.filter(t => !isAutoCommission(t));
      const allVisibleSelected = selectableTransactions.length > 0 && 
                                 selectableTransactions.every(t => selectedTransactions.includes(t.id));
      const shouldSelectAll = !allVisibleSelected;
      onSelectAll(shouldSelectAll);
    }
  };

  const handleSelectTransaction = (transactionId: string) => {
    // ⚠️ PROBLÈME 1: Empêcher la sélection des commissions auto (supprimées en cascade)
    const transaction = transactions.find(t => t.id === transactionId);
    if (transaction && isAutoCommission(transaction)) {
      // Ne pas sélectionner les commissions auto
      return;
    }
    
    if (onSelectTransaction) {
      onSelectTransaction(transactionId);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatAccountingMonth = (monthString: string): string => {
    // Format YYYY-MM vers "Janvier 2025"
    const [year, month] = monthString.split('-');
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthIndex = parseInt(month, 10) - 1;
    return `${monthNames[monthIndex]} ${year}`;
  };

  const formatAmount = (amount: number, type: 'RECETTE' | 'DEPENSE'): string => {
    // Pour les recettes, s'assurer que le montant est positif
    // Pour les dépenses, s'assurer que le montant est négatif
    const adjustedAmount = type === 'RECETTE' ? Math.abs(amount) : -Math.abs(amount);
    
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(adjustedAmount);
  };

  const getAmountColor = (type: 'RECETTE' | 'DEPENSE'): string => {
    return type === 'RECETTE' ? 'text-green-600' : 'text-red-600';
  };

  // Grouper et trier les transactions (avec indentation des commissions)
  const groupedTransactions = useMemo(() => {
    if (!groupByParent) {
      // Si groupByParent est false, trier normalement sans grouper
      return [...transactions].sort((a, b) => {
        let comparison = 0;

        switch (sortField) {
          case 'date':
            comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
            break;
          case 'amount':
            comparison = Math.abs(a.amount) - Math.abs(b.amount);
            break;
          case 'nature':
            comparison = a.nature.type.localeCompare(b.nature.type);
            break;
          case 'accountingMonth':
            const monthA = a.accountingMonth || '0000-00';
            const monthB = b.accountingMonth || '0000-00';
            comparison = monthA.localeCompare(monthB);
            break;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    // Séparer parents et enfants
    const childrenMap = new Map<string, Transaction[]>();
    const parents: Transaction[] = [];

    transactions.forEach(t => {
      if (t.parentTransactionId && t.parentTransactionId !== t.id) {
        const siblings = childrenMap.get(t.parentTransactionId) || [];
        siblings.push(t);
        childrenMap.set(t.parentTransactionId, siblings);
      } else {
        parents.push(t);
      }
    });

    // Trier les parents
    const sorted = [...parents].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = Math.abs(a.amount) - Math.abs(b.amount);
          break;
        case 'nature':
          comparison = a.nature.type.localeCompare(b.nature.type);
          break;
        case 'accountingMonth':
          const monthA = a.accountingMonth || '0000-00';
          const monthB = b.accountingMonth || '0000-00';
          comparison = monthA.localeCompare(monthB);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Construire la liste finale avec enfants indentés
    const result: Array<Transaction & { isChild?: boolean }> = [];
    sorted.forEach(parent => {
      result.push({ ...parent, isChild: false });
      const children = childrenMap.get(parent.id) || [];
      children.forEach(child => {
        result.push({ ...child, isChild: true });
      });
    });

    return result;
  }, [transactions, sortField, sortOrder, groupByParent]);
  
  const sortedTransactions = groupedTransactions;

  const handleSort = (field: SortField) => {
    const newOrder = sortField === field ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';
    if (onSortChange) {
      onSortChange(field, newOrder);
    } else {
      setSortFieldInternal(field);
      setSortOrderInternal(newOrder);
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-orange-600" />
      : <ArrowDown className="h-4 w-4 text-orange-600" />;
  };

  // Helper pour générer le contenu hover (info importante)
  const getHoverInfo = (transaction: Transaction) => {
    // La référence est déjà affichée dans la cellule normale, on n'a pas besoin de l'afficher au hover
    return null;
  };

  // Helper pour générer les actions hover
  const getHoverActions = (transaction: Transaction) => {
    return (
      <div className="flex items-center gap-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRowClick(transaction);
          }}
          className="flex items-center gap-1 text-[#ff6b35] hover:text-[#e55a2b] transition-colors underline text-sm font-medium"
        >
          <Eye className="h-4 w-4" />
          <span>CONSULTER</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(transaction);
          }}
          className="flex items-center gap-1 text-[#ff6b35] hover:text-[#e55a2b] transition-colors underline text-sm font-medium"
        >
          <Edit className="h-4 w-4" />
          <span>MODIFIER</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(transaction);
          }}
          className="flex items-center gap-1 text-red-600 hover:text-red-700 transition-colors underline text-sm font-medium"
        >
          <Trash2 className="h-4 w-4" />
          <span>SUPPRIMER</span>
        </button>
      </div>
    );
  };

  // Utiliser le hook de délai pour éviter les flashs
  const showLoader = useLoadingDelay(isLoading);

  if (showLoader) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6">
          <SkeletonTable rows={8} columns={6} />
        </div>
      </div>
    );
  }

  if (transactions.length === 0 && !isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <EmptyState
          title="Aucune transaction trouvée"
          description="Ajustez vos filtres ou créez une nouvelle transaction."
          icon={<FileText className="h-8 w-8" />}
        />
      </div>
    );
  }

  return (
    <>
      {/* Compteur et tri rapide - Style Documents (fond blanc) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{transactions.length}</span> transaction{transactions.length > 1 ? 's' : ''} affichée{transactions.length > 1 ? 's' : ''}
          {totalCount && totalCount !== transactions.length && (
            <span className="text-gray-500"> / {totalCount} au total</span>
          )}
        </p>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full sm:w-auto">
          <span className="text-xs text-gray-500 flex-shrink-0">Tri rapide:</span>
          <button
            onClick={() => handleSort('accountingMonth')}
            className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors flex-shrink-0 ${
              sortField === 'accountingMonth' 
                ? 'bg-orange-50 border-orange-300 text-orange-700' 
                : 'bg-white border-gray-300 hover:bg-gray-50'
            }`}
            title="Trier par mois comptable"
          >
            Mois {getSortIcon('accountingMonth')}
          </button>
          <button
            onClick={() => handleSort('date')}
            className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors flex-shrink-0 ${
              sortField === 'date' 
                ? 'bg-orange-50 border-orange-300 text-orange-700' 
                : 'bg-white border-gray-300 hover:bg-gray-50'
            }`}
            title="Trier par date"
          >
            Date {getSortIcon('date')}
          </button>
          <button
            onClick={() => handleSort('amount')}
            className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors flex-shrink-0 ${
              sortField === 'amount' 
                ? 'bg-orange-50 border-orange-300 text-orange-700' 
                : 'bg-white border-gray-300 hover:bg-gray-50'
            }`}
            title="Trier par montant"
          >
            Montant {getSortIcon('amount')}
          </button>
          <button
            onClick={() => handleSort('nature')}
            className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors flex-shrink-0 ${
              sortField === 'nature' 
                ? 'bg-orange-50 border-orange-300 text-orange-700' 
                : 'bg-white border-gray-300 hover:bg-gray-50'
            }`}
            title="Trier par nature"
          >
            Nature {getSortIcon('nature')}
          </button>
        </div>
      </div>

      {/* La barre de sélection est maintenant gérée dans TransactionsClient */}
      
      {/* Vue mobile : Cards - Limitées à 3 par défaut */}
      <div className="lg:hidden space-y-3">
        {sortedTransactions.slice(0, mobileLimit).map((transaction) => {
          const isLoading = loadingTransactionId === transaction.id;
          const isSelected = selectedTransactions.includes(transaction.id);
          const isAutoComm = isAutoCommission(transaction);
          
          // Vérifier si c'est une transaction fille
          const isChildTransaction = (transaction as any).isChild === true;
          
          // Toutes les transactions sont cliquables pour ouvrir le drawer (même les commissions auto)
          // La restriction sur modification/suppression est gérée dans le drawer lui-même
          const isClickable = true;
          
          return (
            <div
              key={transaction.id}
              onClick={(e) => {
                // Ne pas déclencher si on clique directement sur un bouton, input, ou lien
                const target = e.target as HTMLElement;
                const interactiveElement = target.closest('button, input, a, [role="button"]');
                if (interactiveElement) {
                  return;
                }
                
                // Toutes les transactions sont cliquables pour ouvrir le drawer
                // (même les commissions auto - la restriction modif/suppr est dans le drawer)
                onRowClick(transaction);
              }}
              className={`bg-white border rounded-lg p-4 shadow-sm transition-all ${
                isLoading ? 'opacity-50' : 'hover:shadow-md cursor-pointer'
              } ${isSelected ? 'ring-2 ring-orange-500' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Header avec checkbox et montant */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isLoading && (
                        <Loader2 className="h-4 w-4 animate-spin sidebar-loader-orange flex-shrink-0" />
                      )}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isAutoComm}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectTransaction(transaction.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0",
                          isAutoComm && "opacity-50 cursor-not-allowed"
                        )}
                        title={isAutoComm ? "Commission auto supprimée automatiquement avec son parent" : undefined}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate" title={transaction.label}>
                          {transaction.label}
                        </p>
                        {transaction.reference && (
                          <p className="text-xs text-gray-500 truncate" title={transaction.reference}>
                            Ref: {transaction.reference}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`font-bold text-lg flex-shrink-0 ${getAmountColor(transaction.nature.type)}`}>
                      {formatAmount(transaction.amount, transaction.nature.type)}
                    </span>
                  </div>
                  
                  {/* Badges et infos */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {(transaction as any).isChild && (
                      <span className="text-red-600 font-bold text-sm">↳</span>
                    )}
                    {transaction.isAuto && transaction.autoSource === 'gestion' && (
                      <Badge variant="danger" className="text-xs font-semibold">
                        A
                      </Badge>
                    )}
                    <Badge variant={NATURE_COLORS[transaction.nature.type]} className="text-xs">
                      {transaction.nature.label}
                    </Badge>
                    <Badge
                      variant={STATUS_COLORS[transaction.status]}
                      className="text-xs"
                    >
                      {transaction.status === 'rapprochee' ? 'Rapprochée' : 'Non rapprochée'}
                    </Badge>
                  </div>
                  
                  {/* Détails */}
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>
                      <span className="text-gray-500">Date:</span>{' '}
                      {transaction.accountingMonth ? formatAccountingMonth(transaction.accountingMonth) : formatDate(transaction.date)}
                    </div>
                    <div>
                      <span className="text-gray-500">Encaissement:</span>{' '}
                      {transaction.paidAt ? formatDate(transaction.paidAt) : '–'}
                    </div>
                    <div>
                      <span className="text-gray-500">Catégorie:</span>{' '}
                      {transaction.Category?.label || 'Non classé'}
                    </div>
                    {!hidePropertyColumn && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Bien:</span>{' '}
                        {transaction.Property.name}
                      </div>
                    )}
                  </div>
                  
                  {/* Documents */}
                  <div className="flex items-center gap-2 mt-2">
                    {transaction.hasDocument ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                    {transaction.documentsCount > 0 && (
                      <span className="text-xs text-gray-600">
                        {transaction.documentsCount} document{transaction.documentsCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Actions rapides */}
                <div className="flex flex-col gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(transaction);
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(transaction);
                    }}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Bouton "Voir plus" sur mobile si plus de transactions */}
        {sortedTransactions.length > mobileLimit && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => setMobileLimit(prev => prev + 10)}
              className="w-full"
            >
              Voir plus ({sortedTransactions.length - mobileLimit} restante{sortedTransactions.length - mobileLimit > 1 ? 's' : ''})
            </Button>
          </div>
        )}
      </div>
      
      {/* Vue desktop : Tableau */}
      <div className="hidden lg:block overflow-x-auto">
        {isUI2Active ? (
          // Version UI2 avec TableV2
          <TableV2>
            <TableHeaderV2>
              <tr>
                <TableHeaderCellV2>
                  <input
                    type="checkbox"
                    checked={
                      (() => {
                        const selectableTransactions = transactions.filter(t => !isAutoCommission(t));
                        return selectableTransactions.length > 0 && 
                               selectableTransactions.every(t => selectedTransactions.includes(t.id));
                      })()
                    }
                    ref={(input) => {
                      if (input) {
                        const selectableTransactions = transactions.filter(t => !isAutoCommission(t));
                        const allVisibleSelected = selectableTransactions.length > 0 && 
                                                   selectableTransactions.every(t => selectedTransactions.includes(t.id));
                        const someSelected = selectedTransactions.length > 0;
                        input.indeterminate = someSelected && !allVisibleSelected;
                      }
                    }}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </TableHeaderCellV2>
                <TableHeaderCellV2>Mois comptable</TableHeaderCellV2>
                <TableHeaderCellV2>Encaissement</TableHeaderCellV2>
                <TableHeaderCellV2>Libellé</TableHeaderCellV2>
                {!hidePropertyColumn && <TableHeaderCellV2>Bien</TableHeaderCellV2>}
                <TableHeaderCellV2>Nature</TableHeaderCellV2>
                <TableHeaderCellV2>Catégorie</TableHeaderCellV2>
                <TableHeaderCellV2 className="text-right">Montant</TableHeaderCellV2>
                <TableHeaderCellV2 className="text-center">Doc</TableHeaderCellV2>
                <TableHeaderCellV2 className="text-center">Actions</TableHeaderCellV2>
              </tr>
            </TableHeaderV2>
            <TableBodyV2>
              {sortedTransactions.map((transaction) => {
                const isLoading = loadingTransactionId === transaction.id;
                return (
                  <TableRowV2
                    key={transaction.id}
                    className={cn(
                      (transaction as any).isChild && "bg-gray-50/50"
                    )}
                    onClick={() => onRowClick(transaction)}
                    onHoverInfo={getHoverInfo(transaction)}
                  >
                    <TableCellV2 onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin sidebar-loader-orange" />
                        ) : null}
                        <input
                          type="checkbox"
                          checked={selectedTransactions.includes(transaction.id)}
                          disabled={isAutoCommission(transaction)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectTransaction(transaction.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "rounded border-gray-300 text-primary-600 focus:ring-primary-500",
                            isAutoCommission(transaction) && "opacity-50 cursor-not-allowed"
                          )}
                          title={isAutoCommission(transaction) ? "Commission auto supprimée automatiquement avec son parent" : undefined}
                        />
                      </div>
                    </TableCellV2>
                    <TableCellV2>
                      <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out font-medium">
                        {transaction.accountingMonth ? formatAccountingMonth(transaction.accountingMonth) : formatDate(transaction.date)}
                      </div>
                    </TableCellV2>
                    <TableCellV2>
                      <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out text-sm text-gray-600">
                        {transaction.paidAt ? formatDate(transaction.paidAt) : '–'}
                      </div>
                    </TableCellV2>
                    
                    <TableCellV2>
                      <div className={`max-w-xs ${(transaction as any).isChild ? 'pl-8' : ''}`}>
                        <div className="flex items-center gap-2">
                          {(transaction as any).isChild && (
                            <span className="text-red-600 font-bold" style={{ fontSize: '16px' }}>↳</span>
                          )}
                          {transaction.isAuto && transaction.autoSource === 'gestion' && (
                            <Badge variant="danger" className="text-xs font-semibold">
                              A
                            </Badge>
                          )}
                          <p className="truncate font-medium" title={transaction.label}>
                            {transaction.label}
                          </p>
                        </div>
                      </div>
                    </TableCellV2>
                    
                    {!hidePropertyColumn && (
                      <TableCellV2>
                        <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out max-w-xs">
                          <p className="font-medium truncate" title={transaction.Property.name}>
                            {transaction.Property.name}
                          </p>
                        </div>
                      </TableCellV2>
                    )}
                    
                    <TableCellV2>
                      <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                        <Badge
                          variant={NATURE_COLORS[transaction.nature.type]}
                          className="text-xs"
                        >
                          {transaction.nature.label}
                        </Badge>
                      </div>
                    </TableCellV2>
                    
                    <TableCellV2>
                      <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                        <span className="text-sm">{transaction.Category?.label || 'Non classé'}</span>
                      </div>
                    </TableCellV2>
                    
                    <TableCellV2 className="text-right">
                      <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                        <span className={`font-medium ${getAmountColor(transaction.nature.type)}`}>
                          {formatAmount(transaction.amount, transaction.nature.type)}
                        </span>
                      </div>
                    </TableCellV2>
                    
                    <TableCellV2 className="text-center">
                      <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out flex items-center justify-center gap-1">
                        {transaction.hasDocument ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        )}
                        {transaction.documentsCount > 0 && (
                          <span className="text-xs text-gray-600 font-medium">
                            {transaction.documentsCount}
                          </span>
                        )}
                      </div>
                    </TableCellV2>
                    <TableCellV2 className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(transaction);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(transaction);
                          }}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCellV2>
                  </TableRowV2>
                );
              })}
            </TableBodyV2>
          </TableV2>
        ) : (
          // Version normale avec Table
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>
                <input
                  type="checkbox"
                  checked={
                    (() => {
                      // ⚠️ PROBLÈME 1: Exclure les commissions auto du calcul "toutes sélectionnées"
                      const selectableTransactions = transactions.filter(t => !isAutoCommission(t));
                      return selectableTransactions.length > 0 && 
                             selectableTransactions.every(t => selectedTransactions.includes(t.id));
                    })()
                  }
                  ref={(input) => {
                    if (input) {
                      // ⚠️ PROBLÈME 1: État indéterminé en excluant les commissions auto
                      const selectableTransactions = transactions.filter(t => !isAutoCommission(t));
                      const allVisibleSelected = selectableTransactions.length > 0 && 
                                                 selectableTransactions.every(t => selectedTransactions.includes(t.id));
                      const someSelected = selectedTransactions.length > 0;
                      input.indeterminate = someSelected && !allVisibleSelected;
                    }
                  }}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </TableHeaderCell>
              <TableHeaderCell>Mois comptable</TableHeaderCell>
              <TableHeaderCell>Encaissement</TableHeaderCell>
              <TableHeaderCell>Libellé</TableHeaderCell>
              {!hidePropertyColumn && <TableHeaderCell>Bien</TableHeaderCell>}
              <TableHeaderCell>Nature</TableHeaderCell>
              <TableHeaderCell>Catégorie</TableHeaderCell>
              <TableHeaderCell className="text-right">Montant</TableHeaderCell>
              <TableHeaderCell className="text-center">Doc</TableHeaderCell>
              <TableHeaderCell className="text-center">Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTransactions.map((transaction) => {
              const isLoading = loadingTransactionId === transaction.id;
              return (
              <TableRow
                key={transaction.id}
                className={cn(
                  (transaction as any).isChild && "bg-gray-50/50"
                )}
                onClick={() => onRowClick(transaction)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin sidebar-loader-orange" />
                    ) : null}
                    <input
                      type="checkbox"
                      checked={selectedTransactions.includes(transaction.id)}
                      disabled={isAutoCommission(transaction)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectTransaction(transaction.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "rounded border-gray-300 text-primary-600 focus:ring-primary-500",
                        isAutoCommission(transaction) && "opacity-50 cursor-not-allowed"
                      )}
                      title={isAutoCommission(transaction) ? "Commission auto supprimée automatiquement avec son parent" : undefined}
                    />
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  {transaction.accountingMonth ? formatAccountingMonth(transaction.accountingMonth) : formatDate(transaction.date)}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {transaction.paidAt ? formatDate(transaction.paidAt) : '–'}
                </TableCell>
                
                <TableCell>
                  <div className={`max-w-xs ${(transaction as any).isChild ? 'pl-8' : ''}`}>
                    <div className="flex items-center gap-2">
                      {(transaction as any).isChild && (
                        <span className="text-red-600 font-bold" style={{ fontSize: '16px' }}>↳</span>
                      )}
                      {transaction.isAuto && transaction.autoSource === 'gestion' && (
                        <Badge variant="danger" className="text-xs font-semibold">
                          A
                        </Badge>
                      )}
                      <p className="truncate" title={transaction.label}>
                        {transaction.label}
                      </p>
                    </div>
                    {transaction.reference && (
                      <p className="text-sm text-gray-500 truncate" title={transaction.reference}>
                        Ref: {transaction.reference}
                      </p>
                    )}
                  </div>
                </TableCell>
                
                {!hidePropertyColumn && (
                  <TableCell>
                    <div className="max-w-xs">
                      <p className="font-medium truncate" title={transaction.Property.name}>
                        {transaction.Property.name}
                      </p>
                    </div>
                  </TableCell>
                )}
                
                <TableCell>
                  <Badge
                    variant={NATURE_COLORS[transaction.nature.type]}
                    className="text-xs"
                  >
                    {transaction.nature.label}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  <span className="text-sm">{transaction.Category?.label || 'Non classé'}</span>
                </TableCell>
                
                <TableCell className="text-right">
                  <span className={`font-medium ${getAmountColor(transaction.nature.type)}`}>
                    {formatAmount(transaction.amount, transaction.nature.type)}
                  </span>
                </TableCell>
                
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {transaction.hasDocument ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                    {transaction.documentsCount > 0 && (
                      <span className="text-xs text-gray-600 font-medium">
                        {transaction.documentsCount}
                      </span>
                    )}
                  </div>
                </TableCell>
                
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(transaction);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(transaction);
                      }}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
            })}
          </TableBody>
        </Table>
        )}
      </div>
    </>
  );
}
