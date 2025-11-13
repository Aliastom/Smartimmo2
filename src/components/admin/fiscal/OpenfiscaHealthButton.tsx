/**
 * Bouton de healthcheck OpenFisca
 * 
 * Vérifie la disponibilité d'OpenFisca et affiche les résultats
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Activity, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface OpenfiscaHealthButtonProps {
  year?: number;
  variant?: 'default' | 'secondary' | 'outline';
  size?: 'default' | 'sm' | 'lg';
}

interface HealthResult {
  ok: boolean;
  baseUrl: string;
  year?: number;
  durationMs?: number;
  hasIR?: boolean;
  irCount?: number;
  hasDecote?: boolean;
  hasPS?: boolean;
  psRate?: number;
  hasMicro?: boolean;
  hasDeficit?: boolean;
  hasPer?: boolean;
  keys?: string[];
  totalKeys?: number;
  warnings?: string[];
  error?: string;
  configured?: boolean;
}

export function OpenfiscaHealthButton({
  year,
  variant = 'outline',
  size = 'default'
}: OpenfiscaHealthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<HealthResult | null>(null);

  const targetYear = year || new Date().getFullYear();

  async function runHealthcheck() {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/admin/tax/openfisca/health?year=${targetYear}`,
        { cache: 'no-store' }
      );

      const data: HealthResult = await res.json();
      setLastResult(data);

      if (!res.ok || !data.ok) {
        // Erreur
        if (!data.configured) {
          toast.error('OpenFisca non configuré', {
            description: 'Variable OPENFISCA_BASE_URL manquante dans .env.local',
            icon: <AlertCircle className="h-4 w-4" />
          });
        } else {
          toast.error('OpenFisca indisponible', {
            description: data.error || 'Erreur de connexion',
            icon: <AlertCircle className="h-4 w-4" />
          });
        }
        return;
      }

      // Succès avec warnings éventuels
      if (data.warnings && data.warnings.length > 0) {
        toast.warning(`OpenFisca répondant avec warnings (${targetYear})`, {
          description: (
            <div className="space-y-1 text-xs">
              <div className="font-medium">
                ⚠️ {data.warnings.join(', ')}
              </div>
              <div className="text-muted-foreground">
                Durée: {data.durationMs}ms • Clés: {data.totalKeys}
              </div>
            </div>
          ),
          duration: 5000
        });
      } else {
        // Tout est OK
        const sections: string[] = [];
        if (data.hasIR) sections.push(`IR: ${data.irCount} tranches`);
        if (data.hasDecote) sections.push('Décote: ✓');
        if (data.hasPS) sections.push(`PS: ${((data.psRate ?? 0) * 100).toFixed(1)}%`);
        if (data.hasMicro) sections.push('Micro: ✓');
        if (data.hasDeficit) sections.push('Déficit: ✓');
        if (data.hasPer) sections.push('PER: ✓');

        toast.success(`OpenFisca opérationnel (${targetYear})`, {
          description: (
            <div className="space-y-1 text-xs">
              <div className="font-mono">{sections.join(' • ')}</div>
              <div className="text-muted-foreground">
                {data.durationMs}ms • {data.totalKeys} paramètres disponibles
              </div>
            </div>
          ),
          icon: <CheckCircle2 className="h-4 w-4" />,
          duration: 5000
        });
      }
    } catch (e: any) {
      console.error('[OpenfiscaHealthButton] Erreur:', e);
      toast.error('Erreur lors du healthcheck', {
        description: e.message || String(e),
        icon: <AlertCircle className="h-4 w-4" />
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={runHealthcheck}
      disabled={loading}
      variant={variant}
      size={size}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Vérification…
        </>
      ) : lastResult?.ok ? (
        <>
          <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
          Vérifier OpenFisca
        </>
      ) : lastResult?.ok === false ? (
        <>
          <AlertCircle className="mr-2 h-4 w-4 text-red-600" />
          Vérifier OpenFisca
        </>
      ) : (
        <>
          <Activity className="mr-2 h-4 w-4" />
          Vérifier OpenFisca
        </>
      )}
    </Button>
  );
}

