// config/db.js
require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// ============================================================================
// Configuration with Defaults
// ============================================================================
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://user:pass@cluster.mongodb.net/community_savings';
const MONGO_URI_FALLBACK = process.env.MONGO_URI_FALLBACK || 'mongodb://127.0.0.1:27017/community_savings';

// Graceful startup configuration
const GRACEFUL_STARTUP = process.env.GRACEFUL_STARTUP === 'true' || NODE_ENV === 'development';
const SKIP_DB_CHECKS = process.env.SKIP_DB_CHECKS === 'true';

// Connection retry configuration
const MAX_RETRIES = GRACEFUL_STARTUP ? 10 : 5;  // More retries in graceful mode
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRY_DELAY = 30000; // 30 seconds

/**
 * Detect if running in Docker environment
 * Checks for common Docker indicators:
 * - DOCKER environment variable
 * - Docker container ID in cgroup
 * - Hostname patterns
 * @returns {boolean} true if running in Docker
 */
function isDockerEnvironment() {
  // Check DOCKER environment variable
  if (process.env.DOCKER === 'true' || process.env.DOCKER === '1') {
    return true;
  }

  // Check cgroup file for Docker/container signatures
  try {
    const fs = require('fs');
    const cgroup = fs.readFileSync('/proc/self/cgroup', 'utf8');
    return /docker|container|kubernetes|kubepods/.test(cgroup);
  } catch (e) {
    // File doesn't exist on non-Linux or not in container
    return false;
  }
}

/**
 * Validate MongoDB URI format
 * - mongodb:// URIs require a port
 * - mongodb+srv:// URIs should NOT have a port (DNS SRV records handle it)
 * @param {string} uri - MongoDB URI to validate
 * @returns {object} { isValid: boolean, error: string|null, isSRV: boolean }
 */
function validateMongoURI(uri) {
  if (!uri) {
    return { isValid: false, error: 'URI is empty or undefined', isSRV: false };
  }

  const isSRV = uri.startsWith('mongodb+srv://');
  const isStandard = uri.startsWith('mongodb://');

  if (!isSRV && !isStandard) {
    return {
      isValid: false,
      error: 'Invalid URI format. Must start with mongodb:// or mongodb+srv://',
      isSRV: false,
    };
  }

  // SRV URIs should NOT have a port (DNS service records handle it)
  if (isSRV && uri.includes(':') && uri.includes('/', uri.indexOf('://') + 3)) {
    // Check if there's a port after the host but before the path
    const afterScheme = uri.substring(uri.indexOf('://') + 3);
    const hostPart = afterScheme.split('/')[0];
    if (hostPart.match(/:\d+$/)) {
      return {
        isValid: false,
        error: 'mongodb+srv:// URIs should NOT include a port number (DNS SRV records handle connection)',
        isSRV: true,
      };
    }
  }

  // Standard URIs should have a port
  if (isStandard && !uri.includes(':27017') && !uri.includes(':') && !uri.includes('@')) {
    // Skip check if auth credentials are present (they contain colons)
    return {
      isValid: true,
      error: null,
      isSRV: false,
      warning: 'Standard mongodb:// URI typically includes port (e.g., :27017)',
    };
  }

  return { isValid: true, error: null, isSRV };
}

/**
 * Mask credentials in URI for safe logging
 * Replaces password with **** in URIs
 * @param {string} uri - Full MongoDB URI
 * @returns {string} URI with masked credentials
 */
function maskCredentials(uri) {
  return uri.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1****$2');
}

/**
 * Resolve MongoDB URI based on environment and Docker detection
 * - Production: Always use MONGO_URI (Atlas SRV)
 * - Development or Docker: Use MONGO_URI_FALLBACK (local/Docker MongoDB)
 * @returns {object} { uri: string, type: string, source: string }
 */
const resolveMongoUri = () => {
  const inProduction = NODE_ENV === 'production';
  const inDocker = isDockerEnvironment();
  
  let selectedUri, uriType, source;

  if (inProduction) {
    // Production always uses Atlas
    selectedUri = MONGO_URI;
    uriType = 'MongoDB Atlas (SRV)';
    source = 'MONGO_URI';
  } else if (inDocker || NODE_ENV === 'development') {
    // Development or Docker uses local/fallback
    selectedUri = MONGO_URI_FALLBACK;
    uriType = inDocker ? 'Docker MongoDB' : 'Local MongoDB';
    source = 'MONGO_URI_FALLBACK';
  } else {
    selectedUri = MONGO_URI_FALLBACK;
    uriType = 'Local MongoDB';
    source = 'MONGO_URI_FALLBACK';
  }

  if (!selectedUri) {
    const defaultFallback = 'mongodb://127.0.0.1:27017/community_savings';
    logger.warn(
      `⚠️ ${source} not set. Using default fallback: ${maskCredentials(defaultFallback)}`
    );
    selectedUri = defaultFallback;
    source = 'DEFAULT_FALLBACK';
  }

  return {
    uri: selectedUri,
    type: uriType,
    source: source,
    masked: maskCredentials(selectedUri),
    inProduction,
    inDocker,
  };
};

let isConnecting = false;

/**
 * Calculate exponential backoff with jitter
 * @param {number} attempt - Attempt number (starting from 1)
 * @returns {number} Delay in milliseconds
 */
function getRetryDelay(attempt) {
  // Exponential backoff: 2s, 4s, 8s, 16s, 30s max
  const baseDelay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1),
    MAX_RETRY_DELAY
  );
  // Add jitter (±10% randomness) to prevent thundering herd
  const jitter = baseDelay * 0.1 * (Math.random() - 0.5);
  return Math.floor(baseDelay + jitter);
}

