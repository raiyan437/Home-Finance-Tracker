const pad = (value: number): string => String(value).padStart(2, '0');

export const toLocalDateKey = (date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const toLocalMonthKey = (date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
