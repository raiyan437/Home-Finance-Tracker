import { describe, expect, it } from 'vitest';
import type { UserProfile } from '../types';
import {
  createProfileFromIdentity,
  mergeProfileIntoCache,
  normalizeCloudProfile,
  normalizeDisplayName,
  normalizeEmail,
  isValidDisplayName,
  isValidEmail,
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

  it('normalizes signup identity deterministically', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com');
    expect(normalizeDisplayName('  Two   Names ')).toBe('Two Names');
    expect(isValidEmail('person@example.com')).toBe(true);
    expect(isValidDisplayName('Two Names')).toBe(true);
    expect(isValidDisplayName('   ')).toBe(false);
  });

  it('does not resurrect an Auth photo after an explicit cloud tombstone', () => {
    const profile = normalizeCloudProfile(
      { ...identity, photoURL: 'https://auth.example/photo.png' },
      { displayName: 'Cloud Person', avatarRemovedAt: '2026-08-04T12:00:00.000Z', createdAt: '2026-08-04T12:00:00.000Z' },
    );
    expect(profile.avatar).toBeUndefined();
    expect(profile.avatarRemovedAt).toBe('2026-08-04T12:00:00.000Z');
  });
});
