import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db, functions, isFirebaseConfigured } from '../config/firebase';
import type { Expense, ExpenseComment, House, PaymentCard, Settlement, UserProfile } from '../types';

export type SyncCollection = 'users' | 'houses' | 'houseCodes' | 'expenses' | 'settlements' | 'cards';
export type SyncOperation = 'set' | 'delete';
export type SyncMutationType =
  | 'document'
  | 'house-with-code'
  | 'house-code'
  | 'profile-identity'
  | 'profile-avatar'
  | 'profile-wallet'
  | 'profile-membership'
  | 'comment-add'
  | 'comment-delete';
export type SyncErrorKind = 'retryable' | 'permanent' | 'auth';

export interface SyncErrorInfo {
  kind: SyncErrorKind;
  code: string;
  userMessage: string;
  occurredAt: string;
}

export type PendingMutationStatus = 'pending' | 'failed';

export interface PendingMutation {
  key: string;
  mutationType: SyncMutationType;
  collection: SyncCollection;
  id: string;
  operation: SyncOperation;
  writeMode?: 'replace' | 'merge';
  data?: Record<string, unknown>;
  deleteFields?: string[];
  related?: {
    collection: SyncCollection;
    id: string;
    data: Record<string, unknown>;
    merge?: boolean;
  };
  userUid: string;
  houseId?: string;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
  nextAttemptAt: string;
  lastError?: SyncErrorInfo;
  mutationVersion: number;
  status: PendingMutationStatus;
}

export type SyncResultStatus = 'synced' | 'queued' | 'failed' | 'auth-required' | 'disabled';

export interface SyncResult {
  status: SyncResultStatus;
  synced: boolean;
  queued: boolean;
  failed: boolean;
  requiresReauthentication: boolean;
  error?: SyncErrorInfo;
  mutationKey?: string;
}

export type UserSyncStatus = 'synced' | 'saving' | 'offline-queued' | 'failed' | 'auth-required';

export interface SyncState {
  status: UserSyncStatus;
  pendingCount: number;
  failedCount: number;
  message?: string;
  canRetry: boolean;
}

const OUTBOX_KEY = 'home_finance_sync_outbox_v2';
const LEGACY_OUTBOX_KEY = 'home_finance_sync_outbox_v1';
export const MAX_OUTBOX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 2_000;
const RETRY_MAX_DELAY_MS = 5 * 60_000;

let flushPromise: Promise<void> | null = null;
let mutationSequence = 0;
const syncSubscribers = new Set<(state: SyncState) => void>();
const lastStatusByUid = new Map<string, UserSyncStatus>();
const lastErrorByUid = new Map<string, SyncErrorInfo>();

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const getErrorCode = (error: unknown): string => {
  if (isRecord(error) && typeof error.code === 'string') return error.code.toLowerCase();
  if (error instanceof Error && error.name) return error.name.toLowerCase();
  return 'unknown';
};

const codeWithoutNamespace = (code: string): string => code.includes('/') ? code.split('/').pop() || code : code;

const safeMessageFor = (kind: SyncErrorKind, code: string): string => {
  const normalized = codeWithoutNamespace(code);
  if (kind === 'auth') return 'Your session needs attention. Sign in again to continue syncing.';
  if (kind === 'retryable') {
    if (normalized === 'deadline-exceeded') return 'The cloud service took too long to respond. Your change is queued.';
    return 'The cloud service is temporarily unavailable. Your change is queued.';
  }
  if (normalized === 'permission-denied') return 'You no longer have permission to make this change.';
  if (normalized === 'not-found') return 'The cloud record could not be found. Refresh and try again.';
  if (normalized === 'already-exists') return 'This cloud record already exists in a different state.';
  return 'The cloud rejected this change. Review it and try again.';
};

/** Converts Firebase/Auth/Functions errors into safe, actionable categories. */
export const classifyFirebaseError = (error: unknown): SyncErrorInfo => {
  const code = getErrorCode(error);
  const normalized = codeWithoutNamespace(code);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const retryableCodes = new Set([
    'unavailable',
    'deadline-exceeded',
    'internal',
    'aborted',
    'cancelled',
    'network-request-failed',
    'timeout',
  ]);
  const authCodes = new Set([
    'unauthenticated',
    'user-token-expired',
    'id-token-expired',
    'requires-recent-login',
    'user-signed-out',
  ]);
  const kind: SyncErrorKind = authCodes.has(normalized)
    ? 'auth'
    : retryableCodes.has(normalized) || (offline && normalized === 'unknown')
      ? 'retryable'
      : 'permanent';

  return {
    kind,
    code,
    userMessage: safeMessageFor(kind, code),
    occurredAt: new Date().toISOString(),
  };
};

const currentUserUid = (): string | null => auth?.currentUser?.uid || null;

