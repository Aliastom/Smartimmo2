'use client';

import React, { useState, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import TransactionGroup from './TransactionGroup';
import { TransactionGroupSkeleton } from './TransactionSkeleton';
import { formatMonthYearFR } from '@/utils/format';

interface TransactionsGridProps {
  context?: 'global' | 'property';
  propertyId?: string;
  initialFilters?: any;
}

export default function TransactionsGrid({ 
  context = 'global', 
  propertyId, 
  initialFilters = {} 
}: TransactionsGridProps) {
  const [filters, setFilters] = useState(initialFilters);

  // Requête infinie pour les transactions
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error
  } = useInfiniteQuery({
    queryKey: ['transactions', { context, propertyId, filters }],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: '20',
        ...filters
      });
      
      if (propertyId) {
        params.append('propertyId', propertyId);
      }

      const response = await fetch(`/api/payments?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      
      return response.json();
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.items.length < 20) return undefined;
      return pages.length + 1;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Grouper les transactions par mois
  const groupedTransactions = useMemo(() => {
    if (!data?.pages) return {};

    const allTransactions = data.pages.flatMap(page => page.items);
    
    return allTransactions.reduce((groups: any, transaction: any) => {
      const date = new Date(transaction.date);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const key = `${year}-${month}`;
      
      if (!groups[key]) {
        groups[key] = {
          month,
          year,
          transactions: []
        };
      }
      
      groups[key].Transaction.push(transaction);
      return groups;
    }, {});
  }, [data]);

  const handleTransactionClick = (transaction: any) => {
    // TODO: Ouvrir modal de détail ou navigation
    console.log('Transaction clicked:', transaction);
  };

  const handleTransactionView = (transaction: any) => {
    // TODO: Navigation vers détail
    console.log('Transaction view:', transaction);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TransactionGroupSkeleton />
        <TransactionGroupSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8">
        <p className="text-error">Erreur lors du chargement des transactions</p>
        <p className="text-sm text-neutral-500 mt-2">{error?.message}</p>
      </div>
    );
  }

  const groupKeys = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  if (groupKeys.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-neutral-400 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-neutral-900 mb-2">Aucune transaction</h3>
        <p className="text-neutral-500">Aucune transaction ne correspond à vos critères de recherche.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Groupes de transactions */}
      {groupKeys.map((key) => {
        const group = groupedTransactions[key];
        return (
          <TransactionGroup
            key={key}
            month={group.month}
            year={group.year}
            transactions={group.Transaction}
            onTransactionClick={handleTransactionClick}
            onTransactionView={handleTransactionView}
          />
        );
      })}

      {/* Bouton charger plus */}
      {hasNextPage && (
        <div className="text-center py-6">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="inline-flex items-center px-4 py-2 border border-neutral-300 rounded-md shadow-sm text-sm font-medium text-neutral-700 bg-base-100 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFetchingNextPage ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Chargement...
              </>
            ) : (
              'Charger plus de transactions'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
