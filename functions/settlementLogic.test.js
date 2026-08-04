const assert = require('node:assert/strict');
const test = require('node:test');
const {
  evaluateSettlementConfirmation,
  idempotencyKeyFor,
} = require('./settlementLogic');

const house = {
  id: 'house-1',
  leaderUid: 'leader',
  memberUids: ['leader', 'member'],
  members: [
    { uid: 'leader', role: 'leader' },
    { uid: 'member', role: 'member' },
  ],
  memberMap: {
    leader: { uid: 'leader', role: 'leader' },
    member: { uid: 'member', role: 'member' },
  },
  ledgerRevision: 4,
};

const expenses = [{
  id: 'expense-1',
  scope: 'household',
  houseId: 'house-1',
  paidBy: 'member',
  amountCents: 1000,
  shares: [{ userId: 'leader', amountCents: 1000 }],
}];

const request = {
  house,
  expenses,
  settlements: [],
  existing: null,
  houseId: 'house-1',
  expectedLedgerRevision: 4,
  recommendationId: 'sim-1-leader-member',
  fromUserId: 'leader',
  toUserId: 'member',
  amountCents: 1000,
};

test('accepts the exact current recommendation', () => {
  const result = evaluateSettlementConfirmation(request);
  assert.equal(result.kind, 'create');
  assert.equal(result.recommendation.id, request.recommendationId);
});

test('returns idempotent for the same completed confirmation', () => {
  const first = evaluateSettlementConfirmation(request);
  const result = evaluateSettlementConfirmation({
    ...request,
    existing: {
      id: first.settlementId,
      idempotencyKey: idempotencyKeyFor('house-1', 4, request.recommendationId, 'leader', 'member', 1000),
      status: 'completed',
      houseId: 'house-1',
      fromUserId: 'leader',
      toUserId: 'member',
      amountCents: 1000,
    },
  });
  assert.equal(result.kind, 'idempotent');
});

test('rejects stale, forged, and colliding confirmations', () => {
  assert.equal(evaluateSettlementConfirmation({ ...request, expectedLedgerRevision: 3 }).kind, 'stale');
  assert.equal(evaluateSettlementConfirmation({ ...request, amountCents: 999 }).kind, 'forged');
  assert.equal(evaluateSettlementConfirmation({
    ...request,
    existing: { idempotencyKey: 'different', status: 'completed' },
  }).kind, 'duplicate');
});

test('does not treat a reversed settlement as a current payment', () => {
  const result = evaluateSettlementConfirmation({
    ...request,
    settlements: [{
      houseId: 'house-1', fromUserId: 'leader', toUserId: 'member', amountCents: 1000, status: 'reversed',
    }],
  });
  assert.equal(result.kind, 'create');
});
