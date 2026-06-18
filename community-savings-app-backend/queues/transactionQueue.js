// queues/transactionQueue.js
'use strict';

import { Queue, QueueScheduler } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI || null;
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_TLS = process.env.REDIS_TLS === 'true';

const connectionOptions = REDIS_URL
  ? { connection: new IORedis(REDIS_URL) }
  : {
      connection: new IORedis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD,
        tls: REDIS_TLS ? {} : undefined,
      }),
    };

// Create a scheduler for the queue (required for delayed jobs and retries)
const transactionQueueScheduler = new QueueScheduler('transactions', connectionOptions);

// Create the queue
export const transactionQueue = new Queue('transactions', connectionOptions);

/**
 * Helper to add a job to the transactions queue with sane defaults.
 * @param {string} name - job name
 * @param {object} data - job payload
 * @param {object} opts - bullmq job options (attempts, backoff, removeOnComplete, etc.)
 */
export const addTransactionJob = async (name, data, opts = {}) => {
  const defaultOpts = {
    attempts: opts.attempts ?? 3,
    backoff: opts.backoff ?? { type: 'exponential', delay: 1000 },
    removeOnComplete: opts.removeOnComplete ?? true,
    removeOnFail: opts.removeOnFail ?? false,
    ...opts,
  };

  return transactionQueue.add(name, data, defaultOpts);
};

/**
 * Graceful shutdown for queue and scheduler
 */
export const shutdownQueues = async () => {
  try {
    await Promise.all([
      transactionQueue.close(),
      transactionQueueScheduler.close(),
    ]);
    // allow process to exit
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error shutting down transaction queue', err);
  }
};

// Optional: automatically shutdown on SIGINT/SIGTERM when this module is loaded directly
if (process.env.ENABLE_QUEUE_SHUTDOWN_HOOK !== 'false') {
  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.info(`Shutting down queues (${signal})`);
    await shutdownQueues();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
