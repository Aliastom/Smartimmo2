import React from 'react';
import { DocumentType } from '@/types/document';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/shared/select';
import { Badge } from '@/ui/shared/badge';
import { LucideIcon, FileText, Receipt, FileCheck, ClipboardList, ClipboardX, Shield, ReceiptEuro, CreditCard, Image, Folder } from 'lucide-react';

// Mapping des icônes Lucide
const iconMap: Record<string, LucideIcon> = {
  FileText,
  Receipt,
  FileCheck,
  ClipboardList,
  ClipboardX,
  Shield,
  ReceiptEuro,
  CreditCard,
  Image,
  Folder,
};

// Fonction pour obtenir l'icône correspondante
const getIcon = (iconName?: string): LucideIcon => {
  if (!iconName) return FileText; // Icône par défaut
  return iconMap[iconName] || FileText;
};

interface DocumentTypeSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  documentTypes: DocumentType[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function DocumentTypeSelect({
  value,
  onValueChange,
  documentTypes,
  placeholder = "Sélectionner un type de document",
  disabled = false,
  required = false,
}: DocumentTypeSelectProps) {
  const getIcon = (iconName?: string) => {
    if (!iconName || !iconMap[iconName]) {
      return FileText; // Icône par défaut
    }
    return iconMap[iconName];
  };

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled} required={required}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {value && (
            <div className="flex items-center gap-2">
              {(() => {
                const selectedType = documentTypes.find(dt => dt.id === value);
                if (!selectedType) return null;
                
                const IconComponent = getIcon(selectedType.icon);
                return (
                  <>
                    <IconComponent className="h-4 w-4" />
                    <span>{selectedType.label}</span>
                    {selectedType.isSystem && (
                      <Badge variant="secondary" className="text-xs">
                        Système
                      </Badge>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(documentTypes || [])
          .filter(dt => dt.isActive)
          .sort((a, b) => (a.order || 0) - (b.order || 0) || a.label.localeCompare(b.label))
          .map((documentType) => {
            const IconComponent = getIcon(documentType.icon);
            return (
              <SelectItem key={documentType.id} value={documentType.id}>
                <div className="flex items-center gap-2">
                  <IconComponent className="h-4 w-4" />
                  <span>{documentType.label}</span>
                  {documentType.isSystem && (
                    <Badge variant="secondary" className="text-xs">
                      Système
                    </Badge>
                  )}
                </div>
              </SelectItem>
            );
          })}
      </SelectContent>
    </Select>
  );
}

// Composant pour afficher un badge de type de document
interface DocumentTypeBadgeProps {
  documentType: DocumentType;
  variant?: 'default' | 'secondary' | 'outline';
}

export function DocumentTypeBadge({ documentType, variant = 'default' }: DocumentTypeBadgeProps) {
  const IconComponent = getIcon(documentType.icon);

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      <IconComponent className="h-3 w-3" />
      <span>{documentType.label}</span>
    </Badge>
  );
}

// Composant pour filtrer par type de document
interface DocumentTypeFilterProps {
  documentTypes: DocumentType[];
  selectedTypes: string[];
  onSelectionChange: (selectedTypes: string[]) => void;
  placeholder?: string;
}

export function DocumentTypeFilter({
  documentTypes,
  selectedTypes,
  onSelectionChange,
  placeholder = "Filtrer par type",
}: DocumentTypeFilterProps) {
  const handleTypeToggle = (typeId: string) => {
    const newSelection = selectedTypes.includes(typeId)
      ? selectedTypes.filter(id => id !== typeId)
      : [...selectedTypes, typeId];
    
    onSelectionChange(newSelection);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{placeholder}</label>
      <div className="flex flex-wrap gap-2">
        {documentTypes
          .filter(dt => dt.isActive)
          .sort((a, b) => (a.order || 0) - (b.order || 0) || a.label.localeCompare(b.label))
          .map((documentType) => {
            const IconComponent = getIcon(documentType.icon);
            const isSelected = selectedTypes.includes(documentType.id);
            
            return (
              <button
                key={documentType.id}
                onClick={() => handleTypeToggle(documentType.id)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm border transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-accent'
                }`}
              >
                <IconComponent className="h-3 w-3" />
                <span>{documentType.label}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
