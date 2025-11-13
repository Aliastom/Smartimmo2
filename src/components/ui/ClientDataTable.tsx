'use client';

import React from 'react';
import { cn } from '@/utils/cn';
import { CreditCard } from 'lucide-react';

export interface ClientDataTableProps<T> {
  data: T[];
  className?: string;
  hover?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;
  onRowClick?: (row: T, index: number) => void;
}

export function ClientDataTable<T extends Record<string, any>>({
  data,
  className,
  hover = true,
  compact = false,
  stickyHeader = true,
  onRowClick,
}: ClientDataTableProps<T>) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-gray-200", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={cn(
            "bg-gray-50",
            stickyHeader && "sticky top-0 z-10"
          )}>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transaction
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Locataire
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Montant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={cn(
                  "transition-colors duration-150",
                  rowIndex % 2 === 1 && "bg-gray-50",
                  hover && "hover:bg-gray-100 cursor-pointer",
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(row, rowIndex)}
              >
                <td className={cn("px-6 py-4 whitespace-nowrap text-sm text-gray-900", compact ? "py-2" : "py-4")}>
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">{row.type}</div>
                      <div className="text-sm text-gray-500">{row.Property}</div>
                    </div>
                  </div>
                </td>
                <td className={cn("px-6 py-4 whitespace-nowrap text-sm text-gray-900", compact ? "py-2" : "py-4")}>
                  {row.Tenant}
                </td>
                <td className={cn("px-6 py-4 whitespace-nowrap text-sm text-gray-900", compact ? "py-2" : "py-4")}>
                  <span className="font-medium text-gray-900">{row.amount}</span>
                </td>
                <td className={cn("px-6 py-4 whitespace-nowrap text-sm text-gray-900", compact ? "py-2" : "py-4")}>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    row.status === 'paid' 
                      ? 'bg-success-100 text-success-800' 
                      : 'bg-warning-100 text-warning-800'
                  }`}>
                    {row.status === 'paid' ? 'Payé' : 'En attente'}
                  </span>
                </td>
                <td className={cn("px-6 py-4 whitespace-nowrap text-sm text-gray-500", compact ? "py-2" : "py-4")}>
                  {row.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
