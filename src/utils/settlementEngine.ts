import type { User, UserId, Expense, Settlement, UserBalance, SimplifiedTransaction, House, UserProfile } from '../types';

import raiyanAvatar from '../assets/avatars/raiyan.png';
import himelAvatar from '../assets/avatars/himel.png';
import lazimAvatar from '../assets/avatars/lazim.png';

export const USERS: Record<UserId, User> = {
  raiyan: {
    id: 'raiyan',
    name: 'Raiyan',
    avatar: raiyanAvatar,
    color: '#3b82f6', // Ocean Blue
  },
  himel: {
    id: 'himel',
    name: 'Himel',
    avatar: himelAvatar,
    color: '#10b981', // Emerald Green
  },
  lazim: {
    id: 'lazim',
    name: 'Lazim',
    avatar: lazimAvatar,
    color: '#8b5cf6', // Violet Purple
  },
};

export const ALL_USERS: User[] = Object.values(USERS);

export const LEGACY_USER: User = {
  id: 'legacy_departed',
  name: 'Departed Member',
  avatar: 'D',
  color: '#6b7280', // Gray
};

/**
 * Returns the list of User objects for members in the active house.
 * If user is not in any house, returns only that logged-in user.
 */
export const getHouseUsers = (
  house?: House | null,
  currentUser?: UserProfile | User | null
): User[] => {
  if (house && house.members && house.members.length > 0) {
    return house.members.map((m) => {
      const staticUser = Object.values(USERS).find(
        (u) => u.id === m.uid || (u as any).uid === m.uid || u.name.toLowerCase() === m.displayName.toLowerCase().trim()
      );
      const userId = m.uid || staticUser?.id || m.displayName.toLowerCase().trim();
      return {
        id: userId,
        name: m.displayName,
        avatar: staticUser?.avatar || m.avatar || m.displayName.toLowerCase().slice(0, 5),
        color: staticUser?.color || '#3b82f6',
        email: m.email,
        uid: m.uid,
      };
    });
  }

  // If user is logged in but not in any house, return ONLY that user
  if (currentUser) {
    const nameStr = (currentUser as any).displayName || (currentUser as any).name || 'User';
    const cleanName = nameStr.toLowerCase().trim();
    const staticUser = USERS[cleanName] || Object.values(USERS).find((u) => u.name.toLowerCase() === cleanName);
    const userId = (currentUser as any).uid || (currentUser as any).id || staticUser?.id || cleanName || 'user';
    return [
      {
        id: userId,
        name: nameStr,
        avatar: staticUser?.avatar || (currentUser as any).avatar || nameStr.slice(0, 5),
        color: staticUser?.color || '#3b82f6',
        email: (currentUser as any).email,
        uid: (currentUser as any).uid,
      },
    ];
  }

  return ALL_USERS;
};

/**
 * Computes net balances for house members dynamically.
 * Isolates departed / legacy members under LEGACY_USER so sum(Net) = 0.
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

  totals[LEGACY_USER.id] = { paid: 0, share: 0, settlementDelta: 0 };
  usersMap[LEGACY_USER.id] = LEGACY_USER;

  // Helper for strict UID / ID lookup
  const findUserKey = (targetIdStr: string): string => {
    if (!targetIdStr) return LEGACY_USER.id;
    if (totals[targetIdStr]) return targetIdStr;
    const targetClean = targetIdStr.toLowerCase().trim();
    const found = Object.keys(totals).find((k) => {
      const u = usersMap[k];
      if (!u) return false;
      return (
        k.toLowerCase() === targetClean ||
        (u.uid && u.uid.toLowerCase() === targetClean) ||
        (u.id && u.id.toLowerCase() === targetClean) ||
        u.name.toLowerCase().trim() === targetClean
      );
    });
    return found || LEGACY_USER.id;
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

  // Include Legacy/Departed member pool if there are transactions attached to former members
  const legacyTotals = totals[LEGACY_USER.id];
  if (legacyTotals && (legacyTotals.paid > 0 || legacyTotals.share > 0 || legacyTotals.settlementDelta !== 0)) {
    const net = legacyTotals.paid - legacyTotals.share + legacyTotals.settlementDelta;
    result[LEGACY_USER.id] = {
      user: LEGACY_USER,
      totalPaidCents: legacyTotals.paid,
      totalShareCents: legacyTotals.share,
      netBalanceCents: net,
    };
  }

  return result;
};

/**
 * Solves the Minimum Cash Flow Problem for active house members.
 */
export const calculateSimplifiedSettlements = (
  userBalances: Record<UserId, UserBalance>,
  activeUsers: User[] = ALL_USERS
): SimplifiedTransaction[] => {
  if (!activeUsers || activeUsers.length < 2) {
    return [];
  }

  const balances: { userId: UserId; user: User; net: number }[] = activeUsers.map((u) => ({
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
      amountCents: Math.round(transferAmount),
    });

    maxDebtor.net += transferAmount;
    maxCreditor.net -= transferAmount;
  }

  return transactions;
};
