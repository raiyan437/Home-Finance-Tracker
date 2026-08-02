import type { Expense, RecurringFrequency } from '../types';

const parseDateOnly = (value: string): { year: number; month: number; day: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
};

const formatDateOnly = (year: number, month: number, day: number): string =>
  `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

export const addRecurringPeriod = (dateValue: string, frequency: RecurringFrequency, preferredDay?: number): string | null => {
  const parsed = parseDateOnly(dateValue);
  if (!parsed) return null;
  if (frequency === 'weekly') {
    const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + 7));
    return formatDateOnly(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  const targetMonthIndex = parsed.month;
  const targetYear = parsed.year + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return formatDateOnly(targetYear, targetMonth + 1, Math.min(preferredDay || parsed.day, lastDay));
};

export const localDateKey = (date = new Date()): string =>
  formatDateOnly(date.getFullYear(), date.getMonth() + 1, date.getDate());

export interface RecurringGenerationResult {
  expenses: Expense[];
  generated: Expense[];
  updatedTemplates: Expense[];
}

export const generateDueRecurringExpenses = (
  expenses: Expense[],
  today = localDateKey(),
  nowIso = new Date().toISOString(),
  canGenerate: (template: Expense) => boolean = () => true
): RecurringGenerationResult => {
  const existingIds = new Set(expenses.map((expense) => expense.id));
  const generated: Expense[] = [];
  const templateUpdates = new Map<string, Expense>();

  expenses.forEach((template) => {
    if (!template.isRecurring || template.recurringSourceId || !canGenerate(template)) return;
    const frequency = template.recurringFrequency || 'monthly';
    const preferredDay = parseDateOnly(template.date)?.day;
    let cursor = template.lastGeneratedDate || template.date;
    let generatedCount = 0;

    while (generatedCount < 120) {
      const nextDate = addRecurringPeriod(cursor, frequency, preferredDay);
      if (!nextDate || nextDate > today) break;
      const generatedId = `exp-recur-${template.id}-${nextDate}`;
      if (!existingIds.has(generatedId)) {
        generated.push({
          ...template,
          id: generatedId,
          date: nextDate,
          isRecurring: false,
          recurringFrequency: undefined,
          lastGeneratedDate: undefined,
          recurringSourceId: template.id,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        existingIds.add(generatedId);
      }
      cursor = nextDate;
      generatedCount += 1;
    }

    if (cursor !== (template.lastGeneratedDate || template.date)) {
      templateUpdates.set(template.id, { ...template, lastGeneratedDate: cursor, updatedAt: nowIso });
    }
  });

  if (generated.length === 0 && templateUpdates.size === 0) {
    return { expenses, generated, updatedTemplates: [] };
  }

  const updatedExisting = expenses.map((expense) => templateUpdates.get(expense.id) || expense);
  return {
    expenses: [...generated, ...updatedExisting],
    generated,
    updatedTemplates: Array.from(templateUpdates.values()),
  };
};
