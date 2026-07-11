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
  it('interestGbp=20, fxImpactGbp=-80, gap=-100 -> 60 (FX loss dominates, interest offsets part of it)', () => {
    expect(computeExplainedPct(20, -80, -100)).toBe(60);
  });

  it('interestGbp=10, fxImpactGbp=-110, gap=-100 -> 100 (fully explained: FX loss + interest offset match the gap exactly)', () => {
    expect(computeExplainedPct(10, -110, -100)).toBe(100);
  });

  it('interestGbp=10.54, fxImpactGbp=-173.03, gap=-257.88 -> ~63 (real case: FX+interest cover most but not all of the gap)', () => {
    expect(computeExplainedPct(10.54, -173.03, -257.88)).toBeCloseTo(63.0, 1);
  });

  it('interestGbp=50, fxImpactGbp=null, gap=-100 -> -50 (interest alone points the WRONG way for a negative gap; never explains it)', () => {
    expect(computeExplainedPct(50, null, -100)).toBe(-50);
  });

  it('interestGbp=50, fxImpactGbp=30, gap=-100 -> -80 (both positive contributors contradict a negative gap; must not read as "explained")', () => {
    expect(computeExplainedPct(50, 30, -100)).toBe(-80);
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
