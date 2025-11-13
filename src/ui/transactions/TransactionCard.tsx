'use client';

import React from 'react';
import { 
  Receipt, 
  Euro, 
  Calendar, 
  Building2, 
  User, 
  FileText,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { formatCurrencyEUR, formatDateFR } from '@/utils/format';
import { TransactionCategoryBadge } from '@/ui/components/TransactionCategoryBadge';

interface TransactionCardProps {
  transaction: {
    id: string;
    date: string;
    amount: number;
    category: string;
    label: string;
    property?: {
      id: string;
      name: string;
    };
    lease?: {
      id: string;
      tenant?: {
        firstName: string;
        lastName: string;
      };
    };
    status?: string;
    tags?: string[];
  };
  onClick?: (transaction: any) => void;
  onView?: (transaction: any) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'LOYER':
      return <Building2 size={20} className="text-emerald-600" />;
    case 'CHARGES':
      return <FileText size={20} className="text-amber-600" />;
    case 'DEPOT_RECU':
    case 'DEPOT_RENDU':
      return <Euro size={20} className="text-primary" />;
    case 'AVOIR':
      return <TrendingUp size={20} className="text-indigo-600" />;
    case 'PENALITE':
      return <TrendingDown size={20} className="text-error" />;
    default:
      return <Receipt size={20} className="text-base-content opacity-80" />;
  }
};

const getAmountIcon = (amount: number) => {
  if (amount > 0) {
    return <TrendingUp size={16} className="text-emerald-600" />;
  } else if (amount < 0) {
    return <TrendingDown size={16} className="text-error" />;
  }
  return <Minus size={16} className="text-base-content opacity-80" />;
};

export default function TransactionCard({ transaction, onClick, onView }: TransactionCardProps) {
  const handleClick = () => {
    onClick?.(transaction);
  };

  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onView?.(transaction);
  };

  return (
    <div
      className="bg-base-100 rounded-lg border border-neutral-200 p-4 hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      onClick={handleClick}
      tabIndex={0}
      role="button"
      aria-label={`Transaction ${transaction.label} du ${formatDateFR(transaction.date)}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Header avec icône et montant */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getCategoryIcon(transaction.Category)}
          <div>
            <TransactionCategoryBadge category={transaction.Category} />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getAmountIcon(transaction.amount)}
          <span className={`text-lg font-semibold ${
            transaction.amount > 0 ? 'text-emerald-600' : 
            transaction.amount < 0 ? 'text-error' : 'text-base-content opacity-80'
          }`}>
            {formatCurrencyEUR(Math.abs(transaction.amount))}
          </span>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="space-y-2 mb-3">
        <h3 className="font-medium text-neutral-900 line-clamp-2">
          {transaction.label}
        </h3>
        
        <div className="flex items-center space-x-2 text-sm text-neutral-600">
          <Calendar size={14} />
          <span>{formatDateFR(transaction.date)}</span>
        </div>

        {transaction.Property && (
          <div className="flex items-center space-x-2 text-sm text-neutral-600">
            <Building2 size={14} />
            <span className="truncate">{transaction.Property.name}</span>
          </div>
        )}

        {transaction.lease?.Tenant && (
          <div className="flex items-center space-x-2 text-sm text-neutral-600">
            <User size={14} />
            <span>
              {transaction.lease.Tenant.firstName} {transaction.lease.Tenant.lastName}
            </span>
          </div>
        )}
      </div>

      {/* Tags */}
      {transaction.tags && transaction.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {transaction.tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer avec bouton d'action */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
        <div className="text-xs text-neutral-500">
          ID: {transaction.id.slice(-8)}
        </div>
        <button
          onClick={handleViewClick}
          className="inline-flex items-center space-x-1 px-3 py-1 text-sm font-medium text-primary hover:text-primary hover:bg-blue-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          aria-label={`Voir les détails de la transaction ${transaction.label}`}
        >
          <Eye size={14} />
          <span>Voir</span>
        </button>
      </div>
    </div>
  );
}
