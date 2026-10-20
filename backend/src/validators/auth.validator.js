import { z } from 'zod';
export const timezones = [
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Europe/London',
  'America/New_York',
  'UTC',
];
export const name = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters.')
  .max(80)
  .regex(/^[^\x00-\x1f\x7f]+$/, 'Remove control characters.');
export const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
export const password = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128, 'Use at most 128 characters.');
export const registerSchema = z
  .object({
    name,
    email,
    password,
    currency: z.enum(['PKR', 'USD', 'AED', 'GBP', 'EUR', 'INR']).default('PKR'),
    timezone: z.enum(timezones).default('Asia/Karachi'),
  })
  .strict();
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const profileSchema = z.object({ name, timezone: z.enum(timezones) }).strict();
export const passwordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
  .strict()
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'Choose a different password.',
  });
