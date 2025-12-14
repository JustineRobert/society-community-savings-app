// config/db.js
require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const srvURI = process.env.MONGO_URI;
const standardURI = process.env.MONGO_URI_FALLBACK; // Add this to .env

/*
 * Connect to MongoDB with retry and fallback support
 */
const connectDB = async (retryCount = 0, useFallback = false) => {
  const mongoURI = useFallback ? standardURI : srvURI;

  if (!mongoURI) {
    logger.error('❌ MongoDB URI is missing in environment variables.');
    return process.exit(1);
  }

  try {
    await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    logger.info(
      `✅ MongoDB connected successfully using ${
        useFallback ? 'Fallback URI' : 'SRV URI'
      }`
    );

  } catch (error) {
    logger.error(`❌ MongoDB connection failed: ${error.message}`);

    // DNS problem → switch to fallback URI only once
    if (error.message.includes('ENOTFOUND') && !useFallback && standardURI) {
      logger.warn('⚠️ DNS lookup failed. Switching to fallback URI...');
      return connectDB(0, true);
    }

    // Retry mechanism (up to 5 attempts)
    if (retryCount < 5) {
      const delay = Math.min(5000 * (retryCount + 1), 30000);
      logger.warn(
        `🔄 Retrying MongoDB connection in ${delay / 1000}s... (Attempt ${
          retryCount + 1
        }/5)`
      );

      return setTimeout(
        () => connectDB(retryCount + 1, useFallback),
        delay
      );
    }

    logger.error('🛑 Maximum retry attempts reached. Shutting down...');
    process.exit(1);
  }
};

// MongoDB events
mongoose.connection.on('connected', () =>
  logger.info('🔌 MongoDB connection established')
);

mongoose.connection.on('disconnected', () =>
  logger.warn('⚠️ MongoDB disconnected')
);

mongoose.connection.on('error', (err) =>
  logger.error(`❌ MongoDB error: ${err.message}`)
);

module.exports = connectDB;
