/**
 * Currency and financial math utilities using integer cents/poisha.
 */

export const dollarsToCents = (takaStr: number | string): number => {
  const raw = String(takaStr).trim();
  const match = /^([+-]?)(?:(\d+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/.exec(raw);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const whole = match[2] || '0';
  const fractional = (match[3] ?? match[4] ?? '').padEnd(2, '0');
  const cents = Number(whole) * 100 + Number(fractional || '0');
  return Number.isSafeInteger(cents) ? sign * cents : 0;
};

export const toBengaliDigits = (str: string): string => {
  const bnDigits: Record<string, string> = {
    '0': '০',
    '1': '১',
    '2': '২',
    '3': '৩',
    '4': '৪',
    '5': '৫',
    '6': '৬',
    '7': '৭',
    '8': '৮',
    '9': '৯',
  };
  return str.replace(/[0-9]/g, (digit) => bnDigits[digit] || digit);
};

export const formatCurrency = (
  cents: number,
  includeSign = false,
  language: 'en' | 'bn' = 'en'
): string => {
  const amount = cents / 100;
  const absValue = Math.abs(amount).toLocaleString('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  let formattedStr = `৳${absValue}`;
  if (language === 'bn') {
    formattedStr = `৳${toBengaliDigits(absValue)}`;
  }

  if (includeSign && cents > 0) {
    return `+${formattedStr}`;
  } else if (cents < 0) {
    return `-${formattedStr}`;
  }
  return formattedStr;
};

/**
 * Calculates equal splits for a total amount in cents among N participants.
 * Handles remainder cents deterministically by allocating 1 extra cent to first R participants.
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
 * Automatically normalizes floating percentage inputs (e.g. 33.3% + 33.3% + 33.3% = 99.9%)
 * within a 0.5% tolerance and uses deterministic remainder distribution.
 */
export const calculatePercentageSplits = (
  totalCents: number,
  percentages: Record<string, number>
): { shares: Record<string, number>; is100Percent: boolean } => {
  let totalPercent = Object.values(percentages).reduce((a, b) => a + b, 0);
  const is100Percent = Math.abs(totalPercent - 100) <= 0.5;

  const normalized: Record<string, number> = {};
  const userIds = Object.keys(percentages);

  if (is100Percent && totalPercent !== 100 && totalPercent > 0) {
    userIds.forEach((u) => {
      normalized[u] = (percentages[u] / totalPercent) * 100;
    });
  } else {
    userIds.forEach((u) => {
      normalized[u] = percentages[u];
    });
  }

  const rawShares: Record<string, number> = {};
  let totalAssigned = 0;

  userIds.forEach((u) => {
    const cents = Math.floor((totalCents * (normalized[u] || 0)) / 100);
    rawShares[u] = cents;
    totalAssigned += cents;
  });

  let remainder = totalCents - totalAssigned;
  const shares: Record<string, number> = {};

  userIds.forEach((u) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    shares[u] = rawShares[u] + extra;
  });

  return { shares, is100Percent };
};
