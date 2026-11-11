module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 60000,
  maxWorkers: 1,
  collectCoverageFrom: ['controllers/**/*.js', 'services/**/*.js', 'middleware/**/*.js'],
  coverageDirectory: 'coverage',
  verbose: true,
};
