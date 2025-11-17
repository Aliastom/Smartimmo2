'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface LoadingContextType {
  isLoading: (path: string) => boolean;
  setLoading: (path: string, loading: boolean) => void;
  loadingPaths: Set<string>;
  loadingPathsArray: string[]; // Array pour forcer les re-renders
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [loadingPathsArray, setLoadingPathsArray] = useState<string[]>([]);

  const isLoading = useCallback((path: string) => {
    return loadingPaths.has(path);
  }, [loadingPaths]);

  const setLoading = useCallback((path: string, loading: boolean) => {
    setLoadingPaths((prev) => {
      const next = new Set(prev);
      if (loading) {
        next.add(path);
      } else {
        next.delete(path);
      }
      // Mettre à jour l'array pour forcer les re-renders
      setLoadingPathsArray(Array.from(next));
      return next;
    });
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, setLoading, loadingPaths, loadingPathsArray }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}

