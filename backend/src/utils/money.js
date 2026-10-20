import { AppError } from './errors.js';
export const MAX_TOTAL = 900_000_000_000_000;
export function toMinor(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(value))
    throw new AppError(
      400,
      'INVALID_AMOUNT',
      'Use an amount from 0.01 to 999,999,999.99 with up to two decimal places.',
    );
  const [whole, fraction = ''] = value.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount < 1)
    throw new AppError(400, 'INVALID_AMOUNT', 'The amount must be greater than zero.');
  return amount;
}
export const toDecimal = (value) =>
  `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
