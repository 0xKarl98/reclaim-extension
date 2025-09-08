module.exports = {
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/src/**/*.test.js',
    '<rootDir>/src/**/*.spec.js'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/zk-symmetric-crypto/'
  ],
  moduleFileExtensions: ['js', 'json'],
  transform: {
    '^.+\.js$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(p-queue|eventemitter3)/)'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/utils/mocks/chrome-mock.js'],
  moduleNameMapper: {
    '^@noir-lang/(.*)$': '<rootDir>/node_modules/@noir-lang/$1',
    '^@aztec/(.*)$': '<rootDir>/node_modules/@aztec/$1'
  }
};