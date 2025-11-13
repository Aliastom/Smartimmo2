/**
 * fiscalStore - Store Zustand pour l'Espace Fiscal
 * 
 * Gère l'état global de la simulation fiscale
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FiscalInputs, SimulationResult } from '@/types/fiscal';

export type FiscalStatus = 'idle' | 'calculating' | 'done' | 'error';

interface FiscalStore {
  // État de la simulation
  simulationDraft: Partial<FiscalInputs>;
  simulationResult: SimulationResult | null;
  status: FiscalStatus;
  error: string | null;
  savedSimulationId: string | null;
  
  // Actions
  updateDraft: (updates: Partial<FiscalInputs>) => void;
  setResult: (result: SimulationResult) => void;
  setStatus: (status: FiscalStatus) => void;
  setError: (error: string | null) => void;
  setSavedSimulationId: (id: string | null) => void;
  resetSimulation: () => void;
  computeFiscalSimulation: () => Promise<void>;
}

const initialDraft: Partial<FiscalInputs> = {
  year: new Date().getFullYear(),
  foyer: {
    salaire: 50000,
    autresRevenus: 0,
    parts: 1,
    isCouple: false,
  },
  per: undefined,
  options: {
    autofill: true,
    baseCalcul: 'encaisse',
    optimiserRegimes: true,
  },
  // Métadonnées UI pour le formulaire (non utilisées dans les calculs)
  _uiMetadata: {
    salaryMode: 'brut' as 'brut' | 'netImposable',
    salaireBrutOriginal: 50000,
    deductionMode: 'forfaitaire' as 'forfaitaire' | 'reels',
    fraisReels: 0,
    perEnabled: false,
    regimeOverride: 'auto' as 'auto' | 'micro' | 'reel',
    autofill: true,
  },
};

export const useFiscalStore = create<FiscalStore>()(
  persist(
    (set, get) => ({
      // État initial - simulation vide au démarrage
      simulationDraft: initialDraft,
      simulationResult: null,
      status: 'idle',
      error: null,
      savedSimulationId: null,

      // Mettre à jour le draft
      updateDraft: (updates) => {
        set((state) => ({
          simulationDraft: {
            ...state.simulationDraft,
            ...updates,
          },
        }));
      },

      // Définir le résultat
      setResult: (result) => {
        set({ simulationResult: result, status: 'done', error: null });
      },

      // Définir le statut
      setStatus: (status) => {
        set({ status });
      },

      // Définir l'erreur
      setError: (error) => {
        set({ error, status: 'error' });
      },

      // Définir l'ID sauvegardé
      setSavedSimulationId: (id) => {
        set({ savedSimulationId: id });
      },

      // Réinitialiser
      resetSimulation: () => {
        set({
          simulationDraft: initialDraft,
          simulationResult: null,
          status: 'idle',
          error: null,
          savedSimulationId: null,
        });
      },

      // Calculer la simulation
      computeFiscalSimulation: async () => {
        const { simulationDraft } = get();
        
        set({ status: 'calculating', error: null });

        try {
          const response = await fetch('/api/fiscal/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(simulationDraft),
          });

          if (!response.ok) {
            throw new Error('Erreur lors de la simulation');
          }

          const result: SimulationResult = await response.json();
          
          set({ 
            simulationResult: result, 
            status: 'done',
            error: null,
          });

          return result;
        } catch (error: any) {
          console.error('Erreur simulation:', error);
          set({ 
            error: error.message || 'Erreur lors de la simulation', 
            status: 'error' 
          });
          throw error;
        }
      },
    }),
    {
      name: 'fiscal-store',
      // Ne persister que le draft, PAS la simulation (on veut démarrer vide)
      partialize: (state) => ({
        simulationDraft: state.simulationDraft,
      }),
    }
  )
);

