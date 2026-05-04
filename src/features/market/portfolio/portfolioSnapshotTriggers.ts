export const PORTFOLIO_CASH_MUTATED_EVENT = 'portfolio:cash-mutated';

/** Cash stratégique (paramètres investissement) modifié — déclenche un instantané automatique (debouncé côté hook). */
export function dispatchPortfolioCashMutated(organizationId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PORTFOLIO_CASH_MUTATED_EVENT, { detail: { organizationId } }));
}
