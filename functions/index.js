const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const {
  evaluateSettlementConfirmation,
  getHouseMemberIds: validateHouseMemberIds,
  idempotencyKeyFor,
} = require('./settlementLogic');
const { appendComment, canDeleteComment, validateComment: validateCommentPayload } = require('./commentLogic');
const { evaluateExpenseMutation } = require('./expenseLogic');

initializeApp();
const db = getFirestore();

const MAX_PROOF_URL = 40000;

const isUid = (value) => typeof value === 'string' && value.length > 0 && value.length <= 128;
const isProofUrl = (value) => typeof value === 'string'
  && value.length > 0
  && value.length <= MAX_PROOF_URL
  && (value.startsWith('https://') || /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value));
const badRequest = (message) => { throw new HttpsError('invalid-argument', message); };
const getHouseMemberIds = (house) => {
  try {
    return validateHouseMemberIds(house);
  } catch (error) {
    throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'The household roster is not valid.');
  }
};

const validateComment = (comment, uid) => {
  try {
    return validateCommentPayload(comment, uid);
  } catch (error) {
    if (error?.code === 'permission-denied') throw new HttpsError('permission-denied', error.message);
    badRequest(error instanceof Error ? error.message : 'Invalid comment.');
  }
};

const requireHouseholdMember = async (houseId, uid, transaction) => {
  if (typeof houseId !== 'string' || houseId.length < 1 || houseId.length > 128) badRequest('Invalid household ID.');
  const houseRef = db.doc(`houses/${houseId}`);
  const houseSnapshot = transaction ? await transaction.get(houseRef) : await houseRef.get();
  if (!houseSnapshot.exists) throw new HttpsError('not-found', 'Household not found.');
  const house = houseSnapshot.data();
  const memberIds = getHouseMemberIds(house);
  if (!memberIds.includes(uid)) throw new HttpsError('permission-denied', 'You are not a household member.');
  return { houseRef, house, memberIds };
};

/**
 * Household expenses and authorized reversals share a duplicated roster and
 * ledger revision write. Keeping that transaction server-authoritative avoids
 * Firestore Rules' expression ceiling for valid ten-member households while
 * retaining the same authorization and schema checks.
 */
exports.mutateHouseholdLedger = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in is required.');
  const { collection, operation, id, houseId, data } = request.data || {};
  if (!['expenses', 'settlements'].includes(collection)
    || !['set', 'delete'].includes(operation)
    || typeof id !== 'string' || id.length < 1 || id.length > 128
    || typeof houseId !== 'string' || houseId.length < 1 || houseId.length > 128
    || (operation === 'set' && (!data || typeof data !== 'object' || Array.isArray(data)))) badRequest('Invalid household ledger mutation.');

  const result = await db.runTransaction(async (transaction) => {
    const houseRef = db.doc(`houses/${houseId}`);
    const targetRef = db.doc(`${collection}/${id}`);
    const [houseSnapshot, targetSnapshot] = await Promise.all([transaction.get(houseRef), transaction.get(targetRef)]);
    if (!houseSnapshot.exists) throw new HttpsError('not-found', 'Household not found.');
    const house = houseSnapshot.data();
    const memberIds = getHouseMemberIds(house);
    if (!memberIds.includes(request.auth.uid)) throw new HttpsError('permission-denied', 'You are not a household member.');
    const currentRevision = Number.isSafeInteger(house.ledgerRevision) ? house.ledgerRevision : 0;

    if (collection === 'expenses') {
      const existing = targetSnapshot.exists ? targetSnapshot.data() : null;
      let decision;
      try {
        decision = evaluateExpenseMutation({
          operation,
          authUid: request.auth.uid,
          leaderUid: house.leaderUid,
          existing,
          incoming: data,
          houseId,
          memberUids: new Set(memberIds),
        });
      } catch (error) {
        if (error?.code === 'permission-denied') throw new HttpsError('permission-denied', error.message);
        throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'The expense is invalid.');
      }
      if (decision.kind === 'delete') transaction.delete(targetRef);
      else transaction.set(targetRef, decision.data);
    } else {
      if (!targetSnapshot.exists) throw new HttpsError('not-found', 'Settlement not found.');
      const existing = targetSnapshot.data();
      if (existing.houseId !== houseId) throw new HttpsError('failed-precondition', 'Settlement does not belong to this household.');
      if (operation === 'delete') {
        throw new HttpsError('failed-precondition', 'Completed settlement audit records cannot be deleted. Reverse the payment instead.');
      } else {
        if (existing.status !== 'completed') throw new HttpsError('failed-precondition', 'Only a completed household settlement can be reversed.');
        if (existing.toUserId !== request.auth.uid && house.leaderUid !== request.auth.uid) throw new HttpsError('permission-denied', 'Only the settlement recipient or household leader can reverse it.');
        const now = new Date().toISOString();
        transaction.update(targetRef, { status: 'reversed', reversedAt: now, reversedBy: request.auth.uid });
      }
    }

    transaction.update(houseRef, { ledgerRevision: currentRevision + 1 });
    return { synced: true };
  });
  return result;
});

