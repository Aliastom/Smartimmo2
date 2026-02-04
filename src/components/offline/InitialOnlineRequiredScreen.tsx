/**
 * Écran bloquant pour le premier lancement offline / purge iOS
 * Affiche un message clair et un bouton de réessai.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

type InitialOnlineRequiredScreenProps = {
  onOnline: () => void;
};

export function InitialOnlineRequiredScreen({ onOnline }: InitialOnlineRequiredScreenProps) {
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      onOnline();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [onOnline]);

  const handleRetry = () => {
    if (typeof navigator === 'undefined') return;
    setIsChecking(true);

    // Re-vérifier le statut réseau et relancer le flux si online
    if (navigator.onLine) {
      onOnline();
    } else {
      setTimeout(() => setIsChecking(false), 500);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#E3EEFA] p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <WifiOff className="h-8 w-8 text-amber-500" />
            <CardTitle className="text-2xl">
              Connexion initiale requise
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-700">
            Connexion initiale requise. Connecte-toi une première fois avec Internet pour activer le mode hors ligne.
          </p>

          <div className="flex gap-3">
            <Button
              onClick={handleRetry}
              disabled={isChecking}
              className="flex-1"
            >
              {isChecking ? (
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
