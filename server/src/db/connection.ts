import mongoose from 'mongoose';
import logger from '../utils/logger';

/**
 * Opens the Mongoose connection. Called once at startup before the server listens.
 * Reads MONGO_URI env var; defaults to localhost.
 */
export async function connectDB(): Promise<void> {
  const uri = process.env['MONGO_URI'] ?? 'mongodb://127.0.0.1:27017/todolist';

  try {
    await mongoose.connect(uri);
    logger.info(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    logger.error('MongoDB connection failed', err instanceof Error ? err.message : err);
    // Re-throw so app.ts can decide whether to exit or retry
    throw err;
  }
}

/** Closes the Mongoose connection — called during graceful shutdown. */
export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
