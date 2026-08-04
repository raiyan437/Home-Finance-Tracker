const assert = require('node:assert/strict');
const test = require('node:test');
const { appendComment, canDeleteComment, validateComment } = require('./commentLogic');

const comment = { id: 'comment-1', userId: 'member', text: 'Paid in cash.', createdAt: '2026-08-04T12:00:00.000Z' };

test('allows only a signed-in author to submit a bounded comment', () => {
  assert.deepEqual(validateComment(comment, 'member'), comment);
  assert.throws(() => validateComment({ ...comment, userId: 'leader' }, 'member'), { code: 'permission-denied' });
  assert.throws(() => validateComment({ ...comment, extra: 'unexpected' }, 'member'), { code: 'invalid-argument' });
});

test('allows comment deletion only to its author or current leader', () => {
  assert.equal(canDeleteComment(comment, 'member', 'leader'), true);
  assert.equal(canDeleteComment(comment, 'leader', 'leader'), true);
  assert.equal(canDeleteComment(comment, 'other', 'leader'), false);
});

test('preserves comment order and enforces the list limit', () => {
  const existing = Array.from({ length: 20 }, (_, index) => ({ ...comment, id: `comment-${index}` }));
  assert.deepEqual(appendComment([], comment), [comment]);
  assert.throws(() => appendComment(existing, comment), { code: 'resource-exhausted' });
});
