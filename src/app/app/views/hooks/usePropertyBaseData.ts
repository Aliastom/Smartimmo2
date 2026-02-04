/**
 * Hook pour charger les données de base d'une propriété (pour le header)
 * Cette query est séparée des queries par onglet pour éviter les remounts
 * Query key: ['property', 'base', propertyId]
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';

export interface PropertyBaseData {
  name: string;
  rentalMode?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  loading: boolean;
  error: string | null;
}

export function usePropertyBaseData(propertyId: string, organizationId: string): PropertyBaseData {
  const [propertyName, setPropertyName] = useState<string>('');
  const [rentalMode, setRentalMode] = useState<string | undefined>(undefined);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [postalCode, setPostalCode] = useState<string | undefined>(undefined);
  const [city, setCity] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId || !organizationId) {
      setPropertyName('');
      setRentalMode(undefined);
      setAddress(undefined);
      setPostalCode(undefined);
      setCity(undefined);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchProperty = async () => {
      try {
        setLoading(true);
        setError(null);
        const repo = getPropertyRepositoryOffline();
        const prop = await repo.getById(propertyId, organizationId);
        
        if (cancelled) return;
        
        if (prop) {
          setPropertyName(prop.name);
          setRentalMode(prop.rentalMode || undefined);
          setAddress(prop.address || undefined);
          setPostalCode(prop.postalCode || undefined);
          setCity(prop.city || undefined);
        } else {
          setPropertyName('Bien non trouvé');
          setError('Bien non trouvé');
          setAddress(undefined);
          setPostalCode(undefined);
          setCity(undefined);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching property:', err);
        setPropertyName('Erreur de chargement');
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    fetchProperty();

    return () => {
      cancelled = true;
    };
  }, [propertyId, organizationId]);

  // ✅ Mémoriser l'objet retourné pour éviter les re-renders inutiles
  return useMemo(() => ({
    name: propertyName,
    rentalMode,
    address,
    postalCode,
    city,
    loading,
    error,
  }), [propertyName, rentalMode, address, postalCode, city, loading, error]);
}


