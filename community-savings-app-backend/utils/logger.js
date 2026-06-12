// utils/logger.js
// Winston-based structured logger with environment-aware formatting.

'use strict';

const winston = require('winston');
const config = require('../config');

const isProd = config.env === 'production';

const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: isProd
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : winston.format.combine(winston.format.colorize(), winston.format.timestamp(), winston.format.simple()),
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
});

// Helper wrappers for consistent structured logs
const wrap = (level) => (message, meta = {}) => {
  if (typeof message === 'object') {
    logger.log(level, '', message);
  } else {
    logger.log(level, message, meta);
  }
};

module.exports = {
  logger,
  debug: wrap('debug'),
  info: wrap('info'),
  warn: wrap('warn'),
  error: wrap('error'),
};
