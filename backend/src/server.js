import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase } from './config/database.js';
import { createApp } from './app.js';
try {
  await connectDatabase();
  const server = createApp().listen(env.PORT, () =>
    logger.info({ port: env.PORT }, 'Cashbook API ready'),
  );
  server.requestTimeout = 30000;
  server.headersTimeout = 35000;
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    logger.info('Graceful shutdown');
    const timer = setTimeout(() => process.exit(1), 15000);
    timer.unref();
    server.close(async () => {
      await mongoose.disconnect();
      clearTimeout(timer);
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (error) {
  logger.fatal({ message: error.message }, 'Startup failed');
  process.exit(1);
}
