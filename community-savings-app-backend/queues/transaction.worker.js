// backend/workers/transaction.worker.js
"use strict";

const { Worker, QueueScheduler } = require("bullmq");
const IORedis = require("ioredis");
const { createTransaction } = require("../modules/transaction/transaction.service");
const logger = require("../utils/logger") || console;

// ✅ Redis connection
const connection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS === "true" ? {} : undefined,
});

// ✅ QueueScheduler ensures retries/delays work
const scheduler = new QueueScheduler("transactions", { connection });

// ✅ Worker definition
const worker = new Worker(
  "transactions",
  async (job) => {
    const { tenantId, type, amount, idempotencyKey } = job.data;
    const start = Date.now();

    try {
      logger.info("[TransactionWorker] Processing job", {
        jobId: job.id,
        tenantId,
        type,
        amount,
        idempotencyKey,
      });

      await createTransaction({ tenantId, type, amount, idempotencyKey });

      logger.info("[TransactionWorker] Job completed", {
        jobId: job.id,
        durationMs: Date.now() - start,
      });

      return { success: true };
    } catch (err) {
      logger.error("[TransactionWorker] Job failed", {
        jobId: job.id,
        error: err.message,
        stack: err.stack,
      });
      throw err; // let BullMQ handle retries/backoff
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.TRANSACTION_WORKER_CONCURRENCY || "5", 10),
  }
);

// ✅ Lifecycle listeners
worker.on("completed", (job) => {
  logger.info("[TransactionWorker] Completed", { jobId: job.id });
});

worker.on("failed", (job, err) => {
  logger.warn("[TransactionWorker] Failed", {
    jobId: job?.id,
    attemptsMade: job?.attemptsMade,
    reason: err?.message,
  });
});

worker.on("error", (err) => {
  logger.error("[TransactionWorker] Worker error", { error: err.message });
});

// ✅ Graceful shutdown
const shutdown = async (signal) => {
  try {
    logger.info("[TransactionWorker] Shutting down", { signal });
    await worker.close();
    await scheduler.close();
    await connection.quit();
    logger.info("[TransactionWorker] Shutdown complete");
  } catch (err) {
    logger.error("[TransactionWorker] Shutdown error", { error: err.message });
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = { worker, shutdown };