const mutationKeyFor = (mutation: Pick<PendingMutation, 'userUid' | 'houseId' | 'collection' | 'id' | 'mutationType'>): string => (
  [mutation.userUid, mutation.houseId || '-', mutation.collection, mutation.id, mutation.mutationType].join('/')
);

const readRawOutbox = (key: string): unknown[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const inferLegacyHouseId = (item: Record<string, unknown>): string | undefined => {
  if (typeof item.data !== 'object' || !item.data || Array.isArray(item.data)) return undefined;
  const data = item.data as Record<string, unknown>;
  return typeof data.houseId === 'string' ? data.houseId : undefined;
};

const normalizeStoredMutation = (value: unknown, legacy = false): PendingMutation | null => {
  if (!isRecord(value)
    || typeof value.collection !== 'string'
    || typeof value.id !== 'string'
    || (value.operation !== 'set' && value.operation !== 'delete')) return null;

  const userUid = typeof value.userUid === 'string' ? value.userUid : '';
  const mutationType = typeof value.mutationType === 'string' ? value.mutationType as SyncMutationType : 'document';
  const houseId = typeof value.houseId === 'string' ? value.houseId : inferLegacyHouseId(value);
  const timestamp = typeof value.timestamp === 'string'
    ? value.timestamp
    : typeof value.queuedAt === 'string' ? value.queuedAt : new Date().toISOString();
  const mutationVersion = typeof value.mutationVersion === 'number'
    ? value.mutationVersion
    : Date.parse(timestamp) * 1000 + (++mutationSequence % 1000);
  const lastError = isRecord(value.lastError)
    && (value.lastError.kind === 'retryable' || value.lastError.kind === 'permanent' || value.lastError.kind === 'auth')
    && typeof value.lastError.code === 'string'
    && typeof value.lastError.userMessage === 'string'
    && typeof value.lastError.occurredAt === 'string'
    ? value.lastError as unknown as SyncErrorInfo
    : undefined;
  const status: PendingMutationStatus = legacy && !userUid
    ? 'failed'
    : value.status === 'failed' ? 'failed' : 'pending';
  const normalized: PendingMutation = {
    key: typeof value.key === 'string' ? value.key : '',
    mutationType,
    collection: value.collection as SyncCollection,
    id: value.id,
    operation: value.operation,
    ...(isRecord(value.data) ? { data: value.data } : {}),
    ...(Array.isArray(value.deleteFields) ? { deleteFields: value.deleteFields.filter((field): field is string => typeof field === 'string') } : {}),
    ...(isRecord(value.related) && typeof value.related.collection === 'string' && typeof value.related.id === 'string' && isRecord(value.related.data)
      ? { related: { collection: value.related.collection as SyncCollection, id: value.related.id, data: value.related.data, merge: value.related.merge === true } }
      : {}),
    userUid,
    ...(houseId ? { houseId } : {}),
    timestamp,
    retryCount: typeof value.retryCount === 'number' && value.retryCount >= 0 ? value.retryCount : 0,
    maxRetries: typeof value.maxRetries === 'number' && value.maxRetries > 0 ? value.maxRetries : MAX_OUTBOX_RETRIES,
    nextAttemptAt: typeof value.nextAttemptAt === 'string' ? value.nextAttemptAt : timestamp,
    ...(lastError ? { lastError } : legacy && !userUid ? {
      lastError: {
        kind: 'auth' as const,
        code: 'legacy-unscoped-outbox',
        userMessage: 'This older queued change cannot be replayed safely until it is associated with its account.',
        occurredAt: new Date().toISOString(),
      },
    } : {}),
    mutationVersion,
    status,
  };
  normalized.key = mutationKeyFor(normalized);
  return normalized;
};

export const readOutbox = (): PendingMutation[] => {
  const current = readRawOutbox(OUTBOX_KEY)
    .map((item) => normalizeStoredMutation(item))
    .filter((item): item is PendingMutation => Boolean(item));
  if (current.length > 0 || typeof localStorage === 'undefined' || !localStorage.getItem(LEGACY_OUTBOX_KEY)) return current;

  // Legacy entries have no safe account identity. Preserve them as failed,
  // non-replayable records rather than guessing which signed-in account owns them.
  const legacy = readRawOutbox(LEGACY_OUTBOX_KEY)
    .map((item) => normalizeStoredMutation(item, true))
    .filter((item): item is PendingMutation => Boolean(item));
  if (legacy.length > 0) {
    writeOutbox(legacy);
    localStorage.removeItem(LEGACY_OUTBOX_KEY);
  }
  return legacy;
};

const writeOutbox = (items: PendingMutation[]): void => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
};

export const getOutboxSnapshot = (userUid?: string, houseId?: string): PendingMutation[] => readOutbox().filter((item) => (
  (!userUid || item.userUid === userUid)
  && (!houseId || item.houseId === houseId)
));

