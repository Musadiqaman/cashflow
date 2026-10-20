import mongoose from 'mongoose';
import { connectDatabase, ensureIndexes } from '../config/database.js';
import { allModels } from '../models/index.js';
try {
  await connectDatabase({ indexes: false });
  await ensureIndexes();
  for (const model of allModels) {
    const indexes = await model.collection.indexes();
    console.log(`${model.collection.collectionName}: ${indexes.map((i) => i.name).join(', ')}`);
  }
} finally {
  await mongoose.disconnect();
}
