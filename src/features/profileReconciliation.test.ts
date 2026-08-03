import { describe, expect, it } from 'vitest';
import type { UserProfile } from '../types';
import {
  createProfileFromIdentity,
  mergeProfileIntoCache,
  normalizeCloudProfile,
} from './profileReconciliation';

const identity = {
  uid: 'firebase-uid',
  email: 'Person@Example.com',
  displayName: null,
  photoURL: null,
  creationTime: '2026-01-01T00:00:00.000Z',
};

describe('cross-device profile reconciliation', () => {
  it('preserves canonical cloud household membership over a blank device cache', () => {
    const profile = normalizeCloudProfile(identity, {
      displayName: 'Cloud Person',
      email: 'person@example.com',
      houseId: 'house-live',
      role: 'member',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(profile).toMatchObject({
      uid: 'firebase-uid',
      email: 'person@example.com',
      houseId: 'house-live',
      role: 'member',
    });
  });

  it('never carries a stale local household to a newly created Firebase UID', () => {
    expect(createProfileFromIdentity(identity)).toMatchObject({
      uid: 'firebase-uid',
      houseId: null,
      role: null,
    });
  });

  it('replaces stale same-email and same-UID cache records with the cloud profile', () => {
    const staleProfiles: UserProfile[] = [
      { uid: 'old-local-uid', displayName: 'Old', email: 'person@example.com', houseId: null, role: null, createdAt: 'old' },
      { uid: 'firebase-uid', displayName: 'Blank', email: 'other@example.com', houseId: null, role: null, createdAt: 'old' },
    ];
    const cloudProfile = normalizeCloudProfile(identity, {
      displayName: 'Cloud Person', houseId: 'house-live', role: 'leader', createdAt: 'cloud',
    });

    expect(mergeProfileIntoCache(staleProfiles, cloudProfile)).toEqual([cloudProfile]);
  });

  it('preserves valid personal wallet settings across devices', () => {
    const profile = normalizeCloudProfile(identity, {
      displayName: 'Cloud Person',
      walletSettings: {
        monthlyBudgetCents: 150_000,
        cashBalanceCents: 80_000,
        cashTrackedExpenseCents: 25_000,
        updatedAt: '2026-08-03T00:00:00.000Z',
      },
    });

    expect(profile.walletSettings).toEqual({
      monthlyBudgetCents: 150_000,
      cashBalanceCents: 80_000,
      cashTrackedExpenseCents: 25_000,
      updatedAt: '2026-08-03T00:00:00.000Z',
    });
  });
});