const versionFromData = (data?: Record<string, unknown>): number => {
  const timestamp = typeof data?.updatedAt === 'string'
    ? Date.parse(data.updatedAt)
    : typeof data?.createdAt === 'string' ? Date.parse(data.createdAt) : NaN;
  return Number.isFinite(timestamp) ? timestamp * 1000 + (++mutationSequence % 1000) : Date.now() * 1000 + (++mutationSequence % 1000);
};

type MutationInput = Omit<PendingMutation, 'key' | 'timestamp' | 'retryCount' | 'maxRetries' | 'nextAttemptAt' | 'mutationVersion' | 'status'>;

const makeMutation = (input: MutationInput): PendingMutation => {
  const mutation: PendingMutation = {
    ...input,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    maxRetries: MAX_OUTBOX_RETRIES,
    nextAttemptAt: new Date().toISOString(),
    mutationVersion: versionFromData(input.data),
    status: 'pending',
    key: '',
  };
  mutation.key = mutationKeyFor(mutation);
  return mutation;
};

const canCoalesce = (existing: PendingMutation, next: PendingMutation): boolean => (
  existing.key === next.key
  && existing.operation === 'set'
  && next.operation === 'set'
  && existing.mutationType === next.mutationType
  && existing.status === 'pending'
  && next.status === 'pending'
  && existing.mutationType !== 'comment-add'
  && existing.mutationType !== 'comment-delete'
);

export const coalesceMutations = (items: PendingMutation[]): PendingMutation[] => {
  const result: PendingMutation[] = [];
  for (const item of items) {
    const previous = result[result.length - 1];
    if (previous && canCoalesce(previous, item)) result[result.length - 1] = item;
    else result.push(item);
  }
  return result;
};

const enqueueMutation = (mutation: PendingMutation, error?: SyncErrorInfo): PendingMutation => {
  const items = readOutbox().filter((item) => item.key !== mutation.key || item.mutationVersion > mutation.mutationVersion);
  const stored: PendingMutation = {
    ...mutation,
    ...(error ? { lastError: error } : {}),
    status: error && error.kind !== 'retryable' ? 'failed' : 'pending',
  };
  const next = coalesceMutations([...items, stored]).sort((a, b) => a.mutationVersion - b.mutationVersion);
  writeOutbox(next);
  return stored;
};

const replaceStoredMutation = (mutation: PendingMutation, update: Partial<PendingMutation>): void => {
  const next = readOutbox().map((item) => (
    item.key === mutation.key && item.mutationVersion === mutation.mutationVersion
      ? { ...item, ...update }
      : item
  ));
  writeOutbox(next);
};

const removeStoredMutation = (mutation: PendingMutation): void => {
  writeOutbox(readOutbox().filter((item) => !(item.key === mutation.key && item.mutationVersion === mutation.mutationVersion)));
};

const resultFor = (status: SyncResultStatus, mutationKey?: string, error?: SyncErrorInfo): SyncResult => ({
  status,
  synced: status === 'synced',
  queued: status === 'queued',
  failed: status === 'failed' || status === 'auth-required',
  requiresReauthentication: status === 'auth-required' || error?.kind === 'auth',
  ...(error ? { error } : {}),
  ...(mutationKey ? { mutationKey } : {}),
});

const publishSyncState = (uid?: string | null): void => {
  const targetUid = uid || currentUserUid();
  const state = getSyncState(targetUid || undefined);
  syncSubscribers.forEach((subscriber) => subscriber(state));
};

const setLastStatus = (uid: string, status: UserSyncStatus, error?: SyncErrorInfo): void => {
  lastStatusByUid.set(uid, status);
  if (error) lastErrorByUid.set(uid, error);
  else if (status === 'synced') lastErrorByUid.delete(uid);
  publishSyncState(uid);
};

export const getSyncState = (userUid?: string): SyncState => {
  const uid = userUid || currentUserUid();
  if (!uid) return { status: 'synced', pendingCount: 0, failedCount: 0, canRetry: false };
  const scoped = getOutboxSnapshot(uid);
  const pendingCount = scoped.filter((item) => item.status === 'pending').length;
  const failed = scoped.filter((item) => item.status === 'failed');
  const lastError = failed[failed.length - 1]?.lastError || lastErrorByUid.get(uid);
  const canRetry = failed.some((item) => item.lastError?.kind === 'retryable' || item.lastError?.kind === 'auth');
  if (lastStatusByUid.get(uid) === 'saving') return { status: 'saving', pendingCount, failedCount: failed.length, canRetry };
  if (lastError?.kind === 'auth') return { status: 'auth-required', pendingCount, failedCount: failed.length, message: lastError.userMessage, canRetry };
  if (failed.length > 0) return { status: 'failed', pendingCount, failedCount: failed.length, message: lastError?.userMessage, canRetry };
  if (pendingCount > 0) return { status: 'offline-queued', pendingCount, failedCount: 0, message: 'Changes are saved locally and queued for cloud sync.', canRetry: true };
  return { status: lastStatusByUid.get(uid) || 'synced', pendingCount: 0, failedCount: 0, canRetry: false };
};

