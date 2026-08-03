import type { PersonalWalletSettings } from '../types';

export const calculateCashInHandCents = (
  settings: PersonalWalletSettings | undefined,
  totalPersonalExpenseCents: number
): number | null => {
  if (settings?.cashBalanceCents === undefined) return null;
  const trackedExpenseCents = settings.cashTrackedExpenseCents ?? totalPersonalExpenseCents;
  return settings.cashBalanceCents - (totalPersonalExpenseCents - trackedExpenseCents);
};

export const createCashCheckpoint = (
  cashBalanceCents: number,
  totalPersonalExpenseCents: number
): Pick<PersonalWalletSettings, 'cashBalanceCents' | 'cashTrackedExpenseCents'> => ({
  cashBalanceCents,
  cashTrackedExpenseCents: totalPersonalExpenseCents,
});
