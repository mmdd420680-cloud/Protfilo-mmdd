import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './env';

let memoryServer: MongoMemoryServer | null = null;
let connectionMode: 'external-mongodb' | 'embedded-mongodb' | 'disconnected' = 'disconnected';
let connectionError: string | null = null;

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // 1. Primary path: Connect to configured MONGODB_URI (MongoDB Atlas or self-hosted)
  if (env.MONGODB_URI && !env.MONGODB_URI.includes('YOUR_MONGODB')) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
      });
      connectionMode = 'external-mongodb';
      connectionError = null;
      console.log('[MongoDB] Connected to external MongoDB cluster.');
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      connectionError = msg;
      console.error('[MongoDB] Failed to connect to configured MONGODB_URI:', msg);
      if (env.IS_PROD) {
        throw new Error(`Production MongoDB connection failed: ${msg}`);
      }
      console.warn('[MongoDB] Falling back to embedded development MongoDB server...');
    }
  } else if (env.IS_PROD) {
    console.warn(
      '[MongoDB] MONGODB_URI is not set. Using embedded MongoDB instance so preview remains operational. Configure MONGODB_URI for persistent Atlas production storage.'
    );
  }

  // 2. Development / Preview path: Spin up real embedded MongoDB server via MongoMemoryServer
  const dbPath = path.resolve(process.cwd(), '.data', 'mongodb');
  fs.mkdirSync(dbPath, { recursive: true });
  const lockFile = path.join(dbPath, 'mongod.lock');
  const isDbPathLocked = fs.existsSync(lockFile) && fs.statSync(lockFile).size > 0;

  if (!isDbPathLocked) {
    try {
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'mahim_dev_portfolio',
          dbPath,
          storageEngine: 'wiredTiger',
        },
      });
    } catch {
      memoryServer = null;
    }
  }

  if (!memoryServer) {
    // Fallback to isolated ephemeral storage engine when .data/mongodb is locked by another process
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'mahim_dev_portfolio',
      },
    });
  }

  const uri = memoryServer.getUri('mahim_dev_portfolio');
  await mongoose.connect(uri);
  connectionMode = 'embedded-mongodb';
  connectionError = null;
  console.log('[MongoDB] Connected to embedded MongoDB instance (mahim_dev_portfolio).');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  connectionMode = 'disconnected';
}

export function getDatabaseHealth() {
  const readyState = mongoose.connection.readyState;
  const stateLabels: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    connected: readyState === 1,
    state: stateLabels[readyState] || 'unknown',
    mode: connectionMode,
    configuredExternalUri: Boolean(env.MONGODB_URI),
    databaseName: mongoose.connection.name || 'mahim_dev_portfolio',
    lastError: connectionError,
  };
}
