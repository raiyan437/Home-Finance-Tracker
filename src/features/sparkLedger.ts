import type { Expense, House, Settlement } from '../types';

const MAX_MEMBERS = 10;

type SparkErrorCode = 'failed-precondition' | 'permission-denied' | 'already-exists' | 'aborted' | 'not-found';

const fail = (code: SparkErrorCode, message: string): never => {
  const error = new Error(message) as Error & { code: SparkErrorCode };
  error.code = code;
  throw error;
};

const isUid = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;

const sameMember = (left: Record<string, unknown>, right: Record<string, unknown>): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => left[key] === right[key]);
};

export const getSparkHouseMemberIds = (house: House): string[] => {
  const ids = Array.isArray(house.memberUids) ? house.memberUids : house.members.map((member) => member.uid);
  const members = Array.isArray(house.members) ? house.members : [];
  const memberMap = house.memberMap || null;
  const leaders = ids.filter((uid) => memberMap?.[uid]?.role === 'leader');
  if (ids.length < 1 || ids.length > MAX_MEMBERS || new Set(ids).size !== ids.length || !ids.every(isUid)
    || members.length !== ids.length || !memberMap
    || Object.keys(memberMap).length !== ids.length
    || Object.keys(memberMap).some((uid) => !ids.includes(uid))
    || ids.some((uid, index) => members[index]?.uid !== uid || !sameMember(members[index] as unknown as Record<string, unknown>, memberMap[uid] as unknown as Record<string, unknown>))
    || leaders.length !== 1 || !isUid(house.leaderUid) || house.leaderUid !== leaders[0]) {
    fail('failed-precondition', 'The household roster is not valid.');
  }
  return ids;
};

const calculateRecommendations = (house: House, expenses: Expense[], settlements: Settlement[]) => {
  const memberIds = getSparkHouseMemberIds(house);
  const balances = new Map(memberIds.map((uid) => [uid, 0]));

  for (const expense of expenses) {
    if (expense.scope === 'personal' || expense.houseId !== house.id) continue;
    if (!isUid(expense.paidBy) || !Number.isSafeInteger(expense.amountCents) || expense.amountCents <= 0
      || !Array.isArray(expense.shares) || expense.shares.length === 0) {
      fail('failed-precondition', 'The household ledger contains an invalid expense.');
    }
    if (!balances.has(expense.paidBy)) fail('failed-precondition', 'The household ledger references a departed payer.');
    balances.set(expense.paidBy, (balances.get(expense.paidBy) || 0) + expense.amountCents);
    let totalShares = 0;
    for (const share of expense.shares) {
      if (!share || !isUid(share.userId) || !Number.isSafeInteger(share.amountCents) || share.amountCents < 0 || !balances.has(share.userId)) {
        fail('failed-precondition', 'The household ledger contains an invalid participant.');
      }
      totalShares += share.amountCents;
      balances.set(share.userId, (balances.get(share.userId) || 0) - share.amountCents);
    }
    if (totalShares !== expense.amountCents) fail('failed-precondition', 'The household ledger is unbalanced.');
  }

  for (const settlement of settlements) {
    if (settlement.houseId !== house.id || settlement.status !== 'completed') continue;
    if (!isUid(settlement.fromUserId) || !isUid(settlement.toUserId)
      || settlement.fromUserId === settlement.toUserId
      || !Number.isSafeInteger(settlement.amountCents) || settlement.amountCents <= 0
      || !balances.has(settlement.fromUserId) || !balances.has(settlement.toUserId)) {
      fail('failed-precondition', 'The household ledger contains an invalid settlement.');
    }
    balances.set(settlement.fromUserId, (balances.get(settlement.fromUserId) || 0) + settlement.amountCents);
    balances.set(settlement.toUserId, (balances.get(settlement.toUserId) || 0) - settlement.amountCents);
  }

  const working = memberIds.map((userId) => ({ userId, net: balances.get(userId) || 0 }));
  const recommendations: Array<{ id: string; fromUserId: string; toUserId: string; amountCents: number }> = [];
  let step = 1;
  while (working.length >= 2) {
    working.sort((a, b) => a.net - b.net);
    const debtor = working[0];
    const creditor = working[working.length - 1];
    if (Math.abs(debtor.net) < 1 || Math.abs(creditor.net) < 1) break;
    const amountCents = Math.min(-debtor.net, creditor.net);
    if (!Number.isSafeInteger(amountCents) || amountCents < 1) break;
    recommendations.push({
      id: `sim-${step++}-${debtor.userId}-${creditor.userId}`,
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amountCents,
    });
    debtor.net += amountCents;
    creditor.net -= amountCents;
  }
  return recommendations;
};

export const idempotencyKeyFor = async (
  houseId: string,
  ledgerRevision: number,
  recommendationId: string,
  fromUserId: string,
  toUserId: string,
  amountCents: number,
): Promise<string> => {
  const input = [houseId, ledgerRevision, recommendationId, fromUserId, toUserId, amountCents].join('|');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
};

export const evaluateSparkSettlementConfirmation = ({
  house,
  expenses,
  settlements,
  existing,
  houseId,
  expectedLedgerRevision,
  recommendationId,
  fromUserId,
  toUserId,
  amountCents,
  idempotencyKey,
  settlementId,
}: {
  house: House;
  expenses: Expense[];
  settlements: Settlement[];
  existing?: Settlement;
  houseId: string;
  expectedLedgerRevision: number;
  recommendationId: string;
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  idempotencyKey: string;
  settlementId: string;
}): { kind: 'idempotent'; existing: Settlement } | { kind: 'create'; settlementId: string; idempotencyKey: string } => {
  if (existing) {
    if (existing.idempotencyKey === idempotencyKey && existing.status === 'completed'
      && existing.houseId === houseId && existing.fromUserId === fromUserId
      && existing.toUserId === toUserId && existing.amountCents === amountCents) {
      return { kind: 'idempotent', existing };
    }
    fail('already-exists', 'This settlement confirmation key is already used.');
  }

  const currentRevision = Number.isSafeInteger(house.ledgerRevision) ? house.ledgerRevision : 0;
  if (currentRevision !== expectedLedgerRevision) fail('aborted', 'The household ledger changed. Recalculate the recommendation.');
  const recommendation = calculateRecommendations(house, expenses, settlements)
    .find((item) => item.id === recommendationId);
  if (!recommendation || recommendation.fromUserId !== fromUserId
    || recommendation.toUserId !== toUserId || recommendation.amountCents !== amountCents) {
    fail('failed-precondition', 'This settlement is not a current recommended transaction.');
  }
  return { kind: 'create', settlementId, idempotencyKey };
};
