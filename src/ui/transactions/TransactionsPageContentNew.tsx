'use client';

import React, { useState } from 'react';
import { Plus, Grid, List } from 'lucide-react';
import TransactionFilters from './TransactionFilters';
import TransactionsGrid from './TransactionsGrid';
import { useTransactionsTable } from './useTransactionsTable';

interface TransactionsPageContentNewProps {
  context?: 'global' | 'property';
  propertyId?: string;
}

export default function TransactionsPageContentNew({ 
  context = 'global', 
  propertyId 
}: TransactionsPageContentNewProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [filters, setFilters] = useState({});

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleAddTransaction = () => {
    // TODO: Ouvrir modal de création
    console.log('Add transaction');
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">
                {context === 'property' ? 'Transactions du bien' : 'Transactions'}
              </h1>
              <p className="mt-2 text-neutral-600">
                Gérez vos transactions financières
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Toggle vue */}
              <div className="flex items-center bg-base-100 rounded-lg border border-neutral-200 p-1">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'cards'
                      ? 'bg-blue-100 text-primary'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                  aria-label="Vue en cartes"
                >
                  <Grid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'table'
                      ? 'bg-blue-100 text-primary'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                  aria-label="Vue en tableau"
                >
                  <List size={18} />
                </button>
              </div>

              {/* Bouton ajouter */}
              <button
                onClick={handleAddTransaction}
                className="bg-primary-700 text-base-100 px-4 py-2 rounded-md shadow-md hover:bg-primary-800 transition-colors flex items-center space-x-2"
              >
                <Plus size={20} />
                <span>Nouvelle transaction</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <TransactionFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
        />

        {/* Contenu principal */}
        {viewMode === 'cards' ? (
          <TransactionsGrid
            context={context}
            propertyId={propertyId}
            initialFilters={filters}
          />
        ) : (
          <div className="bg-base-100 rounded-lg border border-neutral-200 p-4">
            <p className="text-center text-neutral-500 py-8">
              Vue tableau - À implémenter
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
