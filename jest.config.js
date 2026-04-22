module.exports = {
  displayName: 'backend',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/index.js',
    '!src/config/microsoft.strategy.js', // Skip Azure AD for unit tests
    '!src/migrations/**',
  ],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testTimeout: 30000,
  maxWorkers: 1,
  verbose: true,
  bail: false,
  forceExit: true,
  detectOpenHandles: true,
};
