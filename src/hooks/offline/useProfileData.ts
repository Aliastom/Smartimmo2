/**
 * Hook unifié pour charger les données du profil utilisateur
 * Fonctionne en mode "normal" (online avec fallback offline) et "app-shell" (offline-first)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUserProfileRepositoryOffline } from '@/lib/offline/repositories/UserProfileRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LocalUserProfile } from '@/lib/offline/db';

export interface ProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  company?: string;
  siret?: string;
  signature?: string;
  logo?: string;
}

export interface UseProfileDataOptions {
  mode: 'normal' | 'app-shell';
  initialData?: ProfileData | null;
}

export interface UseProfileDataResult {
  profile: ProfileData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  save: (data: ProfileData) => Promise<void>;
}

export function useProfileData(options: UseProfileDataOptions): UseProfileDataResult {
  const { mode, initialData } = options;
  const { organizationId } = useCurrentOrganization();
  
  const [profile, setProfile] = useState<ProfileData | null>(initialData || null);
  const [loading, setLoading] = useState(mode === 'app-shell');
  const [error, setError] = useState<string | null>(null);

  // Charger les données selon le mode
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (mode === 'app-shell') {
        // Mode app-shell : charger UNIQUEMENT depuis IndexedDB
        if (!organizationId) {
          setError('OrganizationId requis');
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError(null);

          const repo = getUserProfileRepositoryOffline();
          const profileData = await repo.getByOrganizationId(organizationId);

          if (!cancelled) {
            if (profileData) {
              setProfile({
                firstName: profileData.firstName || '',
                lastName: profileData.lastName || '',
                email: profileData.email || '',
                phone: profileData.phone || '',
                address: profileData.address || '',
                city: profileData.city || '',
                postalCode: profileData.postalCode || '',
                company: profileData.company || '',
                siret: profileData.siret || '',
                signature: profileData.signature || '',
                logo: profileData.logo || '',
              });
            } else {
              setProfile(null);
            }
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            console.error('[useProfileData] Erreur chargement app-shell:', e);
            setError('Impossible de charger le profil.');
            setLoading(false);
          }
        }
      } else {
        // Mode normal : utiliser initialData
        if (initialData) {
          setProfile(initialData);
        }
        setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [mode, organizationId, initialData]);

  // Fonction de rafraîchissement
  const refresh = useCallback(async () => {
    if (mode === 'app-shell' && organizationId) {
      try {
        setLoading(true);
        setError(null);

        const repo = getUserProfileRepositoryOffline();
        const profileData = await repo.getByOrganizationId(organizationId);

        if (profileData) {
          setProfile({
            firstName: profileData.firstName || '',
            lastName: profileData.lastName || '',
            email: profileData.email || '',
            phone: profileData.phone || '',
            address: profileData.address || '',
            city: profileData.city || '',
            postalCode: profileData.postalCode || '',
            company: profileData.company || '',
            siret: profileData.siret || '',
            signature: profileData.signature || '',
            logo: profileData.logo || '',
          });
        } else {
          setProfile(null);
        }
        setLoading(false);
      } catch (e: any) {
        console.error('[useProfileData] Erreur refresh:', e);
        setError('Impossible de rafraîchir le profil.');
        setLoading(false);
      }
    }
  }, [mode, organizationId]);

  // Fonction de sauvegarde
  const save = useCallback(async (data: ProfileData) => {
    if (mode === 'app-shell' && organizationId) {
      try {
        setLoading(true);
        setError(null);

        const repo = getUserProfileRepositoryOffline();
        
        // Récupérer le profil existant pour obtenir l'ID
        const existing = await repo.getByOrganizationId(organizationId);
        
        // Créer ou mettre à jour
        await repo.upsert(
          {
            id: existing?.id || '',
            organizationId,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || null,
            address: data.address || null,
            city: data.city || null,
            postalCode: data.postalCode || null,
            company: data.company || null,
            siret: data.siret || null,
            signature: data.signature || null,
            logo: data.logo || null,
          },
          organizationId
        );

        // Rafraîchir les données
        await refresh();
        setLoading(false);
      } catch (e: any) {
        console.error('[useProfileData] Erreur sauvegarde:', e);
        setError('Impossible de sauvegarder le profil.');
        setLoading(false);
        throw e;
      }
    } else {
      // Mode normal : utiliser l'API
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/profiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erreur lors de la sauvegarde du profil');
        }

        const result = await response.json();
        setProfile(result.data);
        setLoading(false);
      } catch (e: any) {
        console.error('[useProfileData] Erreur sauvegarde:', e);
        setError(e.message || 'Impossible de sauvegarder le profil.');
        setLoading(false);
        throw e;
      }
    }
  }, [mode, organizationId, refresh]);

  return {
    profile,
    loading,
    error,
    refresh,
    save,
  };
}

