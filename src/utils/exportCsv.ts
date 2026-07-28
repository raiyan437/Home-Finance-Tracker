import type { Expense, Settlement } from '../types';
import { USERS } from '../utils/settlementEngine';

/**
 * Converts expenses and settlements to a formatted CSV file and triggers a browser download.
 */
export const exportAuditReportCsv = (expenses: Expense[], settlements: Settlement[] = [], filename = 'household_finance_report.csv') => {
  const headers = [
    'Type',
    'ID',
    'Date',
    'Title / Description',
    'Category',
    'Paid By',
    'Amount ($)',
    'Split Method',
    'Payment Channel',
    'Scope',
    'Notes',
  ];

  const rows: string[][] = [];

  // 1. Process Expenses
  expenses.forEach((e) => {
    const payerName = USERS[e.paidBy]?.name || e.paidBy;
    const amountDollars = (e.amountCents / 100).toFixed(2);
    const channel = e.paymentMethod?.type === 'card' ? 'Bank Card' : 'Cash';
    const scopeLabel = e.scope === 'personal' ? 'Personal' : 'Household';

    rows.push([
      'Expense',
      e.id,
      e.date,
      `"${e.title.replace(/"/g, '""')}"`,
      e.category,
      payerName,
      amountDollars,
      e.splitMethod,
      channel,
      scopeLabel,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);
  });

  // 2. Process Settlements
  settlements.forEach((s) => {
    const fromName = USERS[s.fromUserId]?.name || s.fromUserId;
    const toName = USERS[s.toUserId]?.name || s.toUserId;
    const amountDollars = (s.amountCents / 100).toFixed(2);
    const dateStr = s.settledAt ? s.settledAt.split('T')[0] : '';

    rows.push([
      'Settlement Transfer',
      s.id,
      dateStr,
      `"${fromName} paid ${toName}"`,
      'Settlement',
      fromName,
      amountDollars,
      'Direct',
      'Bank Transfer',
      'Household',
      `"${(s.notes || '').replace(/"/g, '""')}"`,
    ]);
  });

  // Construct CSV content
  const csvString = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

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
