const crypto = require('node:crypto');

const MAX_MEMBERS = 10;

const isUid = (value) => typeof value === 'string' && value.length > 0 && value.length <= 128;

const idempotencyKeyFor = (houseId, ledgerRevision, recommendationId, fromUserId, toUserId, amountCents) => crypto
  .createHash('sha256')
  .update([houseId, ledgerRevision, recommendationId, fromUserId, toUserId, amountCents].join('|'))
  .digest('hex');

const invalidLedger = (message) => {
  const error = new Error(message);
  error.code = 'failed-precondition';
  throw error;
};

const sameMember = (left, right) => left && right
  && Object.keys(left).length === Object.keys(right).length
  && Object.keys(left).every((key) => left[key] === right[key]);

const getHouseMemberIds = (house) => {
  const ids = Array.isArray(house.memberUids)
    ? house.memberUids
    : Array.isArray(house.members) ? house.members.map((member) => member.uid) : [];
  const members = Array.isArray(house.members) ? house.members : [];
  const memberMap = house.memberMap && typeof house.memberMap === 'object' ? house.memberMap : null;
  const roles = ids.filter((uid) => memberMap?.[uid]?.role === 'leader');
  if (ids.length < 1 || ids.length > MAX_MEMBERS || new Set(ids).size !== ids.length || !ids.every(isUid)
    || members.length !== ids.length || !memberMap
    || Object.keys(memberMap).length !== ids.length
    || Object.keys(memberMap).some((uid) => !ids.includes(uid))
    || ids.some((uid, index) => members[index]?.uid !== uid || !sameMember(members[index], memberMap[uid]))
    || roles.length !== 1 || !isUid(house.leaderUid) || house.leaderUid !== roles[0]) {
    invalidLedger('The household roster is not valid.');
  }
  return ids;
};

const calculateRecommendations = (house, expenses, settlements) => {
  const memberIds = getHouseMemberIds(house);
  const balances = new Map(memberIds.map((uid) => [uid, 0]));

  for (const expense of expenses) {
    if (expense.scope === 'personal' || expense.houseId !== house.id) continue;
    if (!isUid(expense.paidBy) || !Number.isSafeInteger(expense.amountCents) || expense.amountCents <= 0
      || !Array.isArray(expense.shares) || expense.shares.length === 0) {
      invalidLedger('The household ledger contains an invalid expense.');
    }
    if (!balances.has(expense.paidBy)) invalidLedger('The household ledger references a departed payer.');
    balances.set(expense.paidBy, balances.get(expense.paidBy) + expense.amountCents);
    let totalShares = 0;
    for (const share of expense.shares) {
      if (!share || !isUid(share.userId) || !Number.isSafeInteger(share.amountCents) || share.amountCents < 0 || !balances.has(share.userId)) {
        invalidLedger('The household ledger contains an invalid participant.');
      }
      totalShares += share.amountCents;
      balances.set(share.userId, balances.get(share.userId) - share.amountCents);
    }
    if (totalShares !== expense.amountCents) invalidLedger('The household ledger is unbalanced.');
  }

  for (const settlement of settlements) {
    if (settlement.houseId !== house.id || settlement.status !== 'completed') continue;
    if (!isUid(settlement.fromUserId) || !isUid(settlement.toUserId)
      || settlement.fromUserId === settlement.toUserId
      || !Number.isSafeInteger(settlement.amountCents) || settlement.amountCents <= 0
      || !balances.has(settlement.fromUserId) || !balances.has(settlement.toUserId)) {
      invalidLedger('The household ledger contains an invalid settlement.');
    }
    balances.set(settlement.fromUserId, balances.get(settlement.fromUserId) + settlement.amountCents);
    balances.set(settlement.toUserId, balances.get(settlement.toUserId) - settlement.amountCents);
  }

  const working = memberIds.map((userId) => ({ userId, net: balances.get(userId) || 0 }));
  const recommendations = [];
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

const evaluateSettlementConfirmation = ({
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
}) => {
  const idempotencyKey = idempotencyKeyFor(houseId, expectedLedgerRevision, recommendationId, fromUserId, toUserId, amountCents);
  const settlementId = `set-${idempotencyKey}`;
  if (existing) {
    if (existing.idempotencyKey === idempotencyKey && existing.status === 'completed'
      && existing.houseId === houseId && existing.fromUserId === fromUserId
      && existing.toUserId === toUserId && existing.amountCents === amountCents) {
      return { kind: 'idempotent', existing, idempotencyKey, settlementId };
    }
    return { kind: 'duplicate', idempotencyKey, settlementId };
  }

  const currentRevision = Number.isSafeInteger(house.ledgerRevision) ? house.ledgerRevision : 0;
  if (currentRevision !== expectedLedgerRevision) return { kind: 'stale', idempotencyKey, settlementId };

  const recommendation = calculateRecommendations(
    { ...house, id: houseId },
    expenses,
    settlements,
  ).find((item) => item.id === recommendationId);
  if (!recommendation || recommendation.fromUserId !== fromUserId
    || recommendation.toUserId !== toUserId || recommendation.amountCents !== amountCents) {
    return { kind: 'forged', idempotencyKey, settlementId };
  }
  return { kind: 'create', recommendation, idempotencyKey, settlementId };
};

module.exports = {
  calculateRecommendations,
  evaluateSettlementConfirmation,
  getHouseMemberIds,
  idempotencyKeyFor,
};
