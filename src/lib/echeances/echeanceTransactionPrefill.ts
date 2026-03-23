/**
 * Pré-remplissage formulaire transaction depuis une échéance.
 * Nature = mapping type d'échéance → code nature ; catégorie = defaultCategory de la nature (cache IDB).
 * Pas de fallback « première catégorie DEPENSE » (évitait les erreurs type Loyer sur une taxe).
 */

import type { EcheanceRecurrente } from '@/types/echeance';
import { getLocalDB } from '@/lib/offline/db';
import { resolveNatureCodeForEcheance } from '@/lib/echeances/echeanceTypeMigration';

export interface EcheanceTransactionPrefill {
  propertyId: string;
  leaseId?: string;
  nature?: string;
  categoryId?: string;
  amount?: number;
  date?: string;
  paymentDate?: string;
  label?: string;
  /** Contexte échéance pour bloc explicite dans la modal (Partie 6) */
  echeanceSource?: {
    label: string;
    occurrenceYmd: string;
    montantAttendu: number;
    nature: string;
    categoryId?: string;
  };
}

/**
 * Construit le préfill métier depuis une échéance et la date d'occurrence à couvrir (YYYY-MM-DD).
 */
export async function buildTransactionFromEcheance(
  echeance: EcheanceRecurrente,
  occurrenceYmd: string
): Promise<EcheanceTransactionPrefill> {
  const propertyId = echeance.propertyId || '';
  const nature = resolveNatureCodeForEcheance(echeance);
  let categoryId: string | undefined;

  if (echeance.defaultCategoryId) {
    categoryId = echeance.defaultCategoryId;
  }

  if (!categoryId) {
    const db = await getLocalDB();
    if (db) {
      const row = await db.NatureEntity.where('key').equals(nature).first();
      if (row?.defaultCategory) {
        categoryId = row.defaultCategory;
      } else if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[Échéance→Transaction] Nature "${nature}" sans defaultCategory en cache local — choisir la catégorie à la main ou lancer une sync des natures.`
        );
      }
    }
  }

  const amount = Math.abs(Number(echeance.montant));
  return {
    propertyId,
    leaseId: echeance.leaseId || undefined,
    nature,
    categoryId,
    amount,
    date: occurrenceYmd,
    paymentDate: occurrenceYmd,
    label: echeance.label,
    echeanceSource: {
      label: echeance.label,
      occurrenceYmd,
      montantAttendu: amount,
      nature,
      categoryId,
    },
  };
}

/** @deprecated alias — utiliser buildTransactionFromEcheance */
export async function buildTransactionPrefillFromEcheance(
  echeance: EcheanceRecurrente,
  occurrenceYmd: string
): Promise<EcheanceTransactionPrefill> {
  return buildTransactionFromEcheance(echeance, occurrenceYmd);
}