exports.addExpenseComment = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in is required.');
  const expenseId = request.data?.expenseId;
  if (typeof expenseId !== 'string' || expenseId.length < 1 || expenseId.length > 128) badRequest('Invalid expense ID.');
  const comment = request.data?.comment;
  validateComment(comment, request.auth.uid);
  const expenseRef = db.doc(`expenses/${expenseId}`);

  await db.runTransaction(async (transaction) => {
    const expenseSnapshot = await transaction.get(expenseRef);
    if (!expenseSnapshot.exists) throw new HttpsError('not-found', 'Expense not found.');
    const expense = expenseSnapshot.data();
    if (expense.scope === 'personal' || typeof expense.houseId !== 'string') {
      throw new HttpsError('permission-denied', 'Comments are only available for household expenses.');
    }
    const { houseRef, house } = await requireHouseholdMember(expense.houseId, request.auth.uid, transaction);
    const comments = Array.isArray(expense.comments) ? expense.comments : [];
    let updatedComments;
    try {
      updatedComments = appendComment(comments, comment);
    } catch (error) {
      if (error?.code === 'resource-exhausted') throw new HttpsError('resource-exhausted', error.message);
      if (error?.code === 'already-exists') throw new HttpsError('already-exists', error.message);
      throw error;
    }
    transaction.update(expenseRef, { comments: updatedComments, updatedAt: new Date().toISOString() });
    transaction.update(houseRef, { ledgerRevision: Number(house.ledgerRevision || 0) + 1 });
  });
  return { synced: true };
});

exports.deleteExpenseComment = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in is required.');
  const expenseId = request.data?.expenseId;
  const commentId = request.data?.commentId;
  if (typeof expenseId !== 'string' || expenseId.length < 1 || expenseId.length > 128
    || typeof commentId !== 'string' || commentId.length < 1 || commentId.length > 128) badRequest('Invalid comment identity.');
  const expenseRef = db.doc(`expenses/${expenseId}`);

  await db.runTransaction(async (transaction) => {
    const expenseSnapshot = await transaction.get(expenseRef);
    if (!expenseSnapshot.exists) throw new HttpsError('not-found', 'Expense not found.');
    const expense = expenseSnapshot.data();
    if (expense.scope === 'personal' || typeof expense.houseId !== 'string') throw new HttpsError('permission-denied', 'Comments are only available for household expenses.');
    const { houseRef, house } = await requireHouseholdMember(expense.houseId, request.auth.uid, transaction);
    const comments = Array.isArray(expense.comments) ? expense.comments : [];
    const target = comments.find((item) => item && item.id === commentId);
    if (!target) throw new HttpsError('not-found', 'Comment not found.');
    if (!canDeleteComment(target, request.auth.uid, house.leaderUid)) throw new HttpsError('permission-denied', 'Only the comment author or household leader can delete it.');
    transaction.update(expenseRef, { comments: comments.filter((item) => item.id !== commentId), updatedAt: new Date().toISOString() });
    transaction.update(houseRef, { ledgerRevision: Number(house.ledgerRevision || 0) + 1 });
  });
  return { synced: true };
});