export const subscribeSyncState = (onUpdate: (state: SyncState) => void): (() => void) => {
  syncSubscribers.add(onUpdate);
  onUpdate(getSyncState());
  return () => syncSubscribers.delete(onUpdate);
};

const callableFunctions = () => {
  if (functions) return functions;
  if (auth?.app) return getFunctions(auth.app);
  return null;
};

const performMergeWrite = async (mutation: PendingMutation, reference: ReturnType<typeof doc>): Promise<void> => {
  const cleanData = sanitizeForFirestore(mutation.data ?? {});
  const payload: Record<string, unknown> = { ...(cleanData as Record<string, unknown>) };
  if (mutation.mutationType === 'profile-wallet' && isRecord(payload.walletSettings)) {
    // Wallet settings are independent fields. A pending budget update must
    // not replace a newer cash opening value written on another device.
    const walletFields = payload.walletSettings;
    delete payload.walletSettings;
    Object.entries(walletFields).forEach(([field, value]) => {
      payload[`walletSettings.${field}`] = value;
    });
  }
  mutation.deleteFields?.forEach((field) => { payload[field] = deleteField(); });
  await setDoc(reference, payload, { merge: true });
};

const performMutation = async (mutation: PendingMutation): Promise<void> => {
  if (!db) throw Object.assign(new Error('Cloud database is unavailable.'), { code: 'unavailable' });
  const signedInUid = currentUserUid();
  if (!signedInUid || signedInUid !== mutation.userUid) throw Object.assign(new Error('The signed-in account changed.'), { code: 'unauthenticated' });

  const callable = callableFunctions();
  if (mutation.mutationType === 'comment-add' || mutation.mutationType === 'comment-delete') {
    if (!callable) throw Object.assign(new Error('Cloud functions are unavailable.'), { code: 'unavailable' });
    const functionName = mutation.mutationType === 'comment-add' ? 'addExpenseComment' : 'deleteExpenseComment';
    if (mutation.mutationType === 'comment-add') {
      await httpsCallable(callable, functionName)({ expenseId: mutation.id, comment: mutation.data?.comment });
    } else {
      await httpsCallable(callable, functionName)({ expenseId: mutation.id, commentId: mutation.data?.commentId });
    }
    return;
  }

  if (mutation.collection === 'expenses' || mutation.collection === 'settlements') {
    const affectsLedger = Boolean(mutation.houseId);
    if (affectsLedger) {
      if (!callable) throw Object.assign(new Error('Cloud ledger functions are unavailable.'), { code: 'unavailable' });
      await httpsCallable(callable, 'mutateHouseholdLedger')({
        collection: mutation.collection,
        operation: mutation.operation,
        id: mutation.id,
        houseId: mutation.houseId,
        ...(mutation.operation === 'set' ? { data: sanitizeForFirestore(mutation.data ?? {}) } : {}),
      });
      return;
    }
  }

  if (mutation.mutationType === 'house-with-code' && mutation.related) {
    const batch = writeBatch(db);
    const reference = doc(db, mutation.collection, mutation.id);
    batch.set(reference, sanitizeForFirestore(mutation.data ?? {}) as Record<string, unknown>);
    batch.set(
      doc(db, mutation.related.collection, mutation.related.id),
      sanitizeForFirestore(mutation.related.data) as Record<string, unknown>,
      { merge: mutation.related.merge !== false },
    );
    await batch.commit();
    return;
  }

  const reference = doc(db, mutation.collection, mutation.id);
  if (mutation.operation === 'delete') await deleteDoc(reference);
  else if (mutation.mutationType === 'document' || mutation.writeMode === 'replace') {
    await setDoc(reference, sanitizeForFirestore(mutation.data ?? {}) as Record<string, unknown>);
  } else {
    await performMergeWrite(mutation, reference);
  }
};

const syncMutation = async (input: Omit<MutationInput, 'userUid'>, requestedUid?: string): Promise<SyncResult> => {
  if (!isFirebaseConfigured || !db) return resultFor('disabled');
  const uid = requestedUid || currentUserUid();
  if (!uid) {
    const error = classifyFirebaseError({ code: 'unauthenticated' });
    return resultFor('auth-required', undefined, error);
  }
  const mutation = makeMutation({ ...input, userUid: uid });
  // Put the optimistic mutation in the outbox before the network call so a
  // realtime snapshot that arrives during the write cannot erase local state.
  enqueueMutation(mutation);
  setLastStatus(uid, 'saving');
  try {
    await performMutation(mutation);
    removeStoredMutation(mutation);
    setLastStatus(uid, 'synced');
    return resultFor('synced', mutation.key);
  } catch (error) {
    const classified = classifyFirebaseError(error);
    const stored = enqueueMutation(mutation, classified);
    if (classified.kind === 'retryable') {
      setLastStatus(uid, 'offline-queued', classified);
      return resultFor('queued', stored.key, classified);
    }
    setLastStatus(uid, classified.kind === 'auth' ? 'auth-required' : 'failed', classified);
    return resultFor(classified.kind === 'auth' ? 'auth-required' : 'failed', stored.key, classified);
  }
};

