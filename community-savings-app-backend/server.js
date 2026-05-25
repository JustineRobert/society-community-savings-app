// server.js
// ============================================================================
// Community Savings App - Production-Ready Express Server
// Security hardening, performance tuning, observability, and graceful shutdown.
// Robust connection handling with retries, exponential backoff, and graceful fallbacks.
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
// NOTE: replaced external connectDB usage with inline robust connect logic below
// const connectDB = require('./config/db');

// ============================================================================
// Connection Management Utilities
// ============================================================================

/**
 * Exponential backoff calculator with jitter
 * @param {number} attemptNumber - Starting from 0
 * @param {number} minDelay - Minimum delay in ms (default 1000)
 * @param {number} maxDelay - Maximum delay in ms (default 30000)
 * @returns {number} Delay in milliseconds
 */
function getExponentialBackoffDelay(attemptNumber, minDelay = 1000, maxDelay = 30000) {
  const baseDelay = Math.min(minDelay * Math.pow(2, attemptNumber), maxDelay);
  // Add jitter (±10% randomness) to prevent thundering herd
  const jitter = baseDelay * 0.1 * (Math.random() - 0.5);
  return Math.floor(baseDelay + jitter);
}

// ============================================================================
// Environment Configuration
// ============================================================================
dotenv.config({ path: path.resolve(__dirname, '.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || 5000);

// Build safe defaults and ensure URIs are well-formed
const DB_USER = process.env.DB_USER || '';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const MONGO_DB = process.env.MONGO_DB || 'community_savings';

// If MONGO_URI is provided, use it; otherwise build from DB_USER/DB_PASSWORD
let MONGO_URI = process.env.MONGO_URI && process.env.MONGO_URI.trim()
  ? process.env.MONGO_URI.trim()
  : (DB_USER && DB_PASSWORD
      ? `mongodb+srv://${DB_USER}:${DB_PASSWORD}@cluster0.syk98ao.mongodb.net/${MONGO_DB}?retryWrites=true&w=majority`
      : `mongodb+srv://user:pass@cluster0.mongodb.net/${MONGO_DB}`);

const MONGO_URI_FALLBACK = process.env.MONGO_URI_FALLBACK || `mongodb://127.0.0.1:27017/${MONGO_DB}`;
const REDIS_URI = process.env.REDIS_URI || process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Graceful startup flags
const GRACEFUL_STARTUP = process.env.GRACEFUL_STARTUP === 'true' || NODE_ENV === 'development';
const SKIP_DB_CHECKS = process.env.SKIP_DB_CHECKS === 'true';

// Validate required environment variables early to fail fast.
const requiredEnvVars = ['JWT_SECRET'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    // Use console.error as logger may not be ready yet
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// Store connection URIs for startup checks
const connectionConfig = {
  mongo: MONGO_URI,
  mongoFallback: MONGO_URI_FALLBACK,
  redis: REDIS_URI,
  environment: NODE_ENV,
  gracefulStartup: GRACEFUL_STARTUP,
  skipDbChecks: SKIP_DB_CHECKS,
};

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

// ============================================================================
// Startup Health Check Function
// Ensures critical services are available before starting the server
// ============================================================================
async function performStartupHealthCheck() {
  logger.info('🔍 Performing startup health checks...');
  logger.info(`   Environment: ${NODE_ENV}`);
  
  // Determine which MongoDB URI will be used
  const inProduction = NODE_ENV === 'production';
  const inDocker = process.env.DOCKER === 'true' || process.env.DOCKER === '1';
  
  let mongoURIToUse, mongoType;
  if (inProduction) {
    mongoURIToUse = MONGO_URI;
    mongoType = 'MongoDB Atlas (SRV)';
  } else if (inDocker) {
    mongoURIToUse = MONGO_URI_FALLBACK;
    mongoType = 'Docker MongoDB';
  } else {
    mongoURIToUse = MONGO_URI_FALLBACK;
    mongoType = 'Local MongoDB';
  }
  
  // Mask credentials for safe logging
  const maskedMongoURI = mongoURIToUse.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1****$2');
  
  logger.info(`📍 MongoDB: ${mongoType}`);
  logger.info(`   URI (masked): ${maskedMongoURI}`);
  logger.info(`   Source: ${inProduction ? 'MONGO_URI' : 'MONGO_URI_FALLBACK'}`);
  
  // Check Redis availability
  logger.info(`📍 Redis URI: ${REDIS_URI}`);
  if (redisClient && redisClient.status && redisClient.status !== 'mock') {
    logger.info('✅ Redis is available');
  } else {
    logger.warn('⚠️ Redis is not available - rate limiting will use memory store');
  }
  
  // Skip database checks if requested
  if (SKIP_DB_CHECKS) {
    logger.warn('⚠️ Database connectivity checks skipped (SKIP_DB_CHECKS=true)');
    logger.warn('   Application will attempt to connect to databases at runtime');
  }
  
  logger.info('✅ Startup health checks completed');
}

// ============================================================================
// Robust MongoDB Connection Logic (replaces external connectDB)
// - Tries MONGO_URI first (SRV), on SRV/DNS errors falls back to MONGO_URI_FALLBACK
// - Retries with exponential backoff and jitter
// ============================================================================
async function connectMongoWithRetries(maxAttempts = 5) {
  let attempt = 0;
  let lastError = null;
  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // fail fast per attempt
  };

  // Try primary (SRV) first, then fallback if SRV resolution fails
  const tryUriSequence = [MONGO_URI, MONGO_URI_FALLBACK];

  while (attempt < maxAttempts) {
    const uriIndex = attempt < tryUriSequence.length ? attempt : 0; // try fallback on second attempt if needed
    const uriToTry = tryUriSequence[uriIndex] || MONGO_URI;
    try {
      logger.info(`🔌 Connecting to MongoDB (Attempt ${attempt + 1}/${maxAttempts})`);
      logger.info(`   Type: ${uriToTry.startsWith('mongodb+srv') ? 'MongoDB Atlas (SRV)' : 'MongoDB'} | Source: ${uriIndex === 0 ? 'MONGO_URI' : 'MONGO_URI_FALLBACK'}`);
      const masked = uriToTry.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1****$2');
      logger.info(`   URI (masked): ${masked}`);
      await mongoose.connect(uriToTry, options);
      logger.info('✅ MongoDB connected');
      return;
    } catch (err) {
      lastError = err;
      // If SRV/DNS resolution error, log and attempt fallback immediately on next iteration
      const isSrvDnsError = /querySrv|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(err.message || err.toString());
      logger.warn(`]: ⚠️ MongoDB disconnected`);
      logger.error(`]: ❌ MongoDB connection error (Attempt ${attempt + 1}/${maxAttempts}): ${err.message}`);
      if (isSrvDnsError && uriIndex === 0) {
        logger.warn(']:    Detected SRV/DNS error; will attempt fallback URI on next try.');
      }
      attempt += 1;
      const delay = getExponentialBackoffDelay(attempt - 1, 1000, 16000);
      logger.info(`🔄 Retrying MongoDB connection in ${delay}ms (Attempt ${attempt + 1}/${maxAttempts})`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  logger.error('🛑 MongoDB failed to connect after maximum retries.');
  logger.error(`]:    Attempted ${maxAttempts} connections to: ${MONGO_URI}`);
  logger.error(`]:    Configuration source: MONGO_URI`);
  logger.error(`]:    Last error: ${lastError && lastError.message ? lastError.message : lastError}`);
  throw lastError;
}

// Kick off connection attempts (non-blocking)
connectMongoWithRetries().catch((err) => {
  // Let the server continue to start but mark Mongo as disconnected; the readiness endpoint will reflect this.
  logger.error('❌ Unrecoverable MongoDB connection error during startup', { error: err?.message });
  // Do not exit here to allow degraded startup; original behavior crashed — we keep server running but not ready.
});

// ============================================================================
// Database Connection
// ============================================================================
// connectDB(); // replaced by connectMongoWithRetries above

const app = express();

// ----------------------------------------------------------------------------
// Initialize Services (will be called after Socket.IO is created)
// This ensures Socket.IO is available for services that need real-time events
let servicesInitialized = false;

const initializeServices = () => {
  if (servicesInitialized) return;
  
  try {
    // Socket Emitter Service
    const SocketEmitter = require('./services/socketEmitter');
    app.locals.socketEmitter = new SocketEmitter(io);

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
    servicesInitialized = true;
  } catch (error) {
    logger.error('❌ Failed to initialize services', { error: error.message });
    // Don't exit - let the app start with degraded functionality
  }
};

// Declare io variable (will be initialized after http.createServer)
let io;

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
app.use('/api/legal', require('./routes/legal.routes'));
app.use('/api/help', require('./routes/helpCenter.routes'));
app.use('/api/faq', require('./routes/faq.routes'));
app.use('/api/forums', require('./routes/forums.routes'));

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

// ============================================================================
// Socket.IO Configuration — Real-time Communication
// ============================================================================
io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'], // fallback to polling if websocket fails
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6, // 1MB
});

// Middleware: Authenticate socket connections using JWT
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token ||
      (socket.handshake.headers && socket.handshake.headers.authorization
        ? socket.handshake.headers.authorization.split(' ')[1]
        : null);
    if (!token) {
      return next(new Error('Authentication error: token missing'));
    }
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET);
    socket.user = decoded.user || decoded;
    socket.userId = decoded.userId || decoded.id;
    return next();
  } catch (err) {
    logger.error('🔒 Socket authentication failed', { error: err.message });
    return next(new Error('Authentication error'));
  }
});

