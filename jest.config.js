module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['./test/setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  testMatch: ['**/test/**/*.test.js'],
  verbose: true
};
