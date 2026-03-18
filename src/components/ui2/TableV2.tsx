'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/utils/cn';

export interface TableV2Props {
  children: React.ReactNode;
  className?: string;
}

export function TableV2({ children, className }: TableV2Props) {
  return (
    <div className={cn("overflow-x-auto ui2-table-wrapper", className)}>
      <table className="w-full border-collapse ui2-table">
        {children}
      </table>
    </div>
  );
}

export interface TableHeaderV2Props {
  children: React.ReactNode;
}

export function TableHeaderV2({ children }: TableHeaderV2Props) {
  return (
    <thead className="bg-white border-b border-gray-200">
      {children}
    </thead>
  );
}

export interface TableBodyV2Props {
  children: React.ReactNode;
}

export function TableBodyV2({ children }: TableBodyV2Props) {
  return (
    <tbody className="bg-white divide-y divide-gray-200">
      {children}
    </tbody>
  );
}

export interface TableRowV2Props {
  children: React.ReactNode;
  onHoverInfo?: React.ReactNode; // Sous-texte optionnel pour la cellule "Bien"
  onHoverActions?: React.ReactNode; // Actions pour la colonne Actions
  onClick?: () => void;
  className?: string;
}

// Hook pour détecter si on est sur mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 768 || 
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        (typeof window !== 'undefined' && 'ontouchstart' in window)
      );
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

export function TableRowV2({ 
  children, 
  onHoverInfo, 
  onHoverActions,
  onClick,
  className 
}: TableRowV2Props) {
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);
  const lastTapRef = useRef<number>(0);

  // Gestion du clic (mobile uniquement pour expansion)
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isMobile && onHoverActions) {
      e.stopPropagation();
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;
      
      if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
        setIsExpanded(false);
        if (onClick) onClick();
        lastTapRef.current = 0;
        return;
      }
      
      lastTapRef.current = now;
      setIsExpanded(!isExpanded);
      return;
    }
    
    if (onClick) {
      onClick();
    }
  }, [isMobile, onHoverActions, onClick, isExpanded]);

  // Fermer l'expansion sur mobile quand on scroll
  useEffect(() => {
    if (!isMobile || !isExpanded) return;

    const handleScroll = () => {
      setIsExpanded(false);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile, isExpanded]);

  // Convertir children en tableau pour pouvoir insérer le sous-texte
  const childrenArray = React.Children.toArray(children);
  const firstCell = childrenArray[0];
  const restCells = childrenArray.slice(1);

  return (
    <tr
      className={cn(
        "ui2-table-row group transition-colors",
        onClick && "cursor-pointer hover:bg-gray-50 active:bg-gray-100",
        isMobile && isExpanded && "ui2-table-row-mobile-expanded",
        className
      )}
      onClick={handleClick}
    >
      {/* Première cellule avec sous-texte optionnel */}
      {React.isValidElement(firstCell) ? (
        React.cloneElement(firstCell as React.ReactElement<any>, {
          children: (
            <>
              {React.Children.toArray(firstCell.props.children)}
              {onHoverInfo && (
                <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out mt-1 text-xs text-gray-500">
                  {onHoverInfo}
                </div>
              )}
            </>
          )
        })
      ) : firstCell}
      
      {/* Reste des cellules normales */}
      {restCells}
      
      {/* Colonne Actions - toujours présente, quasi invisible hors hover */}
      {onHoverActions && (
        <td className="px-6 py-4 opacity-[0.01] group-hover:opacity-100 transition-opacity duration-150 ease-in-out w-1 whitespace-nowrap">
          <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
            {onHoverActions}
          </div>
        </td>
      )}
    </tr>
  );
}

export interface TableHeaderCellV2Props {
  children: React.ReactNode;
  className?: string;
}

export function TableHeaderCellV2({ children, className }: TableHeaderCellV2Props) {
  return (
    <th className={cn(
      "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ui2-table-header-cell",
      className
    )}>
      {children}
    </th>
  );
}

export interface TableCellV2Props {
  children: React.ReactNode;
  className?: string;
}

export function TableCellV2({ children, className }: TableCellV2Props) {
  return (
    <td className={cn(
      "px-6 py-4 whitespace-nowrap text-sm text-gray-900 ui2-table-cell align-middle",
      className
    )}>
      {children}
    </td>
  );
}
