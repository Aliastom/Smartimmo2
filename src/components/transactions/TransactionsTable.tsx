'use client';

import React, { useState, useMemo } from 'react';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkeletonTable, EmptyState, useLoadingDelay } from '@/components/ui';
import { Edit, Trash2, CheckCircle, AlertTriangle, FileText, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

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
  onSelectAll
}: TransactionsTableProps) {
  const [sortField, setSortField] = useState<SortField>('accountingMonth');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Utiliser selectedTransactionIds passé en prop au lieu de l'état local
  const selectedTransactions = selectedTransactionIds;

  // Fonctions de gestion de sélection - déléguer au parent
  const handleSelectAll = () => {
    if (onSelectAll) {
      const shouldSelectAll = selectedTransactions.length !== transactions.length;
      onSelectAll(shouldSelectAll);
    }
  };

  const handleSelectTransaction = (transactionId: string) => {
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
    if (sortField === field) {
      // Toggle order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to desc
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-blue-600" />
      : <ArrowDown className="h-4 w-4 text-blue-600" />;
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
      <div className="flex items-center justify-between mb-4 pb-3 border-b">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{transactions.length}</span> transaction{transactions.length > 1 ? 's' : ''} affichée{transactions.length > 1 ? 's' : ''}
          {totalCount && totalCount !== transactions.length && (
            <span className="text-gray-500"> / {totalCount} au total</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Tri rapide:</span>
          <button
            onClick={() => handleSort('accountingMonth')}
            className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
              sortField === 'accountingMonth' 
                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                : 'bg-white border-gray-300 hover:bg-gray-50'
            }`}
            title="Trier par mois comptable"
          >
            Mois comptable {getSortIcon('accountingMonth')}
          </button>
          <button
            onClick={() => handleSort('date')}
            className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
              sortField === 'date' 
                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                : 'bg-white border-gray-300 hover:bg-gray-50'
            }`}
            title="Trier par date"
          >
            Date {getSortIcon('date')}
          </button>
          <button
            onClick={() => handleSort('amount')}
            className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
              sortField === 'amount' 
                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                : 'bg-white border-gray-300 hover:bg-gray-50'
            }`}
            title="Trier par montant"
          >
            Montant {getSortIcon('amount')}
          </button>
          <button
            onClick={() => handleSort('nature')}
            className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
              sortField === 'nature' 
                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                : 'bg-white border-gray-300 hover:bg-gray-50'
            }`}
            title="Trier par nature"
          >
            Nature {getSortIcon('nature')}
          </button>
        </div>
      </div>

      {/* La barre de sélection est maintenant gérée dans TransactionsClient */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>
                <input
                  type="checkbox"
                  checked={selectedTransactions.length === transactions.length && transactions.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </TableHeaderCell>
              <TableHeaderCell>Mois comptable</TableHeaderCell>
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
            {sortedTransactions.map((transaction) => (
              <TableRow
                key={transaction.id}
                className={`hover:bg-gray-50 cursor-pointer ${
                  (transaction as any).isChild ? 'bg-gray-50/50' : ''
                }`}
                onClick={() => onRowClick(transaction)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedTransactions.includes(transaction.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleSelectTransaction(transaction.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {transaction.accountingMonth ? formatAccountingMonth(transaction.accountingMonth) : formatDate(transaction.date)}
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
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
