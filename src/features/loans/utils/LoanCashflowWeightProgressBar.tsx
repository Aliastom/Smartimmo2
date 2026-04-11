'use client';

/**
 * Barre 0–100 % : dégradé vert → orange ; au-delà de 100 % : piste entièrement rouge.
 */
export function LoanCashflowWeightProgressBar({ pct }: { pct: number | null }) {
  return (
    <div
      className="h-2 w-full max-w-[132px] rounded-full bg-slate-200/90 overflow-hidden"
      aria-hidden
    >
      {pct === null ? null : pct > 100 ? (
        <div className="h-full w-full rounded-full bg-red-500" />
      ) : (
        <div
          className="h-full min-w-0 rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-[width] duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      )}
    </div>
  );
}
