import React from 'react';
import { Button } from '@/ui/shared/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  showLoadMore?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  hasMore,
  onLoadMore,
  showLoadMore = false,
}: PaginationProps) {
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
      const end = Math.min(totalPages, start + maxVisible - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  if (totalPages <= 1 && !showLoadMore) {
    return null;
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Bouton "Afficher plus" si activé */}
      {showLoadMore && hasMore && (
        <Button
          variant="outline"
          onClick={onLoadMore}
          className="w-full max-w-xs"
        >
          Afficher plus de documents
        </Button>
      )}

      {/* Pagination numérique */}
      {totalPages > 1 && (
        <div className="flex items-center space-x-2">
          {/* Bouton précédent */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Numéros de page */}
          {getPageNumbers().map((page) => (
            <Button
              key={page}
              variant={page === currentPage ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page)}
              className={cn(
                "min-w-[40px]",
                page === currentPage && "bg-primary text-primary-foreground"
              )}
            >
              {page}
            </Button>
          ))}

          {/* Bouton suivant */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Info sur la pagination */}
      <div className="text-sm text-base-content opacity-70">
        Page {currentPage} sur {totalPages}
      </div>
    </div>
  );
}
