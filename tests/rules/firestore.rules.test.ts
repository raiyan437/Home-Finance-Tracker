import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const projectId = 'home-finance-rules-test';
const now = '2026-08-04T12:00:00.000Z';

const member = (uid: string, role: 'leader' | 'member' = 'member') => ({
  uid,
  displayName: uid.toUpperCase(),
  email: `${uid}@example.com`,
  role,
  joinedAt: now,
});

const makeHouse = (members = [member('leader', 'leader'), member('member')]) => ({
  id: 'house-1',
  code: 'HM-1000',
  name: 'Test House',
  leaderUid: 'leader',
  members,
  memberUids: members.map((item) => item.uid),
  memberMap: Object.fromEntries(members.map((item) => [item.uid, item])),
  publicJoin: true,
  ledgerRevision: 0,
  createdAt: now,
});

const makeExpense = (overrides: Record<string, unknown> = {}) => Object.fromEntries(
  Object.entries({
    id: 'expense-1',
    title: 'Groceries',
    amountCents: 1000,
    paidBy: 'leader',
    category: 'Groceries',
    date: '2026-08-04',
    splitMethod: 'equal',
    shares: [{ userId: 'leader', amountCents: 500 }, { userId: 'member', amountCents: 500 }],
    sharesTotalCents: 1000,
    participantUids: ['leader', 'member'],
    scope: 'household',
    houseId: 'house-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }).filter(([, value]) => value !== undefined),
);

const makeProfile = (uid: string, houseId: string | null = null, role: 'leader' | 'member' | null = null) => ({
  uid,
  displayName: uid.toUpperCase(),
  email: `${uid}@example.com`,
  houseId,
  role,
  createdAt: now,
});

let testEnv: RulesTestEnvironment;

const dbFor = (uid: string) => testEnv.authenticatedContext(uid).firestore();
const withAdminDb = async <T>(operation: (db: ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']) => Promise<T>) =>
  testEnv.withSecurityRulesDisabled(async (context) => operation(context.firestore()));

const seed = async (house = makeHouse()) => {
  await withAdminDb(async (db) => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'houses', house.id), house);
    batch.set(doc(db, 'houseCodes', house.code), {
      houseId: house.id,
      name: house.name,
      leaderUid: house.leaderUid,
    });
    for (const item of house.members) {
      batch.set(doc(db, 'users', item.uid), makeProfile(item.uid, house.id, item.role));
    }
    await batch.commit();
  });
};

const commitLedgerWrite = async (uid: string, expenseId: string, expense: Record<string, unknown>, revision: number) => {
  const db = dbFor(uid);
  const batch = writeBatch(db);
  batch.set(doc(db, 'expenses', expenseId), expense);
  batch.update(doc(db, 'houses', 'house-1'), { ledgerRevision: revision });
  return batch.commit();
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

describe('household roster integrity', () => {
  it('allows only an existing legacy roster member to restore derived indexes', async () => {
    await testEnv.clearFirestore();
    const canonical = makeHouse();
    const { memberUids: _memberUids, memberMap: _memberMap, ...legacy } = canonical;
    await withAdminDb(async (db) => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'houses/house-1'), { ...legacy, id: 'wrong-legacy-id', publicJoin: false });
      batch.set(doc(db, 'users/leader'), makeProfile('leader', 'house-1', 'leader'));
      batch.set(doc(db, 'users/member'), makeProfile('member', 'house-1', 'member'));
      await batch.commit();
    });

    const memberDb = dbFor('member');
    await assertSucceeds(getDoc(doc(memberDb, 'houses/house-1')));
    await assertFails(getDoc(doc(dbFor('outsider'), 'houses/house-1')));
    await assertSucceeds(updateDoc(doc(memberDb, 'houses/house-1'), {
      id: 'house-1',
      memberUids: canonical.memberUids,
      memberMap: canonical.memberMap,
    }));
    await assertFails(updateDoc(doc(memberDb, 'houses/house-1'), {
      memberUids: ['leader', 'member', 'outsider'],
      memberMap: { ...canonical.memberMap, outsider: member('outsider') },
    }));
  });

  it('repairs a ten-member legacy roster within the Rules evaluator budget', async () => {
    await testEnv.clearFirestore();
    const tenMembers = [member('leader', 'leader'), ...Array.from({ length: 9 }, (_, index) => member(`member-${index + 1}`))];
    const canonical = makeHouse(tenMembers);
    const { memberUids: _memberUids, memberMap: _memberMap, ...legacy } = canonical;
    await withAdminDb(async (db) => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'houses/house-1'), { ...legacy, publicJoin: false });
      for (const item of tenMembers) batch.set(doc(db, 'users', item.uid), makeProfile(item.uid, 'house-1', item.role));
      await batch.commit();
    });
    const db = dbFor('leader');
    await assertSucceeds(getDoc(doc(db, 'houses/house-1')));
    await assertSucceeds(updateDoc(doc(db, 'houses/house-1'), {
      memberUids: canonical.memberUids,
      memberMap: canonical.memberMap,
    }));
  });

  it('allows leader management and blocks a member from editing another member', async () => {
    const leaderDb = dbFor('leader');
    await assertSucceeds(updateDoc(doc(leaderDb, 'houses/house-1'), { name: 'Renamed House' }));

    const memberDb = dbFor('member');
    const current = makeHouse();
    const forgedMembers = [member('leader', 'leader'), { ...member('member'), displayName: 'Changed by attacker' }];
    await assertFails(updateDoc(doc(memberDb, 'houses/house-1'), {
      members: forgedMembers,
      memberMap: Object.fromEntries(forgedMembers.map((item) => [item.uid, item])),
    }));
    expect(current.memberMap?.member.displayName).toBe('MEMBER');
  });

  it('allows only a self avatar update in the denormalized roster', async () => {
    const db = dbFor('member');
    const house = makeHouse();
    const updatedMember = { ...member('member'), avatar: 'https://example.com/member.webp' };
    const updatedMembers = [house.members[0], updatedMember];
    await assertSucceeds(updateDoc(doc(db, 'houses/house-1'), {
      members: updatedMembers,
      memberMap: Object.fromEntries(updatedMembers.map((item) => [item.uid, item])),
    }));
  });

  it('supports joining and leaving with the user profile in the same transaction', async () => {
    await withAdminDb((db) => setDoc(doc(db, 'users/member2'), makeProfile('member2')));
    const memberDb = dbFor('member2');
    const house = makeHouse();
    const joined = [...house.members, member('member2')];
    const batch = writeBatch(memberDb);
    batch.update(doc(memberDb, 'houses/house-1'), {
      members: joined,
      memberUids: joined.map((item) => item.uid),
      memberMap: Object.fromEntries(joined.map((item) => [item.uid, item])),
    });
    batch.update(doc(memberDb, 'users/member2'), { houseId: 'house-1', role: 'member' });
    await assertSucceeds(batch.commit());

    const left = joined.filter((item) => item.uid !== 'member2');
    const leaveBatch = writeBatch(memberDb);
    leaveBatch.update(doc(memberDb, 'houses/house-1'), {
      members: left,
      memberUids: left.map((item) => item.uid),
      memberMap: Object.fromEntries(left.map((item) => [item.uid, item])),
    });
    leaveBatch.update(doc(memberDb, 'users/member2'), { houseId: null, role: null });
    await assertSucceeds(leaveBatch.commit());

    await withAdminDb((db) => setDoc(doc(db, 'houses/house-private'), { ...makeHouse(), id: 'house-private', publicJoin: false }));
    await withAdminDb((db) => setDoc(doc(db, 'users/member3'), makeProfile('member3')));
    const privateDb = dbFor('member3');
    const privateJoin = writeBatch(privateDb);
    const privateHouse = { ...makeHouse(), id: 'house-private', publicJoin: false, members: [...makeHouse().members, member('member3')], memberUids: ['leader', 'member', 'member3'], memberMap: { ...makeHouse().memberMap, member3: member('member3') } };
    privateJoin.update(doc(privateDb, 'houses/house-private'), {
      members: privateHouse.members,
      memberUids: privateHouse.memberUids,
      memberMap: privateHouse.memberMap,
    });
    privateJoin.update(doc(privateDb, 'users/member3'), { houseId: 'house-private', role: 'member' });
    await assertFails(privateJoin.commit());
  });

  it('allows a leader to transfer leadership with matching profiles and code index', async () => {
    const db = dbFor('leader');
    const updatedMembers = [member('leader', 'member'), member('member', 'leader')];
    const batch = writeBatch(db);
    batch.update(doc(db, 'houses/house-1'), {
      leaderUid: 'member',
      members: updatedMembers,
      memberUids: ['leader', 'member'],
      memberMap: Object.fromEntries(updatedMembers.map((item) => [item.uid, item])),
    });
    batch.update(doc(db, 'users/leader'), { role: 'member' });
    batch.update(doc(db, 'users/member'), { role: 'leader' });
    batch.update(doc(db, 'houseCodes/HM-1000'), { houseId: 'house-1', name: 'Test House', leaderUid: 'member' });
    await assertSucceeds(batch.commit());
  });
  it('allows only a single-member leader to close atomically and preserves audit reads', async () => {
    await testEnv.clearFirestore();
    const singleHouse = makeHouse([member('leader', 'leader')]);
    await seed(singleHouse);
    await withAdminDb((db) => setDoc(doc(db, 'expenses', 'expense-audit'), makeExpense({
      id: 'expense-audit',
      shares: [{ userId: 'leader', amountCents: 1000 }],
      participantUids: ['leader'],
    })));
    const db = dbFor('leader');
    const archive = {
      id: 'house-1',
      houseId: 'house-1',
      code: singleHouse.code,
      name: singleHouse.name,
      leaderUid: 'leader',
      members: singleHouse.members,
      memberUids: singleHouse.memberUids,
      memberMap: singleHouse.memberMap,
      createdAt: now,
      archivedAt: now,
      archivedBy: 'leader',
      auditPolicy: 'ledger-preserved-in-place',
    };
    const batch = writeBatch(db);
    batch.set(doc(db, 'houseArchives', 'house-1'), archive);
    batch.delete(doc(db, 'houseCodes', singleHouse.code));
    batch.delete(doc(db, 'houses', 'house-1'));
    batch.update(doc(db, 'users', 'leader'), { houseId: null, role: null });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(db, 'expenses', 'expense-audit')));
  });
});

