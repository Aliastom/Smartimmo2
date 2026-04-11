import type { EcheanceRecurrente } from '@/types/echeance';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getLinkByTransactionId } from '@/lib/echeances/echeanceTransactionLinkClient';

/** Seuil relevé : éviter des propositions « Lier » trop permissives (aligné pilotage mais plus strict pour le tableau). */
const RELIABLE_SCORE_MIN = 84;
/** Au-delà : la date transaction vs occurrence n’est plus considérée comme une preuve forte. */
const MAX_DAY_DIFF_FOR_LINK = 8;
/** Écart maximal de montant pour valider une correspondance « réellement forte ». */
const MAX_AMOUNT_DIFF_RATIO = 0.08;

type Scored = { id: string; score: number; dayDiff: number; diffPct: number };

/**
 * Transaction non liée, même bien, montant et date très proches de l’occurrence cible.
 * Conditions cumulatives : score, délai de jours et écart de montant.
 */
export async function findReliableTransactionMatchForEcheance(
  echeance: EcheanceRecurrente,
  nextDateYmd: string,
  organizationId: string
): Promise<{ id: string; score: number } | null> {
  const txRepo = getTransactionRepositoryOffline();
  const txs = await txRepo.getAll(organizationId, echeance.propertyId ? { propertyId: echeance.propertyId } : {});
  const targetTs = new Date(nextDateYmd.slice(0, 10) + 'T12:00:00').getTime();
  let best: Scored | null = null;

  for (const tx of txs) {
    const existingLink = await getLinkByTransactionId(tx.id);
    if (existingLink) continue;
    const txAmount = Number(tx.amount || 0);
    const expected = Math.abs(Number(echeance.montant || 0));
    const diffPct = expected > 0 ? Math.abs(Math.abs(txAmount) - expected) / expected : 1;
    const isSameProperty = !echeance.propertyId || tx.propertyId === echeance.propertyId;
    if (!isSameProperty) continue;

    const txTs = new Date(
      (typeof tx.date === 'string' ? tx.date : (tx.date as Date).toISOString().slice(0, 10)) + 'T12:00:00'
    ).getTime();
    const dayDiff = Math.abs(Math.round((txTs - targetTs) / (24 * 60 * 60 * 1000)));
    const dateScore = dayDiff <= 3 ? 25 : dayDiff <= 10 ? 15 : dayDiff <= 30 ? 8 : 2;
    const amountScore = diffPct <= 0.05 ? 35 : diffPct <= 0.1 ? 25 : diffPct <= 0.2 ? 12 : 4;
    const score = 40 + amountScore + dateScore;
    const candidate: Scored = { id: tx.id, score, dayDiff, diffPct };
    if (!best || candidate.score > best.score) best = candidate;
  }

  if (
    !best ||
    best.score < RELIABLE_SCORE_MIN ||
    best.dayDiff > MAX_DAY_DIFF_FOR_LINK ||
    best.diffPct > MAX_AMOUNT_DIFF_RATIO
  ) {
    return null;
  }

  return { id: best.id, score: best.score };
}
