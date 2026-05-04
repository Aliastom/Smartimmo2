'use client';

import { useCallback, useEffect, useState } from 'react';

function storageKey(organizationId: string): string {
  return `smartimmo.portfolio.defaultAccountId.${organizationId}`;
}

export function readPortfolioDefaultAccountId(organizationId: string | undefined): string | null {
  if (!organizationId || typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(storageKey(organizationId));
    return v && v.trim() !== '' ? v.trim() : null;
  } catch {
    return null;
  }
}

export function usePortfolioDefaultAccount(organizationId: string | undefined, accountIds: string[]) {
  const [defaultAccountId, setDefaultAccountIdState] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setDefaultAccountIdState(null);
      return;
    }
    const stored = readPortfolioDefaultAccountId(organizationId);
    if (stored && accountIds.includes(stored)) {
      setDefaultAccountIdState(stored);
      return;
    }
    if (stored && !accountIds.includes(stored)) {
      try {
        window.localStorage.removeItem(storageKey(organizationId));
      } catch {
        /* ignore */
      }
    }
    setDefaultAccountIdState(accountIds[0] ?? null);
  }, [organizationId, accountIds]);

  const setDefaultAccountId = useCallback(
    (id: string) => {
      if (!organizationId) return;
      try {
        window.localStorage.setItem(storageKey(organizationId), id);
      } catch {
        /* ignore */
      }
      setDefaultAccountIdState(id);
    },
    [organizationId]
  );

  return { defaultAccountId, setDefaultAccountId };
}
