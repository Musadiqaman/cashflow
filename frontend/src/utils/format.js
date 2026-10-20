export const formatMoney = (minor, currency = 'PKR', compact = false) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 2,
    ...(compact ? { notation: 'compact' } : {}),
  }).format(minor / 100);
export const amountString = (minor) =>
  `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
export const dateLabel = (value, short = false) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: short ? 'short' : 'long',
    ...(short ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
export const today = (timezone = 'Asia/Karachi') =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function addDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
export const categories = {
  in: ['Sales', 'Salary', 'Freelance', 'Investment', 'Refund', 'Gift', 'Other income'],
  out: [
    'Supplies',
    'Rent',
    'Utilities',
    'Transport',
    'Food',
    'Shopping',
    'Health',
    'Other expense',
  ],
};
export const chartColors = [
  '#3a9975',
  '#99c8a5',
  '#e8b873',
  '#83aac2',
  '#b5a4d0',
  '#e49a85',
  '#a6b16d',
  '#6e9189',
];
