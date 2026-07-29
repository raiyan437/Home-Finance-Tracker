import type { User, UserId, Expense, Settlement, UserBalance, SimplifiedTransaction, House } from '../types';

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

/**
 * Returns the list of User objects for members in the active house.
 * Defaults to ALL_USERS if no house or empty roster.
 */
export const getHouseUsers = (house?: House | null): User[] => {
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
  return ALL_USERS;
};

/**
 * Computes net balances for house members dynamically.
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

  // Helper for strict UID / ID lookup
  const findUserKey = (targetIdStr: string) => {
    if (!targetIdStr) return undefined;
    if (totals[targetIdStr]) return targetIdStr;
    const targetClean = targetIdStr.toLowerCase().trim();
    return Object.keys(totals).find((k) => {
      const u = usersMap[k];
      if (!u) return false;
      return (
        k.toLowerCase() === targetClean ||
        (u.uid && u.uid.toLowerCase() === targetClean) ||
        (u.id && u.id.toLowerCase() === targetClean) ||
        u.name.toLowerCase().trim() === targetClean
      );
    });
  };

  // 1. Process active expenses strictly by UID / ID
  expenses.forEach((exp) => {
    const payerKey = findUserKey(exp.paidBy);
    if (payerKey) {
      totals[payerKey].paid += exp.amountCents;
    }

    exp.shares.forEach((share) => {
      const shareKey = findUserKey(share.userId);
      if (shareKey) {
        totals[shareKey].share += share.amountCents;
      }
    });
  });

  // 2. Process completed settlements strictly by UID / ID
  settlements.forEach((st) => {
    if (st.status === 'completed') {
      const fromKey = findUserKey(st.fromUserId);
      const toKey = findUserKey(st.toUserId);

      if (fromKey) totals[fromKey].settlementDelta += st.amountCents;
      if (toKey) totals[toKey].settlementDelta -= st.amountCents;
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

  return result;
};

/**
 * Solves the Minimum Cash Flow Problem for active house members.
 */
export const calculateSimplifiedSettlements = (
  userBalances: Record<UserId, UserBalance>,
  activeUsers: User[] = ALL_USERS
): SimplifiedTransaction[] => {
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
