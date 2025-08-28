const request = require('supertest');
const { createServer } = require('../app/server');

/**
 * Tests de integración completa
 * Verifica el flujo end-to-end del microservicio
 */

// Mock del servicio de Salesforce (es una instancia singleton)
jest.mock('../services/salesforce.service', () => ({
  createOpportunity: jest.fn().mockResolvedValue({
    success: true,
    salesforceId: 'SF_OPP_MOCK_123',
    operation: 'created',
    opportunityData: {},
  }),
  updateOpportunity: jest.fn().mockResolvedValue({
    success: true,
    salesforceId: 'SF_OPP_MOCK_123',
    operation: 'updated',
    opportunityData: {},
  }),
  markOpportunityAsClosedLost: jest.fn().mockResolvedValue({
    success: true,
    salesforceId: 'SF_OPP_MOCK_123',
    operation: 'closed_lost',
  }),
}));

describe('Integration Tests - Complete Webhook Flow', () => {
  let app;

  beforeAll(() => {
    // Create server instance for testing
    app = createServer();
  });

  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
  });

  describe('Complete Webhook Processing Flow', () => {
    test('should handle complete proposal.created flow', async () => {
      const webhookPayload = {
        event: 'proposal.created',
        timestamp: '2024-01-15T10:00:00Z',
        source: 'prolibu',
        data: {
          proposalId: 'prop-integration-123',
          stage: 'qualification',
          amount: { total: 25000 },
          title: 'Integration Test Proposal',
          description: 'Test description',
        },
      };

      const response = await request(app)
        .post('/webhooks/prolibu')
        .send(webhookPayload)
        .expect(200);

      // Verify response structure
      expect(response.body).toMatchObject({
        status: 'ok',
        message: 'Webhook procesado exitosamente',
        traceId: expect.any(String),
        data: {
          event: 'proposal.created',
          proposalId: 'prop-integration-123',
          salesforceId: expect.stringMatching(/^SF_OPP_\d+$/),
          processed: true,
        },
      });

      // Verify headers
      expect(response.headers['content-type']).toMatch(/json/);
    });

    test('should handle complete proposal.updated flow', async () => {
      const webhookPayload = {
        event: 'proposal.updated',
        timestamp: '2024-01-16T14:30:00Z',
        source: 'prolibu',
        data: {
          proposalId: 'prop-integration-123',
          stage: 'negotiation',
        },
      };

      const response = await request(app)
        .post('/webhooks/prolibu')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        message: 'Webhook procesado exitosamente',
        data: {
          event: 'proposal.updated',
          proposalId: 'prop-integration-123',
          processed: true,
        },
      });
    });

    test('should handle complete proposal.deleted flow', async () => {
      const webhookPayload = {
        event: 'proposal.deleted',
        timestamp: '2024-01-17T09:15:00Z',
        source: 'prolibu',
        data: {
          proposalId: 'prop-integration-123',
        },
      };

      const response = await request(app)
        .post('/webhooks/prolibu')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        message: 'Webhook procesado exitosamente',
        data: {
          event: 'proposal.deleted',
          proposalId: 'prop-integration-123',
          processed: true,
        },
      });
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle validation errors with proper trace ID', async () => {
      const invalidPayload = {
        event: 'proposal.created',
        timestamp: '2024-01-15T10:00:00Z',
        source: 'prolibu',
        data: {
          // Missing required fields
          proposalId: '',
        },
      };

      const response = await request(app)
        .post('/webhooks/prolibu')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'validation_error',
        message: 'Los datos enviados no son válidos',
      });
    });

    test('should handle unsupported events with proper error', async () => {
      const unsupportedPayload = {
        event: 'proposal.archived',
        timestamp: '2024-01-15T10:00:00Z',
        source: 'prolibu',
        data: {
          proposalId: 'prop-123',
        },
      };

      const response = await request(app)
        .post('/webhooks/prolibu')
        .send(unsupportedPayload)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'validation_error',
        message: 'Los datos enviados no son válidos',
      });
    });

    test('should handle malformed JSON with proper error', async () => {
      const response = await request(app)
        .post('/webhooks/prolibu')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'invalid_json',
        message: expect.stringContaining('JSON'),
      });
    });
  });

  describe('Health and Status Endpoints Integration', () => {
    test('should provide health check with system status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        service: 'prolibu-salesforce-webhook',
        version: expect.any(String),
      });
    });

    test('should provide webhook-specific health check', async () => {
      const response = await request(app).get('/webhooks/prolibu/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'prolibu-webhooks',
        timestamp: expect.any(String),
      });
    });
  });

  describe('404 and Route Handling Integration', () => {
    test('should handle 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown/route').expect(404);

      expect(response.body).toMatchObject({
        error: 'not_found',
        message: 'La ruta GET /unknown/route no existe',
      });
    });

    test('should handle 404 for unknown webhook endpoints', async () => {
      const response = await request(app)
        .post('/webhooks/unknown')
        .send({ test: 'data' })
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'not_found',
        message: 'La ruta POST /webhooks/unknown no existe',
      });
    });
  });
});