exports.confirmSettlement = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in is required.');
  const { houseId, expectedLedgerRevision, recommendationId, fromUserId, toUserId, amountCents, proofUrl } = request.data || {};
  if (typeof houseId !== 'string' || houseId.length < 1 || houseId.length > 128
    || !Number.isSafeInteger(expectedLedgerRevision) || expectedLedgerRevision < 0
    || typeof recommendationId !== 'string' || recommendationId.length < 1 || recommendationId.length > 128
    || !isUid(fromUserId) || !isUid(toUserId) || fromUserId === toUserId
    || !Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100000000000
    || (proofUrl !== undefined && !isProofUrl(proofUrl))) badRequest('Invalid settlement request.');

  const result = await db.runTransaction(async (transaction) => {
    const houseRef = db.doc(`houses/${houseId}`);
    const settlementQuery = db.collection('settlements').where('houseId', '==', houseId);
    const expenseQuery = db.collection('expenses').where('houseId', '==', houseId).where('scope', '==', 'household');
    const settlementId = `set-${idempotencyKeyFor(houseId, expectedLedgerRevision, recommendationId, fromUserId, toUserId, amountCents)}`;
    const settlementRef = db.doc(`settlements/${settlementId}`);
    const [houseSnapshot, settlementSnapshot, expenseSnapshot, existingSnapshot] = await Promise.all([
      transaction.get(houseRef),
      transaction.get(settlementQuery),
      transaction.get(expenseQuery),
      transaction.get(settlementRef),
    ]);
    if (!houseSnapshot.exists) throw new HttpsError('not-found', 'Household not found.');
    const house = houseSnapshot.data();
    const memberIds = getHouseMemberIds(house);
    if (!memberIds.includes(request.auth.uid) || toUserId !== request.auth.uid) throw new HttpsError('permission-denied', 'Only the recommended recipient can confirm this settlement.');
    let decision;
    try {
      decision = evaluateSettlementConfirmation({
        house,
        expenses: expenseSnapshot.docs.map((snapshot) => snapshot.data()),
        settlements: settlementSnapshot.docs.map((snapshot) => snapshot.data()),
        existing: existingSnapshot?.exists ? existingSnapshot.data() : null,
        houseId,
        expectedLedgerRevision,
        recommendationId,
        fromUserId,
        toUserId,
        amountCents,
      });
    } catch (error) {
      throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'The household ledger is invalid.');
    }
    if (decision.kind === 'idempotent') return decision.existing;
    if (decision.kind === 'duplicate') throw new HttpsError('already-exists', 'This settlement confirmation key is already used.');
    if (decision.kind === 'stale') throw new HttpsError('aborted', 'The household ledger changed. Recalculate the recommendation.');
    if (decision.kind === 'forged') throw new HttpsError('failed-precondition', 'This settlement is not a current recommended transaction.');

    const now = new Date().toISOString();
    const settlement = {
      id: decision.settlementId,
      houseId,
      fromUserId,
      toUserId,
      amountCents,
      status: 'completed',
      recommendationId: decision.recommendation.id,
      ledgerRevision: expectedLedgerRevision,
      idempotencyKey: decision.idempotencyKey,
      confirmedBy: request.auth.uid,
      createdAt: now,
      settledAt: now,
      ...(proofUrl ? { proofUrl } : {}),
    };
    transaction.create(settlementRef, settlement);
    transaction.update(houseRef, { ledgerRevision: expectedLedgerRevision + 1 });
    return settlement;
  });

  return { settlement: result };
});
