import { z } from 'zod';
import { isDate, today, dayCount } from '../utils/dates.js';
import { AppError, parse } from '../utils/errors.js';
import { toMinor } from '../utils/money.js';
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
const date = z
  .string()
  .refine(isDate, 'Enter a valid date.')
  .refine((v) => v >= '2000-01-01', 'Use a date from the year 2000 onwards.');
const fields = {
  type: z.enum(['in', 'out']),
  amount: z.string(),
  category: z.string(),
  title: z.string().trim().min(2, 'Add a short description.').max(100),
  note: z.string().trim().max(500).default(''),
  occurredOn: date,
};
export const createSchema = z.object(fields).strict();
export const editSchema = z.object({ ...fields, version: z.number().int().min(1) }).strict();
export const voidSchema = z
  .object({
    version: z.number().int().min(1),
    reason: z.string().trim().min(3, 'Give a reason for voiding this entry.').max(200),
  })
  .strict();
export const keySchema = z.string().uuid('A valid Idempotency-Key UUID is required.');
export const idSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid entry ID.');
export const querySchema = z
  .object({
    type: z.enum(['in', 'out']).optional(),
    category: z.string().max(30).optional(),
    status: z.enum(['posted', 'void']).default('posted'),
    from: date.optional(),
    to: date.optional(),
    reference: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]*$/)
      .max(40)
      .optional(),
    cursor: z.string().max(1000).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'The start date must come before the end date.',
    path: ['from'],
  })
  .refine((v) => !v.category || (v.type && categories[v.type].includes(v.category)), {
    message: 'Choose a category matching the entry type.',
    path: ['category'],
  });
export const rangeSchema = z
  .object({ from: date, to: date })
  .strict()
  .refine((v) => v.from <= v.to && dayCount(v.from, v.to) <= 366, {
    message: 'Choose a date range of up to 366 days.',
    path: ['from'],
  });
export function entryInput(schema, body, user) {
  const data = parse(schema, body);
  if (!categories[data.type].includes(data.category))
    throw new AppError(400, 'INVALID_CATEGORY', 'Choose a category for this entry type.', {
      category: 'Choose a valid category.',
    });
  if (data.occurredOn > today(user.timezone))
    throw new AppError(400, 'FUTURE_DATE', 'Cash entries cannot be dated in the future.', {
      occurredOn: 'Use today or an earlier date.',
    });
  const amountMinor = toMinor(data.amount);
  const { amount, version, ...rest } = data;
  return { ...rest, amountMinor, ...(version ? { version } : {}) };
}
