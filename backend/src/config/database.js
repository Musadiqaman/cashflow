import mongoose from 'mongoose';
import { env } from './env.js';
import { allModels } from '../models/index.js';
import { logger } from './logger.js';
mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);
export async function ensureIndexes() {
  // Additive: never drop an existing production index automatically.
  for (const model of allModels) {
    await model.createCollection();
    await model.createIndexes();
  }
}
export async function connectDatabase({
  indexes = env.AUTO_CREATE_INDEXES,
  maxPoolSize = 25,
  minPoolSize = 2,
} = {}) {
  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize,
    minPoolSize,
    serverSelectionTimeoutMS: 10000,
    maxIdleTimeMS: 60000,
    writeConcern: { w: 'majority', j: true, wtimeoutMS: 10000 },
  });
  await mongoose.connection.db.admin().ping();
  if (indexes) await ensureIndexes();
  logger.info('MongoDB connected. Standalone MongoDB and Atlas are both supported.');
}
