/**
 * Store pour le mode expert fiscal
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ExpertModeStore {
  isExpertMode: boolean;
  toggleExpertMode: () => void;
  setExpertMode: (value: boolean) => void;
  
  // Overrides pour simulations what-if
  overrides: {
    revenuImposable?: number;
    revenuFoncier?: number;
    perDeduction?: number;
  };
  setOverride: (key: keyof ExpertModeStore['overrides'], value: number | undefined) => void;
  resetOverrides: () => void;
  
  // Scénarios sauvegardés
  scenarios: Array<{
    id: string;
    name: string;
    overrides: ExpertModeStore['overrides'];
    createdAt: Date;
  }>;
  addScenario: (name: string, overrides: ExpertModeStore['overrides']) => void;
  removeScenario: (id: string) => void;
}

export const useExpertModeStore = create<ExpertModeStore>()(
  persist(
    (set) => ({
      isExpertMode: false,
      
      toggleExpertMode: () => set((state) => ({ isExpertMode: !state.isExpertMode })),
      
      setExpertMode: (value) => set({ isExpertMode: value }),
      
      overrides: {},
      
      setOverride: (key, value) => set((state) => ({
        overrides: { ...state.overrides, [key]: value }
      })),
      
      resetOverrides: () => set({ overrides: {} }),
      
      scenarios: [],
      
      addScenario: (name, overrides) => set((state) => ({
        scenarios: [
          ...state.scenarios,
          {
            id: Date.now().toString(),
            name,
            overrides,
            createdAt: new Date(),
          }
        ]
      })),
      
      removeScenario: (id) => set((state) => ({
        scenarios: state.scenarios.filter(s => s.id !== id)
      })),
    }),
    {
      name: 'expert-mode-storage',
    }
  )
);

