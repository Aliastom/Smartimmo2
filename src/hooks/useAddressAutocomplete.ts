'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface AddressSuggestion {
  label: string;
  street: string;
  postcode: string;
  city: string;
  citycode?: string;
  context?: string;
  x?: number;
  y?: number;
}

interface ApiResponse {
  features: Array<{
    properties: {
      label: string;
      name: string;
      postcode: string;
      city: string;
      citycode?: string;
      context?: string;
      x?: number;
      y?: number;
    };
  }>;
}

export function useAddressAutocomplete() {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isApiAvailable, setIsApiAvailable] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cache des adresses récentes (optionnel)
  const recentAddressesKey = 'recent_addresses';

  const getCachedAddresses = useCallback((): AddressSuggestion[] => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(recentAddressesKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }, []);

  const addToCache = useCallback((address: AddressSuggestion) => {
    if (typeof window === 'undefined') return;
    try {
      const cached = getCachedAddresses();
      const filtered = cached.filter(a => a.label !== address.label);
      const updated = [address, ...filtered].slice(0, 10); // Garder les 10 dernières
      localStorage.setItem(recentAddressesKey, JSON.stringify(updated));
    } catch (error) {
      console.warn('Erreur lors de la mise en cache:', error);
    }
  }, [getCachedAddresses]);

  const searchAddresses = useCallback(async (query: string) => {
    // Nettoyage de la recherche précédente
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Query trop courte
    if (query.trim().length < 3) {
      setSuggestions([]);
      setError(null);
      return;
    }

    // Debounce de 300ms
    debounceTimerRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // Appel à l'API Adresse du Gouvernement
        const response = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=8`,
          {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Erreur API: ${response.status}`);
        }

        const data: ApiResponse = await response.json();

        const formattedSuggestions: AddressSuggestion[] = data.features.map(feature => ({
          label: feature.properties.label,
          street: feature.properties.name,
          postcode: feature.properties.postcode,
          city: feature.properties.city,
          citycode: feature.properties.citycode,
          context: feature.properties.context,
          x: feature.properties.x,
          y: feature.properties.y,
        }));

        setSuggestions(formattedSuggestions);
        setIsApiAvailable(true);
        setError(null);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Requête annulée, pas d'erreur
          return;
        }

        console.warn('Erreur API Adresse:', err);
        setIsApiAvailable(false);
        setError('Auto-complétion temporairement indisponible');
        setSuggestions([]);

        // Proposer les adresses du cache en fallback
        const cached = getCachedAddresses();
        const filteredCache = cached.filter(addr =>
          addr.label.toLowerCase().includes(query.toLowerCase())
        );
        if (filteredCache.length > 0) {
          setSuggestions(filteredCache);
          setError('Mode hors-ligne (adresses récentes)');
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, [getCachedAddresses]);

  const selectAddress = useCallback((address: AddressSuggestion) => {
    addToCache(address);
    setSuggestions([]);
  }, [addToCache]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    isApiAvailable,
    searchAddresses,
    selectAddress,
    clearSuggestions,
  };
}

