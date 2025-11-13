'use client';

import React from 'react';
import { cn } from '@/utils/cn';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  className?: string;
  striped?: boolean;
  hover?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;
  onRowClick?: (row: T, index: number) => void;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  className,
  striped = true,
  hover = true,
  compact = false,
  stickyHeader = true,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-gray-200", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={cn(
            "bg-gray-50",
            stickyHeader && "sticky top-0 z-10"
          )}>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={cn(
                    "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                    compact ? "py-2" : "py-3",
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={cn(
                  "transition-colors duration-150",
                  striped && rowIndex % 2 === 1 && "bg-gray-50",
                  hover && "hover:bg-gray-100 cursor-pointer",
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(row, rowIndex)}
              >
                {columns.map((column, colIndex) => (
                  <td
                    key={colIndex}
                    className={cn(
                      "px-6 py-4 whitespace-nowrap text-sm text-gray-900",
                      compact ? "py-2" : "py-4",
                      column.className
                    )}
                  >
                    {column.render
                      ? column.render(row[column.key as keyof T], row, rowIndex)
                      : row[column.key as keyof T]
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
