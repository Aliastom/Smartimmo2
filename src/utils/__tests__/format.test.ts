import { formatCurrencyEUR, formatDateFR, formatPercentage } from '../format';

describe('format utilities', () => {
  describe('formatCurrencyEUR', () => {
    it('should format positive numbers correctly', () => {
      expect(formatCurrencyEUR(1234.56)).toBe('1 234,56 €');
      expect(formatCurrencyEUR(0)).toBe('0,00 €');
      expect(formatCurrencyEUR(1000000)).toBe('1 000 000,00 €');
    });

    it('should handle string inputs', () => {
      expect(formatCurrencyEUR('1234.56')).toBe('1 234,56 €');
      expect(formatCurrencyEUR('0')).toBe('0,00 €');
    });

    it('should handle invalid inputs', () => {
      expect(formatCurrencyEUR('invalid')).toBe('N/A');
      expect(formatCurrencyEUR(NaN)).toBe('N/A');
    });
  });

  describe('formatDateFR', () => {
    it('should format dates correctly', () => {
      const date = new Date('2024-01-15');
      expect(formatDateFR(date)).toBe('15/01/2024');
    });

    it('should handle string dates', () => {
      expect(formatDateFR('2024-01-15')).toBe('15/01/2024');
    });

    it('should handle invalid dates', () => {
      expect(formatDateFR('invalid')).toBe('Date invalide');
      expect(formatDateFR(new Date('invalid'))).toBe('Date invalide');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages correctly', () => {
      expect(formatPercentage(4.2)).toBe('4,20 %');
      expect(formatPercentage(0)).toBe('0,00 %');
      expect(formatPercentage(100)).toBe('100,00 %');
    });

    it('should handle invalid inputs', () => {
      expect(formatPercentage(NaN)).toBe('N/A');
    });
  });
});
