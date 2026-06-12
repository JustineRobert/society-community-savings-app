// services/redis.js
// Production-ready Redis client with exponential backoff, throttled logging, graceful degradation,
// and fallback to memory store if Redis is unavailable.

const Redis = require('ioredis');

// ============================================================================
// Configuration with Environment Variables
// ============================================================================
// Use REDIS_URI or REDIS_URL if provided, otherwise default to localhost Redis
const REDIS_URI = process.env.REDIS_URI || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================================================
// Connection Retry Configuration
// ============================================================================
const MIN_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const BACKOFF_MULTIPLIER = 1.5;
const MAX_RETRY_ATTEMPTS = 10;

// Throttle error logs (log only once every N seconds)
const ERROR_LOG_THROTTLE_MS = NODE_ENV === 'production' ? 30000 : 5000;

let lastErrorLog = 0;
let reconnectAttempts = 0;
let isConnecting = false;
let gracefullyDegraded = false;

/**
 * Calculate exponential backoff delay with jitter
 * @param {number} attemptCount - Number of retry attempts so far
 * @returns {number} Delay in milliseconds
 */
function getBackoffDelay(attemptCount) {
  const exponentialDelay = Math.min(
    MIN_RECONNECT_DELAY * Math.pow(BACKOFF_MULTIPLIER, attemptCount),
    MAX_RECONNECT_DELAY
  );
  // Add jitter (±10% randomness) to prevent thundering herd
  const jitter = exponentialDelay * 0.1 * (Math.random() - 0.5);
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Throttled error logging to prevent spam
 * @param {string} message - Error message
 * @param {Error} error - Error object
 */
function logErrorThrottled(message, error) {
  const now = Date.now();
  if (now - lastErrorLog > ERROR_LOG_THROTTLE_MS) {
    const errorDetails = error ? ` ${error.message || String(error)}` : '';
    console.error(`${message}${errorDetails}`);
    lastErrorLog = now;
  }
}

/**
 * Log information message
 * @param {string} message - Message to log
 */
function logInfo(message) {
  if (NODE_ENV !== 'production') {
    console.log(message);
  } else {
    // In production, only log connection state changes
    if (
      message.includes('connected') ||
      message.includes('ready') ||
      message.includes('degraded')
    ) {
      console.log(message);
    }
  }
}

// ============================================================================
// Redis Client Initialization
// ============================================================================
let redis;

try {
  redis = new Redis(REDIS_URI, {
    // ============================================================================
    // Exponential backoff + maximum delay configuration
    // ============================================================================
    retryStrategy: (times) => {
      if (times > MAX_RETRY_ATTEMPTS) {
        // Stop retrying after max attempts - will fall back to memory store
        logErrorThrottled(
          `❌ Redis connection exhausted after ${MAX_RETRY_ATTEMPTS} attempts. ` +
            `Falling back to memory store for rate limiting.`,
          null
        );
        gracefullyDegraded = true;
        return null; // null tells ioredis to stop retrying
      }

      const delay = getBackoffDelay(times - 1);
      logErrorThrottled(
        `🔄 Redis reconnection attempt ${times}/${MAX_RETRY_ATTEMPTS}, ` +
          `backing off for ${delay}ms...`,
        null
      );
      return delay;
    },

    // ============================================================================
    // Timeouts and Connection Configuration
    // ============================================================================
    connectTimeout: 10000, // 10s to establish connection
    commandTimeout: 5000, // 5s for individual commands
    enableOfflineQueue: true, // Queue commands while reconnecting
    maxRetriesPerRequest: 3, // Prevent infinite retries per command
    enableReadyCheck: true, // Wait for Redis to be ready

    // ============================================================================
    // Performance and Error Handling
    // ============================================================================
    lazyConnect: false, // Connect immediately
    autoResubscribe: true, // Resubscribe to channels after reconnect
  });

  logInfo('🔌 Redis client created');
} catch (error) {
  console.warn(
    `⚠️ Failed to create Redis client: ${error.message}. ` +
      `Redis features will be disabled; using memory store fallback.`
  );
  gracefullyDegraded = true;

  // Create a mock Redis client that gracefully handles missing Redis
  redis = {
    call: () => Promise.reject(new Error('Redis not available - using memory store')),
    on: () => {},
    off: () => {},
    status: 'mock',
    isAvailable: false,
  };
}

// ============================================================================
// Redis Event Handlers
// ============================================================================
redis.on('connect', () => {
  reconnectAttempts = 0;
  gracefullyDegraded = false;
  logInfo('✅ Redis connected');
});

redis.on('ready', () => {
  logInfo('✅ Redis ready and accepting commands');
});

redis.on('error', (err) => {
  // Throttle error logging to prevent spam
  logErrorThrottled('❌ Redis error:', err);
  // Note: We intentionally don't throw here to allow graceful degradation
});

redis.on('reconnecting', () => {
  reconnectAttempts++;
  logInfo(`🔄 Redis reconnecting (attempt ${reconnectAttempts}/${MAX_RETRY_ATTEMPTS})...`);
});

redis.on('close', () => {
  logInfo('🔌 Redis connection closed');
});

redis.on('warn', (msg) => {
  logErrorThrottled('⚠️ Redis warning:', msg);
});

// ============================================================================
// Graceful Shutdown Handlers
// ============================================================================
/**
 * Gracefully disconnect Redis on process termination
 */
async function disconnectRedis() {
  if (redis && redis.status !== 'mock' && redis.status !== 'end') {
    try {
      await redis.quit();
      logInfo('✅ Redis disconnected gracefully');
    } catch (err) {
      console.error(`❌ Error disconnecting Redis: ${err.message}`);
    }
  }
}

process.on('SIGTERM', disconnectRedis);
process.on('SIGINT', disconnectRedis);

// ============================================================================
// Helper Methods for Status Checking
// ============================================================================
/**
 * Check if Redis is available and connected
 * @returns {boolean} true if Redis is available
 */
redis.isAvailable = function () {
  return this.status === 'ready' || this.status === 'connected';
};

/**
 * Get current connection status
 * @returns {string} Status: 'ready', 'connecting', 'mock', etc.
 */
redis.getStatus = function () {
  return this.status || 'unknown';
};

module.exports = redis;
