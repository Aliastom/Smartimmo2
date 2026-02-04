/**
 * Écran de configuration PIN pour appareil de confiance
 */

'use client';

import React, { useState } from 'react';
import { ShieldCheck, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { dismissTrustPrompt, setupTrustedDevice } from '@/lib/security/pin';

type PinSetupScreenProps = {
  onComplete: () => void;
  onSkip: () => void;
};

export function PinSetupScreen({ onComplete, onSkip }: PinSetupScreenProps) {
  const [trusted, setTrusted] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const validatePin = () => {
    if (!/^\d{4,6}$/.test(pin)) {
      return 'Le PIN doit contenir 4 à 6 chiffres.';
    }
    if (pin !== confirmPin) {
      return 'Les PIN ne correspondent pas.';
    }
    return null;
  };

  const handleContinue = async () => {
    setError(null);

    if (!trusted) {
      dismissTrustPrompt();
      onSkip();
      return;
    }

    const validationError = validatePin();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      await setupTrustedDevice(pin);
      onComplete();
    } catch (err) {
      setError('Impossible d’enregistrer le PIN. Réessayez.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#E3EEFA] p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
            <CardTitle className="text-2xl">
              Appareil de confiance
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-700">
            Pour sécuriser l’accès aux données locales, vous pouvez activer un verrou PIN sur cet appareil.
          </p>

          <label className="flex items-center gap-3 text-slate-700">
            <input
              type="checkbox"
              checked={trusted}
              onChange={(e) => setTrusted(e.target.checked)}
              className="checkbox checkbox-primary"
            />
            Faire confiance à cet appareil
          </label>

          {trusted && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Créer un PIN (4 à 6 chiffres)</label>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="\d*"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="input input-bordered w-full"
                    placeholder="••••"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Confirmer le PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="••••"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleContinue}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                trusted ? 'Activer le verrou' : 'Continuer'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
