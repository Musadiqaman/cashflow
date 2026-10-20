import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { AppError } from './utils/errors.js';
import { requireTrustedMutation } from './middleware/security.js';
import { limit } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { requireProxy } from './middleware/proxy-auth.js';
import authRoutes from './routes/auth.routes.js';
import ledgerRoutes from './routes/entry.routes.js';
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.set('query parser', 'simple');
  app.use((req, res, next) => {
    req.id = randomUUID();
    res.set('X-Request-ID', req.id);
    next();
  });
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, path: req.url?.split('?')[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
        },
      },
      strictTransportSecurity:
        env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );
  app.use(
    cors({
      origin: env.APP_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'],
    }),
  );
  app.get('/health/live', (req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (req, res, next) => {
    try {
      await mongoose.connection.db.admin().ping();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
  app.use(
    '/api',
    (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    },
    requireProxy,
    requireTrustedMutation,
    express.json({ limit: '16kb' }),
    cookieParser(),
    limit('api', 300, 60000),
  );
  app.use('/api/auth', authRoutes);
  app.use('/api', ledgerRoutes);
  app.use('/api', (req, res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'API endpoint not found.')),
  );
  app.get('/', (req, res) => res.json({ name: 'Cashbook API', version: '2.0.0', status: 'ok' }));
  app.use((req, res, next) => next(new AppError(404, 'NOT_FOUND', 'Page not found.')));
  app.use(errorHandler);
  return app;
}
