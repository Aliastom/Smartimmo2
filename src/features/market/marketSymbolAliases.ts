export interface EtfReferenceAlias {
  key: string;
  label: string;
  providerSymbols: string[];
  defaultProviderSymbol: string;
}

export const ETF_REFERENCE_ALIASES: EtfReferenceAlias[] = [
  {
    key: 'AMUNDI_MSCI_WORLD_UCITS_ETF',
    label: 'Amundi MSCI World UCITS ETF',
    providerSymbols: ['CW8.PA'],
    defaultProviderSymbol: 'CW8.PA',
  },
  {
    key: 'LYXOR_AMUNDI_MSCI_WORLD_ETF',
    label: 'Lyxor / Amundi MSCI World ETF',
    providerSymbols: ['EWLD.PA'],
    defaultProviderSymbol: 'EWLD.PA',
  },
  {
    key: 'ISHARES_MSCI_WORLD_PEA',
    label: 'iShares MSCI World PEA',
    providerSymbols: ['WPEA.PA'],
    defaultProviderSymbol: 'WPEA.PA',
  },
];

export const CUSTOM_MARKET_SYMBOL_KEY = 'CUSTOM';

export function resolveMarketSymbol(input: string): string {
  const normalized = (input || '').trim();
  if (!normalized) return normalized;

  const byKey = ETF_REFERENCE_ALIASES.find((alias) => alias.key === normalized);
  if (byKey) return byKey.defaultProviderSymbol;

  const byLabel = ETF_REFERENCE_ALIASES.find((alias) => alias.label.toLowerCase() === normalized.toLowerCase());
  if (byLabel) return byLabel.defaultProviderSymbol;

  const byProviderSymbol = ETF_REFERENCE_ALIASES.find((alias) =>
    alias.providerSymbols.some((symbol) => symbol.toLowerCase() === normalized.toLowerCase())
  );
  if (byProviderSymbol) {
    const exact = byProviderSymbol.providerSymbols.find((symbol) => symbol.toLowerCase() === normalized.toLowerCase());
    return exact ?? byProviderSymbol.defaultProviderSymbol;
  }

  return normalized;
}

export function findEtfAliasFromSettings(referenceLabel: string, referenceSymbol: string): EtfReferenceAlias | null {
  const byLabel = ETF_REFERENCE_ALIASES.find((alias) => alias.label.toLowerCase() === (referenceLabel || '').trim().toLowerCase());
  if (byLabel) return byLabel;

  const bySymbol = ETF_REFERENCE_ALIASES.find((alias) =>
    alias.providerSymbols.some((symbol) => symbol.toLowerCase() === (referenceSymbol || '').trim().toLowerCase())
  );
  return bySymbol ?? null;
}
