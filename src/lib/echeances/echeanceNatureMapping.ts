/**
 * Mapping type d'échéance (enum métier) → code nature de transaction.
 * Le type d'échéance sert de preset uniquement ; la vérité opérationnelle est le code nature.
 * À terme : champ `natureCode` stocké sur l'échéance (migration Prisma).
 *
 * Option future (preset UI uniquement, pas source de vérité) :
 * ```ts
 * type EcheanceProfile = { label: string; natureCode: string; defaultCategoryId?: string; periodicite?: Periodicite };
 * ```
 */

import type { EcheanceType } from '@prisma/client';

/**
 * Code nature par défaut pour une échéance selon son type et son sens.
 * Pas de fallback générique "loyer" : LOYER_ATTENDU + CREDIT uniquement → RECETTE_LOYER.
 */
export function getDefaultNatureCodeForEcheanceType(type: EcheanceType, sens: 'DEBIT' | 'CREDIT'): string {
  if (sens === 'CREDIT') {
    if (type === 'LOYER_ATTENDU') return 'RECETTE_LOYER';
    return 'RECETTE_AUTRE';
  }
  switch (type) {
    case 'IMPOT':
    case 'CFE':
      return 'DEPENSE_TAXE';
    case 'PNO':
    case 'ASSURANCE':
      return 'DEPENSE_ASSURANCE';
    case 'PRET':
      return 'DEPENSE_BANQUE';
    case 'COPRO':
    case 'CHARGE_RECUP':
    case 'ENTRETIEN':
      return 'DEPENSE_ENTRETIEN';
    case 'LOYER_ATTENDU':
      return 'DEPENSE_ENTRETIEN';
    case 'AUTRE':
    default:
      return 'DEPENSE_ENTRETIEN';
  }
}

/** Compat : log si type incohérent avec sens (ex. IMPOT en CREDIT). */
export function logEcheanceNatureIncoherence(type: EcheanceType, sens: 'DEBIT' | 'CREDIT', natureCode: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const taxTypes: EcheanceType[] = ['IMPOT', 'CFE'];
  if (taxTypes.includes(type) && sens === 'CREDIT') {
    console.warn(`[Échéance] Type ${type} avec sens CREDIT — nature utilisée : ${natureCode}`);
  }
}

/** Dérive un type legacy pour compat DB (natureCode → EcheanceType). */
export function getLegacyTypeFromNatureCode(natureCode: string, sens: 'DEBIT' | 'CREDIT'): EcheanceType {
  if (sens === 'CREDIT') {
    if (natureCode === 'RECETTE_LOYER') return 'LOYER_ATTENDU' as EcheanceType;
    return 'LOYER_ATTENDU'; // RECETTE_AUTRE → LOYER_ATTENDU pour compat
  }
  const map: Record<string, EcheanceType> = {
    DEPENSE_TAXE: 'IMPOT',
    DEPENSE_ASSURANCE: 'ASSURANCE',
    DEPENSE_BANQUE: 'PRET',
    DEPENSE_ENTRETIEN: 'ENTRETIEN',
    DEPENSE_COPRO: 'COPRO',
  };
  return (map[natureCode] || 'AUTRE') as EcheanceType;
}
