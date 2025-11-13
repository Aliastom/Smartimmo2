'use client';

import React, { useEffect } from 'react';
import { cn } from '@/utils/cn';
import { LoadingDots } from './LoadingDots';
import { X, AlertCircle } from 'lucide-react';

interface BlockingOverlayProps {
  show: boolean;
  label?: string;
  description?: string;
  progress?: number;
  canCancel?: boolean;
  onCancel?: () => void;
  canBackground?: boolean;
  onBackground?: () => void;
  icon?: React.ReactNode;
  variant?: 'loading' | 'processing' | 'uploading' | 'exporting';
  className?: string;
}

const variantConfig = {
  loading: {
    defaultLabel: 'Chargement...',
    icon: null,
    color: 'text-primary'
  },
  processing: {
    defaultLabel: 'Traitement en cours...',
    icon: null,
    color: 'text-blue-600'
  },
  uploading: {
    defaultLabel: 'Envoi des fichiers...',
    icon: null,
    color: 'text-green-600'
  },
  exporting: {
    defaultLabel: 'Préparation de l\'export...',
    icon: null,
    color: 'text-purple-600'
  }
};

export function BlockingOverlay({ 
  show,
  label,
  description,
  progress,
  canCancel = false,
  onCancel,
  canBackground = false,
  onBackground,
  icon,
  variant = 'loading',
  className
}: BlockingOverlayProps) {
  const config = variantConfig[variant];
  const displayLabel = label || config.defaultLabel;

  // Bloquer le scroll quand l'overlay est visible
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [show]);

  // Gérer la touche Escape pour annuler
  useEffect(() => {
    if (!show || !canCancel || !onCancel) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, canCancel, onCancel]);

  if (!show) return null;

  return (
    <div 
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-black/50 backdrop-blur-sm',
        'animate-in fade-in duration-200',
        className
      )}
      role="alert"
      aria-live="assertive"
      aria-busy="true"
    >
      <div className={cn(
        'bg-white rounded-2xl shadow-2xl p-8 mx-4 max-w-md w-full',
        'animate-in zoom-in-95 duration-200'
      )}>
        {/* Header avec fermeture */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            {icon || (
              <div className={cn('text-2xl', config.color)}>
                <LoadingDots size="lg" color="current" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {displayLabel}
              </h3>
              {description && (
                <p className="text-sm text-gray-600 mt-1">
                  {description}
                </p>
              )}
            </div>
          </div>
          
          {canCancel && onCancel && (
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Annuler"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Barre de progression si fournie */}
        {typeof progress === 'number' && (
          <div className="mb-6 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Progression</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  'bg-primary'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          {canBackground && onBackground && (
            <button
              onClick={onBackground}
              className="btn btn-ghost btn-sm"
            >
              Continuer en arrière-plan
            </button>
          )}
          
          {canCancel && onCancel && (
            <button
              onClick={onCancel}
              className="btn btn-outline btn-sm"
            >
              Annuler
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Composant spécialisé pour les uploads
export function UploadOverlay({ 
  show, 
  filesCount = 0, 
  currentFile = '', 
  progress = 0,
  onCancel 
}: {
  show: boolean;
  filesCount?: number;
  currentFile?: string;
  progress?: number;
  onCancel?: () => void;
}) {
  return (
    <BlockingOverlay
      show={show}
      variant="uploading"
      label={`Envoi de ${filesCount} fichier${filesCount > 1 ? 's' : ''}...`}
      description={currentFile ? `Fichier actuel : ${currentFile}` : undefined}
      progress={progress}
      canCancel={true}
      onCancel={onCancel}
    />
  );
}

// Composant spécialisé pour les exports
export function ExportOverlay({ 
  show, 
  exportType = 'PDF',
  onCancel,
  onBackground 
}: {
  show: boolean;
  exportType?: string;
  onCancel?: () => void;
  onBackground?: () => void;
}) {
  return (
    <BlockingOverlay
      show={show}
      variant="exporting"
      label={`Génération du ${exportType}...`}
      description="Cela peut prendre quelques instants selon la taille du document."
      canCancel={true}
      onCancel={onCancel}
      canBackground={true}
      onBackground={onBackground}
    />
  );
}
