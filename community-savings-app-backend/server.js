// ============================================================================
// TITech Community Capital
// Production-ready server bootstrap
// File: backend/server.js
// ============================================================================
//
// Enhancements over original:
// - Waits for Redis readiness in production (bounded wait) to avoid inconsistent
//   in-memory fallback across instances.
// - Uses redis service helper to create a rate-limit store (Redis-backed when
//   available, memory fallback otherwise).
// - Lighter auth-specific rate limiter and skip for logout to avoid 401->429 loops.
// - Mongoose autoIndex disabled in production to avoid duplicate index creation
//   noise; logs guidance for duplicate index warnings.
// - Improved startup logging and health endpoints include Redis status.
// - Graceful shutdown and improved error handling.
//
// Drop-in replacement for your existing server.js. Adjust timeouts and limits
// via environment variables or the existing config module as needed.
// ============================================================================

'use strict';

const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
const hpp = require('hpp');
const client = require('prom-client');
const mongoose = require('mongoose');
const crypto = require('crypto');

const config = require('./config');
const logger = require('./utils/logger');
const { createSocketServer } = require('./services/socket');
const redisService = require('./services/redis'); // enhanced redis helper
const { errorHandler } = require('./middleware/errorHandler');
const apiGateway = require('./middleware/apiGateway');
const initChatSocket = require('./realtime/chatSocket');

const connectDB = require('./config/db');

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

/* -------------------------------------------------------------------------- */
/*                               SECURITY                                      */
/* -------------------------------------------------------------------------- */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

/* -------------------------------------------------------------------------- */
/*                              PERFORMANCE                                    */
/* -------------------------------------------------------------------------- */

app.use(compression());

if (config.env !== 'production') {
  app.use(morgan('dev', { stream: logger.stream }));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}

/* -------------------------------------------------------------------------- */
/*                               BODY PARSING                                 */
/* -------------------------------------------------------------------------- */

app.use(express.json({ limit: config.bodyLimit || '10kb' }));
app.use(
  express.urlencoded({
    extended: true,
    limit: config.bodyLimit || '10kb',
  })
);

app.use(cookieParser());
app.disable('x-powered-by');

/* -------------------------------------------------------------------------- */
/*                              REQUEST ID                                     */
/* -------------------------------------------------------------------------- */

app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

/* -------------------------------------------------------------------------- */
/*                                   CORS                                     */
/* -------------------------------------------------------------------------- */

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
  ...(config.corsOrigins
    ? config.corsOrigins
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : []),
].filter(Boolean);

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    // Allow non-browser clients (no origin) and whitelisted origins
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn('Blocked CORS Origin', { origin });
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Requested-With'],
  exposedHeaders: ['X-Request-Id'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* -------------------------------------------------------------------------- */
/*                               RATE LIMITING                                 */
/* -------------------------------------------------------------------------- */

const isDevelopment = process.env.NODE_ENV !== 'production';

function skipLocalhost(req) {
  if (!isDevelopment) return false;

  const ip = req.ip || req.connection?.remoteAddress || '';
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.includes('127.0.0.1')
  );
}

/**
 * Create a rate limiter using redisService.createRateLimitStore() which will
 * return a Redis-backed store when Redis is available, or a memory fallback
 * otherwise. For auth endpoints we use a lighter limiter and skip logout to
 * avoid 401->429 cascades.
 */
function createApiLimiter({ windowMs = 15 * 60 * 1000, max = config.rateLimitMax, skipPaths = [] } = {}) {
  const store = redisService.createRateLimitStore();
  return rateLimit({
    windowMs,
    max,
    store,
    standardHeaders: true,
    legacyHeaders: false,
    skip(req) {
      if (skipPaths.some((path) => req.path === path || req.originalUrl?.endsWith(path))) {
        return true;
      }
      return skipLocalhost(req);
    },
    handler: (req, res) =>
      res.status(429).json({
        message: 'Too many requests, please try again later.',
      }),
  });
}

// Global API limiter
const apiLimiter = createApiLimiter();

// Auth-specific limiter (lighter)
const authLimiter = createApiLimiter({
  windowMs: 15 * 60 * 1000,
  max: Math.max(10, Math.floor((config.rateLimitMax || 100) / 4)),
  skipPaths: ['/logout'],
});

// Apply global limiter to API
app.use(apiLimiter);

// Apply auth limiter to auth routes only (mounted later)
app.use('/api/auth', authLimiter);

/* -------------------------------------------------------------------------- */
/*                                  ROUTES                                     */
/* -------------------------------------------------------------------------- */

// Mount API gateway and routes
app.use('/api', apiGateway);
app.use('/api/risk', require('./routes/risk'));

// For auth routes we want to ensure logout is not blocked by strict rate limits.
// The auth route file should export router; we mount it here and then add a
// small middleware to bypass rate limiting for logout path if needed.
const authRouter = require('./routes/auth');
const emailRouter = require('./routes/email');

app.use('/api/auth', authRouter);
app.use('/api/email', emailRouter);

app.use('/api/momo', require('./routes/momoRoutes'));
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/kyc', require('./routes/kyc'));
app.use('/api/bizchat', require('./routes/bizchat'));
app.use('/api/rbac', require('./routes/rbac'));

/* -------------------------------------------------------------------------- */
/*                                 METRICS                                     */
/* -------------------------------------------------------------------------- */

