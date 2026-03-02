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
  // ✅ Cache des données autofill pour éviter de recharger
  autofillCache: {
    biens: any[];
    year: number;
    baseCalcul: 'encaisse' | 'exigible';
    scope?: { propertyIds?: string[] };
  } | null;
  
  // Actions
  updateDraft: (updates: Partial<FiscalInputs>) => void;
  setResult: (result: SimulationResult) => void;
  setStatus: (status: FiscalStatus) => void;
  setError: (error: string | null) => void;
  setSavedSimulationId: (id: string | null) => void;
  resetSimulation: () => void;
  setAutofillCache: (cache: FiscalStore['autofillCache']) => void;
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
      autofillCache: null,

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

      // Définir le cache autofill
      setAutofillCache: (cache) => {
        set({ autofillCache: cache });
      },

      // Réinitialiser
      resetSimulation: () => {
        set({
          simulationDraft: initialDraft,
          simulationResult: null,
          status: 'idle',
          error: null,
          savedSimulationId: null,
          autofillCache: null,
        });
      },

      // Calculer la simulation
      computeFiscalSimulation: async () => {
        const { simulationDraft, autofillCache } = get();
        
        set({ status: 'calculating', error: null });

        try {
          // ✅ Inclure le scope avec les IDs des biens sélectionnés si autofill est activé
          const selectedBienIds = (simulationDraft._uiMetadata as any)?.selectedBienIds || [];
          const scope = simulationDraft.options?.autofill && selectedBienIds.length > 0 ? {
            propertyIds: selectedBienIds,
          } : undefined;
          
          // ✅ Si on a un cache autofill valide pour la même année/baseCalcul, l'utiliser
          // On ne compare pas le scope car les selectedBienIds peuvent changer, mais les biens chargés restent les mêmes
          const useCache = autofillCache && 
            autofillCache.year === simulationDraft.year &&
            autofillCache.baseCalcul === simulationDraft.options?.baseCalcul &&
            autofillCache.biens && 
            autofillCache.biens.length > 0;
          
          console.log('🔍 Vérification cache:', {
            hasCache: !!autofillCache,
            cacheYear: autofillCache?.year,
            draftYear: simulationDraft.year,
            cacheBaseCalcul: autofillCache?.baseCalcul,
            draftBaseCalcul: simulationDraft.options?.baseCalcul,
            cacheBiensCount: autofillCache?.biens?.length,
            selectedBienIdsCount: selectedBienIds.length,
            useCache,
          });
          
          // ✅ Filtrer les biens du cache selon les selectedBienIds
          let biensFromCache: any[] | undefined = undefined;
          if (useCache && autofillCache.biens) {
            if (selectedBienIds.length > 0) {
              // Filtrer pour ne garder que les biens sélectionnés
              biensFromCache = autofillCache.biens.filter((b: any) => 
                selectedBienIds.includes(b.id)
              );
              console.log(`✅ Filtrage du cache: ${autofillCache.biens.length} → ${biensFromCache.length} bien(s) sélectionné(s)`);
            } else {
              // Si aucun bien sélectionné, ne pas utiliser le cache (ou utiliser tous les biens ?)
              console.warn('⚠️ Aucun bien sélectionné, utilisation de tous les biens du cache');
              biensFromCache = autofillCache.biens;
            }
          }
          
          const baremeCode = (simulationDraft._uiMetadata as any)?.baremeCode as string | undefined;
          const payload = {
            ...simulationDraft,
            scope,
            ...(baremeCode ? { baremeCode } : {}),
            // ✅ Passer les biens filtrés du cache si disponible pour éviter de recharger
            biens: biensFromCache,
            _useAutofillCache: useCache, // Flag pour indiquer qu'on utilise le cache
          };
          
          const response = await fetch('/api/fiscal/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
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

