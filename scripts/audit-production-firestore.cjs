const fs = require('node:fs');
const path = require('node:path');
const { getAccessToken } = require('firebase-tools/lib/apiv2');
const firebaseAuth = require('firebase-tools/lib/auth');

const COLLECTIONS = [
  'users',
  'houses',
  'houseCodes',
  'houseArchives',
  'expenses',
  'settlements',
  'cards',
];

const projectConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.firebaserc'), 'utf8'));
const configuredProject = projectConfig.projects?.default;
const projectId = process.env.FIREBASE_PROJECT_ID
  || (typeof configuredProject === 'string' ? configuredProject : null);

if (!projectId) {
  throw new Error('No Firebase project is configured. Set FIREBASE_PROJECT_ID or .firebaserc projects.default.');
}

const decodeValue = (value) => {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('stringValue' in value) return value.stringValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return null;
};

const decodeFields = (fields) => Object.fromEntries(
  Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]),
);

const documentId = (document) => document.name.split('/').at(-1);
const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sameRecord = (left, right) => {
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && sameValue(left[key], right[key]));
};

const listCollection = async (token, collection) => {
  const documents = [];
  let pageToken = '';
  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`,
    );
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Firestore backup failed for ${collection} (HTTP ${response.status}).`);
    }
    const body = await response.json();
    documents.push(...(body.documents || []));
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return documents;
};

const auditSnapshot = (rawCollections) => {
  const decoded = Object.fromEntries(
    Object.entries(rawCollections).map(([collection, documents]) => [
      collection,
      new Map(documents.map((document) => [documentId(document), decodeFields(document.fields)])),
    ]),
  );
  const issues = [];
  const addIssue = (kind, collection, id) => issues.push({ kind, collection, id });
  const houses = decoded.houses;
  const users = decoded.users;

  for (const [id, house] of houses) {
    const members = Array.isArray(house.members) ? house.members : [];
    const rosterUids = members.map((member) => member?.uid);
    const indexedUids = Array.isArray(house.memberUids) ? house.memberUids : [];
    const memberMap = house.memberMap && typeof house.memberMap === 'object' ? house.memberMap : {};
    if (house.id !== id) addIssue('house-document-id-mismatch', 'houses', id);
    if (members.length < 1 || members.length > 10 || new Set(rosterUids).size !== rosterUids.length) {
      addIssue('house-roster-invalid', 'houses', id);
    }
    if (!sameValue(indexedUids, rosterUids)) addIssue('house-member-uids-mismatch', 'houses', id);
    if (Object.keys(memberMap).length !== rosterUids.length
      || rosterUids.some((uid, index) => !uid || !sameRecord(memberMap[uid], members[index]))) {
      addIssue('house-member-map-mismatch', 'houses', id);
    }
    const leaders = members.filter((member) => member?.role === 'leader').map((member) => member.uid);
    if (leaders.length !== 1 || leaders[0] !== house.leaderUid) addIssue('house-leader-invalid', 'houses', id);
  }

  for (const [id, user] of users) {
    if (user.uid !== id) addIssue('user-document-id-mismatch', 'users', id);
    if (Object.prototype.hasOwnProperty.call(user, 'password')) addIssue('user-plaintext-password-field', 'users', id);
    if (user.houseId) {
      const house = houses.get(user.houseId);
      const member = house?.members?.find((candidate) => candidate?.uid === id);
      if (!house || !member) addIssue('user-house-reference-invalid', 'users', id);
      else {
        const expectedRole = house.leaderUid === id ? 'leader' : 'member';
        if (user.role !== expectedRole) addIssue('user-house-role-mismatch', 'users', id);
      }
    }
  }

  for (const [id, expense] of decoded.expenses) {
    if (expense.id !== id) addIssue('expense-document-id-mismatch', 'expenses', id);
    if (expense.scope === 'personal') {
      if (!expense.ownerId || !users.has(expense.ownerId) || expense.paidBy !== expense.ownerId) {
        addIssue('personal-expense-owner-invalid', 'expenses', id);
      }
      continue;
    }
    const house = houses.get(expense.houseId);
    const roster = new Set(house?.members?.map((member) => member?.uid) || []);
    if (!house || !roster.has(expense.paidBy)
      || !Array.isArray(expense.shares)
      || expense.shares.some((share) => !roster.has(share?.userId))) {
      addIssue('household-expense-reference-invalid', 'expenses', id);
    }
  }

  for (const [id, settlement] of decoded.settlements) {
    if (settlement.id !== id) addIssue('settlement-document-id-mismatch', 'settlements', id);
    const house = houses.get(settlement.houseId);
    const roster = new Set(house?.members?.map((member) => member?.uid) || []);
    if (!house || !roster.has(settlement.fromUserId) || !roster.has(settlement.toUserId)) {
      addIssue('settlement-reference-invalid', 'settlements', id);
    }
  }

  for (const [id, card] of decoded.cards) {
    if (card.id !== id) addIssue('card-document-id-mismatch', 'cards', id);
    if (!card.ownerId || !users.has(card.ownerId)) addIssue('card-owner-invalid', 'cards', id);
  }

  return issues;
};

const run = async () => {
  const account = firebaseAuth.selectAccount(undefined, process.cwd());
  if (!account) throw new Error('Firebase CLI is not authenticated. Run firebase login first.');
  firebaseAuth.setActiveAccount({}, account);
  const token = await getAccessToken();
  const rawCollections = {};
  for (const collection of COLLECTIONS) {
    rawCollections[collection] = await listCollection(token, collection);
  }
  const issues = auditSnapshot(rawCollections);
  const issueCounts = issues.reduce((counts, issue) => {
    counts[issue.kind] = (counts[issue.kind] || 0) + 1;
    return counts;
  }, {});
  const createdAt = new Date().toISOString();
  const backupDir = path.join(process.cwd(), 'recovery-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `firestore-${createdAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({
    projectId,
    createdAt,
    collections: rawCollections,
    audit: { issues },
  }, null, 2), { encoding: 'utf8', flag: 'wx' });

  console.log(JSON.stringify({
    backupPath,
    documentCounts: Object.fromEntries(
      Object.entries(rawCollections).map(([collection, documents]) => [collection, documents.length]),
    ),
    issueCounts,
    needsReview: issues.length > 0,
  }, null, 2));
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Production backup failed.');
  process.exitCode = 1;
});
