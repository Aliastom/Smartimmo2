/**
 * Écran de verrouillage PIN pour appareil de confiance
 */

'use client';

import React, { useState } from 'react';
import { Lock, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { clearLocalAccessState, setPinUnlocked, verifyPin } from '@/lib/security/pin';
import { useLocalDbStatus } from '@/contexts/LocalDbStatusContext';

type PinLockScreenProps = {
  onUnlock: () => void;
};

export function PinLockScreen({ onUnlock }: PinLockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { resetDb, isResetting } = useLocalDbStatus();

  const handleUnlock = async () => {
    setError(null);
    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN invalide.');
      return;
    }

    setIsChecking(true);
    try {
      const ok = await verifyPin(pin);
      if (!ok) {
        setError('PIN incorrect.');
        return;
      }
      setPinUnlocked();
      onUnlock();
    } catch (err) {
      setError('Impossible de vérifier le PIN.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleResetAccess = async () => {
    if (!confirm('Réinitialiser l’accès local ? Cela supprimera les données locales sur cet appareil.')) {
      return;
    }
    clearLocalAccessState();
    await resetDb();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#E3EEFA] p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Lock className="h-8 w-8 text-slate-700" />
            <CardTitle className="text-2xl">
              Entrer le PIN
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-700">
            Cet appareil est protégé par un verrou local. Saisissez votre PIN pour accéder aux données.
          </p>

          <div className="space-y-2">
            <input
              type="password"
              inputMode="numeric"
              pattern="\d*"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="input input-bordered w-full"
              placeholder="••••"
            />
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleUnlock} disabled={isChecking} className="flex-1">
              {isChecking ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Vérification...
                </>
              ) : (
                'Déverrouiller'
              )}
            </Button>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-start gap-2 text-sm text-amber-700 mb-3">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>
                En cas d’oubli du PIN, vous pouvez réinitialiser l’accès local. Les données locales seront supprimées.
              </span>
            </div>
            <Button
              onClick={handleResetAccess}
              disabled={isResetting}
              variant="outline"
            >
              {isResetting ? 'Réinitialisation...' : 'Réinitialiser l’accès'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