client.collectDefaultMetrics();

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

/* -------------------------------------------------------------------------- */
/*                           HEALTH / READINESS                               */
/* -------------------------------------------------------------------------- */

let mongoReady = false;

mongoose.connection.once('open', () => {
  mongoReady = true;
  logger.info('MongoDB connected and application marked ready');
});

mongoose.connection.on('error', (err) => {
  mongoReady = false;
  logger.error('MongoDB connection error', { error: err.message });
});

app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    redis: {
      status: redisService.getStatus(),
      ready: redisService.isReady(),
      degraded: !!redisService.gracefullyDegraded,
    },
  });
});

app.get('/readyz', (req, res) => {
  if (!mongoReady) {
    return res.status(503).json({ status: 'not-ready', reason: 'mongo' });
  }

  // If in production we prefer Redis to be ready for full readiness
  if (config.env === 'production' && !redisService.isReady()) {
    return res.status(503).json({ status: 'not-ready', reason: 'redis' });
  }

  return res.json({ status: 'ready' });
});

/* -------------------------------------------------------------------------- */
/*                                 ROOT                                        */
/* -------------------------------------------------------------------------- */

app.get('/', (req, res) => {
  res.json({
    message: '🚀 TITech Community Capital - African Community Finance Operating System(ACFOS) Backend is running!',
    version: process.env.APP_VERSION || '1.0.0',
    env: config.env,
    timestamp: new Date().toISOString(),
    redis: {
      status: redisService.getStatus(),
      ready: redisService.isReady(),
      degraded: !!redisService.gracefullyDegraded,
    },
  });
});

/* -------------------------------------------------------------------------- */
/*                            ERROR HANDLING                                   */
/* -------------------------------------------------------------------------- */

app.use((req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

app.use(errorHandler);

/* -------------------------------------------------------------------------- */
/*                                SOCKET.IO                                    */
/* -------------------------------------------------------------------------- */

const io = createSocketServer(server);
app.locals.io = io;
initChatSocket(server);

/* -------------------------------------------------------------------------- */
/*                             SERVER SETTINGS                                 */
/* -------------------------------------------------------------------------- */

server.keepAliveTimeout = config.timeouts?.keepAlive || 65000;
server.headersTimeout = config.timeouts?.headers || 66000;
server.requestTimeout = config.timeouts?.request || 120000;

/* -------------------------------------------------------------------------- */
/*                              START SERVER                                   */
/* -------------------------------------------------------------------------- */

async function startServer() {
  try {
    // Connect DB first (this will set mongoReady when open)
    await connectDB();

    // In production, wait for Redis readiness for a bounded time to avoid
    // inconsistent behavior across instances. In development, wait a short time
    // but allow fallback to memory store.
    const redisWaitMs = config.redisWaitMs || (config.env === 'production' ? 30000 : 5000);
    const redisOk = await redisService.waitForReady(redisWaitMs);

    if (!redisOk && config.env === 'production') {
      logger.error('Redis not ready after wait; aborting startup to avoid inconsistent state');
      process.exit(1);
    }

    // If mongoose emits duplicate index warnings, recommend disabling autoIndex in production
    if (config.env === 'production') {
      mongoose.set('autoIndex', false);
    }

    // Seed RBAC roles/permissions if present
    try {
      const rbacService = require('./services/rbacService');
      rbacService.seedRolesPermissions().catch((err) => logger.debug('RBAC seed skipped or failed', { err: err.message }));
    } catch (err) {
      logger.debug('RBAC seed service not available', { err: err.message });
    }

    if (!server.listening) {
      server.listen(config.port, () => {
        logger.info(`Server running (${config.env}) at http://localhost:${config.port}`);
        logger.info('Metrics available at: /metrics');
        logger.info('Health check at: /healthz');
        logger.info('Readiness check at: /readyz');

        // Log Redis state after startup
        logger.info('Redis status', {
          status: redisService.getStatus(),
          ready: redisService.isReady(),
          degraded: !!redisService.gracefullyDegraded,
        });

        if (redisService.gracefullyDegraded) {
          logger.warn('Redis degraded mode active; some features are using in-memory fallback');
        }
      });
    }
  } catch (err) {
    logger.error('Failed to start application', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

server.on('error', (err) => {
  logger.error('HTTP Server Error', { error: err.message, code: err.code });
  process.exit(1);
});

/* -------------------------------------------------------------------------- */
/*                           GRACEFUL SHUTDOWN                                */
/* -------------------------------------------------------------------------- */

const shutdown = async (code = 0) => {
  logger.warn('Gracefully shutting down...');

  server.close(async () => {
    try {
      await mongoose.connection.close(false);
      logger.info('MongoDB disconnected');
    } catch (err) {
      logger.error('MongoDB shutdown error', { error: err.message });
    } finally {
      // Attempt to disconnect Redis gracefully
      try {
        if (redisService && typeof redisService.client?.quit === 'function') {
          await redisService.client.quit();
          logger.info('Redis disconnected');
        }
      } catch (err) {
        logger.error('Redis shutdown error', { error: err.message });
      }

      logger.info('Server closed');
      process.exit(code);
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, config.timeouts?.shutdown || 10000).unref();
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason });
  shutdown(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  shutdown(1);
});

module.exports = app;
app.server = server;
app.io = io;
