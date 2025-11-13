import { describe, it, expect } from 'vitest'
import { computeMonthlyKpis } from '../src/domain/use-cases/computeMonthlyKpis'

describe('computeMonthlyKpis', () => {
  it('calcule correctement les KPI', () => {
    const result = computeMonthlyKpis({
      transactions: [
        { type: 'rent', amount: 2000 },
        { type: 'expense', amount: 300 },
      ],
      loanMonthly: 800,
      taxesMonthly: 100,
    })
    expect(result.rents).toBe(2000)
    expect(result.expenses).toBe(1200)
    expect(result.cashflow).toBe(800)
    expect(result.yieldPct).toBeCloseTo(40)
  })
})
