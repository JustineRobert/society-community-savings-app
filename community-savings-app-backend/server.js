// server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
const path = require('path');
const http = require('http');
const winston = require('winston');
const mongoose = require('mongoose');
const { errorHandler } = require('./middleware/errorHandler');

// variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Validate required environment variables
const requiredEnvVars = ['PORT', 'MONGO_URI', 'JWT_SECRET'];
requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

// MongoDB Connection
const connectDB = require('./config/db');
connectDB();

const app = express();

// ----------------------------
// Global Middleware
// ----------------------------
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ----------------------------
// Routes
// ----------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/contributions', require('./routes/contributions'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/chats', require('./routes/chat'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/settings', require('./routes/settings'));

app.get('/', (req, res) => res.status(200).json({ 
  message: '🚀 Community Savings App Backend is running!',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}));

// 404 Handler
app.use((req, res) => res.status(404).json({ message: 'API route not found' }));

// Global Error Handler (must be last)
app.use(errorHandler);

// ----------------------------
// Server Initialization
// ----------------------------
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`✅ Server running in ${process.env.NODE_ENV || 'development'} mode at http://localhost:${PORT}`);
});

// ----------------------------
// Graceful Shutdown
// ----------------------------
const shutdown = async (code = 0) => {
  console.log('🛑 Gracefully shutting down...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB disconnected');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(code);
    });
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  shutdown(1);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  shutdown(1);
});