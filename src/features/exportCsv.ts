import type { Expense, Settlement } from '../types';
import { USERS } from './settlementEngine';
import { loadUsersDB } from '../services/mockAuthDatabase';

/**
 * Converts expenses and settlements to a formatted CSV file and triggers a browser download.
 */
export const exportAuditReportCsv = (expenses: Expense[], settlements: Settlement[] = [], filename = 'household_finance_report.csv') => {
  const usersDB = loadUsersDB();
  const getName = (id: string) => {
    if (USERS[id]?.name) return USERS[id].name;
    const u = usersDB.find((usr) => usr.uid === id);
    if (u?.displayName) return u.displayName;
    return id;
  };

  const headers = [
    'Type',
    'ID',
    'Date',
    'Title / Description',
    'Category',
    'Paid By',
    'Amount (৳)',
    'Split Method',
    'Payment Channel',
    'Card ID',
    'Card Snapshot',
    'Shares',
    'Status',
    'Reversed At',
    'Reversed By',
    'Attachment',
    'Scope',
    'Notes',
  ];

  const rows: string[][] = [];

  // 1. Process Expenses
  expenses.forEach((e) => {
    const payerName = getName(e.paidBy);
    const amountDollars = (e.amountCents / 100).toFixed(2);
    const channel = e.paymentMethod?.type === 'card' ? 'Bank Card' : 'Cash';
    const scopeLabel = e.scope === 'personal' ? 'Personal' : 'Household';

    rows.push([
      'Expense',
      e.id,
      e.date,
      e.title,
      e.category,
      payerName,
      amountDollars,
      e.splitMethod,
      channel,
      e.paymentMethod?.cardId || '',
      e.paymentMethod?.cardName || '',
      e.shares.map((share) => `${getName(share.userId)}:${(share.amountCents / 100).toFixed(2)}${share.percentage === undefined ? '' : ` (${share.percentage}%)`}`).join(' | '),
      'posted',
      '',
      '',
      e.receiptUrl || '',
      scopeLabel,
      e.notes || '',
    ]);
  });

  // 2. Process Settlements
  settlements.forEach((s) => {
    const fromName = getName(s.fromUserId);
    const toName = getName(s.toUserId);
    const amountDollars = (s.amountCents / 100).toFixed(2);
    const dateStr = s.settledAt ? s.settledAt.split('T')[0] : '';

    rows.push([
      'Settlement Transfer',
      s.id,
      dateStr,
      `${fromName} paid ${toName}`,
      'Settlement',
      fromName,
      amountDollars,
      'Direct',
      'Unspecified peer transfer',
      '',
      '',
      '',
      s.status,
      s.reversedAt || '',
      s.reversedBy ? getName(s.reversedBy) : '',
      s.proofUrl || '',
      'Household',
      s.notes || '',
    ]);
  });

  // Construct CSV content
  const escapeCsv = (value: string): string => `"${value.replace(/"/g, '""')}"`;
  const csvString = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');

  // Trigger download
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