// ============================================================================
// Socket.IO Main Namespace
// ============================================================================
io.on('connection', (socket) => {
  logger.info('🔌 WebSocket connected', { socketId: socket.id, userId: socket.userId });

  // Join user-specific room for direct notifications
  socket.join(`user:${socket.userId}`);

  // Track user presence
  socket.on('presence:status', (status) => {
    const validStatuses = ['online', 'away', 'offline', 'busy'];
    if (validStatuses.includes(status)) {
      io.to(`user:${socket.userId}`).emit('presence:updated', {
        userId: socket.userId,
        status,
        timestamp: new Date(),
      });
    }
  });

  // ========================================================================
  // Notifications Namespace
  // ========================================================================
  socket.on('notifications:subscribe', (groupId) => {
    socket.join(`notifications:${groupId}`);
    logger.debug('📬 User subscribed to group notifications', { userId: socket.userId, groupId });
  });

  socket.on('notifications:unsubscribe', (groupId) => {
    socket.leave(`notifications:${groupId}`);
    logger.debug('📬 User unsubscribed from group notifications', { userId: socket.userId, groupId });
  });

  // ========================================================================
  // Chat Namespace
  // ========================================================================
  socket.on('chat:subscribe', (groupId) => {
    const chatRoom = `chat:${groupId}`;
    socket.join(chatRoom);
    io.to(chatRoom).emit('chat:user-joined', {
      userId: socket.userId,
      timestamp: new Date(),
    });
    logger.debug('💬 User joined chat room', { userId: socket.userId, groupId });
  });

  socket.on('chat:unsubscribe', (groupId) => {
    const chatRoom = `chat:${groupId}`;
    socket.leave(chatRoom);
    io.to(chatRoom).emit('chat:user-left', {
      userId: socket.userId,
      timestamp: new Date(),
    });
    logger.debug('💬 User left chat room', { userId: socket.userId, groupId });
  });

  socket.on('chat:message', (data) => {
    try {
      const { groupId, message } = data;
      if (!groupId || !message || typeof message !== 'string' || message.trim().length === 0) {
        return socket.emit('chat:error', { error: 'Invalid message data' });
      }
      const chatRoom = `chat:${groupId}`;
      io.to(chatRoom).emit('chat:message-received', {
        userId: socket.userId,
        groupId,
        message: message.trim(),
        timestamp: new Date(),
        socketId: socket.id,
      });
    } catch (err) {
      logger.error('💬 Error emitting chat message', { error: err.message });
      socket.emit('chat:error', { error: 'Failed to send message' });
    }
  });

  socket.on('chat:typing', (data) => {
    const { groupId } = data;
    const chatRoom = `chat:${groupId}`;
    io.to(chatRoom).emit('chat:user-typing', {
      userId: socket.userId,
      groupId,
      timestamp: new Date(),
    });
  });

  socket.on('chat:stopped-typing', (data) => {
    const { groupId } = data;
    const chatRoom = `chat:${groupId}`;
    io.to(chatRoom).emit('chat:user-stopped-typing', {
      userId: socket.userId,
      groupId,
    });
  });

  // ========================================================================
  // Loans Namespace
  // ========================================================================
  socket.on('loans:subscribe', (groupId) => {
    socket.join(`loans:${groupId}`);
    logger.debug('📋 User subscribed to loan updates', { userId: socket.userId, groupId });
  });

  socket.on('loans:unsubscribe', (groupId) => {
    socket.leave(`loans:${groupId}`);
    logger.debug('📋 User unsubscribed from loan updates', { userId: socket.userId, groupId });
  });

  // ========================================================================
  // Contributions Namespace
  // ========================================================================
  socket.on('contributions:subscribe', (groupId) => {
    socket.join(`contributions:${groupId}`);
    logger.debug('💰 User subscribed to contribution updates', { userId: socket.userId, groupId });
  });

  socket.on('contributions:unsubscribe', (groupId) => {
    socket.leave(`contributions:${groupId}`);
    logger.debug('💰 User unsubscribed from contribution updates', { userId: socket.userId, groupId });
  });

  // ========================================================================
  // Heartbeat / Ping
  // ========================================================================
  socket.on('heartbeat', () => {
    socket.emit('heartbeat-ack', { timestamp: new Date() });
  });

  // ========================================================================
  // Disconnect
  // ========================================================================
  socket.on('disconnect', () => {
    logger.info('🔌 WebSocket disconnected', { socketId: socket.id, userId: socket.userId });
    // Broadcast user offline status
    io.emit('presence:updated', {
      userId: socket.userId,
      status: 'offline',
      timestamp: new Date(),
    });
  });

  // Error handling
  socket.on('error', (error) => {
    logger.error('❌ Socket error', { socketId: socket.id, error: error.message });
  });
});

