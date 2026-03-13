/**
 * useFiscalSession - Session fiscale (déclaration / barème) avec persistance et cache offline.
 * L'état est partagé via FiscalSessionContext pour que le header (combobox) et le panneau vert
 * voient la même session dès qu'elle est mise à jour.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';

export interface FiscalSession {
  id: string;
  organizationId: string;
  declarationYear: number;
  incomeYear: number;
  baremeCode: string;
  updatedAt: string;
}

const DEFAULT_SESSION: FiscalSession = {
  id: '',
  organizationId: '',
  declarationYear: new Date().getFullYear() + 1,
  incomeYear: new Date().getFullYear(),
  baremeCode: '2025.1',
  updatedAt: new Date().toISOString(),
};

export type FiscalSessionContextValue = {
  session: FiscalSession | null;
  loading: boolean;
  error: string | null;
  updateSession: (payload: { declarationYear?: number; baremeCode?: string }) => Promise<void>;
  isOffline: boolean;
};

const FiscalSessionContext = createContext<FiscalSessionContextValue | null>(null);

/** Logique état + API + cache, utilisée uniquement par le Provider pour un état partagé. */
function useFiscalSessionState(): FiscalSessionContextValue {
  const { organizationId } = useCurrentOrganization();
  const [session, setSession] = useState<FiscalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const saveToCache = useCallback(async (s: FiscalSession) => {
    try {
      const db = await getLocalDB();
      if (db?.FiscalSessionCache) {
        await db.FiscalSessionCache.put({
          organizationId: s.organizationId,
          declarationYear: s.declarationYear,
          incomeYear: s.incomeYear,
          baremeCode: s.baremeCode,
          updatedAt: s.updatedAt,
        });
      }
    } catch (e) {
      console.warn('[useFiscalSession] Cache IDB:', e);
    }
  }, []);

  const loadFromCache = useCallback(async (orgId: string): Promise<FiscalSession | null> => {
    try {
      const db = await getLocalDB();
      if (!db?.FiscalSessionCache) return null;
      const row = await db.FiscalSessionCache.get(orgId);
      if (!row) return null;
      return {
        id: '',
        organizationId: row.organizationId,
        declarationYear: row.declarationYear,
        incomeYear: row.incomeYear,
        baremeCode: row.baremeCode,
        updatedAt: row.updatedAt,
      };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const online = typeof navigator !== 'undefined' && navigator.onLine;

    const run = async () => {
      setLoading(true);
      setError(null);
      setIsOffline(false);

      if (!online) {
        const cached = await loadFromCache(organizationId);
        if (!cancelled) {
          setSession(cached || { ...DEFAULT_SESSION, organizationId });
          setIsOffline(true);
        }
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/fiscal/session');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as { error?: string }).error || res.statusText);
        }
        if (cancelled) return;
        setSession(data);
        await saveToCache(data);
      } catch (e) {
        if (cancelled) return;
        const cached = await loadFromCache(organizationId);
        if (cached) {
          setSession(cached);
          setIsOffline(true);
        } else {
          setSession({ ...DEFAULT_SESSION, organizationId });
          setError(e instanceof Error ? e.message : 'Erreur chargement session');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [organizationId, loadFromCache, saveToCache]);

  const updateSession = useCallback(
    async (payload: { declarationYear?: number; baremeCode?: string }) => {
      if (!organizationId) return;
      const online = typeof navigator !== 'undefined' && navigator.onLine;
      if (!online) {
        setError('Hors ligne : impossible de mettre à jour la session');
        return;
      }
      setError(null);
      try {
        console.log('[Fiscal] POST /api/fiscal/session', payload);
        const res = await fetch('/api/fiscal/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
        console.log('[Fiscal] Session reçue:', data?.declarationYear, 'revenus:', data?.incomeYear);
        setSession(data);
        await saveToCache(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur mise à jour');
        throw e;
      }
    },
    [organizationId, saveToCache]
  );

  // Ne jamais exposer le fallback quand session est null : évite la frame où orgId vient d'apparaître
  // mais le fetch n'a pas encore démarré (loading=false, session=null) → fallback avec incomeYear=2026
  return {
    session: session ?? null,
    loading,
    error,
    updateSession,
    isOffline,
  };
}

/** Provider à placer autour de la page fiscale pour partager la session entre header et panneau vert. */
export function FiscalSessionProvider({ children }: { children: React.ReactNode }) {
  const value = useFiscalSessionState();
  return React.createElement(FiscalSessionContext.Provider, { value }, children);
}

/** Hook : doit être utilisé sous FiscalSessionProvider (ex. dans FiscalPageCore). */
export function useFiscalSession(): FiscalSessionContextValue {
  const ctx = useContext(FiscalSessionContext);
  if (!ctx) {
    throw new Error('useFiscalSession doit être utilisé dans un FiscalSessionProvider');
  }
  return ctx;
}
