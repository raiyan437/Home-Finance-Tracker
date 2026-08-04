import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const projectId = 'home-finance-1ah277j9';
const now = '2026-08-04T12:00:00.000Z';
const house = {
  id: 'house-1', code: 'HM-1000', name: 'Storage House', leaderUid: 'leader',
  members: [
    { uid: 'leader', displayName: 'LEADER', email: 'leader@example.com', role: 'leader', joinedAt: now },
    { uid: 'member', displayName: 'MEMBER', email: 'member@example.com', role: 'member', joinedAt: now },
  ],
  memberUids: ['leader', 'member'],
  memberMap: {
    leader: { uid: 'leader', displayName: 'LEADER', email: 'leader@example.com', role: 'leader', joinedAt: now },
    member: { uid: 'member', displayName: 'MEMBER', email: 'member@example.com', role: 'member', joinedAt: now },
  },
  ledgerRevision: 0,
  createdAt: now,
};

let testEnv: RulesTestEnvironment;
const storageFor = (uid: string) => testEnv.authenticatedContext(uid).storage();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'houses/house-1'), house);
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

describe('storage access control', () => {
  it('allows private owner uploads/reads/deletes and blocks another user', async () => {
    const ownerRef = ref(storageFor('member'), 'users/member/receipts/receipt.png');
    const metadata = { contentType: 'image/png', customMetadata: { ownerUid: 'member' } };
    await assertSucceeds(uploadBytes(ownerRef, new Uint8Array([1, 2, 3]), metadata));
    await assertSucceeds(getBytes(ownerRef));
    await assertFails(getBytes(ref(storageFor('leader'), 'users/member/receipts/receipt.png')));
    await assertSucceeds(deleteObject(ownerRef));
  });

  it('allows household members to share receipts and remove them', async () => {
    const receiptRef = ref(storageFor('member'), 'houses/house-1/receipts/shared.webp');
    await assertSucceeds(uploadBytes(receiptRef, new Uint8Array([1, 2, 3]), {
      contentType: 'image/webp', customMetadata: { ownerUid: 'member' },
    }));
    await assertSucceeds(getBytes(ref(storageFor('leader'), 'houses/house-1/receipts/shared.webp')));
    await assertSucceeds(deleteObject(ref(storageFor('leader'), 'houses/house-1/receipts/shared.webp')));
  });

  it('rejects unsupported MIME types, missing ownership metadata, oversized files, and invalid paths', async () => {
    const invalidMime = ref(storageFor('member'), 'users/member/receipts/file.gif');
    await assertFails(uploadBytes(invalidMime, new Uint8Array([1]), { contentType: 'image/gif', customMetadata: { ownerUid: 'member' } }));
    const missingOwner = ref(storageFor('member'), 'users/member/receipts/missing.png');
    await assertFails(uploadBytes(missingOwner, new Uint8Array([1]), { contentType: 'image/png' }));
    const oversized = ref(storageFor('member'), 'users/member/receipts/large.png');
    await assertFails(uploadBytes(oversized, new Uint8Array(5 * 1024 * 1024 + 1), { contentType: 'image/png', customMetadata: { ownerUid: 'member' } }));
    await assertFails(uploadBytes(ref(storageFor('member'), 'houses/house-2/receipts/not-member.png'), new Uint8Array([1]), { contentType: 'image/png', customMetadata: { ownerUid: 'member' } }));
  });
});
