import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { CachedManagementCompany } from '@/lib/offline/db';
import type { ManagementCompany } from '@/lib/gestion/types';

export interface UseGestionDelegueeDataOptions {
  mode: 'normal' | 'app-shell';
}

export interface GestionDelegueeData {
  societes: ManagementCompany[];
  enabled: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook unifié pour charger les données de gestion déléguée
 * - Mode normal : utilise React Query avec fetch API
 * - Mode app-shell : lit uniquement depuis IndexedDB
 */
export function useGestionDelegueeData(options: UseGestionDelegueeDataOptions): GestionDelegueeData {
  const { mode } = options;
  const { organizationId } = useCurrentOrganization();
  const [societes, setSocietes] = useState<ManagementCompany[]>([]);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(mode === 'app-shell');
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Mode normal : utiliser React Query
  const { data: normalData, isLoading: normalLoading, error: normalError } = useQuery<{
    societes: ManagementCompany[];
    enabled: boolean;
  }>({
    queryKey: ['management-companies'],
    queryFn: async () => {
      const res = await fetch('/api/gestion/societes');
      if (!res.ok) throw new Error('Erreur lors de la récupération des sociétés');
      return res.json();
    },
    enabled: mode === 'normal',
  });

  // Mode app-shell : charger depuis IndexedDB
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (mode === 'app-shell') {
        if (!organizationId) {
          setError('OrganizationId requis');
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError(null);

          const db = await getLocalDB();
          
          // Charger les sociétés de gestion depuis IndexedDB
          const cachedSocietes = await db.ManagementCompany
            .where('organizationId')
            .equals(organizationId)
            .toArray();

          // Convertir CachedManagementCompany en ManagementCompany
          const societesData: ManagementCompany[] = cachedSocietes.map((cached: CachedManagementCompany) => ({
            id: cached.id,
            nom: cached.nom,
            contact: cached.contact || null,
            email: cached.email || null,
            telephone: cached.telephone || null,
            modeCalcul: (cached.modeCalcul || 'LOYERS_UNIQUEMENT') as 'LOYERS_UNIQUEMENT' | 'REVENUS_TOTAUX',
            taux: cached.taux || 0,
            fraisMin: cached.fraisMin || null,
            baseSurEncaissement: cached.baseSurEncaissement ?? true,
            tvaApplicable: cached.tvaApplicable ?? false,
            tauxTva: cached.tauxTva || null,
            actif: cached.actif,
            createdAt: cached.createdAt ? new Date(cached.createdAt) : new Date(cached.cachedAt),
            updatedAt: cached.updatedAt ? new Date(cached.updatedAt) : new Date(cached.cachedAt),
          }));

          if (!cancelled) {
            setSocietes(societesData);
            // ✅ App-shell/offline: ne pas bloquer le CRUD si aucune société locale
            // Le flag "enabled" côté API n'est pas disponible offline, donc on autorise par défaut
            setEnabled(true);
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            console.error('[useGestionDelegueeData] Erreur chargement app-shell:', e);
            setError('Impossible de charger les sociétés de gestion.');
            setLoading(false);
          }
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [mode, organizationId, refreshKey]);

  // ✅ APP-SHELL: Écouter uniquement managementCompany:refresh (pas sync:refresh global)
  useEffect(() => {
    if (mode !== 'app-shell') return;
    const lastRefreshRef = { timestamp: 0, reason: '' };
    const handleRefresh = (event: Event) => {
      if (!(event instanceof CustomEvent) || !event.detail) return;
      const detail = event.detail as { reason?: string };
      const now = Date.now();
      if (now - lastRefreshRef.timestamp < 300 && detail.reason === lastRefreshRef.reason) {
        return;
      }
      lastRefreshRef.timestamp = now;
      lastRefreshRef.reason = detail.reason || '';
      setRefreshKey(prev => prev + 1);
    };
    window.addEventListener('managementCompany:refresh', handleRefresh);
    return () => {
      window.removeEventListener('managementCompany:refresh', handleRefresh);
    };
  }, [mode]);

  // Retourner les données selon le mode
  if (mode === 'normal') {
    return {
      societes: normalData?.societes || [],
      enabled: normalData?.enabled ?? true,
      loading: normalLoading,
      error: normalError ? (normalError as Error).message : null,
    };
  }

  return {
    societes,
    enabled,
    loading,
    error,
  };
}

