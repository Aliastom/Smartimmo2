'use client';

import React from 'react';

export default function TransactionSkeleton() {
  return (
    <div className="bg-base-100 rounded-lg border border-neutral-200 p-4 animate-pulse">
      {/* Header avec icône et montant */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 bg-neutral-200 rounded"></div>
          <div className="w-16 h-6 bg-neutral-200 rounded-full"></div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-neutral-200 rounded"></div>
          <div className="w-20 h-6 bg-neutral-200 rounded"></div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="space-y-2 mb-3">
        <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
        <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
        <div className="h-3 bg-neutral-200 rounded w-2/3"></div>
      </div>

      {/* Tags */}
      <div className="flex space-x-2 mb-3">
        <div className="w-12 h-5 bg-neutral-200 rounded-full"></div>
        <div className="w-16 h-5 bg-neutral-200 rounded-full"></div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
        <div className="w-16 h-3 bg-neutral-200 rounded"></div>
        <div className="w-16 h-8 bg-neutral-200 rounded"></div>
      </div>
    </div>
  );
}

export function TransactionGroupSkeleton() {
  return (
    <div className="mb-8">
      {/* Header du mois */}
      <div className="sticky top-0 z-10 bg-base-100 border-b border-neutral-200 py-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="w-32 h-6 bg-neutral-200 rounded animate-pulse"></div>
          <div className="w-20 h-4 bg-neutral-200 rounded animate-pulse"></div>
        </div>
      </div>

      {/* Grid des cartes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <TransactionSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