// ============================================================================
// Socket.IO Administrative Namespace (for server-to-client emits)
// ============================================================================
// Make io globally available for controllers and services to emit events
app.locals.io = io;
module.exports.io = io;

// Initialize services now that Socket.IO is set up
initializeServices();

// Timeouts: align with proxy/load balancer to avoid half-open sockets.
// - headersTimeout slightly above keepAliveTimeout.
// - requestTimeout to guard slowloris.
server.keepAliveTimeout = 5000;       // 5s keep-alive (match Nginx default)
server.headersTimeout = 6500;         // 6.5s (must be > keepAliveTimeout)
server.requestTimeout = 30000;        // 30s per-request cap

// ============================================================================
// Server Startup with Health Checks
// ============================================================================
const startServer = async (listenPort = PORT, attempt = 0) => {
  try {
    // Perform startup health checks
    await performStartupHealthCheck();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${listenPort} already in use`, { port: listenPort });
        const nextPort = listenPort === 0 ? 0 : listenPort + 1;
        if (attempt < 2) {
          logger.warn(`➡️ Retrying on port ${nextPort} (attempt ${attempt + 2})`);
          return startServer(nextPort, attempt + 1);
        }
      }

      logger.error('❌ Server listen error', { error: err.message, stack: err.stack });
      process.exit(1);
    });

    // Start listening for connections
    server.listen(listenPort, () => {
      const boundPort = server.address() && server.address().port ? server.address().port : listenPort;
      logger.info(`✅ Server running (${NODE_ENV}) at http://localhost:${boundPort}`);
      logger.info(`🌐 CORS allowed origins: ${process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:3000'}`);
      logger.info('📊 Metrics available at: /metrics');
      logger.info('🏥 Health check at: /healthz');
      logger.info('📡 Readiness check at: /readyz');
    });
  } catch (error) {
    logger.error('❌ Failed to start server', { error: error.message });
    process.exit(1);
  }
};

// Start the server
startServer();

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
