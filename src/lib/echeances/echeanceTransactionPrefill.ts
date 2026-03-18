/**
 * Pré-remplissage formulaire transaction depuis une échéance (phase 2).
 */
import type { EcheanceRecurrente } from '@/types/echeance';
import type { EcheanceType } from '@prisma/client';
import { getLocalDB } from '@/lib/offline/db';

function defaultNatureForEcheance(type: EcheanceType, sens: 'DEBIT' | 'CREDIT'): string {
  if (type === 'LOYER_ATTENDU' && sens === 'CREDIT') return 'RECETTE_LOYER';
  if (sens === 'CREDIT') return 'RECETTE_AUTRE';
  if (type === 'IMPOT' || type === 'CFE') return 'DEPENSE_TAXE';
  if (type === 'PNO' || type === 'ASSURANCE') return 'DEPENSE_ASSURANCE';
  if (type === 'PRET') return 'DEPENSE_BANQUE';
  if (type === 'COPRO' || type === 'CHARGE_RECUP' || type === 'ENTRETIEN') return 'DEPENSE_ENTRETIEN';
  return 'DEPENSE_ENTRETIEN';
}

const NATURE_TO_CATEGORY_SLUG: Record<string, string> = {
  RECETTE_LOYER: 'loyer',
  RECETTE_AUTRE: 'revenus-exceptionnels',
  DEPENSE_TAXE: 'taxe-fonciere',
  DEPENSE_ASSURANCE: 'assurance-pno',
  DEPENSE_BANQUE: 'interets-emprunt',
  DEPENSE_ENTRETIEN: 'travaux-entretien',
};

export interface EcheanceTransactionPrefill {
  propertyId: string;
  leaseId?: string;
  nature?: string;
  categoryId?: string;
  amount?: number;
  date?: string;
  paymentDate?: string;
  label?: string;
}

/**
 * Construit le prefill pour TransactionModal à partir d'une échéance et d'une date d'occurrence (YYYY-MM-DD).
 */
export async function buildTransactionPrefillFromEcheance(
  echeance: EcheanceRecurrente,
  occurrenceYmd: string
): Promise<EcheanceTransactionPrefill> {
  const propertyId = echeance.propertyId || '';
  const nature = defaultNatureForEcheance(echeance.type, echeance.sens);
  const slug = NATURE_TO_CATEGORY_SLUG[nature];
  let categoryId: string | undefined;
  const db = await getLocalDB();
  if (db && slug) {
    const cats = await db.Category.toArray();
    const c = cats.find((x: { slug?: string; actif?: boolean }) => x.slug === slug && x.actif !== false);
    categoryId = c?.id;
  }
  if (!categoryId && db) {
    const type = echeance.sens === 'CREDIT' ? 'REVENU' : 'DEPENSE';
    const cats = (await db.Category.toArray()).filter(
      (x: { type?: string; actif?: boolean }) => x.type === type && x.actif !== false
    );
    categoryId = cats[0]?.id;
  }

  return {
    propertyId,
    leaseId: echeance.leaseId || undefined,
    nature,
    categoryId,
    amount: Math.abs(Number(echeance.montant)),
    date: occurrenceYmd,
    paymentDate: occurrenceYmd,
    label: echeance.label,
  };
}
