/**
 * src/setupTests.js
 * Jest setup file for test configuration
 */

// This file runs before all tests

// Mock axios to prevent ES module loading issues
jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    request: jest.fn(),
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  request: jest.fn(),
}));

// Ensure @testing-library/jest-dom matchers are available
import '@testing-library/jest-dom';

