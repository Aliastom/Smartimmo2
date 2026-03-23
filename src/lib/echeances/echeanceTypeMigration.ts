/**
 * Migration progressive : à terme, natureCode explicite sur EcheanceRecurrente.
 * Pour l’instant : dériver depuis `type` via getDefaultNatureCodeForEcheanceType.
 */

import type { EcheanceRecurrente } from '@/types/echeance';
import { getDefaultNatureCodeForEcheanceType, logEcheanceNatureIncoherence } from '@/lib/echeances/echeanceNatureMapping';

/** Nature transaction à utiliser pour l’échéance (preset actuel = type → nature). */
export function resolveNatureCodeForEcheance(echeance: EcheanceRecurrente): string {
  if (echeance.natureCode && echeance.natureCode.trim()) {
    return echeance.natureCode;
  }
  const sens = echeance.sens === 'CREDIT' ? 'CREDIT' : 'DEBIT';
  const code = getDefaultNatureCodeForEcheanceType(echeance.type as any, sens);
  logEcheanceNatureIncoherence(echeance.type as any, sens, code);
  return code;
}
