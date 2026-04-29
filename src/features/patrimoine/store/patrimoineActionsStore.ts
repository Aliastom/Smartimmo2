'use client';

import { create } from 'zustand';
import { toast } from 'sonner';
import { formatCurrencyEUR } from '@/utils/format';
import { marketInvestmentStorage } from '@/features/market/services/marketInvestmentStorage';

const LS_KEY = 'smartimmo.patrimoine.lastDcaApplyAt';

/** Anti double-clic / rafales après succès */
const MIN_GAP_MS = 1000;

/** Délai minimal UX après la persistance (500–800 ms) */
const MIN_UX_MS = 650;

/** Durée d’affichage « DCA appliqué » sur le bouton */
export const DCA_SUCCESS_UI_MS = 3000;

export interface ApplyDcaInput {
  organizationId: string;
  amountEuros: number;
}

async function persistDcaSettings(organizationId: string, amountEuros: number): Promise<void> {
  const s = await marketInvestmentStorage.getSettings(organizationId);
  const nextDca = Math.max(0, amountEuros);
  await marketInvestmentStorage.saveSettings({
    ...s,
    monthlyDcaAmount: nextDca,
    investmentStrategy: s.investmentStrategy
      ? { ...s.investmentStrategy, monthlyDca: nextDca }
      : s.investmentStrategy,
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync:refresh'));
  }
}

export function formatPatrimoineLastActionRelative(ts: number | null): string | null {
  if (ts == null || !Number.isFinite(ts)) return null;
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 45) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

interface PatrimoineActionsStore {
  isApplyingDca: boolean;
  lastAppliedAt: number | null;
  /** Flash UI succès sur le bouton (mémoire uniquement) */
  lastSuccessUiAt: number | null;
  applyDca: (input: ApplyDcaInput) => Promise<void>;
  hydrateLastAppliedFromStorage: () => void;
}

export const usePatrimoineActionsStore = create<PatrimoineActionsStore>((set, get) => ({
  isApplyingDca: false,
  lastAppliedAt: null,
  lastSuccessUiAt: null,

  hydrateLastAppliedFromStorage: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const t = Number(raw);
      if (Number.isFinite(t) && t > 0) {
        set({ lastAppliedAt: t });
      }
    } catch {
      /* ignore */
    }
  },

  applyDca: async (input) => {
    const { organizationId, amountEuros } = input;
    if (!organizationId) return;

    const st = get();
    if (st.isApplyingDca) return;

    const t0 = Date.now();
    if (st.lastAppliedAt != null && t0 - st.lastAppliedAt < MIN_GAP_MS) return;

    set({ isApplyingDca: true });
    const started = Date.now();

    try {
      await persistDcaSettings(organizationId, amountEuros);
      const elapsed = Date.now() - started;
      if (elapsed < MIN_UX_MS) {
        await new Promise<void>((resolve) => setTimeout(resolve, MIN_UX_MS - elapsed));
      }
      const now = Date.now();
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(LS_KEY, String(now));
        }
      } catch {
        /* ignore */
      }
      const flashId = now;
      set({
        lastAppliedAt: now,
        lastSuccessUiAt: flashId,
        isApplyingDca: false,
      });
      toast.success(`DCA de ${formatCurrencyEUR(amountEuros)} appliqué`);
      window.setTimeout(() => {
        if (get().lastSuccessUiAt === flashId) {
          set({ lastSuccessUiAt: null });
        }
      }, DCA_SUCCESS_UI_MS);
    } catch {
      set({ isApplyingDca: false });
      toast.error("Erreur lors de l'application");
    }
  },
}));