const aggregateResults = (results: SyncResult[]): SyncResult => {
  const errorResult = results.find((item) => item.status === 'failed') || results.find((item) => item.status === 'auth-required');
  if (errorResult) return errorResult;
  const queued = results.find((item) => item.status === 'queued');
  if (queued) return queued;
  const disabled = results.find((item) => item.status === 'disabled');
  return disabled || resultFor('synced');
};

const profilePatch = async (
  uid: string,
  mutationType: Exclude<SyncMutationType, 'document'>,
  data: Record<string, unknown>,
  deleteFields: string[] = [],
): Promise<SyncResult> => syncMutation({
  collection: 'users',
  id: uid,
  operation: 'set',
  mutationType,
  data,
  deleteFields,
  writeMode: 'merge',
}, uid);

export const sanitizeForFirestore = <T>(data: T): T => {
  if (data === null || data === undefined) return null as unknown as T;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  const cleanObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (value !== undefined) cleanObj[key] = sanitizeForFirestore(value);
  }
  return cleanObj as T;
};

export const syncSaveUserIdentity = async (profile: UserProfile): Promise<SyncResult> => profilePatch(profile.uid, 'profile-identity', {
  uid: profile.uid,
  displayName: profile.displayName,
  email: profile.email,
  createdAt: profile.createdAt,
});

export const syncSaveUserAvatar = async (uid: string, avatarUrl: string | null): Promise<SyncResult> => profilePatch(
  uid,
  'profile-avatar',
  avatarUrl ? { avatar: avatarUrl } : {},
  avatarUrl ? [] : ['avatar'],
);

export const syncSaveUserWalletSettings = async (uid: string, walletSettings: UserProfile['walletSettings']): Promise<SyncResult> => {
  if (!walletSettings) return profilePatch(uid, 'profile-wallet', {}, ['walletSettings']);
  const fields = Object.entries(walletSettings).filter(([key]) => key !== 'updatedAt');
  const data = fields.length > 0
    ? { walletSettings: Object.fromEntries(fields) }
    : {};
  return profilePatch(uid, 'profile-wallet', data, []);
};

export const syncSaveUserMembership = async (uid: string, houseId: string | null, role: UserProfile['role']): Promise<SyncResult> => profilePatch(
  uid,
  'profile-membership',
  { houseId, role },
);

/** Compatibility wrapper that writes independent profile field groups. */
export const syncSaveUser = async (profile: UserProfile): Promise<SyncResult> => aggregateResults([
  await syncSaveUserIdentity(profile),
  await syncSaveUserMembership(profile.uid, profile.houseId || null, profile.role || null),
  ...(profile.avatar !== undefined ? [await syncSaveUserAvatar(profile.uid, profile.avatar)] : []),
  ...(profile.walletSettings !== undefined ? [await syncSaveUserWalletSettings(profile.uid, profile.walletSettings)] : []),
]);

export const syncSaveHouse = async (house: House): Promise<SyncResult> => {
  const normalizedHouse: House = {
    ...house,
    memberUids: house.members.map((member) => member.uid),
    memberMap: Object.fromEntries(house.members.map((member) => [member.uid, member])),
    publicJoin: house.publicJoin !== false,
  };
  return syncMutation({
    collection: 'houses',
    id: house.id,
    houseId: house.id,
    operation: 'set',
    mutationType: 'house-with-code',
    data: normalizedHouse as unknown as Record<string, unknown>,
    related: {
      collection: 'houseCodes',
      id: house.code.toUpperCase(),
      data: { houseId: house.id, name: house.name, leaderUid: house.leaderUid },
      merge: true,
    },
  });
};

