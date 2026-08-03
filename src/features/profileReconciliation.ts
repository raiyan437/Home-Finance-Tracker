import type { HouseRole, PersonalWalletSettings, UserProfile } from '../types';

export interface AuthIdentity {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  creationTime?: string;
}

const isRole = (value: unknown): value is HouseRole => value === 'leader' || value === 'member';

const normalizeWalletSettings = (value: unknown): PersonalWalletSettings | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const settings: PersonalWalletSettings = {};
  const copyCents = (key: keyof Pick<PersonalWalletSettings, 'monthlyBudgetCents' | 'cashBalanceCents' | 'cashTrackedExpenseCents'>) => {
    const amount = raw[key];
    if (typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0) settings[key] = amount;
  };
  copyCents('monthlyBudgetCents');
  copyCents('cashBalanceCents');
  copyCents('cashTrackedExpenseCents');
  if (typeof raw.updatedAt === 'string') settings.updatedAt = raw.updatedAt;
  return Object.keys(settings).length > 0 ? settings : undefined;
};

export const createProfileFromIdentity = (
  identity: AuthIdentity,
  now = new Date().toISOString()
): UserProfile => {
  const email = identity.email?.trim().toLowerCase() ?? '';
  return {
    uid: identity.uid,
    displayName: identity.displayName?.trim() || email.split('@')[0] || 'User',
    email,
    ...(identity.photoURL ? { avatar: identity.photoURL } : {}),
    houseId: null,
    role: null,
    createdAt: identity.creationTime || now,
  };
};

export const normalizeCloudProfile = (
  identity: AuthIdentity,
  rawProfile: Partial<UserProfile>,
  now = new Date().toISOString()
): UserProfile => {
  const fallback = createProfileFromIdentity(identity, now);
  const houseId = typeof rawProfile.houseId === 'string' && rawProfile.houseId.trim()
    ? rawProfile.houseId
    : null;
  const walletSettings = normalizeWalletSettings(rawProfile.walletSettings);

  return {
    uid: identity.uid,
    displayName: rawProfile.displayName?.trim() || fallback.displayName,
    email: identity.email?.trim().toLowerCase() || rawProfile.email?.trim().toLowerCase() || '',
    ...(rawProfile.avatar || fallback.avatar ? { avatar: rawProfile.avatar || fallback.avatar } : {}),
    houseId,
    role: houseId && isRole(rawProfile.role) ? rawProfile.role : null,
    ...(walletSettings ? { walletSettings } : {}),
    createdAt: rawProfile.createdAt || fallback.createdAt,
  };
};

export const mergeProfileIntoCache = (
  profiles: UserProfile[],
  profile: UserProfile
): UserProfile[] => [
  ...profiles.filter(
    (candidate) => candidate.uid !== profile.uid
      && candidate.email.trim().toLowerCase() !== profile.email.trim().toLowerCase()
  ),
  profile,
];
