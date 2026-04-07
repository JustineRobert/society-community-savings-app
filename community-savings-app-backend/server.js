
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
const RedisStore = require('rate-limit-redis');
const mongoSanitize = require('express-mongo-sanitize');
const redisClient = require('./services/redis');
const xss = require('xss-clean'); // Note: popular but community-maintained. Keep if it fits your risk posture.
const compression = require('compression');
const hpp = require('hpp');
const path = require('path');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const client = require('prom-client'); // Prometheus metrics
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
// Initialize Services
// ----------------------------------------------------------------------------
try {
  // Payment Service
  const PaymentService = require('./services/payment/PaymentService');
  const mobileMoneyProvider = require('./services/mobileMoneyService');
  app.locals.paymentService = new PaymentService({
    providers: { mobileMoney: mobileMoneyProvider }
  });

  // Chat Service
  const ChatService = require('./services/chatService');
  app.locals.chatService = new ChatService();

  // Loan Workflow Service
  const LoanWorkflowService = require('./services/loanWorkflowService');
  app.locals.loanWorkflowService = new LoanWorkflowService();

  logger.info('✅ Services initialized successfully');
} catch (error) {
  logger.error('❌ Failed to initialize services', { error: error.message });
  // Don't exit - let the app start with degraded functionality
}

// ----------------------------------------------------------------------------
// Trust Proxy — required when running behind a load balancer or CDN
// to ensure real client IPs and correct rate limiting keying.
// ----------------------------------------------------------------------------
app.set('trust proxy', 1);

// ----------------------------------------------------------------------------
// Security, Performance & Parsing Middleware
// ----------------------------------------------------------------------------

// Rate limiting: standardized headers; friendly JSON handler backed by Redis store.
let apiLimiter;
if (redisClient && redisClient.status === 'ready') {
  try {
    apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      standardHeaders: true, // Send rate limit info in the RateLimit-* headers
      legacyHeaders: false,  // Disable X-RateLimit-* headers
      keyGenerator: (req) => req.ip,
      store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        // optionally use client: redisClient
      }),
      handler: (req, res /*, next*/) => {
        return res.status(429).json({
          message: 'Too many requests, please try again later.',
        });
      },
    });
  } catch (error) {
    logger.warn('⚠️ Redis store failed, falling back to memory store', { error: error.message });
    apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.ip,
      handler: (req, res /*, next*/) => {
        return res.status(429).json({
          message: 'Too many requests, please try again later.',
        });
      },
    });
  }
} else {
  logger.info('ℹ️ Redis not available, using memory store for rate limiting');
  apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    handler: (req, res /*, next*/) => {
      return res.status(429).json({
        message: 'Too many requests, please try again later.',
      });
    },
  });
}
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
// Prometheus Metrics (export at /metrics)
// ----------------------------------------------------------------------------
client.collectDefaultMetrics({ timeout: 5000 });

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

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

// attach socket.io for realtime notifications
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// authenticate socket connections using same JWT logic as HTTP
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token ||
      (socket.handshake.headers && socket.handshake.headers.authorization
        ? socket.handshake.headers.authorization.split(' ')[1]
        : null);
    if (!token) {
      return next(new Error('Authentication error: token missing'));
    }
    const decoded = require('jsonwebtoken').verify(token, process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET);
    socket.user = decoded.user || decoded;
    return next();
  } catch (err) {
    return next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  logger.info('🔌 WebSocket connected', { socketId: socket.id, user: socket.user });
  socket.on('disconnect', () => {
    logger.info('🔌 WebSocket disconnected', { socketId: socket.id });
  });
});

// export io for other modules to emit events
module.exports.io = io;

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
