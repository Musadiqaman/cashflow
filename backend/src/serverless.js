import express from 'express';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { logger } from './config/logger.js';

// One initialization promise and a bounded pool per warm function instance.
// Failed initialization is retried on a later request. Never disconnect after
// each response: concurrent requests can share this instance and its pool.
export function createServerlessApp({
  connect = () => connectDatabase({ maxPoolSize: 10, minPoolSize: 0 }),
} = {}) {
  let initialization;
  const app = express();
  app.disable('x-powered-by');
  app.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    try {
      if (!initialization) {
        initialization = Promise.resolve()
          .then(connect)
          .catch((error) => {
            initialization = undefined;
            throw error;
          });
      }
      await initialization;
      next();
    } catch (error) {
      // A driver error can contain connection details; never return/log its text.
      logger.error({ errorType: error.name }, 'Database initialization failed');
      res
        .set('Retry-After', '5')
        .status(503)
        .json({
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: 'The database is temporarily unavailable. Please try again shortly.',
          },
        });
    }
  });
  app.use(createApp());
  return app;
}
