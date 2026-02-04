/**
 * Écran affiché lorsque la base de données locale est indisponible
 * Propose à l'utilisateur de réinitialiser les données locales
 * 
 * ⚠️ CRITIQUE: Cet écran remplace tout le contenu de l'application
 * pour éviter les blocages UI.
 */

'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Database } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useLocalDbStatus } from '@/contexts/LocalDbStatusContext';

export function LocalDbUnavailableScreen() {
  const { resetDb, retryOpen, isResetting, isRetrying, error } = useLocalDbStatus();

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#E3EEFA] p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <CardTitle className="text-2xl">
              Base de données locale indisponible
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-slate-700">
              La base de données locale (IndexedDB) n'est pas accessible. Cela peut arriver après :
            </p>
            <ul className="list-disc list-inside text-slate-600 space-y-1 ml-4">
              <li>Un vidage du cache navigateur</li>
              <li>Une mise à jour du schéma de la base de données</li>
              <li>Un conflit avec un autre onglet ou Service Worker</li>
              <li>Une corruption de la base de données</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium mb-1">Détails de l'erreur :</p>
              <p className="text-sm text-red-700 font-mono">{error.message || 'Erreur inconnue'}</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Database className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium mb-1">
                  Que se passe-t-il si je réinitialise ?
                </p>
                <p className="text-sm text-blue-800">
                  La réinitialisation supprimera toutes les données locales stockées dans votre navigateur.
                  Vos données sur le serveur ne seront pas affectées. Après la réinitialisation, vous devrez
                  vous reconnecter et synchroniser à nouveau vos données.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-amber-900 font-medium mb-1">
                  Multi-onglets détecté ?
                </p>
                <p className="text-sm text-amber-800">
                  Si vous avez plusieurs onglets Smartimmo ouverts, fermez-les tous avant de réinitialiser.
                  Cela évite les conflits d'accès à IndexedDB.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={retryOpen}
              disabled={isRetrying || isResetting}
              className="flex-1"
              variant="default"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Réessai en cours...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Réessayer
                </>
              )}
            </Button>
            <Button
              onClick={resetDb}
              disabled={isResetting || isRetrying}
              variant="outline"
            >
              {isResetting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Réinitialisation...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Réinitialiser les données locales
                </>
              )}
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              disabled={isResetting || isRetrying}
            >
              Recharger la page
            </Button>
          </div>

          <p className="text-xs text-slate-500 text-center">
            Si le problème persiste après la réinitialisation, contactez le support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

