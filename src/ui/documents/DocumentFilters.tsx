import React from 'react';
import { DocumentType, DocumentTypeFilter } from '@/ui/shared/DocumentTypeSelect';
import { Input } from '@/ui/shared/input';
import { Label } from '@/ui/shared/label';
import { Button } from '@/ui/shared/button';
import { Search, X, Filter } from 'lucide-react';
import { getIcon } from '@/utils/icons';

interface DocumentFiltersProps {
  documentTypes: DocumentType[];
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount: number;
  onClearFilters: () => void;
}

export function DocumentFilters({
  documentTypes,
  selectedTypes,
  onTypesChange,
  searchQuery,
  onSearchChange,
  totalCount,
  onClearFilters,
}: DocumentFiltersProps) {
  const hasActiveFilters = selectedTypes.length > 0 || searchQuery.length > 0;

  return (
    <div className="bg-base-100 p-6 rounded-lg border border-neutral-200 space-y-4">
      {/* En-tête avec compteur */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Documents ({totalCount})
        </h3>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="text-base-content opacity-70 hover:text-base-content opacity-90"
          >
            <X className="h-4 w-4 mr-1" />
            Effacer les filtres
          </Button>
        )}
      </div>

      {/* Filtres rapides par type */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-base-content opacity-70" />
          <Label className="text-sm font-medium">Filtres rapides :</Label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedTypes.length === 0 ? "default" : "outline"}
            size="sm"
            onClick={() => onTypesChange([])}
            className="text-xs"
          >
            Tous ({totalCount})
          </Button>
          {documentTypes.slice(0, 8).map((type) => {
            const isSelected = selectedTypes.includes(type.id);
            const IconComponent = getIcon(type.icon);
            return (
              <Button
                key={type.id}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (isSelected) {
                    onTypesChange(selectedTypes.filter(id => id !== type.id));
                  } else {
                    onTypesChange([...selectedTypes, type.id]);
                  }
                }}
                className="text-xs flex items-center gap-1"
              >
                <IconComponent className="h-3 w-3" />
                {type.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Filtres avancés */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
        {/* Filtre par type (avancé) */}
        <div className="space-y-2">
          <Label>Filtre par type (avancé)</Label>
          <DocumentTypeFilter
            documentTypes={documentTypes}
            selectedTypes={selectedTypes}
            onSelectionChange={onTypesChange}
            placeholder="Sélectionner des types..."
          />
        </div>

        {/* Recherche */}
        <div className="space-y-2">
          <Label htmlFor="search">Rechercher</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-base-content opacity-60" />
            <Input
              id="search"
              type="text"
              placeholder="Nom du fichier, description..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Indicateurs de filtres actifs */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {selectedTypes.length > 0 && (
            <span className="text-sm text-primary bg-blue-50 px-2 py-1 rounded">
              {selectedTypes.length} type(s) sélectionné(s)
            </span>
          )}
          {searchQuery.length > 0 && (
            <span className="text-sm text-success bg-green-50 px-2 py-1 rounded">
              Recherche: "{searchQuery}"
            </span>
          )}
        </div>
      )}
    </div>
  );
}
