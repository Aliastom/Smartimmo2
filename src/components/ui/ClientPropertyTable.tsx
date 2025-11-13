'use client';

import React from 'react';
import { cn } from '@/utils/cn';
import { Button } from './Button';
import { Eye, Settings } from 'lucide-react';

export interface ClientPropertyTableProps<T> {
  data: T[];
  className?: string;
  hover?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;
  onRowClick?: (row: T, index: number) => void;
}

export function ClientPropertyTable<T extends Record<string, any>>({
  data,
  className,
  hover = true,
  compact = false,
  stickyHeader = true,
  onRowClick,
}: ClientPropertyTableProps<T>) {
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
                Bien
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Adresse
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Locataire
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Loyer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
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
                  <div className="font-medium text-gray-900">{row.name}</div>
                </td>
                <td className={cn("px-6 py-4 whitespace-nowrap text-sm text-gray-500", compact ? "py-2" : "py-4")}>
                  {row.address}
                </td>
                <td className={cn("px-6 py-4 whitespace-nowrap text-sm text-gray-900", compact ? "py-2" : "py-4")}>
                  {row.Tenant}
                </td>
                <td className={cn("px-6 py-4 whitespace-nowrap text-sm text-gray-900", compact ? "py-2" : "py-4")}>
                  <span className="font-medium text-gray-900">{row.rent}</span>
                </td>
                <td className={cn("px-6 py-4 whitespace-nowrap text-sm text-gray-900", compact ? "py-2" : "py-4")}>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    row.status === 'occupied' 
                      ? 'bg-success-100 text-success-800' 
                      : 'bg-warning-100 text-warning-800'
                  }`}>
                    {row.status === 'occupied' ? 'Occupé' : 'Vacant'}
                  </span>
                </td>
                <td className={cn("px-6 py-4 whitespace-nowrap text-sm text-gray-900", compact ? "py-2" : "py-4")}>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
