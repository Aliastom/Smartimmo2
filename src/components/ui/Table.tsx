'use client';

import React from 'react';
import { cn } from '@/utils/cn';

export interface TableProps {
  children: React.ReactNode;
  className?: string;
  striped?: boolean;
  hover?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;
}

export function Table({ 
  children, 
  className, 
  striped = true, 
  hover = true, 
  compact = false,
  stickyHeader = true 
}: TableProps) {
  return (
    <div className={cn("table-base", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child) && child.type === TableHeader) {
              return React.cloneElement(child, { 
                sticky: stickyHeader,
                compact 
              } as any);
            }
            if (React.isValidElement(child) && child.type === TableBody) {
              return React.cloneElement(child, { 
                striped, 
                hover, 
                compact 
              } as any);
            }
            return child;
          })}
        </table>
      </div>
    </div>
  );
}

export interface TableHeaderProps {
  children: React.ReactNode;
  sticky?: boolean;
  compact?: boolean;
}

export function TableHeader({ children, sticky = true, compact = false }: TableHeaderProps) {
  return (
    <thead className={cn(
      "table-header",
      sticky && "sticky top-0 z-10"
    )}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === TableRow) {
          return React.cloneElement(child, { compact } as any);
        }
        return child;
      })}
    </thead>
  );
}

export interface TableBodyProps {
  children: React.ReactNode;
  striped?: boolean;
  hover?: boolean;
  compact?: boolean;
}

export function TableBody({ children, striped = true, hover = true, compact = false }: TableBodyProps) {
  return (
    <tbody className="bg-white divide-y divide-gray-200">
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child) && child.type === TableRow) {
          return React.cloneElement(child, { 
            striped: striped && index % 2 === 1,
            hover, 
            compact 
          } as any);
        }
        return child;
      })}
    </tbody>
  );
}

export interface TableRowProps {
  children: React.ReactNode;
  striped?: boolean;
  hover?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export function TableRow({ children, striped = false, hover = true, compact = false, onClick }: TableRowProps) {
  return (
    <tr
      className={cn(
        "table-row",
        striped && "bg-gray-50",
        hover && "hover:bg-gray-100 cursor-pointer",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && (child.type === TableCell || child.type === TableHeaderCell)) {
          return React.cloneElement(child, { compact } as any);
        }
        return child;
      })}
    </tr>
  );
}

export interface TableHeaderCellProps {
  children: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export function TableHeaderCell({ children, compact = false, className }: TableHeaderCellProps) {
  return (
    <th className={cn(
      "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
      compact ? "py-2" : "py-3",
      className
    )}>
      {children}
    </th>
  );
}

export interface TableCellProps {
  children: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export function TableCell({ children, compact = false, className }: TableCellProps) {
  return (
    <td className={cn(
      "px-6 py-4 whitespace-nowrap text-sm text-gray-900",
      compact ? "py-2" : "py-4",
      className
    )}>
      {children}
    </td>
  );
}
