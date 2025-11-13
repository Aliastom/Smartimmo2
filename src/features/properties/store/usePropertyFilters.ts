'use client';

import { useState, useEffect } from 'react';

export type StatusFilter = 'all' | 'occupied' | 'vacant';

interface PropertyFiltersState {
  selectedPropertyIds: string[] | null;
  statusFilter: StatusFilter;
}

// Store simple sans zustand, utilisant un singleton avec React hooks
let globalState: PropertyFiltersState = {
  selectedPropertyIds: null,
  statusFilter: 'all',
};

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const propertyFiltersStore = {
  getState: () => globalState,
  
  setSelectedPropertyIds: (ids: string[] | null) => {
    globalState = { ...globalState, selectedPropertyIds: ids };
    notify();
  },
  
  setStatusFilter: (filter: StatusFilter) => {
    globalState = { ...globalState, statusFilter: filter };
    notify();
  },
  
  reset: () => {
    globalState = { selectedPropertyIds: null, statusFilter: 'all' };
    notify();
  },
  
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function usePropertyFilters() {
  const [state, setState] = useState(propertyFiltersStore.getState());
  
  useEffect(() => {
    const unsubscribe = propertyFiltersStore.subscribe(() => {
      setState(propertyFiltersStore.getState());
    });
    return unsubscribe;
  }, []);
  
  return {
    selectedPropertyIds: state.selectedPropertyIds,
    statusFilter: state.statusFilter,
    setSelectedPropertyIds: propertyFiltersStore.setSelectedPropertyIds,
    setStatusFilter: propertyFiltersStore.setStatusFilter,
    reset: propertyFiltersStore.reset,
  };
}

