/**
 * Test Setup and Configuration
 * Configuración global para todos los tests
 */

// Configure environment for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.LOG_LEVEL = 'silent';

// Mock console methods globally to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Global test utilities
global.testUtils = {
  /**
   * Creates a valid webhook payload for testing
   */
  createValidWebhookPayload: (event = 'proposal.created', customData = {}) => {
    const basePayload = {
      event,
      timestamp: new Date().toISOString(),
      source: 'prolibu',
      data: {
        id: 'prop-test-123',
        external_id: 'ext-test-456',
        stage: 'qualification',
        amount: 10000,
        probability: 20,
        client: {
          id: 'client-test-789',
          name: 'Test Client',
          email: 'test@client.com'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...customData
      }
    };

    // Add event-specific fields
    if (event === 'proposal.updated') {
      basePayload.data.changes = {
        stage: { from: 'lead', to: 'qualification' }
      };
    }

    if (event === 'proposal.deleted') {
      basePayload.data.deleted_at = new Date().toISOString();
      basePayload.data.deletion_reason = 'Test deletion';
    }

    return basePayload;
  },

  /**
   * Creates an invalid webhook payload for testing error cases
   */
  createInvalidWebhookPayload: (type = 'missing-required') => {
    switch (type) {
    case 'missing-required':
      return {
        event: 'proposal.created',
        timestamp: new Date().toISOString(),
        source: 'prolibu',
        data: {
          id: 'prop-invalid'
          // Missing required fields
        }
      };

    case 'invalid-event':
      return {
        event: 'proposal.invalid',
        timestamp: new Date().toISOString(),
        source: 'prolibu',
        data: {
          id: 'prop-test-123',
          stage: 'qualification'
        }
      };

    case 'invalid-stage':
      return {
        event: 'proposal.created',
        timestamp: new Date().toISOString(),
        source: 'prolibu',
        data: {
          id: 'prop-test-123',
          external_id: 'ext-test-456',
          stage: 'invalid_unknown_stage',
          amount: 10000,
          probability: 20,
          client: {
            id: 'client-test-789',
            name: 'Test Client',
            email: 'test@client.com'
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };

    default:
      return {};
    }
  },

  /**
   * Waits for a specified amount of time
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generates a random test ID
   */
  generateTestId: (prefix = 'test') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
};

// Setup and teardown hooks
beforeAll(() => {
  // Global setup before all tests
});

afterAll(() => {
  // Global cleanup after all tests
});

// Reset mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});
