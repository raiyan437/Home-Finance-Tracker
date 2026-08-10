import { describe, expect, it } from 'vitest';
import type { House, HouseMember } from '../types';
import { getSparkHouseMemberIds, getSparkHouseRosterRepair } from './sparkLedger';

const joinedAt = '2026-08-04T12:00:00.000Z';
const members: HouseMember[] = [
  { uid: 'leader', displayName: 'Leader', email: 'leader@example.com', role: 'leader', joinedAt },
  { uid: 'member', displayName: 'Member', email: 'member@example.com', role: 'member', joinedAt },
];

const legacyHouse = (): House => ({
  id: 'house-1',
  code: 'HM-1000',
  name: 'Legacy House',
  leaderUid: 'leader',
  members,
  createdAt: joinedAt,
});

describe('Spark household roster repair', () => {
  it('derives missing indexes without changing membership', () => {
    const repair = getSparkHouseRosterRepair(legacyHouse());
    expect(repair?.memberUids).toEqual(['leader', 'member']);
    expect(repair?.memberMap.member).toEqual(members[1]);
    expect(getSparkHouseMemberIds({ ...legacyHouse(), ...repair })).toEqual(['leader', 'member']);
  });

  it('does not rewrite an already canonical roster', () => {
    const house = legacyHouse();
    house.memberUids = members.map((member) => member.uid);
    house.memberMap = Object.fromEntries(members.map((member) => [member.uid, member]));
    expect(getSparkHouseRosterRepair(house)).toBeNull();
  });

  it('refuses to guess when an existing membership index disagrees with members', () => {
    const house = legacyHouse();
    house.memberUids = ['leader'];
    expect(() => getSparkHouseRosterRepair(house)).toThrow('does not match');
  });
});
