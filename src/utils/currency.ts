/**
 * Currency and financial math utilities using integer cents.
 */

export const dollarsToCents = (dollars: number | string): number => {
  const parsed = typeof dollars === 'string' ? parseFloat(dollars) : dollars;
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
};

export const centsToDollars = (cents: number): number => {
  return cents / 100;
};

export const formatCurrency = (cents: number, includeSign = false): string => {
  const dollars = cents / 100;
  const absValue = Math.abs(dollars).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (includeSign && cents > 0) {
    return `+${absValue}`;
  } else if (cents < 0) {
    return `-${absValue}`;
  }
  return absValue;
};

/**
 * Calculates equal splits for a total amount in cents among N participants.
 * Handles remainder cents deterministically.
 */
export const calculateEqualSplits = (
  totalCents: number,
  participantUserIds: string[]
): Record<string, number> => {
  const count = participantUserIds.length;
  if (count === 0) return {};

  const baseShare = Math.floor(totalCents / count);
  let remainder = totalCents - baseShare * count;

  const result: Record<string, number> = {};
  participantUserIds.forEach((userId) => {
    // Distribute remainder cents 1 by 1
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    result[userId] = baseShare + extra;
  });

  return result;
};

/**
 * Validates that custom split amounts sum up to the total expense amount.
 */
export const validateCustomSplits = (
  totalCents: number,
  customShares: Record<string, number>
): { isValid: boolean; differenceCents: number } => {
  const sum = Object.values(customShares).reduce((acc, val) => acc + val, 0);
  const diff = totalCents - sum;
  return {
    isValid: diff === 0,
    differenceCents: diff,
  };
};

/**
 * Calculates percentage splits into integer cents.
 */
export const calculatePercentageSplits = (
  totalCents: number,
  percentages: Record<string, number>
): { shares: Record<string, number>; is100Percent: boolean } => {
  const totalPercent = Object.values(percentages).reduce((a, b) => a + b, 0);
  const is100Percent = Math.abs(totalPercent - 100) < 0.01;

  let assignedCents = 0;
  const shares: Record<string, number> = {};
  const entries = Object.entries(percentages);

  entries.forEach(([userId, percent], index) => {
    if (index === entries.length - 1) {
      // Last participant receives exact remainder to match totalCents
      shares[userId] = Math.max(0, totalCents - assignedCents);
    } else {
      const shareCents = Math.round((totalCents * percent) / 100);
      shares[userId] = shareCents;
      assignedCents += shareCents;
    }
  });

  return { shares, is100Percent };
};
