import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//),
  APP_ORIGIN: z.string().url(),
  APP_SECRET: z.string().min(48),
  PROXY_SECRET: z.string().min(48).optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  AUTO_CREATE_INDEXES: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  LOG_LEVEL: z.enum(['silent', 'error', 'warn', 'info', 'debug']).default('info'),
});
const result = schema.safeParse(process.env);
if (!result.success)
  throw new Error(
    `Invalid environment fields: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}. Run npm run setup.`,
  );
export const env = result.data;
const origin = new URL(env.APP_ORIGIN);
if (origin.origin !== env.APP_ORIGIN || origin.username || origin.password)
  throw new Error('APP_ORIGIN must be an exact origin without a path or trailing slash.');
if (env.APP_SECRET.includes('replace-with'))
  throw new Error('Generate a random APP_SECRET with npm run setup.');
if (env.NODE_ENV === 'production' && origin.protocol !== 'https:')
  throw new Error('Production requires an HTTPS APP_ORIGIN.');
if (process.env.VERCEL === '1' && !env.PROXY_SECRET)
  throw new Error('Set PROXY_SECRET in both Vercel projects. See README-VERCEL.md.');
