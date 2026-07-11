import { describe, it, expect } from 'vitest';

import {
  computeInterestGbp,
  computeFxImpactGbp,
  computeExplainedPct,
  isWithinReconcileBand,
} from './ynab-eur-reconciliation';

describe('computeInterestGbp', () => {
  it('matches manual calculation: 1000 EUR, 1.8%, 30 days, rate 0.85', () => {
    // interestEur = 1000 * 0.018 * (30/365) = 1.47945205...
    // interestGbp = interestEur * 0.85 = 1.25753...  -> rounds to 1.26
    const result = computeInterestGbp(1000, 1.8, 30, 0.85);
    expect(result).toBeCloseTo(1.26, 2);
  });
});

describe('computeFxImpactGbp', () => {
  it('returns null when historicalRate is null', () => {
    expect(computeFxImpactGbp(5000, 0.85185, null)).toBeNull();
  });

  it('matches 5000 * (0.85185 - 0.86495) when historicalRate is provided', () => {
    const expected = 5000 * (0.85185 - 0.86495);
    expect(computeFxImpactGbp(5000, 0.85185, 0.86495)).toBeCloseTo(expected, 10);
  });
});

describe('computeExplainedPct', () => {
  it('interestGbp=50, fxImpactGbp=30, gap=-100 -> 80', () => {
    expect(computeExplainedPct(50, 30, -100)).toBe(80);
  });

  it('interestGbp=50, fxImpactGbp=null, gap=-100 -> 50', () => {
    expect(computeExplainedPct(50, null, -100)).toBe(50);
  });
});

describe('isWithinReconcileBand', () => {
  it('84.99 -> false', () => {
    expect(isWithinReconcileBand(84.99)).toBe(false);
  });

  it('85 -> true (boundary)', () => {
    expect(isWithinReconcileBand(85)).toBe(true);
  });

  it('115 -> true (boundary)', () => {
    expect(isWithinReconcileBand(115)).toBe(true);
  });

  it('115.01 -> false', () => {
    expect(isWithinReconcileBand(115.01)).toBe(false);
  });

  it('100 -> true', () => {
    expect(isWithinReconcileBand(100)).toBe(true);
  });
});
