/**
 * Système centralisé de sévérité pour les cartes d'alerte du Dashboard
 *
 * Logique :
 * - value = 0 → ok (vert, "Tout est à jour")
 * - value > 0 et <= warningThreshold → warning (orange)
 * - value > warningThreshold → critical (rouge)
 *
 * Pour les montants (ex. Manque perçu) : utiliser warningThreshold: 0
 * pour que tout montant > 0 soit critical.
 */

export type AlertSeverity = 'critical' | 'warning' | 'attention' | 'ok';

export interface GetAlertSeverityOptions {
  /** Seuil au-delà duquel on passe en critical. Par défaut 3. Mettre 0 pour les montants (tout > 0 = critical). */
  warningThreshold?: number;
}

/**
 * Retourne la sévérité d'une alerte selon la valeur numérique.
 *
 * RÈGLE ABSOLUE : value = 0 → toujours 'ok' (jamais rouge ni "À traiter")
 *
 * @param value - Valeur (nombre d'occurrences ou montant)
 * @param options - warningThreshold : si value > threshold → critical, sinon warning. 0 pour les montants.
 */
export function getAlertSeverity(
  value: number,
  options?: GetAlertSeverityOptions
): AlertSeverity {
  const safe = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
  if (safe === 0) return 'ok';
  const threshold = options?.warningThreshold ?? 3;
  return safe > threshold ? 'critical' : 'warning';
}

/** Configuration d'affichage par sévérité */
export interface AlertSeverityDisplay {
  badgeLabel: string;
  message: string;
  icon: 'check' | 'alert' | 'warning';
  variant: 'critical' | 'warning' | 'ok';
}

export const ALERT_SEVERITY_DISPLAY: Record<AlertSeverity, AlertSeverityDisplay> = {
  ok: {
    badgeLabel: 'OK',
    message: 'Tout est à jour',
    icon: 'check',
    variant: 'ok',
  },
  attention: {
    badgeLabel: 'Attention',
    message: 'À surveiller',
    icon: 'warning',
    variant: 'warning',
  },
  warning: {
    badgeLabel: 'À traiter',
    message: 'Action requise',
    icon: 'warning',
    variant: 'warning',
  },
  critical: {
    badgeLabel: 'Critique',
    message: 'Action requise',
    icon: 'alert',
    variant: 'critical',
  },
};
