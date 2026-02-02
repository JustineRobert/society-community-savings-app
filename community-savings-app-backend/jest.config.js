// jest.config.js
// ============================================================================
// Jest Configuration
// Unit and integration testing framework setup
// ============================================================================

module.exports = {
  displayName: 'Community Savings Backend Tests',
  testEnvironment: 'node',
  
  // Root directories to test
  roots: ['<rootDir>/'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],

  // Coverage thresholds
  collectCoverageFrom: [
    'controllers/**/*.js',
    'models/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    'routes/**/*.js',
    '!**/*.config.js',
    '!**/node_modules/**',
    '!**/dist/**',
  ],

  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './controllers/**/*.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,

  // Transform
  transform: {},

  // Module directories
  moduleFileExtensions: ['js', 'json'],

  // Verbose output
  verbose: true,

  // Reporter
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-reports',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
    }],
    ['jest-html-reporters', {
      publicPath: './test-reports',
      filename: 'report.html',
      expand: true,
    }],
  ],

  // Bail early on first failure in watch mode
  bail: false,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
  ],

  // Timers
  timers: 'fake',
};
