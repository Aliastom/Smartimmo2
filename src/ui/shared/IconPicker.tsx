'use client';

import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { cn } from '@/lib/utils';

// Liste des icônes les plus courantes pour les documents
const COMMON_ICONS = [
  'FileText',
  'Receipt',
  'FileCheck',
  'File',
  'Files',
  'Folder',
  'FolderOpen',
  'Home',
  'LogOut',
  'LogIn',
  'CreditCard',
  'Shield',
  'Camera',
  'Image',
  'Paperclip',
  'Edit',
  'Edit3',
  'ClipboardList',
  'ClipboardCheck',
  'ClipboardX',
  'FileSignature',
  'FileBadge',
  'FileKey',
  'FileSpreadsheet',
  'Archive',
  'Inbox',
  'Send',
  'Download',
  'Upload',
];

interface IconPickerProps {
  value?: string;
  onChange: (iconName: string) => void;
  label?: string;
  className?: string;
}

export function IconPicker({ value, onChange, label, className }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredIcons = COMMON_ICONS.filter(iconName =>
    iconName.toLowerCase().includes(search.toLowerCase())
  );

  const getIconComponent = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName];
    return Icon || LucideIcons.File;
  };

  const CurrentIcon = value ? getIconComponent(value) : LucideIcons.File;

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full justify-start gap-2"
        >
          <CurrentIcon className="h-4 w-4" />
          <span>{value || 'Sélectionner une icône'}</span>
        </Button>

        {isOpen && (
          <>
            {/* Overlay pour fermer */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <div className="absolute z-50 mt-2 w-full max-w-md rounded-lg border border-neutral-200 bg-base-100 p-4 shadow-lg">
              <div className="mb-3">
                <Input
                  type="text"
                  placeholder="Rechercher une icône..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="grid max-h-64 grid-cols-6 gap-2 overflow-y-auto">
                {filteredIcons.map((iconName) => {
                  const Icon = getIconComponent(iconName);
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => {
                        onChange(iconName);
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-md border transition-colors hover:bg-neutral-100',
                        value === iconName
                          ? 'border-primary bg-blue-50'
                          : 'border-neutral-200'
                      )}
                      title={iconName}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>

              {filteredIcons.length === 0 && (
                <p className="py-4 text-center text-sm text-neutral-500">
                  Aucune icône trouvée
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

