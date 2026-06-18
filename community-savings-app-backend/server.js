'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
const hpp = require('hpp');
const client = require('prom-client');
const mongoose = require('mongoose');
const crypto = require('crypto');

const config = require('./config');
const { logger, info, warn, error } = require('./utils/logger');
const { createSocketServer } = require('./services/socket');
const redisClient = require('./services/redis'); // optional
const { errorHandler } = require('./middleware/errorHandler');

const apiGateway = require('./middleware/apiGateway'); // if folder is singular

const initChatSocket = require('./realtime/chatSocket');
// const io = initChatSocket(server); // pass HTTP server instance


// ✅ Initialize app first
const app = express();
const server = http.createServer(app);

// Basic app settings
app.set('trust proxy', 1);

// ✅ Use middleware after app is defined
app.use("/api", apiGateway);

module.exports = { app, server };



// Rate limiter setup (unchanged)
let apiLimiter;
try {
  if (redisClient && redisClient.status === 'ready') {
    apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.ip,
      store: new RedisStore({ sendCommand: (...args) => redisClient.call(...args) }),
      handler: (req, res) => res.status(429).json({ message: 'Too many requests, please try again later.' }),
    });
  } else {
    info('Redis not ready; using in-memory rate limiter');
    apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.ip,
      handler: (req, res) => res.status(429).json({ message: 'Too many requests, please try again later.' }),
    });
  }
} catch (err) {
  warn('Failed to configure rate limiter; falling back to memory store', { error: err?.message });
  apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    handler: (req, res) => res.status(429).json({ message: 'Too many requests, please try again later.' }),
  });
}

// Mount routers (add risk routes)
const riskRoutes = require('./routes/risk');
app.use('/api/risk', riskRoutes);

app.use(require("./middleware/requestId"));

app.use(apiLimiter);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(hpp());
app.use(mongoSanitize());
app.use(xss());
app.use(compression());
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));
app.use(cookieParser()); // ✅ required for refresh cookie
app.disable('x-powered-by');

// Request ID
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Logging
if (config.env !== 'production') {
  app.use(morgan('dev', { stream: { write: (msg) => logger.info(msg.trim()) } }));
}

// CORS
const allowedOrigins = config.corsOrigins.split(',').map((o) => o.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    optionsSuccessStatus: 204,
  })
);
app.options('*', cors());

// Metrics
client.collectDefaultMetrics({ timeout: 5000 });
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Health & readiness
let isReady = false;
mongoose.connection.once('open', () => {
  isReady = true;
  info('MongoDB connected and application marked ready');
});

app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }));
app.get('/readyz', (req, res) => (isReady ? res.status(200).json({ status: 'ready' }) : res.status(503).json({ status: 'not-ready' })));

// ✅ Mount routers
app.use('/api/auth', require('./routes/auth')); // <-- FIXED
app.use('/api/momo', require('./routes/momoRoutes'));
app.use('/api/webhook', require('./routes/webhook'));
// ... other routers as before

app.get('/', (req, res) => res.status(200).json({ message: '🚀 Community Savings App Backend is running!', version: process.env.APP_VERSION || '1.0.0', env: config.env, timestamp: new Date().toISOString() }));

app.use((req, res) => res.status(404).json({ message: 'API route not found' }));
app.use(errorHandler);

// Socket.IO
const io = createSocketServer(server);
app.locals.io = io;

// Initialize services (unchanged)
try {
  const SocketEmitter = require('./services/socketEmitter');
  app.locals.socketEmitter = new SocketEmitter(io);

  const PaymentService = require('./services/payment/PaymentService');
  const mobileMoneyProvider = require('./services/mobileMoneyService');
  app.locals.paymentService = new PaymentService({ providers: { mobileMoney: mobileMoneyProvider } });

  const ChatService = require('./services/chatService');
  app.locals.chatService = new ChatService();

  const LoanWorkflowService = require('./services/loanWorkflowService');
  app.locals.loanWorkflowService = new LoanWorkflowService();

  info('Services initialized successfully');
} catch (err) {
  warn('Some services failed to initialize; continuing with degraded functionality', { error: err?.message });
}

// Server timeouts
server.keepAliveTimeout = config.timeouts.keepAlive;
server.headersTimeout = config.timeouts.headers;
server.requestTimeout = config.timeouts.request;

// Start server
server.listen(config.port, () => {
  info(`Server running (${config.env}) at http://localhost:${config.port}`);
  info('Metrics available at: /metrics');
  info('Health check at: /healthz');
  info('Readiness check at: /readyz');
});

// Graceful shutdown (unchanged)
const shutdown = async (code = 0) => {
  warn('Gracefully shutting down...');
  server.close(async () => {
    try {
      await mongoose.connection.close(false);
      info('MongoDB disconnected');
    } catch (e) {
      error('Error disconnecting MongoDB', { error: e?.message });
    } finally {
      info('Server closed');
      process.exit(code);
    }
  });

  setTimeout(() => {
    error('Forced shutdown due to timeout');
    process.exit(1);
  }, config.timeouts.shutdown).unref();
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('unhandledRejection', (reason) => {
  error('Unhandled Rejection', { reason });
  shutdown(1);
});
process.on('uncaughtException', (err) => {
  error('Uncaught Exception', { error: err?.message, stack: err?.stack });
  shutdown(1);
});

module.exports = { app, server, io };
