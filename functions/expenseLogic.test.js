const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateExpenseMutation } = require('./expenseLogic');

const memberUids = new Set(['leader', ...Array.from({ length: 9 }, (_, index) => `member-${index + 1}`)]);
const now = '2026-08-04T12:00:00.000Z';
const expense = {
  id: 'expense-max',
  title: 'Groceries',
  amountCents: 1000,
  paidBy: 'leader',
  category: 'Groceries',
  date: '2026-08-04',
  splitMethod: 'equal',
  shares: [...memberUids].map((userId) => ({ userId, amountCents: 100 })),
  sharesTotalCents: 1000,
  participantUids: [...memberUids],
  scope: 'household',
  houseId: 'house-1',
  createdAt: now,
  updatedAt: now,
};

test('accepts a valid ten-member household expense', () => {
  assert.deepEqual(
    evaluateExpenseMutation({ operation: 'set', authUid: 'leader', leaderUid: 'leader', existing: null, incoming: expense, houseId: 'house-1', memberUids }),
    { kind: 'write', data: expense },
  );
});

test('rejects forged payer, mismatched participants, and invalid dates', () => {
  assert.throws(() => evaluateExpenseMutation({ operation: 'set', authUid: 'member-1', leaderUid: 'leader', existing: null, incoming: { ...expense, paidBy: 'outsider' }, houseId: 'house-1', memberUids }), /payer/);
  assert.throws(() => evaluateExpenseMutation({ operation: 'set', authUid: 'leader', leaderUid: 'leader', existing: null, incoming: { ...expense, participantUids: ['leader', ...[...memberUids].slice(2)] }, houseId: 'house-1', memberUids }), /participants/);
  assert.throws(() => evaluateExpenseMutation({ operation: 'set', authUid: 'leader', leaderUid: 'leader', existing: null, incoming: { ...expense, date: '2026-02-29' }, houseId: 'house-1', memberUids }), /date/);
});

test('allows only payer or leader to delete or update an existing expense', () => {
  assert.throws(() => evaluateExpenseMutation({ operation: 'delete', authUid: 'member-1', leaderUid: 'leader', existing: expense, incoming: null, houseId: 'house-1', memberUids }), /delete/);
  assert.deepEqual(evaluateExpenseMutation({ operation: 'delete', authUid: 'leader', leaderUid: 'leader', existing: expense, incoming: null, houseId: 'house-1', memberUids }), { kind: 'delete' });
  assert.throws(() => evaluateExpenseMutation({ operation: 'set', authUid: 'member-1', leaderUid: 'leader', existing: expense, incoming: { ...expense, title: 'Changed' }, houseId: 'house-1', memberUids }), /update/);
});
