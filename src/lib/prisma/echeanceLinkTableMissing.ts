/**
 * P2021 : table EcheanceTransactionLink non migrée sur cette base (dev / env alternatif).
 */
export function isEcheanceTransactionLinkTableMissing(e: unknown): boolean {
  const err = e as { code?: string; meta?: { table?: string; modelName?: string } };
  if (err?.code !== 'P2021') return false;
  const t = err.meta?.table ?? '';
  const m = err.meta?.modelName ?? '';
  return t.includes('EcheanceTransactionLink') || m === 'EcheanceTransactionLink';
}
