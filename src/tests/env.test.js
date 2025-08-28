const { loadAndValidateEnv, validateSalesforceConfig, envSchema } = require('../app/libs/env');

/**
 * Tests para validación de variables de entorno
 * Verifica que la configuración se cargue y valide correctamente
 */

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadAndValidateEnv', () => {
    test('should load valid environment variables', () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3000';
      process.env.LOG_LEVEL = 'info';

      const config = loadAndValidateEnv();

      expect(config).toMatchObject({
        NODE_ENV: 'test',
        PORT: 3000,
        LOG_LEVEL: 'info'
      });
    });

    test('should use default values for missing variables', () => {
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.LOG_LEVEL;

      const config = loadAndValidateEnv();

      expect(config).toMatchObject({
        NODE_ENV: 'development',
        PORT: 3000,
        LOG_LEVEL: 'info'
      });
    });

    test('should validate PORT as number', () => {
      process.env.PORT = '8080';

      const config = loadAndValidateEnv();

      expect(config.PORT).toBe(8080);
      expect(typeof config.PORT).toBe('number');
    });

    test('should reject invalid PORT values', () => {
      process.env.PORT = '0';

      expect(() => loadAndValidateEnv()).toThrow(/PORT debe ser un número entre 1 y 65535/);
    });

    test('should reject invalid NODE_ENV values', () => {
      process.env.NODE_ENV = 'invalid';

      expect(() => loadAndValidateEnv()).toThrow(/Variables de entorno inválidas/);
    });

    test('should reject invalid LOG_LEVEL values', () => {
      process.env.LOG_LEVEL = 'invalid';

      expect(() => loadAndValidateEnv()).toThrow(/Variables de entorno inválidas/);
    });
  });

  describe('validateSalesforceConfig', () => {
    test('should return false when Salesforce variables are missing', () => {
      const config = {
        NODE_ENV: 'test',
        PORT: 3000,
        LOG_LEVEL: 'info'
      };

      const isValid = validateSalesforceConfig(config);

      expect(isValid).toBe(false);
    });

    test('should return true when all Salesforce variables are present', () => {
      const config = {
        NODE_ENV: 'test',
        PORT: 3000,
        LOG_LEVEL: 'info',
        SF_LOGIN_URL: 'https://login.salesforce.com',
        SF_USERNAME: 'test@example.com',
        SF_PASSWORD: 'password',
        SF_CLIENT_ID: 'client_id',
        SF_CLIENT_SECRET: 'client_secret'
      };

      const isValid = validateSalesforceConfig(config);

      expect(isValid).toBe(true);
    });

    test('should return false when some Salesforce variables are missing', () => {
      const config = {
        NODE_ENV: 'test',
        PORT: 3000,
        LOG_LEVEL: 'info',
        SF_LOGIN_URL: 'https://login.salesforce.com',
        SF_USERNAME: 'test@example.com'
        // Faltan: SF_PASSWORD, SF_CLIENT_ID, SF_CLIENT_SECRET
      };

      const isValid = validateSalesforceConfig(config);

      expect(isValid).toBe(false);
    });
  });

  describe('envSchema', () => {
    test('should validate correct schema', () => {
      const validEnv = {
        NODE_ENV: 'production',
        PORT: '443',
        LOG_LEVEL: 'warn',
        SF_LOGIN_URL: 'https://login.salesforce.com'
      };

      const result = envSchema.safeParse(validEnv);

      expect(result.success).toBe(true);
      expect(result.data.PORT).toBe(443);
    });

    test('should reject invalid schema', () => {
      const invalidEnv = {
        NODE_ENV: 'invalid',
        PORT: 'not-a-number',
        LOG_LEVEL: 'invalid'
      };

      const result = envSchema.safeParse(invalidEnv);

      expect(result.success).toBe(false);
      expect(result.error.issues.length).toBeGreaterThan(0);
    });
  });
});
