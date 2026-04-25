import { describe, expect, it } from 'vitest';
import { resolveMarketSymbol } from '@/features/market/marketSymbolAliases';

describe('marketSymbolAliases', () => {
  it('résout Amundi MSCI World PEA vers CW8.PA', () => {
    expect(resolveMarketSymbol('Amundi MSCI World PEA')).toBe('CW8.PA');
  });

  it('conserve un symbole personnalisé tel quel', () => {
    expect(resolveMarketSymbol('MY_CUSTOM.ETF')).toBe('MY_CUSTOM.ETF');
  });
});

