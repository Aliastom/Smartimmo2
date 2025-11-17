'use client';

import { createContext, useContext, useState, ReactNode, useMemo } from 'react';

interface PropertyHeaderActionsContextType {
  setActions: (actions: ReactNode) => void;
  actions: ReactNode;
}

const PropertyHeaderActionsContext = createContext<PropertyHeaderActionsContextType | undefined>(undefined);

export function PropertyHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null);

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

