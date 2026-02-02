// tests/setup.js
// ============================================================================
// Test Setup
// Initializes test environment, database, and utilities
// ============================================================================

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/community-savings-test';

// Suppress console output during tests (can be overridden)
if (process.env.DEBUG !== 'true') {
  global.console.log = jest.fn();
  global.console.info = jest.fn();
  global.console.warn = jest.fn();
}

// Extend timeout for integration tests
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  try {
    // Drop test database
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
  } catch (error) {
    console.error('Error cleaning up test database:', error);
  }
});
