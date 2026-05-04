import type {
  FiscalEstimateParams,
  PortfolioAccountKind,
  PortfolioFiscalEstimateResult,
  FiscalEstimateLine,
} from '@/features/market/portfolio/portfolioTypes';

const DEFAULT_DISCLAIMER =
  'Estimation fiscale indicative uniquement (hypothèses paramétrables). Ne remplace pas une liasse ou un conseil professionnel. La fiscalité réelle dépend de votre situation, des options et des textes en vigueur.';

/**
 * Couche simple et extensible : barèmes forfaitaires par enveloppe.
 * - CTO : PFU forfaitaire sur gains réalisés + dividendes (taux unique paramétrable).
 * - PEA : PS sur les gains uniquement (option simplifiée hors durée / sortie).
 * - Assurance-vie : placeholder (taux optionnel si défini).
 */
export function estimatePortfolioTaxSimple(params: {
  /** Gain latent + PV réalisées (lot) + dividendes nets (agrégés par enveloppe) */
  incomeLikeByKind: Partial<Record<PortfolioAccountKind, { unrealized: number; realized: number; dividends: number }>>;
  fiscal: FiscalEstimateParams;
}): PortfolioFiscalEstimateResult {
  const flat = params.fiscal.flatTaxRateOnIncome ?? 0.3;
  const peaRate = params.fiscal.peaSocialContributionsOnGainsRate ?? 0.172;
  const avRate = params.fiscal.assuranceVieFlatRateOnGains ?? null;

  const lines: FiscalEstimateLine[] = [];
  const kinds = Object.keys(params.incomeLikeByKind) as PortfolioAccountKind[];

  for (const envelope of kinds) {
    const slice = params.incomeLikeByKind[envelope];
    if (!slice) continue;
    const assumptions: string[] = [];
    let taxEstimateEuro = 0;
    let taxableBaseEstimateEuro = 0;

    if (envelope === 'CTO') {
      taxableBaseEstimateEuro = Math.max(0, slice.realized + slice.dividends);
      assumptions.push(`Prélèvement forfaitaire unique sur réalisé + dividendes : ${(flat * 100).toFixed(1)} % (paramètre).`);
      taxEstimateEuro = taxableBaseEstimateEuro * flat;
      const latent = Math.max(0, slice.unrealized);
      if (latent > 0) {
        assumptions.push(
          'Plus-value latente non taxée tant que non réalisée — non incluse dans la base estimée ci-dessus.'
        );
      }
    } else if (envelope === 'PEA') {
      const gainsLike = Math.max(0, slice.realized + slice.unrealized);
      taxableBaseEstimateEuro = gainsLike;
      assumptions.push(
        `Modèle simplifié PEA : prélèvements sociaux ${(peaRate * 100).toFixed(1)} % sur gains (paramètre), hors durée de détention / sortie.`
      );
      taxEstimateEuro = gainsLike * peaRate;
    } else if (envelope === 'ASSURANCE_VIE') {
      const gainsLike = Math.max(0, slice.realized + slice.unrealized + slice.dividends);
      taxableBaseEstimateEuro = gainsLike;
      if (typeof avRate === 'number' && Number.isFinite(avRate) && avRate >= 0) {
        assumptions.push(`Placeholder assurance-vie : ${(avRate * 100).toFixed(1)} % sur base élargie (paramètre).`);
        taxEstimateEuro = gainsLike * avRate;
      } else {
        assumptions.push('Assurance-vie : barème non renseigné — estimation mise à 0 (à étendre).');
        taxEstimateEuro = 0;
      }
    } else {
      /* CRYPTO / AUTRE — traiter comme CTO par défaut */
      taxableBaseEstimateEuro = Math.max(0, slice.realized + slice.dividends);
      assumptions.push(`Enveloppe « ${envelope} » : même approximation que CTO (${(flat * 100).toFixed(1)} %).`);
      taxEstimateEuro = taxableBaseEstimateEuro * flat;
    }

    lines.push({
      envelope,
      taxableBaseEstimateEuro: Math.round(taxableBaseEstimateEuro * 100) / 100,
      taxEstimateEuro: Math.round(taxEstimateEuro * 100) / 100,
      assumptions,
    });
  }

  const totalTaxEstimateEuro = Math.round(lines.reduce((s, l) => s + l.taxEstimateEuro, 0) * 100) / 100;

  return {
    lines,
    totalTaxEstimateEuro,
    disclaimer: DEFAULT_DISCLAIMER,
  };
}
