import type { Expense, House, Settlement } from '../types';

const isPositiveInteger = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0;

export const assertValidExpense = (expense: Expense, house?: House | null): void => {
  if (!expense.id || !expense.title.trim() || !isPositiveInteger(expense.amountCents)) {
    throw new Error('Expense must have an ID, title, and positive whole-cent amount.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expense.date)) throw new Error('Expense date must use YYYY-MM-DD.');
  if (!expense.shares.length || expense.shares.some((share) => !share.userId || !Number.isInteger(share.amountCents) || share.amountCents < 0)) {
    throw new Error('Every expense must contain valid non-negative shares.');
  }
  const uniqueShareOwners = new Set(expense.shares.map((share) => share.userId));
  if (uniqueShareOwners.size !== expense.shares.length) throw new Error('An expense cannot contain duplicate shares.');
  const shareTotal = expense.shares.reduce((sum, share) => sum + share.amountCents, 0);
  if (shareTotal !== expense.amountCents) throw new Error('Expense shares must exactly equal the expense amount.');

  if (expense.scope === 'personal') {
    if (!expense.ownerId || expense.ownerId !== expense.paidBy) throw new Error('A personal expense must be paid by its owner.');
    if (expense.houseId) throw new Error('A personal expense cannot belong to a house.');
    if (expense.shares.length !== 1 || expense.shares[0].userId !== expense.ownerId) {
      throw new Error('A personal expense must be assigned only to its owner.');
    }
    return;
  }

  if (!house || expense.houseId !== house.id) throw new Error('A household expense must belong to the active house.');
  const members = new Set(house.members.map((member) => member.uid));
  if (!members.has(expense.paidBy) || expense.shares.some((share) => !members.has(share.userId))) {
    throw new Error('Payer and share owners must be current house members.');
  }
};

export const assertValidSettlement = (settlement: Settlement, house: House): void => {
  if (!settlement.id || !isPositiveInteger(settlement.amountCents)) throw new Error('Settlement amount must be positive.');
  if (settlement.fromUserId === settlement.toUserId) throw new Error('A member cannot settle with themselves.');
  if (settlement.houseId !== house.id) throw new Error('Settlement must belong to the active house.');
  const members = new Set(house.members.map((member) => member.uid));
  if (!members.has(settlement.fromUserId) || !members.has(settlement.toUserId)) {
    throw new Error('Both settlement parties must be current house members.');
  }
  if (settlement.status === 'completed' && (settlement.reversedAt || settlement.reversedBy)) {
    throw new Error('An active settlement cannot contain reversal metadata.');
  }
  if (settlement.status === 'reversed' && (!settlement.reversedAt || !settlement.reversedBy)) {
    throw new Error('A reversed settlement requires a reversal timestamp and actor.');
  }
};

export const hasConsistentRoster = (house: House): boolean => {
  const memberUids = house.members.map((member) => member.uid);
  return new Set(memberUids).size === memberUids.length
    && new Set(house.memberUids ?? []).size === memberUids.length
    && memberUids.every((uid) => house.memberUids?.includes(uid))
    && house.members.filter((member) => member.role === 'leader').length === 1
    && house.leaderUid === house.members.find((member) => member.role === 'leader')?.uid;
};