export const getPendingProfileOverlay = (uid: string, profile: UserProfile): UserProfile => {
  const pending = getOutboxSnapshot(uid).filter((item) => item.collection === 'users' && item.status === 'pending')
    .sort((a, b) => a.mutationVersion - b.mutationVersion);
  let result = { ...profile };
  for (const mutation of pending) {
    if (mutation.mutationType === 'profile-identity') result = { ...result, ...(mutation.data as Partial<UserProfile>) };
    if (mutation.mutationType === 'profile-avatar') {
      if (mutation.deleteFields?.includes('avatar')) {
        const { avatar: _avatar, ...withoutAvatar } = result;
        result = withoutAvatar;
      } else if (typeof mutation.data?.avatar === 'string') result = { ...result, avatar: mutation.data.avatar };
    }
    if (mutation.mutationType === 'profile-wallet') {
      if (mutation.deleteFields?.includes('walletSettings')) {
        const { walletSettings: _walletSettings, ...withoutWallet } = result;
        result = withoutWallet;
      } else if (mutation.data?.walletSettings && isRecord(mutation.data.walletSettings)) {
        result = {
          ...result,
          walletSettings: {
            ...(result.walletSettings || {}),
            ...(mutation.data.walletSettings as UserProfile['walletSettings']),
          },
        };
      }
      const walletDeletes = (mutation.deleteFields || [])
        .filter((field) => field.startsWith('walletSettings.'))
        .map((field) => field.slice('walletSettings.'.length));
      if (walletDeletes.length > 0 && result.walletSettings) {
        const nextWallet = { ...result.walletSettings };
        walletDeletes.forEach((field) => { delete nextWallet[field as keyof typeof nextWallet]; });
        result = { ...result, walletSettings: nextWallet };
      }
    }
  }
  // Membership is deliberately excluded: the household roster and cloud
  // profile are canonical for membership, never a stale local outbox entry.
  return result;
};

export const discardPendingUserProfileMutation = (uid: string): void => {
  writeOutbox(readOutbox().filter((item) => !(item.collection === 'users' && item.userUid === uid && item.status === 'pending')));
  publishSyncState(uid);
};

const applyPendingToCollection = <T extends { id: string }>(collectionName: SyncCollection, cloudItems: T[], userUid?: string, houseId?: string | null): T[] => {
  const byId = new Map(cloudItems.map((item) => [item.id, item]));
  const pending = readOutbox()
    .filter((item) => item.collection === collectionName && item.status === 'pending')
    .filter((item) => !userUid || item.userUid === userUid)
    .filter((item) => houseId === undefined || item.houseId === houseId)
    .sort((a, b) => a.mutationVersion - b.mutationVersion);

  for (const mutation of pending) {
    if (mutation.mutationType === 'comment-add' || mutation.mutationType === 'comment-delete') {
      const current = byId.get(mutation.id) as unknown as Expense | undefined;
      if (!current) continue;
      const comments = [...(current.comments || [])];
      if (mutation.mutationType === 'comment-add' && mutation.data?.comment) {
        const comment = mutation.data.comment as ExpenseComment;
        if (!comments.some((item) => item.id === comment.id)) byId.set(mutation.id, { ...current, comments: [...comments, comment] } as unknown as T);
      } else if (mutation.mutationType === 'comment-delete') {
        byId.set(mutation.id, { ...current, comments: comments.filter((item) => item.id !== mutation.data?.commentId) } as unknown as T);
      }
    } else if (mutation.operation === 'delete') byId.delete(mutation.id);
    else if (mutation.data) byId.set(mutation.id, mutation.data as unknown as T);
  }
  return [...byId.values()];
};

export const mergePending = <T extends { id: string }>(collectionName: SyncCollection, cloudItems: T[], userUid?: string, houseId?: string | null): T[] => (
  applyPendingToCollection(collectionName, cloudItems, userUid || currentUserUid() || undefined, houseId)
);

const flushOne = async (mutation: PendingMutation, force: boolean): Promise<'success' | 'stop' | 'continue'> => {
  if (!force && Date.parse(mutation.nextAttemptAt) > Date.now()) return 'continue';
  try {
    await performMutation(mutation);
    removeStoredMutation(mutation);
    setLastStatus(mutation.userUid, 'synced');
    return 'success';
  } catch (error) {
    const classified = classifyFirebaseError(error);
    const nextRetryCount = mutation.retryCount + 1;
    if (classified.kind === 'retryable' && nextRetryCount <= mutation.maxRetries) {
      const delay = Math.min(RETRY_BASE_DELAY_MS * (2 ** Math.max(0, nextRetryCount - 1)), RETRY_MAX_DELAY_MS);
      replaceStoredMutation(mutation, {
        retryCount: nextRetryCount,
        nextAttemptAt: new Date(Date.now() + delay).toISOString(),
        lastError: classified,
        status: 'pending',
      });
      setLastStatus(mutation.userUid, 'offline-queued', classified);
      return 'stop';
    }
    replaceStoredMutation(mutation, {
      retryCount: nextRetryCount,
      lastError: classified,
      status: 'failed',
      nextAttemptAt: new Date().toISOString(),
    });
    setLastStatus(mutation.userUid, classified.kind === 'auth' ? 'auth-required' : 'failed', classified);
    return classified.kind === 'retryable' ? 'stop' : 'continue';
  }
};

export const flushSyncOutbox = async (force = false): Promise<void> => {
  if (!isFirebaseConfigured || !db || flushPromise) return flushPromise ?? Promise.resolve();
  const uid = currentUserUid();
  if (!uid) return;
  flushPromise = (async () => {
    const pending = readOutbox()
      .filter((item) => item.userUid === uid && item.status === 'pending')
      .sort((a, b) => a.mutationVersion - b.mutationVersion);
    for (const mutation of pending) {
      const action = await flushOne(mutation, force);
      if (action === 'stop') break;
    }
    publishSyncState(uid);
  })().finally(() => { flushPromise = null; });
  return flushPromise;
};

