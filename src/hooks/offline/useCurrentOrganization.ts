/**
 * Hook client pour récupérer l'organizationId
 * OPTIMISÉ : Utilise useAppSession (React Query) pour un seul appel /api/auth/me
 * En mode offline, récupère depuis localStorage ou IndexedDB
 */

import React, { useEffect } from 'react';
import { getLocalDB } from '@/lib/offline/db';
import { useAppSession } from '@/features/auth/useAppSession';
import { useAppAuth } from '@/features/auth/useAppAuth';

export function useCurrentOrganization() {
  const { authReady } = useAppAuth();
  const { session, organizationId: sessionOrgId, isLoading: sessionLoading } = useAppSession();
  const [organizationId, setOrganizationId] = React.useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    // Attendre que l'auth soit prête
    if (!authReady) {
      return;
    }

    const loadOrganizationId = async () => {
      // ⚠️ OPTIMISÉ : Utiliser d'abord useAppSession (React Query cache)
      if (sessionOrgId) {
        setOrganizationId(sessionOrgId);
        setIsLoading(false);
        return;
      }

      // Si session est en cours de chargement, attendre
      if (sessionLoading) {
        return;
      }

      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      
      // En mode offline, essayer de récupérer depuis localStorage ou IndexedDB
      if (!isOnline) {
        try {
          // Essayer localStorage d'abord
          const stored = localStorage.getItem('organizationId') || 
                        localStorage.getItem('currentOrganizationId') ||
                        localStorage.getItem('userOrganizationId');
          
          if (stored) {
            setOrganizationId(stored);
            setIsLoading(false);
            return;
          }
          
          // Sinon, essayer de trouver une organizationId dans IndexedDB (via une propriété par exemple)
          const db = await getLocalDB();
          const firstProperty = await db.Property.toCollection().first();
          if (firstProperty?.organizationId) {
            localStorage.setItem('organizationId', firstProperty.organizationId);
            setOrganizationId(firstProperty.organizationId);
            setIsLoading(false);
            return;
          }
          
          // Fallback
          setOrganizationId(undefined);
          setIsLoading(false);
          return;
        } catch (error) {
          // Erreur silencieuse
          setOrganizationId(undefined);
          setIsLoading(false);
          return;
        }
      }
      
      // En mode online mais pas d'orgId depuis session, essayer localStorage
      const stored = localStorage.getItem('organizationId') || 
                    localStorage.getItem('currentOrganizationId');
      if (stored) {
        setOrganizationId(stored);
        setIsLoading(false);
        return;
      }
      
      // Pas d'organizationId trouvé
      setOrganizationId(undefined);
      setIsLoading(false);
    };
    
    loadOrganizationId();
  }, [authReady, sessionOrgId, sessionLoading]);

  return { organizationId, isLoading: isLoading || sessionLoading };
}