describe('expense, comment, and card authorization', () => {
  it('rejects direct ten-member ledger batches so they use server authority', async () => {
    const members = [member('leader', 'leader'), ...Array.from({ length: 9 }, (_, index) => member(`member-${index + 1}`))];
    await testEnv.clearFirestore();
    await seed(makeHouse(members));
    const shares = members.map((item) => ({ userId: item.uid, amountCents: 100 }));
    await assertFails(commitLedgerWrite('leader', 'expense-max', makeExpense({
      id: 'expense-max',
      amountCents: 1000,
      shares,
      participantUids: members.map((item) => item.uid),
      sharesTotalCents: 1000,
    }), 1));
    const updatedMembers = members.map((item) => item.uid === 'member-1' ? { ...item, avatar: 'https://example.com/member-1.png' } : item);
    await assertSucceeds(updateDoc(doc(dbFor('member-1'), 'houses/house-1'), {
      members: updatedMembers,
      memberMap: Object.fromEntries(updatedMembers.map((item) => [item.uid, item])),
    }));
    await assertSucceeds(updateDoc(doc(dbFor('leader'), 'houses/house-1'), { name: 'Renamed Ten-Member House' }));
  });

  it('allows a payer expense create/update/delete only with a ledger revision advance', async () => {
    const expense = makeExpense();
    await commitLedgerWrite('leader', 'expense-1', expense, 1);
    const db = dbFor('leader');
    const updateBatch = writeBatch(db);
    updateBatch.update(doc(db, 'expenses/expense-1'), { ...expense, title: 'Updated', updatedAt: '2026-08-04T12:01:00.000Z' });
    updateBatch.update(doc(db, 'houses/house-1'), { ledgerRevision: 2 });
    await assertSucceeds(updateBatch.commit());
    const deleteBatch = writeBatch(db);
    deleteBatch.delete(doc(db, 'expenses/expense-1'));
    deleteBatch.update(doc(db, 'houses/house-1'), { ledgerRevision: 3 });
    await assertSucceeds(deleteBatch.commit());
  });

  it('keeps personal expenses isolated and rejects invalid expense schemas', async () => {
    const ownerDb = dbFor('member');
    const personal = makeExpense({
      id: 'personal-1', scope: 'personal', ownerId: 'member', houseId: undefined,
      paidBy: 'member', shares: [{ userId: 'member', amountCents: 1000 }], participantUids: ['member'],
    });
    await assertSucceeds(setDoc(doc(ownerDb, 'expenses/personal-1'), personal));
    await assertFails(setDoc(doc(ownerDb, 'expenses/personal-empty-notes'), {
      ...personal,
      id: 'personal-empty-notes',
      notes: '',
    }));
    await assertFails(getDoc(doc(dbFor('leader'), 'expenses/personal-1')));
    await assertFails(setDoc(doc(dbFor('leader'), 'expenses/forged'), makeExpense({ id: 'forged', scope: 'personal', ownerId: 'member', houseId: undefined })));
    await assertFails(setDoc(doc(ownerDb, 'expenses/bad-date'), makeExpense({ id: 'bad-date', date: '2026-02-29' })));
  });

  it('allows a member comment through an atomic expense and ledger transaction', async () => {
    await commitLedgerWrite('leader', 'expense-1', makeExpense(), 1);
    const db = dbFor('member');
    const batch = writeBatch(db);
    batch.update(doc(db, 'expenses/expense-1'), {
      comments: [{ id: 'comment-1', userId: 'member', text: 'Looks good', createdAt: now }],
      updatedAt: '2026-08-04T12:01:00.000Z',
    });
    batch.update(doc(db, 'houses/house-1'), { ledgerRevision: 2 });
    await assertSucceeds(batch.commit());
  });
  it('validates card ownership, type, and schema', async () => {
    const db = dbFor('member');
    const card = { id: 'card-1', bankName: 'Example Bank', cardType: 'debit', color: 'linear-gradient(#111,#222)', ownerId: 'member', createdAt: now };
    await assertSucceeds(setDoc(doc(db, 'cards/card-1'), card));
    await assertFails(setDoc(doc(db, 'cards/card-bad'), { ...card, id: 'card-bad', cardType: 'prepaid' }));
    await assertFails(updateDoc(doc(db, 'cards/card-1'), { ownerId: 'leader' }));
    await assertFails(getDoc(doc(dbFor('leader'), 'cards/card-1')));
  });

  it('accepts current cash-opening wallet fields and rejects invalid values', async () => {
    const db = dbFor('member');
    await assertSucceeds(updateDoc(doc(db, 'users/member'), {
      walletSettings: {
        monthlyBudgetCents: 50_000,
        cashOpeningBalanceCents: 12_500,
        cashOpeningAt: now,
        updatedAt: now,
      },
    }));
    await assertFails(updateDoc(doc(db, 'users/member'), {
      walletSettings: {
        cashOpeningBalanceCents: -1,
        cashOpeningAt: 'not-a-timestamp',
      },
    }));
  });

  it('reproduces a legacy oversized avatar without conflating wallet and ledger authorization', async () => {
    const oversizedAvatar = `data:image/webp;base64,${'a'.repeat(351_000)}`;
    const legacyMembers = [
      { ...member('leader', 'leader'), avatar: oversizedAvatar },
      member('member'),
    ];
    await withAdminDb(async (admin) => {
      const batch = writeBatch(admin);
      batch.update(doc(admin, 'users/leader'), { avatar: oversizedAvatar });
      batch.update(doc(admin, 'houses/house-1'), {
        members: legacyMembers,
        memberMap: Object.fromEntries(legacyMembers.map((item) => [item.uid, item])),
      });
      await batch.commit();
    });

    await assertFails(updateDoc(doc(dbFor('leader'), 'users/leader'), {
      walletSettings: { monthlyBudgetCents: 50_000, updatedAt: now },
    }));
    await assertSucceeds(commitLedgerWrite('leader', 'expense-legacy-avatar', makeExpense({
      id: 'expense-legacy-avatar',
    }), 1));
  });
});

