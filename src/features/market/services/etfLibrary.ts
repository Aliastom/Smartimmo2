import { normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';

export type EtfCategory =
  | 'WORLD'
  | 'SP500'
  | 'NASDAQ'
  | 'EUROPE'
  | 'EMERGENTS'
  | 'OBLIGATIONS'
  | 'OR'
  | 'CRYPTO'
  | 'SECTORIEL';

export type EtfEnvelope = 'PEA' | 'CTO' | 'ASSURANCE_VIE' | 'AUTRE';
export type EtfDistribution = 'CAPITALISANT' | 'DISTRIBUANT';
export type EtfPortfolioRole = 'PILIER' | 'DIVERSIFICATION' | 'SATELLITE' | 'SPECULATIF';
export type MarketAssetClass =
  | 'ETF_ACTION'
  | 'ETF_OBLIGATAIRE'
  | 'ETC_OR'
  | 'ETN_CRYPTO'
  | 'SCPI'
  | 'PRIVATE_EQUITY'
  | 'FONDS_DATE';

export interface EtfLibraryItem {
  id: string;
  name: string;
  ticker: string;
  isin: string;
  issuer: string;
  category: EtfCategory;
  assetClass: MarketAssetClass;
  eligibleEnvelopes: EtfEnvelope[];
  totalExpenseRatioPct: number;
  aumBillionEur: number;
  distributionPolicy: EtfDistribution;
  inceptionYear: number;
  volatilityPct: number;
  shortComment: string;
  portfolioRole: EtfPortfolioRole;
}

export interface EtfQualityScoreBreakdown {
  fees: number;
  aum: number;
  age: number;
  volatilityConsistency: number;
  peaEligibility: number;
  accumulationPolicy: number;
}

export interface EtfQualityScoreResult {
  score: number;
  breakdown: EtfQualityScoreBreakdown;
}

const EQUITY_CATEGORIES: EtfCategory[] = ['WORLD', 'SP500', 'NASDAQ', 'EUROPE', 'EMERGENTS', 'SECTORIEL'];

const CATEGORY_VOLATILITY_TARGETS: Record<EtfCategory, { min: number; max: number }> = {
  WORLD: { min: 12, max: 22 },
  SP500: { min: 14, max: 24 },
  NASDAQ: { min: 18, max: 35 },
  EUROPE: { min: 12, max: 24 },
  EMERGENTS: { min: 16, max: 32 },
  OBLIGATIONS: { min: 3, max: 12 },
  OR: { min: 12, max: 28 },
  CRYPTO: { min: 45, max: 95 },
  SECTORIEL: { min: 16, max: 36 },
};

export const ETF_LIBRARY: EtfLibraryItem[] = [
  {
    id: 'amundi-msci-world-cw8',
    name: 'Amundi MSCI World UCITS ETF',
    ticker: 'CW8.PA',
    isin: 'LU1681043599',
    issuer: 'Amundi',
    category: 'WORLD',
    assetClass: 'ETF_ACTION',
    eligibleEnvelopes: ['PEA', 'CTO', 'ASSURANCE_VIE'],
    totalExpenseRatioPct: 0.38,
    aumBillionEur: 6.8,
    distributionPolicy: 'CAPITALISANT',
    inceptionYear: 2018,
    volatilityPct: 17.2,
    shortComment: 'Référence PEA large cap monde.',
    portfolioRole: 'PILIER',
  },
  {
    id: 'ishares-core-msci-world-eunl',
    name: 'iShares Core MSCI World UCITS ETF',
    ticker: 'EUNL.DE',
    isin: 'IE00B4L5Y983',
    issuer: 'iShares',
    category: 'WORLD',
    assetClass: 'ETF_ACTION',
    eligibleEnvelopes: ['CTO', 'ASSURANCE_VIE'],
    totalExpenseRatioPct: 0.2,
    aumBillionEur: 64,
    distributionPolicy: 'CAPITALISANT',
    inceptionYear: 2009,
    volatilityPct: 16.9,
    shortComment: 'Très gros encours, benchmark global.',
    portfolioRole: 'PILIER',
  },
  {
    id: 'vanguard-sp500-vusa',
    name: 'Vanguard S&P 500 UCITS ETF',
    ticker: 'VUSA.L',
    isin: 'IE00B3XXRP09',
    issuer: 'Vanguard',
    category: 'SP500',
    assetClass: 'ETF_ACTION',
    eligibleEnvelopes: ['CTO', 'ASSURANCE_VIE'],
    totalExpenseRatioPct: 0.07,
    aumBillionEur: 36,
    distributionPolicy: 'DISTRIBUANT',
    inceptionYear: 2012,
    volatilityPct: 18.5,
    shortComment: 'Exposition US pure, frais très faibles.',
    portfolioRole: 'PILIER',
  },
  {
    id: 'amundi-pea-sp500',
    name: 'Amundi PEA S&P 500 UCITS ETF',
    ticker: '500.PA',
    isin: 'FR0013412285',
    issuer: 'Amundi',
    category: 'SP500',
    assetClass: 'ETF_ACTION',
    eligibleEnvelopes: ['PEA', 'CTO', 'ASSURANCE_VIE'],
    totalExpenseRatioPct: 0.15,
    aumBillionEur: 4.7,
    distributionPolicy: 'CAPITALISANT',
    inceptionYear: 2019,
    volatilityPct: 18.1,
    shortComment: 'Version PEA de l’exposition S&P 500.',
    portfolioRole: 'PILIER',
  },
  {
    id: 'invesco-nasdaq-eqqq',
    name: 'Invesco EQQQ Nasdaq-100 UCITS ETF',
    ticker: 'EQQQ.L',
    isin: 'IE0032077012',
    issuer: 'Invesco',
    category: 'NASDAQ',
    assetClass: 'ETF_ACTION',
    eligibleEnvelopes: ['CTO', 'ASSURANCE_VIE'],
    totalExpenseRatioPct: 0.3,
    aumBillionEur: 8.9,
    distributionPolicy: 'DISTRIBUANT',
    inceptionYear: 2002,
    volatilityPct: 25.4,
    shortComment: 'Technologie US dominante, volatilité élevée.',
    portfolioRole: 'SATELLITE',
  },
  {
    id: 'lyxor-nasdaq-100-pea',
    name: 'Amundi PEA Nasdaq-100 UCITS ETF',
    ticker: 'PANX.PA',
    isin: 'FR0011871110',
    issuer: 'Amundi',
    category: 'NASDAQ',
    assetClass: 'ETF_ACTION',
    eligibleEnvelopes: ['PEA', 'CTO'],
    totalExpenseRatioPct: 0.3,
    aumBillionEur: 2.3,
    distributionPolicy: 'CAPITALISANT',
    inceptionYear: 2014,
    volatilityPct: 27.5,
    shortComment: 'Nasdaq PEA, plus concentré et volatil.',
    portfolioRole: 'SATELLITE',
  },
  {
    id: 'amundi-msci-emerging-aeem',
    name: 'Amundi MSCI Emerging Markets UCITS ETF',
    ticker: 'AEEM.PA',
    isin: 'LU1681045370',
    issuer: 'Amundi',
    category: 'EMERGENTS',
    assetClass: 'ETF_ACTION',
    eligibleEnvelopes: ['CTO', 'ASSURANCE_VIE'],
    totalExpenseRatioPct: 0.2,
    aumBillionEur: 1.7,
    distributionPolicy: 'CAPITALISANT',
    inceptionYear: 2018,
    volatilityPct: 22.6,
    shortComment: 'Diversification géographique émergente.',
    portfolioRole: 'DIVERSIFICATION',
  },
  {
    id: 'amundi-europe-stoxx600',
    name: 'Amundi STOXX Europe 600 UCITS ETF',
    ticker: 'MEUD.PA',
    isin: 'LU1681040223',
    issuer: 'Amundi',
    category: 'EUROPE',
    assetClass: 'ETF_ACTION',
    eligibleEnvelopes: ['CTO', 'ASSURANCE_VIE'],
    totalExpenseRatioPct: 0.18,
    aumBillionEur: 2.1,
    distributionPolicy: 'CAPITALISANT',
    inceptionYear: 2017,
    volatilityPct: 19.2,
    shortComment: 'Diversification actions Europe large/mid caps.',
    portfolioRole: 'DIVERSIFICATION',
  },
  {
    id: 'ishares-core-euro-government-bond',
    name: 'iShares Core Euro Government Bond UCITS ETF',
    ticker: 'IEGA.AS',
    isin: 'IE00B4WXJJ64',
    issuer: 'iShares',
    category: 'OBLIGATIONS',
    assetClass: 'ETF_OBLIGATAIRE',
    eligibleEnvelopes: ['CTO', 'ASSURANCE_VIE'],
    totalExpenseRatioPct: 0.09,
    aumBillionEur: 4.2,
    distributionPolicy: 'CAPITALISANT',
    inceptionYear: 2009,
    volatilityPct: 6.4,
    shortComment: 'Stabilisateur défensif obligataire euro.',
    portfolioRole: 'DIVERSIFICATION',
  },
  {
    id: 'amundi-euro-gov-bond-1-3y',
    name: 'Amundi Euro Government Bond 1-3Y UCITS ETF',
    ticker: 'EM13.PA',
    isin: 'LU1650487413',
    issuer: 'Amundi',
    category: 'OBLIGATIONS',
    assetClass: 'ETF_OBLIGATAIRE',
    eligibleEnvelopes: ['CTO', 'ASSURANCE_VIE'],
    totalExpenseRatioPct: 0.14,
    aumBillionEur: 1.8,
    distributionPolicy: 'CAPITALISANT',
    inceptionYear: 2017,
    volatilityPct: 4.8,
    shortComment: 'Obligataire court terme, profil défensif.',
    portfolioRole: 'DIVERSIFICATION',
  },
  {
    id: 'wisdomtree-physical-gold-etc',
    name: 'WisdomTree Physical Gold',
    ticker: 'PHAU.L',
    isin: 'JE00B1VS3770',
    issuer: 'WisdomTree',
    category: 'OR',
    assetClass: 'ETC_OR',
    eligibleEnvelopes: ['CTO', 'AUTRE'],
    totalExpenseRatioPct: 0.39,
    aumBillionEur: 15.4,
    distributionPolicy: 'CAPITALISANT',
    inceptionYear: 2007,
    volatilityPct: 17.8,
    shortComment: 'Couverture inflation et stress macro.',
    portfolioRole: 'DIVERSIFICATION',
  },
  {
    id: 'coinshares-physical-bitcoin-etn',
    name: 'CoinShares Physical Bitcoin ETP',
    ticker: 'BITC.SW',
    isin: 'GB00BLD4ZL17',
    issuer: 'CoinShares',
    category: 'CRYPTO',
    assetClass: 'ETN_CRYPTO',
    eligibleEnvelopes: ['CTO', 'AUTRE'],
    totalExpenseRatioPct: 0.98,
    aumBillionEur: 1.2,
    distributionPolicy: 'CAPITALISANT',
    inceptionYear: 2021,
    volatilityPct: 68,
    shortComment: 'Exposition bitcoin, risque très élevé.',
    portfolioRole: 'SPECULATIF',
  },
  {
    id: 'coinshares-physical-ethereum-etn',
    name: 'CoinShares Physical Ethereum ETP',
    ticker: 'ETHE.SW',
    isin: 'GB00BLD4ZM24',
    issuer: 'CoinShares',
    category: 'CRYPTO',
    assetClass: 'ETN_CRYPTO',
    eligibleEnvelopes: ['CTO', 'AUTRE'],
    totalExpenseRatioPct: 1.25,
    aumBillionEur: 0.8,
    distributionPolicy: 'CAPITALISANT',
    inceptionYear: 2021,
    volatilityPct: 78,
    shortComment: 'Exposition ethereum, très spéculatif.',
    portfolioRole: 'SPECULATIF',
  },
  {
    id: 'primovie-scpi',
    name: 'Primonial Primovie',
    ticker: 'SCPI-PRIMOVIE',
    isin: 'SCPI00000001',
    issuer: 'Primonial REIM',
    category: 'EUROPE',
    assetClass: 'SCPI',
    eligibleEnvelopes: ['ASSURANCE_VIE', 'AUTRE'],
    totalExpenseRatioPct: 1.85,
    aumBillionEur: 5.2,
    distributionPolicy: 'DISTRIBUANT',
    inceptionYear: 2012,
    volatilityPct: 8,
    shortComment: 'SCPI de rendement, non ETF classique.',
    portfolioRole: 'DIVERSIFICATION',
  },
  {
    id: 'blackstone-private-equity',
    name: 'Blackstone Private Equity Strategies',
    ticker: 'PE-BXPE',
    isin: 'PE0000000001',
    issuer: 'Blackstone',
    category: 'SECTORIEL',
    assetClass: 'PRIVATE_EQUITY',
    eligibleEnvelopes: ['AUTRE'],
    totalExpenseRatioPct: 2.4,
    aumBillionEur: 3.1,
    distributionPolicy: 'CAPITALISANT',
    inceptionYear: 2019,
    volatilityPct: 24,
    shortComment: 'Private equity non coté, liquidité réduite.',
    portfolioRole: 'SATELLITE',
  },
  {
    id: 'fonds-date-euro-2030',
    name: 'Fonds daté obligataire Euro 2030',
    ticker: 'FD-2030',
    isin: 'FD0000002030',
    issuer: 'BNP Paribas AM',
    category: 'OBLIGATIONS',
    assetClass: 'FONDS_DATE',
    eligibleEnvelopes: ['ASSURANCE_VIE', 'CTO'],
    totalExpenseRatioPct: 1.1,
    aumBillionEur: 1.4,
    distributionPolicy: 'DISTRIBUANT',
    inceptionYear: 2024,
    volatilityPct: 7.2,
    shortComment: 'Fonds daté, profil distinct des ETF obligataires.',
    portfolioRole: 'DIVERSIFICATION',
  },
];

function scoreFees(terPct: number): number {
  if (terPct <= 0.12) return 25;
  if (terPct <= 0.2) return 22;
  if (terPct <= 0.3) return 18;
  if (terPct <= 0.45) return 12;
  return 6;
}

function scoreFeesByAssetClass(item: EtfLibraryItem): number {
  if (item.assetClass === 'ETF_ACTION' || item.assetClass === 'ETF_OBLIGATAIRE') {
    return scoreFees(item.totalExpenseRatioPct);
  }
  if (item.assetClass === 'ETC_OR') {
    if (item.totalExpenseRatioPct <= 0.2) return 20;
    if (item.totalExpenseRatioPct <= 0.4) return 15;
    if (item.totalExpenseRatioPct <= 0.7) return 10;
    return 6;
  }
  if (item.assetClass === 'ETN_CRYPTO') {
    if (item.totalExpenseRatioPct <= 0.6) return 18;
    if (item.totalExpenseRatioPct <= 1) return 14;
    if (item.totalExpenseRatioPct <= 1.5) return 10;
    return 6;
  }
  if (item.assetClass === 'SCPI' || item.assetClass === 'PRIVATE_EQUITY' || item.assetClass === 'FONDS_DATE') {
    if (item.totalExpenseRatioPct <= 1) return 14;
    if (item.totalExpenseRatioPct <= 1.8) return 11;
    if (item.totalExpenseRatioPct <= 2.5) return 8;
    return 5;
  }
  return 6;
}

function scoreAum(aumBillionEur: number): number {
  if (aumBillionEur >= 20) return 20;
  if (aumBillionEur >= 5) return 16;
  if (aumBillionEur >= 1) return 11;
  return 6;
}

function scoreAge(inceptionYear: number): number {
  const age = Math.max(0, new Date().getFullYear() - inceptionYear);
  if (age >= 12) return 15;
  if (age >= 7) return 12;
  if (age >= 4) return 9;
  return 5;
}

function scoreVolatilityConsistency(item: EtfLibraryItem): number {
  const target = CATEGORY_VOLATILITY_TARGETS[item.category];
  if (!target) return 8;
  if (item.volatilityPct >= target.min && item.volatilityPct <= target.max) return 15;
  const gap = Math.min(Math.abs(item.volatilityPct - target.min), Math.abs(item.volatilityPct - target.max));
  if (gap <= 3) return 11;
  if (gap <= 7) return 8;
  return 5;
}

function scorePeaEligibility(item: EtfLibraryItem): number {
  if (item.assetClass !== 'ETF_ACTION') return 7;
  if (!EQUITY_CATEGORIES.includes(item.category)) return 7;
  return item.eligibleEnvelopes.includes('PEA') ? 10 : 4;
}

function scoreAccumulationPolicy(item: EtfLibraryItem): number {
  if (item.assetClass === 'SCPI' || item.assetClass === 'FONDS_DATE') return 8;
  if (item.assetClass === 'ETN_CRYPTO') return 10;
  if (item.assetClass === 'PRIVATE_EQUITY') return 11;
  if (!EQUITY_CATEGORIES.includes(item.category)) return 11;
  return item.distributionPolicy === 'CAPITALISANT' ? 15 : 9;
}

export function computeEtfQualityScore(item: EtfLibraryItem): EtfQualityScoreResult {
  const breakdown: EtfQualityScoreBreakdown = {
    fees: scoreFeesByAssetClass(item),
    aum: scoreAum(item.aumBillionEur),
    age: scoreAge(item.inceptionYear),
    volatilityConsistency: scoreVolatilityConsistency(item),
    peaEligibility: scorePeaEligibility(item),
    accumulationPolicy: scoreAccumulationPolicy(item),
  };
  const score = Object.values(breakdown).reduce((acc, part) => acc + part, 0);
  return { score: Math.max(0, Math.min(100, score)), breakdown };
}

export function categoryLabel(category: EtfCategory): string {
  const labels: Record<EtfCategory, string> = {
    WORLD: 'World',
    SP500: 'S&P 500',
    NASDAQ: 'Nasdaq',
    EUROPE: 'Europe',
    EMERGENTS: 'Émergents',
    OBLIGATIONS: 'Obligations',
    OR: 'Or',
    CRYPTO: 'Crypto',
    SECTORIEL: 'Sectoriel',
  };
  return labels[category];
}

export function roleLabel(role: EtfPortfolioRole): string {
  const labels: Record<EtfPortfolioRole, string> = {
    PILIER: 'Pilier',
    DIVERSIFICATION: 'Diversification',
    SATELLITE: 'Satellite',
    SPECULATIF: 'Spéculatif',
  };
  return labels[role];
}

export function envelopeLabel(envelope: EtfEnvelope): string {
  const labels: Record<EtfEnvelope, string> = {
    PEA: 'PEA',
    CTO: 'CTO',
    ASSURANCE_VIE: 'Assurance-vie',
    AUTRE: 'Autre',
  };
  return labels[envelope];
}

export function assetClassLabel(assetClass: MarketAssetClass): string {
  const labels: Record<MarketAssetClass, string> = {
    ETF_ACTION: 'ETF action',
    ETF_OBLIGATAIRE: 'ETF obligataire',
    ETC_OR: 'ETC or',
    ETN_CRYPTO: 'ETN crypto',
    SCPI: 'SCPI',
    PRIVATE_EQUITY: 'Private equity',
    FONDS_DATE: 'Fonds daté',
  };
  return labels[assetClass];
}

export function isTrackableMarketAsset(assetClass: MarketAssetClass): boolean {
  return (
    assetClass === 'ETF_ACTION' ||
    assetClass === 'ETF_OBLIGATAIRE' ||
    assetClass === 'ETC_OR' ||
    assetClass === 'ETN_CRYPTO'
  );
}

/**
 * Actifs de la bibliothèque éligibles à un refresh Yahoo en masse (hors SCPI, private equity, fonds datés).
 * Par défaut, exclut la crypto (ETN / catégorie CRYPTO) — API peu fiable pour un refresh catalogue.
 */
export function isFullLibraryMarketRefreshable(
  item: EtfLibraryItem,
  options?: { excludeCrypto?: boolean }
): boolean {
  const excludeCrypto = options?.excludeCrypto ?? true;
  if (
    item.assetClass === 'SCPI' ||
    item.assetClass === 'PRIVATE_EQUITY' ||
    item.assetClass === 'FONDS_DATE'
  ) {
    return false;
  }
  const yahooLike =
    item.assetClass === 'ETF_ACTION' ||
    item.assetClass === 'ETF_OBLIGATAIRE' ||
    item.assetClass === 'ETC_OR' ||
    item.assetClass === 'ETN_CRYPTO';
  if (!yahooLike) return false;
  if (excludeCrypto && (item.assetClass === 'ETN_CRYPTO' || item.category === 'CRYPTO')) {
    return false;
  }
  return true;
}

export function isTrackedEtf(item: EtfLibraryItem, currentSymbol: string): boolean {
  return normalizeMarketStorageSymbol(item.ticker) === normalizeMarketStorageSymbol(currentSymbol);
}
