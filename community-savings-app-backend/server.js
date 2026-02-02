
// server.js
// ============================================================================
// Community Savings App - Production-Ready Express Server
// Security hardening, performance tuning, observability, and graceful shutdown.
// ============================================================================

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean'); // Note: popular but community-maintained. Keep if it fits your risk posture.
const compression = require('compression');
const hpp = require('hpp');
const path = require('path');
const http = require('http');
const winston = require('winston');
const mongoose = require('mongoose');
const crypto = require('crypto');

const { errorHandler } = require('./middleware/errorHandler');
const connectDB = require('./config/db');

// ----------------------------------------------------------------------------
// Environment
// ----------------------------------------------------------------------------
dotenv.config({ path: path.resolve(__dirname, '.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || 5000);

// Validate required environment variables early to fail fast.
const requiredEnvVars = ['PORT', 'MONGO_URI', 'JWT_SECRET'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    // Use console.error as logger may not be ready yet
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// ----------------------------------------------------------------------------
// Logger (Winston) — JSON in production, colorized in dev; includes requestId.
// ----------------------------------------------------------------------------
const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format:
    NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
    }),
  ],
});

// ----------------------------------------------------------------------------
// Database
// ----------------------------------------------------------------------------
connectDB();

const app = express();

// ----------------------------------------------------------------------------
// Trust Proxy — required when running behind a load balancer or CDN
// to ensure real client IPs and correct rate limiting keying.
// ----------------------------------------------------------------------------
app.set('trust proxy', 1);

// ----------------------------------------------------------------------------
// Security, Performance & Parsing Middleware
// ----------------------------------------------------------------------------

// Rate limiting: standardized headers; friendly JSON handler.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  standardHeaders: true, // Send rate limit info in the RateLimit-* headers
  legacyHeaders: false,  // Disable X-RateLimit-* headers
  keyGenerator: (req) => req.ip,
  handler: (req, res /*, next*/) => {
    return res.status(429).json({
      message: 'Too many requests, please try again later.',
    });
  },
});
app.use(apiLimiter);

// Helmet: sensible defaults for APIs (no CSP needed unless you serve HTML).
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // acceptable for APIs
  })
);

// Prevent HTTP Parameter Pollution.
app.use(hpp());

// Sanitize MongoDB operators in the payload.
app.use(mongoSanitize());

// Basic XSS protection on incoming payload.
app.use(xss());

// Compression: reduce response size; safe for JSON APIs.
app.use(compression());

// Body parsers with safe limits to prevent large payload DoS.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Cookies
app.use(cookieParser());

// Disable Express signature header explicitly (helmet also does this).
app.disable('x-powered-by');

// ----------------------------------------------------------------------------
// Request Correlation & Access Logging
// ----------------------------------------------------------------------------

// Attach a per-request ID for correlation
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Morgan logs routed to Winston (skip in production if desired)
if (NODE_ENV !== 'production') {
  const morganStream = {
    write: (message) => logger.info(message.trim(), { requestId: null }),
  };
  app.use(morgan('dev', { stream: morganStream }));
}

// ----------------------------------------------------------------------------
// CORS
// ----------------------------------------------------------------------------
const allowedOriginsEnv =
  process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const allowedOrigins = allowedOriginsEnv
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin, curl/postman, and any origin explicitly listed.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Optional: allow matching by subdomain or regex here if needed.
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    optionsSuccessStatus: 204,
  })
);

// Explicitly handle CORS preflight for all routes
app.options('*', cors());

// ----------------------------------------------------------------------------
// Health & Readiness Endpoints
// ----------------------------------------------------------------------------
let isReady = false;

mongoose.connection.once('open', () => {
  isReady = true;
  logger.info('✅ MongoDB connected and application marked ready');
});

app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/readyz', (req, res) => {
  if (isReady) {
    return res.status(200).json({ status: 'ready' });
  }
  return res.status(503).json({ status: 'not-ready' });
});

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------
// If you add a routes/index.js aggregator, you can mount `app.use('/api', require('./routes'))`
// For now, keep explicit feature routers for clarity.

app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/contributions', require('./routes/contributions'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/chats', require('./routes/chat'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/payments', require('./routes/payments'));

// Root info endpoint (non-sensitive)
app.get('/', (req, res) => {
  res.status(200).json({
    message: '🚀 Community Savings App Backend is running!',
    version: '1.0.0',
    env: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler — keep minimal to avoid information leakage
app.use((req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// Global Error Handler (must be last)
app.use(errorHandler);

// ----------------------------------------------------------------------------
// Server Initialization & Timeouts
// ----------------------------------------------------------------------------
const server = http.createServer(app);

// Timeouts: align with proxy/load balancer to avoid half-open sockets.
// - headersTimeout slightly above keepAliveTimeout.
// - requestTimeout to guard slowloris.
server.keepAliveTimeout = 5000;       // 5s keep-alive (match Nginx default)
server.headersTimeout = 6500;         // 6.5s (must be > keepAliveTimeout)
server.requestTimeout = 30000;        // 30s per-request cap

server.listen(PORT, () => {
  logger.info(`✅ Server running (${NODE_ENV}) at http://localhost:${PORT}`);
});

// ----------------------------------------------------------------------------
// Graceful Shutdown
// ----------------------------------------------------------------------------
const shutdown = async (code = 0) => {
  logger.warn('🛑 Gracefully shutting down...');
  // Stop accepting new connections
  server.close(async () => {
    try {
      await mongoose.connection.close();
      logger.info('✅ MongoDB disconnected');
    } catch (err) {
      logger.error('❌ Error disconnecting MongoDB', { error: err?.message });
    } finally {
      logger.info('✅ Server closed');
      process.exit(code);
    }
  });

  // Force exit if shutdown takes too long (defensive)
  setTimeout(() => {
    logger.error('❌ Forced shutdown due to timeout');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.on('unhandledRejection', (reason) => {
  logger.error('❌ Unhandled Rejection', { reason });
  shutdown(1);
});

process.on('uncaughtException', (err) => {
  logger.error('❌ Uncaught Exception', { error: err?.message, stack: err?.stack });
  shutdown(1);
});
