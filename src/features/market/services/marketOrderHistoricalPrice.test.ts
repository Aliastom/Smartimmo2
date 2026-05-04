import { describe, expect, it } from 'vitest';
import { findNearestHistoryPoint, isYmdCalendarToday, orderYmdToComparableIso } from '@/features/market/services/marketOrderHistoricalPrice';

describe('marketOrderHistoricalPrice', () => {
  it('isYmdCalendarToday : jour courant', () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(isYmdCalendarToday(ymd)).toBe(true);
    expect(isYmdCalendarToday('1990-01-01')).toBe(false);
  });

  it('findNearestHistoryPoint : choisit le point le plus proche de la cible', () => {
    const target = orderYmdToComparableIso('2024-06-10');
    const p = findNearestHistoryPoint(
      [
        { date: '2024-06-01', close: 50 },
        { date: '2024-06-15', close: 55 },
      ],
      target
    );
    expect(p?.close).toBe(55);
    expect(p?.date).toBe('2024-06-15');
  });
});
