'use strict';

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
const logger = require('./utils/logger');
const { createSocketServer } = require('./services/socket');
const redisClient = require('./services/redis');
const { errorHandler } = require('./middleware/errorHandler');
const apiGateway = require('./middleware/apiGateway');
const initChatSocket = require('./realtime/chatSocket');

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
const requestId =
req.headers['x-request-id'] || crypto.randomUUID();

req.requestId = requestId;
res.setHeader('X-Request-Id', requestId);

next();
});

/* -------------------------------------------------------------------------- */
/*                                   CORS                                      */
/* -------------------------------------------------------------------------- */

const allowedOrigins = (config.corsOrigins || '')
.split(',')
.map((o) => o.trim())
.filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
    ],
    optionsSuccessStatus: 204,
  })
);

app.options('*', cors());

/* -------------------------------------------------------------------------- */
/*                               RATE LIMITING                                 */
/* -------------------------------------------------------------------------- */

let apiLimiter;

if (redisClient && redisClient.status === 'ready') {
apiLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
max: config.rateLimitMax,
store: new RedisStore({
sendCommand: (...args) => redisClient.call(...args),
}),
standardHeaders: true,
legacyHeaders: false,
handler: (req, res) =>
res.status(429).json({
message:
'Too many requests, please try again later.',
}),
});
} else {
logger.info(
'Redis not ready; using in-memory rate limiter'
);

apiLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
max: config.rateLimitMax,
standardHeaders: true,
legacyHeaders: false,
handler: (req, res) =>
res.status(429).json({
message:
'Too many requests, please try again later.',
}),
});
}

app.use(apiLimiter);

/* -------------------------------------------------------------------------- */
/*                                  ROUTES                                     */
/* -------------------------------------------------------------------------- */

app.use('/api', apiGateway);
app.use('/api/risk', require('./routes/risk'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/momo', require('./routes/momoRoutes'));
app.use('/api/webhook', require('./routes/webhook'));

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

let isReady = false;

mongoose.connection.once('open', () => {
isReady = true;
logger.info(
'MongoDB connected and application marked ready'
);
});

mongoose.connection.on('error', (err) => {
isReady = false;
logger.error('MongoDB connection error', {
error: err.message,
});
});

app.get('/healthz', (req, res) => {
res.json({
status: 'ok',
uptime: process.uptime(),
timestamp: new Date().toISOString(),
});
});

app.get('/readyz', (req, res) => {
if (!isReady) {
return res.status(503).json({
status: 'not-ready',
});
}

return res.json({
status: 'ready',
});
});

/* -------------------------------------------------------------------------- */
/*                                 ROOT                                        */
/* -------------------------------------------------------------------------- */

app.get('/', (req, res) => {
res.json({
message:
'🚀 TITech Community Capital Fintech Platform Backend is running!',
version: process.env.APP_VERSION || '1.0.0',
env: config.env,
timestamp: new Date().toISOString(),
});
});

/* -------------------------------------------------------------------------- */
/*                            ERROR HANDLING                                   */
/* -------------------------------------------------------------------------- */

app.use((req, res) => {
res.status(404).json({
message: 'API route not found',
});
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

server.keepAliveTimeout =
  config.timeouts?.keepAlive || 65000;

server.headersTimeout =
  config.timeouts?.headers || 66000;

server.requestTimeout =
  config.timeouts?.request || 120000;

/* -------------------------------------------------------------------------- */
/*                              START SERVER                                   */
/* -------------------------------------------------------------------------- */

if (!server.listening) {
  server.listen(config.port, () => {
    logger.info(
      `Server running (${config.env}) at http://localhost:${config.port}`
    );

    logger.info('Metrics available at: /metrics');
    logger.info('Health check at: /healthz');
    logger.info('Readiness check at: /readyz');
  });
}

server.on('error', (err) => {
  logger.error('HTTP Server Error', {
    error: err.message,
    code: err.code,
  });

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
      logger.error('MongoDB shutdown error', {
        error: err.message,
      });
    } finally {
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
  logger.error('Unhandled Rejection', {
    reason,
  });

  shutdown(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack,
  });

  shutdown(1);
});

module.exports = {
  app,
  server,
  io,
};