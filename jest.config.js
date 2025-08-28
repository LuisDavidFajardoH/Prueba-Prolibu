module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.js', '!src/index.js', '!src/**/test*.js'],
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  verbose: true,
  // Cargar dotenv antes de los tests para tener acceso a Salesforce
  setupFiles: ['<rootDir>/jest.setup.js'],
};