/** Retries only queued transport/session failures; permanent failures stay failed. */
export const retryFailedSyncMutations = async (): Promise<void> => {
  const uid = currentUserUid();
  if (!uid) return;
  const next = readOutbox().map((item) => (
    item.userUid === uid
      && item.status === 'failed'
      && (item.lastError?.kind === 'retryable' || item.lastError?.kind === 'auth')
      ? { ...item, status: 'pending' as const, retryCount: 0, nextAttemptAt: new Date().toISOString() }
      : item
  ));
  writeOutbox(next);
  publishSyncState(uid);
  await flushSyncOutbox(true);
};

export const hasPendingLedgerMutations = (houseId: string): boolean => {
  const uid = currentUserUid();
  return readOutbox().some((item) => item.status === 'pending'
    && item.userUid === uid
    && (item.collection === 'expenses' || item.collection === 'settlements')
    && item.houseId === houseId);
};

export const syncSaveExpense = async (expense: Expense, houseId?: string | null): Promise<SyncResult> => {
  const normalizedExpense = {
    ...expense,
    sharesTotalCents: expense.shares.reduce((sum, share) => sum + share.amountCents, 0),
    participantUids: expense.shares.map((share) => share.userId),
  };
  const dataToSave = houseId ? { ...normalizedExpense, houseId } : normalizedExpense;
  return syncMutation({
    collection: 'expenses',
    id: expense.id,
    operation: 'set',
    mutationType: 'document',
    ...(houseId ? { houseId } : {}),
    data: sanitizeForFirestore(dataToSave) as unknown as Record<string, unknown>,
    writeMode: 'replace',
  });
};

export const syncDeleteExpense = async (expenseId: string): Promise<SyncResult> => syncMutation({
  collection: 'expenses', id: expenseId, operation: 'delete', mutationType: 'document', writeMode: 'replace',
});

export const syncDeleteHouseExpense = async (expenseId: string, houseId: string): Promise<SyncResult> => syncMutation({
  collection: 'expenses', id: expenseId, operation: 'delete', mutationType: 'document', houseId, data: { houseId }, writeMode: 'replace',
});

export const syncAddExpenseComment = async (expense: Expense, comment: ExpenseComment): Promise<SyncResult> => {
  if (!isFirebaseConfigured || !db) return resultFor('disabled');
  const uid = currentUserUid();
  if (!uid || uid !== comment.userId) return resultFor('auth-required', undefined, classifyFirebaseError({ code: 'unauthenticated' }));
  return syncMutation({
    collection: 'expenses', id: expense.id, operation: 'set', mutationType: 'comment-add', houseId: expense.houseId,
    data: { comment: sanitizeForFirestore(comment) as unknown as Record<string, unknown> },
  }, uid);
};

export const syncDeleteExpenseComment = async (expense: Expense, commentId: string): Promise<SyncResult> => syncMutation({
  collection: 'expenses', id: expense.id, operation: 'set', mutationType: 'comment-delete', houseId: expense.houseId,
  data: { commentId },
});

export const syncSaveSettlement = async (settlement: Settlement, houseId?: string | null): Promise<SyncResult> => {
  if (settlement.status === 'completed' && isFirebaseConfigured) return resultFor('disabled');
  const dataToSave = houseId ? { ...settlement, houseId } : settlement;
  return syncMutation({
    collection: 'settlements', id: settlement.id, operation: 'set', mutationType: 'document', ...(houseId ? { houseId } : {}),
    data: sanitizeForFirestore(dataToSave) as unknown as Record<string, unknown>, writeMode: 'replace',
  });
};

export const syncConfirmSettlement = async (
  houseId: string,
  ledgerRevision: number,
  transaction: { id: string; fromUserId: string; toUserId: string; amountCents: number },
  proofUrl?: string,
): Promise<Settlement> => {
  if (!isFirebaseConfigured || !db) throw new Error('Cloud settlement confirmation is unavailable.');
  const callable = callableFunctions();
  if (!callable) throw new Error('Cloud functions are unavailable.');
  const result = await httpsCallable<{
    houseId: string;
    expectedLedgerRevision: number;
    recommendationId: string;
    fromUserId: string;
    toUserId: string;
    amountCents: number;
    proofUrl?: string;
  }, { settlement: Settlement }>(callable, 'confirmSettlement')({
    houseId,
    expectedLedgerRevision: ledgerRevision,
    recommendationId: transaction.id,
    fromUserId: transaction.fromUserId,
    toUserId: transaction.toUserId,
    amountCents: transaction.amountCents,
    ...(proofUrl ? { proofUrl } : {}),
  });
  return result.data.settlement;
};

