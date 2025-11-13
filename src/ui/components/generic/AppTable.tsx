'use client';

import React from 'react';
import { 
  Table, 
  TableHeader, 
  TableRowHover, 
  TableCell,
  combineClasses 
} from '@/ui/tokens';

interface AppTableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
  striped?: boolean;
  hover?: boolean;
  compact?: boolean;
}

export function AppTable({
  headers,
  children,
  className = '',
  striped = true,
  hover = true,
  compact = false
}: AppTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={combineClasses(
        Table,
        compact && 'table-sm',
        className
      )}>
        <thead>
          <tr className={TableHeader}>
            {headers.map((header, index) => (
              <th key={index} className={TableCell}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {React.Children.map(children, (child, index) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, {
                className: combineClasses(
                  child.props.className,
                  hover && TableRowHover,
                  striped && index % 2 === 1 && 'bg-base-200 opacity-30'
                )
              } as any);
            }
            return child;
          })}
        </tbody>
      </table>
    </div>
  );
}

interface AppTableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function AppTableRow({ children, className = '', onClick }: AppTableRowProps) {
  const Component = onClick ? 'button' : 'tr';
  
  return (
    <Component
      className={combineClasses(className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </Component>
  );
}

interface AppTableCellProps {
  children: React.ReactNode;
  className?: string;
}

export function AppTableCell({ children, className = '' }: AppTableCellProps) {
  return (
    <td className={combineClasses(TableCell, className)}>
      {children}
    </td>
  );
}
