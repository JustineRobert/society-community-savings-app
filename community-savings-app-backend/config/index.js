// config/index.js
// Centralized configuration with validation and sensible defaults.

'use strict';

const path = require('path');
const dotenv = require('dotenv');
const Joi = require('joi');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(5000),
  MONGO_URI: Joi.string().allow('').optional(),
  MONGO_URI_FALLBACK: Joi.string().default('mongodb://127.0.0.1:27017/community_savings'),
  REDIS_URI: Joi.string().default('redis://127.0.0.1:6379'),
  JWT_SECRET: Joi.string().required(),
  ACCESS_TOKEN_SECRET: Joi.string().optional(),
  RATE_LIMIT_MAX: Joi.number().default(100),
  BODY_LIMIT: Joi.string().default('1mb'),
  MTN_MOMO_BASE_URL: Joi.string().optional(),
  MTN_TOKEN: Joi.string().optional(),
  CASH_ACCOUNT_ID: Joi.string().optional(),
  USER_WALLET_ACCOUNT_ID: Joi.string().optional(),
  KEEP_ALIVE_TIMEOUT_MS: Joi.number().default(5000),
  HEADERS_TIMEOUT_MS: Joi.number().default(6500),
  REQUEST_TIMEOUT_MS: Joi.number().default(30000),
  SHUTDOWN_TIMEOUT_MS: Joi.number().default(10000),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  ADMIN_MAX_RANGE_DAYS: Joi.number().default(90),
  SKIP_DB_CHECKS: Joi.boolean().truthy('true').falsy('false').default(false),
  GRACEFUL_STARTUP: Joi.boolean().truthy('true').falsy('false').default(false),
}).unknown(true);

const { value: env, error } = schema.validate(process.env, { abortEarly: false });

if (error) {
  // Fail fast in non-test environments
  if (env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error('Environment validation error:', error.details.map((d) => d.message).join(', '));
    process.exit(1);
  }
}

const config = {
  env: env.NODE_ENV,
  port: Number(env.PORT),
  mongoUri: env.MONGO_URI && env.MONGO_URI.trim() ? env.MONGO_URI.trim() : env.MONGO_URI_FALLBACK,
  mongoUriFallback: env.MONGO_URI_FALLBACK,
  redisUri: env.REDIS_URI,
  jwtSecret: env.JWT_SECRET,
  accessTokenSecret: env.ACCESS_TOKEN_SECRET || env.JWT_SECRET,
  rateLimitMax: Number(env.RATE_LIMIT_MAX),
  bodyLimit: env.BODY_LIMIT,
  mtn: {
    baseUrl: env.MTN_MOMO_BASE_URL,
    token: env.MTN_TOKEN,
  },
  accounts: {
    cashAccountId: env.CASH_ACCOUNT_ID,
    userWalletAccountId: env.USER_WALLET_ACCOUNT_ID,
  },
  timeouts: {
    keepAlive: Number(env.KEEP_ALIVE_TIMEOUT_MS),
    headers: Number(env.HEADERS_TIMEOUT_MS),
    request: Number(env.REQUEST_TIMEOUT_MS),
    shutdown: Number(env.SHUTDOWN_TIMEOUT_MS),
  },
  corsOrigins: env.CORS_ORIGINS,
  admin: {
    maxRangeDays: Number(env.ADMIN_MAX_RANGE_DAYS),
  },
  flags: {
    skipDbChecks: env.SKIP_DB_CHECKS,
    gracefulStartup: env.GRACEFUL_STARTUP,
  },
};

module.exports = config;