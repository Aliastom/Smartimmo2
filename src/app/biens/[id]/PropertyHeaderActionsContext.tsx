'use client';

import { createContext, useContext, useState, ReactNode, useMemo, useRef, useEffect } from 'react';

interface PropertyHeaderActionsContextType {
  setActions: (actions: ReactNode) => void;
  actions: ReactNode;
}

const PropertyHeaderActionsContext = createContext<PropertyHeaderActionsContextType | undefined>(undefined);

// État global pour les actions (hors contexte React pour éviter les re-renders)
const globalActionsRef = { current: null as ReactNode };
const globalActionsListeners = new Set<() => void>();

// Fonction pour notifier tous les listeners
function notifyActionsListeners() {
  globalActionsListeners.forEach(listener => listener());
}

export function PropertyHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null);

  // Synchroniser avec le ref global
  useEffect(() => {
    globalActionsRef.current = actions;
    notifyActionsListeners();
  }, [actions]);

  // Mémoriser la valeur du contexte pour éviter les re-renders inutiles
  const contextValue = useMemo(() => ({ setActions, actions }), [actions]);

  return (
    <PropertyHeaderActionsContext.Provider value={contextValue}>
      {children}
    </PropertyHeaderActionsContext.Provider>
  );
}

export function usePropertyHeaderActions() {
  const context = useContext(PropertyHeaderActionsContext);
  if (context === undefined) {
    throw new Error('usePropertyHeaderActions must be used within a PropertyHeaderActionsProvider');
  }
  return context;
}

// Hook pour lire les actions depuis l'extérieur du provider (sans re-render)
export function useHeaderActionsStatic() {
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    const listener = () => forceUpdate({});
    globalActionsListeners.add(listener);
    return () => {
      globalActionsListeners.delete(listener);
    };
  }, []);
  
  return globalActionsRef.current;
}

