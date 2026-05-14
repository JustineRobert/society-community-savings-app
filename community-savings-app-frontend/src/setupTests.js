/**
 * src/setupTests.js
 * Vitest setup file for test configuration
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom';

// This file runs before all tests

// Mock axios to prevent ES module loading issues
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
  request: vi.fn(),
}));


