import type { User, UserId, Expense, Settlement, UserBalance, SimplifiedTransaction, House, HouseMember, UserProfile } from '../types';

export const USERS: Record<UserId, User> = {
  raiyan: {
    id: 'raiyan',
    name: 'Raiyan',
    avatar: undefined,
    color: '#3b82f6', // Ocean Blue
  },
  himel: {
    id: 'himel',
    name: 'Himel',
    avatar: undefined,
    color: '#10b981', // Emerald Green
  },
  lazim: {
    id: 'lazim',
    name: 'Lazim',
    avatar: undefined,
    color: '#8b5cf6', // Violet Purple
  },
};

export const ALL_USERS: User[] = Object.values(USERS);

export const LEGACY_USER: User = {
  id: 'legacy_departed',
  name: 'Departed Member',
  avatar: undefined,
  color: '#6b7280', // Gray
};

/**
 * Returns a resilient, UID-ordered roster by merging the two denormalized
 * house indexes. Firestore writes the UI `members` list and rule-verifiable
 * `memberMap` together, but a cross-device listener can observe them between
 * writes or encounter an older document that only has one index.
 */
export const getCanonicalHouseMembers = (house: House): HouseMember[] => {
  const members = Array.isArray(house.members) ? house.members : [];
  const membersByUid = new Map(members.map((member) => [member.uid, member]));
  const indexedMembers = house.memberMap || {};
  const orderedUids = Array.from(new Set([
    ...(house.memberUids || []),
    ...members.map((member) => member.uid),
    ...Object.keys(indexedMembers),
  ]));

  return orderedUids
    .map((uid) => {
      const member = membersByUid.get(uid);
      const indexedMember = indexedMembers[uid];
      if (!member && !indexedMember) return null;
      if (!member) return indexedMember ?? null;
      if (!indexedMember) return member;
      return {
        ...indexedMember,
        ...member,
        // Prefer whichever index has a usable photo while preserving the
        // member list as the primary source for all other display fields.
        ...(member.avatarRemovedAt ? { avatar: undefined } : member.avatar || !indexedMember.avatar ? {} : { avatar: indexedMember.avatar }),
      };
    })
    .filter((member): member is HouseMember => Boolean(member));
};

/**
 * Returns the list of User objects for members in the active house.
 * If user is not in any house, returns only that logged-in user.
 */
export const getHouseUsers = (
  house?: House | null,
  currentUser?: UserProfile | User | null
): User[] => {
  if (house && (house.members?.length || Object.keys(house.memberMap || {}).length)) {
    const canonicalMembers = getCanonicalHouseMembers(house);
    return canonicalMembers.map((m) => {
      const isCurrent = currentUser && (m.uid === (currentUser as any).uid || m.email === (currentUser as any).email);
      const resolvedName = (isCurrent && (currentUser as any).displayName) || m.displayName || m.email?.split('@')[0] || 'Member';
      const rawAvatar = isCurrent && !m.avatarRemovedAt ? (currentUser as any).avatar : m.avatar;

      const hasCustomPhoto =
        typeof rawAvatar === 'string' &&
        rawAvatar.trim().length > 0 &&
        (rawAvatar.startsWith('data:') ||
         rawAvatar.startsWith('http:') ||
         rawAvatar.startsWith('https:') ||
         rawAvatar.startsWith('blob:') ||
         rawAvatar.includes('/'));

      return {
        id: m.uid,
        name: resolvedName,
        avatar: hasCustomPhoto ? rawAvatar : undefined,
        color: '#3b82f6',
        email: m.email,
        uid: m.uid,
      };
    });
  }

  // If user is logged in but not in any house, return ONLY that user
  if (currentUser) {
    const nameStr = (currentUser as any).displayName || (currentUser as any).name || (currentUser as any).email?.split('@')[0] || 'User';
    const userAvatar = (currentUser as any).avatar;
    const hasCustomPhoto =
      typeof userAvatar === 'string' &&
      (userAvatar.startsWith('data:') || userAvatar.startsWith('http') || userAvatar.includes('/'));

    return [
      {
        id: (currentUser as any).uid || (currentUser as any).id || 'user',
        name: nameStr,
        avatar: hasCustomPhoto ? userAvatar : undefined,
        color: '#3b82f6',
        email: (currentUser as any).email,
        uid: (currentUser as any).uid,
      },
    ];
  }

  return [];
};

/**
 * Computes net balances for house members dynamically.
 * Keeps every departed identity separate so unrelated obligations can never cancel.
 */