/**
 * Connect to MongoDB with exponential backoff retry strategy
 * Intelligently selects between MONGO_URI (production/Atlas) and
 * MONGO_URI_FALLBACK (development/Docker) based on environment.
 * @param {number} attempt - Current attempt number (starting from 1)
 */
const connectDB = async (attempt = 1) => {
  if (isConnecting && attempt > 1) return;
  if (attempt === 1) isConnecting = true;

  // Resolve URI based on environment and Docker detection
  const uriConfig = resolveMongoUri();
  const mongoUri = uriConfig.uri;

  if (!mongoUri) {
    logger.error('❌ MongoDB URI is missing. Check MONGO_URI and MONGO_URI_FALLBACK environment variables.');
    process.exit(1);
  }

  // Validate URI format
  const validation = validateMongoURI(mongoUri);
  if (!validation.isValid) {
    logger.error(`❌ Invalid MongoDB URI format: ${validation.error}`);
    logger.error(`   URI (masked): ${uriConfig.masked}`);
    logger.error(`   Type: ${uriConfig.type}`);
    logger.error(`   Source: ${uriConfig.source}`);
    process.exit(1);
  }

  if (validation.warning) {
    logger.warn(`⚠️ ${validation.warning}`);
  }

  try {
    logger.info(
      `🔌 Connecting to MongoDB (Attempt ${attempt}/${MAX_RETRIES})`
    );
    logger.info(
      `   Type: ${uriConfig.type} | Source: ${uriConfig.source}`
    );
    logger.info(
      `   URI (masked): ${uriConfig.masked}`
    );

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      // Prevent automatic index creation in production for better control
      autoIndex: NODE_ENV !== 'production',
      // SRV URIs don't need retryWrites in connection options
      retryWrites: !validation.isSRV,
    });

    logger.info(`✅ MongoDB connected successfully (${uriConfig.type})`);
    isConnecting = false;

  } catch (error) {
    isConnecting = false;
    const message = error.message || String(error);

    logger.error(
      `❌ MongoDB connection error (Attempt ${attempt}/${MAX_RETRIES}): ${message}`
    );
    logger.error(`   Type: ${uriConfig.type}`);
    logger.error(`   URI (masked): ${uriConfig.masked}`);

    // Fail fast on configuration errors
    if (
      message.includes('Invalid connection string') ||
      message.includes('Invalid scheme') ||
      message.includes('Invalid hostname') ||
      message.includes('ENOTFOUND') && attempt <= 1  // DNS resolution error on first try
    ) {
      logger.error('🛑 Invalid MongoDB URI configuration.');
      logger.error(`   Check that the URI format is correct: mongodb://host:port/db or mongodb+srv://...`);
      logger.error(`   For mongodb+srv:// URIs, ensure NO port number is specified.`);
      logger.error(`   Current source: ${uriConfig.source}`);
      process.exit(1);
    }

    // Fail fast on authentication errors (but retry network timeouts)
    if (
      message.includes('authentication failed') ||
      message.includes('auth error') ||
      message.includes('SASL authentication failed') ||
      message.includes('Invalid username')
    ) {
      logger.error('🛑 MongoDB authentication failed.');
      logger.error(`   Check credentials in ${uriConfig.source} environment variable.`);
      logger.error(`   Ensure username and password are URL-encoded if they contain special characters.`);
      logger.error(`   URI (masked): ${uriConfig.masked}`);
      process.exit(1);
    }

    // Fail fast if URI points to wrong environment
    if (message.includes('Certificate verification failed') && uriConfig.inProduction) {
      logger.error('🛑 SSL/TLS certificate verification failed.');
      logger.error(`   This typically means you're trying to connect to MongoDB Atlas from an environment`);
      logger.error(`   without proper certificate validation. Check network/firewall settings.`);
      process.exit(1);
    }

    // Retry network-related errors only
    if (attempt < MAX_RETRIES) {
      const delay = getRetryDelay(attempt);
      logger.warn(
        `🔄 Retrying MongoDB connection in ${delay / 1000}s (Attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      logger.info(`   Will attempt to connect to: ${uriConfig.type}`);

      setTimeout(() => connectDB(attempt + 1), delay);
      return;
    }

    // Final failure after all retries exhausted
    logger.error('🛑 MongoDB failed to connect after maximum retries.');
    logger.error(`   Attempted ${MAX_RETRIES} connections to: ${uriConfig.type}`);
    logger.error(`   Configuration source: ${uriConfig.source}`);
    logger.error(`   Last error: ${message}`);
    logger.error('   Troubleshooting:');
    logger.error(`   - If using mongodb://, ensure MongoDB is running at the specified host:port`);
    logger.error(`   - If using mongodb+srv://, ensure you have network access to MongoDB Atlas`);
    logger.error(`   - Check that credentials in ${uriConfig.source} are correct and URL-encoded`);
    logger.error(`   - Verify firewall/security group allows connections`);

    // In graceful startup mode, don't exit - let the app start with limited functionality
    if (GRACEFUL_STARTUP) {
      logger.error('');
      logger.error('🚨 GRACEFUL STARTUP MODE: Application will continue without MongoDB!');
      logger.error('   Some features will be limited until MongoDB becomes available.');
      logger.error('   The application will attempt to reconnect automatically.');
      logger.error('   To disable graceful startup, set GRACEFUL_STARTUP=false');
      logger.error('');
      return;  // Don't exit, let the app start
    }

    process.exit(1);
  }
};

/**
 * MongoDB lifecycle events
 */
mongoose.connection.on('connected', () =>
  logger.info('📡 MongoDB connection established')
);

mongoose.connection.on('disconnected', () =>
  logger.warn('⚠️ MongoDB disconnected')
);

mongoose.connection.on('error', (err) =>
  logger.error(`❌ MongoDB runtime error: ${err.message}`)
);

module.exports = connectDB;