export const syncDeleteSettlement = async (settlementId: string): Promise<SyncResult> => syncMutation({
  collection: 'settlements', id: settlementId, operation: 'delete', mutationType: 'document', writeMode: 'replace',
});

export const syncDeleteHouseSettlement = async (settlementId: string, houseId: string): Promise<SyncResult> => syncMutation({
  collection: 'settlements', id: settlementId, operation: 'delete', mutationType: 'document', houseId, data: { houseId }, writeMode: 'replace',
});

export const syncSaveCard = async (card: PaymentCard, houseId?: string | null): Promise<SyncResult> => {
  const dataToSave = houseId ? { ...card, houseId } : card;
  return syncMutation({
    collection: 'cards', id: card.id, operation: 'set', mutationType: 'document', ...(houseId ? { houseId } : {}),
    data: sanitizeForFirestore(dataToSave) as unknown as Record<string, unknown>, writeMode: 'replace',
  });
};

export const syncDeleteCard = async (cardId: string): Promise<SyncResult> => syncMutation({
  collection: 'cards', id: cardId, operation: 'delete', mutationType: 'document', writeMode: 'replace',
});

export const subscribeHouse = (
  houseId: string,
  onUpdate: (house: House | null) => void,
  onError?: (error: unknown) => void,
): (() => void) => {
  if (!isFirebaseConfigured || !db || !houseId) return () => {};
  try {
    return onSnapshot(
      doc(db, 'houses', houseId),
      (snapshot) => onUpdate(snapshot.exists() ? mergePending('houses', [snapshot.data() as House], currentUserUid() || undefined, houseId)[0] || null : null),
      (error) => onError?.(error),
    );
  } catch (error) {
    onError?.(error);
    return () => {};
  }
};

export const subscribeExpenses = (onUpdate: (expenses: Expense[]) => void, houseId?: string | null): (() => void) => {
  if (!isFirebaseConfigured || !db) return () => {};
  if (!houseId) { onUpdate([]); return () => {}; }
  try {
    return onSnapshot(
      query(collection(db, 'expenses'), where('houseId', '==', houseId), where('scope', '==', 'household')),
      (snapshot) => {
        const list: Expense[] = [];
        snapshot.forEach((item) => list.push(item.data() as Expense));
        onUpdate(mergePending('expenses', list, currentUserUid() || undefined, houseId));
        void flushSyncOutbox().catch(() => undefined);
      },
      () => undefined,
    );
  } catch {
    return () => {};
  }
};

export const subscribePersonalExpenses = (onUpdate: (expenses: Expense[]) => void, ownerId?: string | null): (() => void) => {
  if (!isFirebaseConfigured || !db) return () => {};
  if (!ownerId) { onUpdate([]); return () => {}; }
  try {
    return onSnapshot(
      query(collection(db, 'expenses'), where('ownerId', '==', ownerId), where('scope', '==', 'personal')),
      (snapshot) => {
        const list: Expense[] = [];
        snapshot.forEach((item) => list.push(item.data() as Expense));
        onUpdate(mergePending('expenses', list, ownerId, undefined));
        void flushSyncOutbox().catch(() => undefined);
      },
      () => undefined,
    );
  } catch {
    return () => {};
  }
};

export const subscribeSettlements = (onUpdate: (settlements: Settlement[]) => void, houseId?: string | null): (() => void) => {
  if (!isFirebaseConfigured || !db) return () => {};
  if (!houseId) { onUpdate([]); return () => {}; }
  try {
    return onSnapshot(
      query(collection(db, 'settlements'), where('houseId', '==', houseId)),
      (snapshot) => {
        const list: Settlement[] = [];
        snapshot.forEach((item) => list.push(item.data() as Settlement));
        onUpdate(mergePending('settlements', list, currentUserUid() || undefined, houseId));
        void flushSyncOutbox().catch(() => undefined);
      },
      () => undefined,
    );
  } catch {
    return () => {};
  }
};

export const subscribeCards = (
  onUpdate: (cards: PaymentCard[]) => void,
  houseId?: string | null,
  ownerId?: string | null,
): (() => void) => {
  if (!isFirebaseConfigured || !db) return () => {};
  try {
    const reference = collection(db, 'cards');
    const cardQuery = houseId ? query(reference, where('houseId', '==', houseId))
      : ownerId ? query(reference, where('ownerId', '==', ownerId)) : reference;
    return onSnapshot(
      cardQuery,
      (snapshot) => {
        const list: PaymentCard[] = [];
        snapshot.forEach((item) => list.push(item.data() as PaymentCard));
        onUpdate(mergePending('cards', list, ownerId || currentUserUid() || undefined, houseId));
        void flushSyncOutbox().catch(() => undefined);
      },
      () => undefined,
    );
  } catch {
    return () => {};
  }
};
