// jest.config.js
// ============================================================================
// Jest Configuration
// GitHub Copilot assisted configuration
// Production-ready setup for Community Savings Backend
// ============================================================================

module.exports = {
  displayName: 'Community Savings Backend Tests',

  // Test environment
  testEnvironment: 'node',

  // Root directories to test
  roots: ['<rootDir>/'],

  // Test file patterns
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js', '**/tests/**/*.test.js'],

  // Coverage collection
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
  coverageDirectory: 'coverage',

  // Coverage thresholds
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

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './test-reports',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
      },
    ],
  ],

  // Bail early on first failure in watch mode
  bail: false,

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  // Coverage reporters
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json'],

  // Timers — disabled to avoid Mongoose warnings
  // (fakeTimers can interfere with MongoDB driver async operations)
  // Remove or comment out if not needed
  // fakeTimers: {
  //   enableGlobally: true,
  // },
};
