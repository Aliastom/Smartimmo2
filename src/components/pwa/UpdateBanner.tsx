'use client';

import React from 'react';
import { useServiceWorkerUpdate } from '@/hooks/useServiceWorkerUpdate';
import { Button } from '@/components/ui/Button';
import { X, RefreshCw } from 'lucide-react';

/**
 * Composant bandeau de notification de mise à jour PWA
 * 
 * Affiche un bandeau en bas de l'écran quand une nouvelle version est disponible.
 * Style inspiré de Slack/Notion : discret, non-intrusif, avec actions claires.
 */
export function UpdateBanner() {
  const { isUpdateAvailable, updateServiceWorker, dismissUpdate } = useServiceWorkerUpdate();

  if (!isUpdateAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[10000] bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Message */}
          <div className="flex items-center gap-3 flex-1">
            <RefreshCw className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                Une nouvelle version de SmartImmo est disponible.
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Cliquez sur "Mettre à jour" pour recharger l'application avec la dernière version.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={updateServiceWorker}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            >
              Mettre à jour
            </Button>
            <button
              onClick={dismissUpdate}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
              aria-label="Fermer"
              title="Plus tard"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

