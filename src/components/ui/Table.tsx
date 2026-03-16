'use client';

import React from 'react';
import { cn } from '@/utils/cn';
import { useUI2 } from '@/hooks/useUI2';

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
  const isUI2Active = useUI2();
  
  return (
    <div className={cn("table-base", className)}>
      <div className={cn("overflow-x-auto", isUI2Active && "ui2-table-wrapper")}>
        <table className={cn("w-full", isUI2Active && "ui2-table")}>
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child) && child.type === TableHeader) {
              return React.cloneElement(child, { 
                sticky: stickyHeader,
                compact,
                useUI2: isUI2Active
              } as any);
            }
            if (React.isValidElement(child) && child.type === TableBody) {
              return React.cloneElement(child, { 
                striped, 
                hover, 
                compact,
                useUI2: isUI2Active
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
  useUI2?: boolean;
}

export function TableHeader({ children, sticky = true, compact = false, useUI2 = false }: TableHeaderProps) {
  return (
    <thead className={cn(
      "table-header",
      sticky && "sticky top-0 z-10",
      useUI2 && "bg-white border-b border-gray-200"
    )}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === TableRow) {
          return React.cloneElement(child, { compact, useUI2 } as any);
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
  useUI2?: boolean;
}

export function TableBody({ children, striped = true, hover = true, compact = false, useUI2 = false }: TableBodyProps) {
  return (
    <tbody className={cn(
      "bg-white",
      !useUI2 && "divide-y divide-gray-200"
    )}>
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child) && child.type === TableRow) {
          return React.cloneElement(child, { 
            striped: striped && index % 2 === 1,
            hover, 
            compact,
            useUI2
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
  className?: string;
  useUI2?: boolean;
}

export function TableRow({ children, striped = false, hover = true, compact = false, onClick, className, useUI2 = false }: TableRowProps) {
  return (
    <tr
      className={cn(
        "table-row",
        useUI2 && "ui2-table-row",
        !useUI2 && striped && "bg-gray-50",
        !useUI2 && hover && "hover:bg-gray-100 cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && (child.type === TableCell || child.type === TableHeaderCell)) {
          return React.cloneElement(child, { compact, useUI2 } as any);
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
  useUI2?: boolean;
}

export function TableHeaderCell({ children, compact = false, className, useUI2 = false }: TableHeaderCellProps) {
  return (
    <th className={cn(
      "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
      compact ? "py-2" : "py-3",
      useUI2 && "ui2-table-header-cell",
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
  useUI2?: boolean;
  colSpan?: number;
}

export function TableCell({ children, compact = false, className, useUI2 = false, colSpan }: TableCellProps) {
  return (
    <td colSpan={colSpan} className={cn(
      "px-6 py-4 whitespace-nowrap text-sm text-gray-900",
      compact ? "py-2" : "py-4",
      useUI2 && "ui2-table-cell",
      className
    )}>
      {children}
    </td>
  );
}
