/**
 * SMARTIMMO - Système de notifications v2
 * Basé sur Sonner avec un wrapper unifié
 * 
 * Usage:
 *   notify2.success('Opération réussie');
 *   notify2.error('Erreur', 'Description détaillée');
 *   notify2.info('Information');
 *   notify2.warning('Attention');
 */

import { toast } from 'sonner';

export const notify2 = {
  success: (title: string, description?: string) => {
    if (description) {
      toast.success(title, {
        description,
        duration: 4000,
      });
    } else {
      toast.success(title, {
        duration: 4000,
      });
    }
  },

  error: (title: string, description?: string) => {
    if (description) {
      toast.error(title, {
        description,
        duration: 5000, // Un peu plus long pour les erreurs
      });
    } else {
      toast.error(title, {
        duration: 5000,
      });
    }
  },

  info: (title: string, description?: string) => {
    if (description) {
      toast.info(title, {
        description,
        duration: 4000,
      });
    } else {
      toast.info(title, {
        duration: 4000,
      });
    }
  },

  warning: (title: string, description?: string) => {
    if (description) {
      toast.warning(title, {
        description,
        duration: 4000,
      });
    } else {
      toast.warning(title, {
        duration: 4000,
      });
    }
  },

  // Helper pour afficher un toast de chargement avec promesse
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(promise, messages);
  },
};

// Export du type pour référence
export type NotifyVariant = 'success' | 'error' | 'info' | 'warning';

