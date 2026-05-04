'use client';

/**
 * Encart court — page bien (vue fiscale) & synthèse fiscale.
 */
export function GestionVsFiscalExplainer({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs text-slate-800 leading-relaxed ${className}`}
    >
      <p className="font-medium text-slate-900">Gestion et fiscalité peuvent différer :</p>
      <p className="mt-1 text-slate-700">
        • La gestion suit le mois comptable.
        <br />
        • La fiscalité suit l’encaissement et les règles LMNP.
        <br />• Certaines charges viennent du prêt ou des amortissements.
      </p>
    </div>
  );
}
