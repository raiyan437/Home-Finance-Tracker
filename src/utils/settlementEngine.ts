import type { User, UserId, Expense, Settlement, UserBalance, SimplifiedTransaction } from '../types';

export const USERS: Record<UserId, User> = {
  raiyan: {
    id: 'raiyan',
    name: 'Raiyan',
    avatar: '/avatars/raiyan.png',
    color: '#3b82f6', // Ocean Blue
  },
  himel: {
    id: 'himel',
    name: 'Himel',
    avatar: '/avatars/himel.png',
    color: '#10b981', // Emerald Green
  },
  lazim: {
    id: 'lazim',
    name: 'Lazim',
    avatar: '/avatars/lazim.png',
    color: '#8b5cf6', // Violet Purple
  },
};

export const ALL_USERS: User[] = Object.values(USERS);

/**
 * Computes net balances for all household members given a list of expenses and settlements.
 */
export const calculateNetBalances = (
  expenses: Expense[],
  settlements: Settlement[] = []
): Record<UserId, UserBalance> => {
  const totals: Record<UserId, { paid: number; share: number; settlementDelta: number }> = {
    raiyan: { paid: 0, share: 0, settlementDelta: 0 },
    himel: { paid: 0, share: 0, settlementDelta: 0 },
    lazim: { paid: 0, share: 0, settlementDelta: 0 },
  };

  // 1. Process active expenses
  expenses.forEach((exp) => {
    if (totals[exp.paidBy]) {
      totals[exp.paidBy].paid += exp.amountCents;
    }

    exp.shares.forEach((share) => {
      if (totals[share.userId]) {
        totals[share.userId].share += share.amountCents;
      }
    });
  });

  // 2. Process completed settlements
  settlements.forEach((st) => {
    if (st.status === 'completed') {
      if (totals[st.fromUserId]) {
        totals[st.fromUserId].settlementDelta += st.amountCents;
      }
      if (totals[st.toUserId]) {
        totals[st.toUserId].settlementDelta -= st.amountCents;
      }
    }
  });

  // 3. Assemble UserBalance records
  const result: Record<UserId, UserBalance> = {
    raiyan: {} as UserBalance,
    himel: {} as UserBalance,
    lazim: {} as UserBalance,
  };

  (Object.keys(USERS) as UserId[]).forEach((userId) => {
    const { paid, share, settlementDelta } = totals[userId];
    const net = paid - share + settlementDelta;

    result[userId] = {
      user: USERS[userId],
      totalPaidCents: paid,
      totalShareCents: share,
      netBalanceCents: net,
    };
  });

  return result;
};

/**
 * Solves the Minimum Cash Flow Problem to produce the optimal list of simplified settlement payments.
 */
export const calculateSimplifiedSettlements = (
  userBalances: Record<UserId, UserBalance>
): SimplifiedTransaction[] => {
  const balances: { userId: UserId; net: number }[] = (Object.keys(USERS) as UserId[]).map(
    (userId) => ({
      userId,
      net: userBalances[userId].netBalanceCents,
    })
  );

  const transactions: SimplifiedTransaction[] = [];
  let step = 1;

  while (true) {
    balances.sort((a, b) => a.net - b.net);

    const maxDebtor = balances[0];
    const maxCreditor = balances[balances.length - 1];

    if (Math.abs(maxDebtor.net) < 1 && Math.abs(maxCreditor.net) < 1) {
      break;
    }

    const transferAmount = Math.min(-maxDebtor.net, maxCreditor.net);
    if (transferAmount < 1) break;

    transactions.push({
      id: `sim-${step++}-${maxDebtor.userId}-${maxCreditor.userId}`,
      fromUser: USERS[maxDebtor.userId],
      toUser: USERS[maxCreditor.userId],
      amountCents: Math.round(transferAmount),
    });

    maxDebtor.net += transferAmount;
    maxCreditor.net -= transferAmount;
  }

  return transactions;
};
