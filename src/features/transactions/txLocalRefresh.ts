import type { LocalTransaction } from '@/lib/offline/db';

/**
 * Mise à jour locale de la liste transactions (App Shell) sans relecture IDB complète.
 * Activé via detail.patch sur l'événement `transactions:refresh`.
 */
export type TransactionsLocalPatch =
  | { action: 'upsert'; rows: LocalTransaction[] }
  | { action: 'delete'; ids: string[] };

export type TransactionsRefreshDetail = {
  scope?: string;
  propertyId?: string;
  reason?: string;
  patch?: TransactionsLocalPatch;
};

export function dispatchTransactionsLocalRefresh(detail: TransactionsRefreshDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<TransactionsRefreshDetail>('transactions:refresh', { detail }));
}
