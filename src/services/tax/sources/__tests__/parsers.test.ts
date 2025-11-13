/**
 * Tests pour les parsers HTML et PDF
 */

import { describe, it, expect } from '@jest/globals';
import {
  parseHTML,
  cleanText,
  parseEuroAmount,
  parsePercentage,
  extractInteger,
  parseIRBracketRow
} from '../parsers/html';

describe('HTML Parser Utils', () => {
  describe('cleanText', () => {
    it('should clean and trim text', () => {
      expect(cleanText('  Hello   World  ')).toBe('Hello World');
      expect(cleanText('Text\u00A0with\u00A0nbsp')).toBe('Text with nbsp');
      expect(cleanText('Multiple\n\nlines')).toBe('Multiple lines');
    });
  });
  
  describe('parseEuroAmount', () => {
    it('should parse various euro formats', () => {
      expect(parseEuroAmount('10 000 €')).toBe(10000);
      expect(parseEuroAmount('10.000,00 €')).toBe(10000);
      expect(parseEuroAmount("10'000 €")).toBe(10000);
      expect(parseEuroAmount('1 234,56 €')).toBe(1234.56);
      expect(parseEuroAmount('invalid')).toBeNull();
    });
    
    it('should handle amounts without symbols', () => {
      expect(parseEuroAmount('15000')).toBe(15000);
      expect(parseEuroAmount('42 500')).toBe(42500);
    });
  });
  
  describe('parsePercentage', () => {
    it('should parse percentages and return fraction', () => {
      expect(parsePercentage('17,2 %')).toBe(0.172);
      expect(parsePercentage('30%')).toBe(0.30);
      expect(parsePercentage('11 %')).toBe(0.11);
      expect(parsePercentage('invalid')).toBeNull();
    });
  });
  
  describe('extractInteger', () => {
    it('should extract first integer from text', () => {
      expect(extractInteger('Il y a 10 ans')).toBe(10);
      expect(extractInteger('123 456')).toBe(123);
      expect(extractInteger('no number')).toBeNull();
    });
  });
  
  describe('parseIRBracketRow', () => {
    it('should parse IR bracket from table row', () => {
      const row = ['De 11 294 € à 28 797 €', '11 %'];
      const result = parseIRBracketRow(row);
      
      expect(result).toEqual({
        lower: 11294,
        upper: 28797,
        rate: 0.11
      });
    });
    
    it('should handle open-ended bracket', () => {
      const row = ['Au-delà de 177 106 €', '45 %'];
      const result = parseIRBracketRow(row);
      
      expect(result).toEqual({
        lower: 177106,
        upper: null,
        rate: 0.45
      });
    });
    
    it('should return null for invalid row', () => {
      expect(parseIRBracketRow(['invalid', 'data'])).toBeNull();
      expect(parseIRBracketRow([])).toBeNull();
    });
  });
});