describe('settlement integrity', () => {
  it('allows a valid recipient confirmation and rejects forged recipient data', async () => {
    const expense = makeExpense({ paidBy: 'member', shares: [{ userId: 'leader', amountCents: 1000 }], participantUids: ['leader'] });
    await commitLedgerWrite('member', 'expense-1', expense, 1);
    const leaderDb = dbFor('leader');
    const valid = {
      id: 'set-valid',
      fromUserId: 'member',
      toUserId: 'leader',
      amountCents: 1000,
      status: 'completed',
      houseId: 'house-1',
      createdAt: now,
      settledAt: now,
      recommendationId: 'sim-1-member-leader',
      ledgerRevision: 1,
      idempotencyKey: 'a'.repeat(64),
      confirmedBy: 'leader',
    };
    const batch = writeBatch(leaderDb);
    batch.set(doc(leaderDb, 'settlements/set-valid'), valid);
    batch.update(doc(leaderDb, 'houses/house-1'), { ledgerRevision: 2 });
    await assertSucceeds(batch.commit());

    const forged = { ...valid, id: 'set-forged', toUserId: 'member', confirmedBy: 'leader', idempotencyKey: 'b'.repeat(64) };
    await assertFails(setDoc(doc(leaderDb, 'settlements/set-forged'), forged));
  });
  it('allows only an authorized, audited reversal with a matching revision advance', async () => {
    await withAdminDb((admin) => setDoc(doc(admin, 'settlements/set-valid'), {
      id: 'set-valid', fromUserId: 'member', toUserId: 'leader', amountCents: 100, status: 'completed', houseId: 'house-1', createdAt: now, settledAt: now,
      recommendationId: 'sim-1-member-leader', ledgerRevision: 0, idempotencyKey: 'b'.repeat(64), confirmedBy: 'leader',
    }));
    const memberDb = dbFor('leader');
    const batch = writeBatch(memberDb);
    batch.update(doc(memberDb, 'settlements/set-valid'), { status: 'reversed', reversedAt: '2026-08-04T12:01:00.000Z', reversedBy: 'leader' });
    batch.update(doc(memberDb, 'houses/house-1'), { ledgerRevision: 1 });
    await assertSucceeds(batch.commit());

    const staleDb = dbFor('member');
    const stale = writeBatch(staleDb);
    stale.update(doc(staleDb, 'settlements/set-valid'), { status: 'completed' });
    stale.update(doc(staleDb, 'houses/house-1'), { ledgerRevision: 2 });
    await assertFails(stale.commit());
  });
});
