'use client';

import { Toaster } from 'sonner';

/**
 * SMARTIMMO: Toast System v2
 * Provider unifié pour toutes les notifications de l'application
 * Basé sur Sonner (moderne, performant, accessible)
 * 
 * Configuration :
 * - Position : bottom-center (en bas au centre)
 * - Design : Fond blanc + accents colorés (pas de richColors)
 * - Barre de progression visible (timer)
 * - Bordure gauche + icône colorée selon variante
 * - Texte en gris foncé (neutre)
 */
export function ToastProvider() {
  return (
    <Toaster
      position="bottom-center"
      expand={true}
      richColors={false}
      closeButton={true}
      duration={4000}
      toastOptions={{
        style: {
          // Z-index élevé pour passer au-dessus des modals
          zIndex: 9999,
        },
        classNames: {
          toast: 'toast-smartimmo',
          title: 'text-sm font-medium',
          description: 'text-xs opacity-90',
          actionButton: 'bg-primary-600 hover:bg-primary-700',
          cancelButton: 'bg-gray-200 hover:bg-gray-300',
          closeButton: 'bg-gray-100 hover:bg-gray-200',
          success: 'toast-success',
          error: 'toast-error',
          info: 'toast-info',
          warning: 'toast-warning',
        },
      }}
    />
  );
}

// Alias pour faciliter la migration si besoin
export const ToastProvider2 = ToastProvider;
