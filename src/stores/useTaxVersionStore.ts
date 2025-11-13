/**
 * Store Zustand pour la gestion de la version fiscale active
 */

import { create } from 'zustand';
import { TaxParamsService } from '@/services/TaxParamsService';

interface TaxVersionState {
  activeVersion: any | null;
  loading: boolean;
  error: string | null;
  fetchActiveVersion: () => Promise<void>;
  refetch: () => Promise<void>;
}

export const useTaxVersionStore = create<TaxVersionState>((set, get) => ({
  activeVersion: null,
  loading: false,
  error: null,

  fetchActiveVersion: async () => {
    set({ loading: true, error: null });

    try {
      const service = new TaxParamsService();
      const version = await service.getActiveVersion();
      set({ activeVersion: version, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  refetch: async () => {
    await get().fetchActiveVersion();
  },
}));

