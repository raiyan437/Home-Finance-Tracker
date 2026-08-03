import { describe, expect, it } from 'vitest';
import { calculateCashInHandCents, createCashCheckpoint } from './personalWalletLedger';

describe('personal wallet cash ledger', () => {
  it('starts at the cash amount saved by the user', () => {
    const settings = createCashCheckpoint(50_000, 12_000);
    expect(calculateCashInHandCents(settings, 12_000)).toBe(50_000);
  });

  it('deducts expenses added after the cash checkpoint', () => {
    const settings = createCashCheckpoint(50_000, 12_000);
    expect(calculateCashInHandCents(settings, 17_500)).toBe(44_500);
  });

  it('reconciles edited and deleted expenses without double-deducting', () => {
    const settings = createCashCheckpoint(50_000, 12_000);
    expect(calculateCashInHandCents(settings, 10_000)).toBe(52_000);
  });

  it('distinguishes an unset cash balance from a zero balance', () => {
    expect(calculateCashInHandCents(undefined, 10_000)).toBeNull();
    expect(calculateCashInHandCents({ cashBalanceCents: 0, cashTrackedExpenseCents: 0 }, 10_000)).toBe(-10_000);
  });
});