export const calculateNetBalances = (
  expenses: Expense[],
  settlements: Settlement[] = [],
  activeUsers: User[] = ALL_USERS
): Record<UserId, UserBalance> => {
  const usersMap: Record<string, User> = {};
  const totals: Record<string, { paid: number; share: number; settlementDelta: number }> = {};

  activeUsers.forEach((u) => {
    const key = u.id;
    usersMap[key] = u;
    totals[key] = { paid: 0, share: 0, settlementDelta: 0 };
  });

  // UID/ID is the only accounting identity. Display names and email prefixes are
  // intentionally not aliases because they are mutable and may not be unique.
  const findUserKey = (targetIdStr: string): string => {
    const rawIdentity = targetIdStr?.trim() || 'unknown';
    const departedIdentity = rawIdentity.startsWith('departed:')
      ? rawIdentity.slice('departed:'.length)
      : rawIdentity;
    if (totals[targetIdStr]) return targetIdStr;
    const canonicalLegacyKey = `departed:${departedIdentity}`;
    if (!totals[canonicalLegacyKey]) {
      totals[canonicalLegacyKey] = { paid: 0, share: 0, settlementDelta: 0 };
      usersMap[canonicalLegacyKey] = {
        ...LEGACY_USER,
        id: canonicalLegacyKey,
        name: departedIdentity === 'unknown' ? 'Unknown departed member' : `Departed: ${departedIdentity}`,
      };
    }
    return canonicalLegacyKey;
  };

  // 1. Process active expenses strictly by UID / ID
  expenses.forEach((exp) => {
    const payerKey = findUserKey(exp.paidBy);
    totals[payerKey].paid += exp.amountCents;

    exp.shares.forEach((share) => {
      const shareKey = findUserKey(share.userId);
      totals[shareKey].share += share.amountCents;
    });
  });

  // 2. Process completed settlements strictly by UID / ID (ignoring 'reversed' status)
  settlements.forEach((st) => {
    if (st.status === 'completed') {
      const fromKey = findUserKey(st.fromUserId);
      const toKey = findUserKey(st.toUserId);

      totals[fromKey].settlementDelta += st.amountCents;
      totals[toKey].settlementDelta -= st.amountCents;
    }
  });

  // 3. Assemble UserBalance records
  const result: Record<UserId, UserBalance> = {};

  activeUsers.forEach((u) => {
    const { paid, share, settlementDelta } = totals[u.id] || { paid: 0, share: 0, settlementDelta: 0 };
    const net = paid - share + settlementDelta;

    result[u.id] = {
      user: u,
      totalPaidCents: paid,
      totalShareCents: share,
      netBalanceCents: net,
    };
  });

  Object.entries(totals)
    .filter(([key]) => key.startsWith('departed:'))
    .forEach(([key, value]) => {
      if (value.paid || value.share || value.settlementDelta) {
        result[key] = {
          user: usersMap[key],
          totalPaidCents: value.paid,
          totalShareCents: value.share,
          netBalanceCents: value.paid - value.share + value.settlementDelta,
        };
      }
    });

  assertZeroSumBalances(result);

  return result;
};

/** Every payment is a transfer, so the household net ledger must sum to zero. */
export const assertZeroSumBalances = (balances: Record<UserId, UserBalance>): void => {
  const total = Object.values(balances).reduce((sum, balance) => sum + balance.netBalanceCents, 0);
  if (!Number.isSafeInteger(total) || total !== 0) {
    throw new Error('Household balances must preserve a zero-sum integer-cent invariant.');
  }
};

/**
 * Solves the Minimum Cash Flow Problem for active house members.
 */
export const calculateSimplifiedSettlements = (
  userBalances: Record<UserId, UserBalance>,
  activeUsers: User[] = ALL_USERS
): SimplifiedTransaction[] => {
  const includedUsers = [...activeUsers];
  Object.values(userBalances).forEach((balance) => {
    if (!includedUsers.some((user) => user.id === balance.user.id)) includedUsers.push(balance.user);
  });

  if (includedUsers.length < 2) {
    return [];
  }

  const balances: { userId: UserId; user: User; net: number }[] = includedUsers.map((u) => ({
    userId: u.id,
    user: u,
    net: userBalances[u.id]?.netBalanceCents || 0,
  }));

  const transactions: SimplifiedTransaction[] = [];
  let step = 1;

  while (true) {
    balances.sort((a, b) => a.net - b.net);

    if (balances.length < 2) break;

    const maxDebtor = balances[0];
    const maxCreditor = balances[balances.length - 1];

    if (Math.abs(maxDebtor.net) < 1 && Math.abs(maxCreditor.net) < 1) {
      break;
    }

    const transferAmount = Math.min(-maxDebtor.net, maxCreditor.net);
    if (transferAmount < 1) break;

    transactions.push({
      id: `sim-${step++}-${maxDebtor.userId}-${maxCreditor.userId}`,
      fromUser: maxDebtor.user,
      toUser: maxCreditor.user,
      amountCents: transferAmount,
    });

    maxDebtor.net += transferAmount;
    maxCreditor.net -= transferAmount;
  }

  return transactions;
};
