import type { InvestmentEnvelope } from '@/features/market/types';

/** Enveloppe étendue par rapport au conseil historique (crypto, autre). */
export type PortfolioAccountKind = InvestmentEnvelope | 'CRYPTO' | 'AUTRE';

export type PortfolioOrderType =
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'FEE'
  | 'TAX'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';

export interface PortfolioAccount {
  id: string;
  organizationId: string;
  name: string;
  kind: PortfolioAccountKind;
  currency: string;
  /** Taux annuel d’inflation de référence pour les estimations (ex. 0,02). Optionnel, défaut moteur. */
  inflationAnnualRate?: number | null;
  /** Hypothèses fiscales propres au compte (surcharge couche globale). */
  fiscalProfileId?: string | null;
  createdAt: string;
  updatedAt: string;
  _syncedAt?: string;
}

export interface PortfolioOrder {
  id: string;
  organizationId: string;
  accountId: string;
  /** Symbole provider / ticker normalisé (ex. CW8.PA) */
  assetSymbol: string;
  assetIsin?: string | null;
  type: PortfolioOrderType;
  date: string;
  quantity: number;
  unitPrice: number | null;
  grossAmount: number | null;
  fees: number;
  taxes: number;
  currency: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  _syncedAt?: string;
}

export type PortfolioPositionWarningCode =
  | 'NEGATIVE_QUANTITY'
  | 'MISSING_PRICE_FOR_VALUATION'
  | 'STALE_PRICE_FOR_VALUATION'
  | 'UNKNOWN_ASSET_SYMBOL'
  | 'ORDER_INCOHERENT'
  | 'TRANSFER_MISMATCH';

export interface PortfolioPositionWarning {
  code: PortfolioPositionWarningCode;
  message: string;
  orderId?: string;
}

/** Statut du dernier cours utilisé pour la valorisation (TTL paramétrable côté hook). */
export type PortfolioPriceStatus = 'fresh' | 'stale' | 'missing';

export interface PortfolioPositionComputed {
  accountId: string;
  accountName: string;
  accountKind: PortfolioAccountKind;
  assetSymbol: string;
  assetIsin: string | null;
  quantity: number;
  averageCostPerUnit: number;
  /** Coût restant (quantité × PRU) */
  remainingCostBasis: number;
  lastPrice: number | null;
  /** Date ISO du snapshot marché ayant fourni ce cours (si connue). */
  lastPriceFetchedAt: string | null;
  priceStatus: PortfolioPriceStatus;
  marketValue: number | null;
  /** Référence au coût quand aucun cours : hors total « Valeur actuelle », mais ligne toujours visible. */
  indicativeValueAtCostEuro: number;
  unrealizedPnLEuro: number | null;
  unrealizedPnLPct: number | null;
  realizedPnLEuro: number;
  dividendsNet: number;
  feesAllocated: number;
  taxesAllocated: number;
  warnings: PortfolioPositionWarning[];
}

/** Règles de valorisation agrégée : impact des cours sur les KPI « valeur » et « PV latente ». */
export interface PortfolioValuationCoverage {
  /** Lignes ouvertes (hors lots techniques __). */
  openLines: number;
  /** Lignes ouvertes avec un cours connu (ancien ou frais) : incluses dans totalMarketValue. */
  linesWithMarketPrice: number;
  /** Cours manquant : exclus de totalMarketValue et de la PV latente totale. */
  linesMissingPrice: number;
  /** Cours présent mais au-delà du TTL : **toujours** incluses dans totalMarketValue (même poids qu’un cours frais). */
  linesStalePrice: number;
  /** Coût PRU des lignes sans cours (rappel : non compris dans « Valeur actuelle »). */
  costBasisOpenWithoutPriceEuro: number;
}

/** Bases fiscales simplifiées par enveloppe : le moteur agrège d’abord réalisé + dividendes sur tous les lots (y compris lignes closes), puis la PV latente uniquement sur les positions ouvertes. */
export type PortfolioFiscalIncomeByKind = Partial<
  Record<PortfolioAccountKind, { unrealized: number; realized: number; dividends: number }>
>;

export interface PortfolioTotals {
  totalMarketValue: number;
  /** Somme des coûts restants des lignes encore ouvertes (toujours, même si cours manquant). */
  totalRemainingCostBasis: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  totalDividendsNet: number;
  totalFees: number;
  totalTaxes: number;
  /** Performance brute (latente + réalisée + dividendes nets, hors effet fiscal obligatoire sur PV réalisées) */
  grossPerformanceEuro: number;
  valuationCoverage: PortfolioValuationCoverage;
}

export interface FiscalEstimateParams {
  /** PFU-like flat rate on dividends + realized gains (CTO par défaut). */
  flatTaxRateOnIncome?: number;
  /** PEA : prélèvements sociaux sur les gains à la sortie (modèle simplifié). */
  peaSocialRateOnGains?: boolean;
  peaSocialContributionsOnGainsRate?: number;
  /** Assurance-vie : placeholder — taux forfaitaire optionnel sur gains estimés */
  assuranceVieFlatRateOnGains?: number | null;
}

export interface FiscalEstimateLine {
  envelope: PortfolioAccountKind;
  /** Gain latent + PV réalisées + dividendes soumis au barème simplifié */
  taxableBaseEstimateEuro: number;
  taxEstimateEuro: number;
  assumptions: string[];
}

/**
 * Instantané persisté (lecture historique / courbe) — la vérité reste ordres + cours actuels.
 * `valuationIncomplete` = au moins une ligne ouverte sans cours au moment T.
 */
export interface PortfolioSnapshot {
  id: string;
  organizationId: string;
  capturedAt: string;
  totalMarketValue: number;
  totalRemainingCostBasis: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  totalDividendsNet: number;
  grossPerformanceEuro: number;
  /** Performance brute moins impôt estimé (même définition que l’UI « net fiscal »). */
  netPerformanceAfterTaxEuro: number;
  surplusInflationEuro: number;
  valuationIncomplete: boolean;
  createdAt: string;
}

export interface PortfolioFiscalEstimateResult {
  lines: FiscalEstimateLine[];
  totalTaxEstimateEuro: number;
  disclaimer: string;
}
