import { describe, expect, it } from 'vitest';
import type { House } from '../types';
import { getCanonicalHouseMembers, getHouseUsers } from './settlementEngine';

const baseHouse = (): House => ({
  id: 'house-live',
  code: 'HM-1234',
  name: 'Demo House',
  leaderUid: 'leader-uid',
  members: [
    {
      uid: 'leader-uid',
      displayName: 'Leader',
      email: 'leader@example.com',
      role: 'leader',
      joinedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      uid: 'member-uid',
      displayName: 'Member',
      email: 'member@example.com',
      role: 'member',
      joinedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  memberUids: ['leader-uid', 'member-uid'],
  memberMap: {},
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('house member avatar resolution', () => {
  it('keeps an avatar present only in the shared member roster', () => {
    const house = baseHouse();
    house.memberMap = Object.fromEntries(house.members.map((member) => [member.uid, member]));
    house.memberMap['member-uid'] = { ...house.memberMap['member-uid'], avatar: 'data:image/webp;base64,memberphoto' };

    const member = getHouseUsers(house).find((user) => user.id === 'member-uid');

    expect(member?.avatar).toBe('data:image/webp;base64,memberphoto');
  });

  it('does not resurrect a stale memberMap avatar after a removal tombstone', () => {
    const house = baseHouse();
    house.members[1].avatarRemovedAt = '2026-08-04T12:00:00.000Z';
    house.memberMap = Object.fromEntries(house.members.map((member) => [member.uid, { ...member, avatar: member.uid === 'member-uid' ? 'stale-avatar' : member.avatar }]));

    expect(getCanonicalHouseMembers(house).find((member) => member.uid === 'member-uid')?.avatar).toBeUndefined();
    expect(getHouseUsers(house).find((user) => user.id === 'member-uid')?.avatar).toBeUndefined();
  });

  it('falls back to the member list when the denormalized index is stale', () => {
    const house = baseHouse();
    house.members[1].avatar = 'data:image/webp;base64,memberphoto';
    house.memberMap = Object.fromEntries(house.members.map((member) => [member.uid, { ...member, avatar: undefined }]));

    const member = getHouseUsers(house).find((user) => user.id === 'member-uid');

    expect(member?.avatar).toBe('data:image/webp;base64,memberphoto');
  });
});
