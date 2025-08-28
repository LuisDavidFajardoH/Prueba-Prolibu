const request = require('supertest');
const { createServer } = require('../app/server');

/**
 * Tests de integración completa
 * Verifica el flujo end-to-end del microservicio
 */

describe('Integration Tests - Complete Webhook Flow', () => {
  let app;

  beforeAll(() => {
    // Create server instance for testing
    app = createServer();
  });

  describe('Complete Webhook Processing Flow', () => {
    test('should handle complete proposal.created flow', async () => {
      const webhookPayload = {
        event: 'proposal.created',
        timestamp: '2024-01-15T10:00:00Z',
        source: 'prolibu',
        data: {
          id: 'prop-integration-123',
          external_id: 'ext-integration-456',
          stage: 'qualification',
          amount: 25000,
          probability: 30,
          client: {
            id: 'client-integration-789',
            name: 'Integration Test Client',
            email: 'integration@test.com'
          },
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        }
      };

      const response = await request(app)
        .post('/webhooks/prolibu')
        .send(webhookPayload)
        .expect(200);

      // Verify response structure
      expect(response.body).toMatchObject({
        success: true,
        message: 'Proposal created successfully',
        traceId: expect.any(String),
        event: 'proposal.created',
        data: {
          prolibuId: 'prop-integration-123',
          salesforceStage: 'Qualification',
          originalStage: 'qualification',
          amount: 25000,
          client: {
            id: 'client-integration-789',
            name: 'Integration Test Client',
            email: 'integration@test.com'
          }
        }
      });

      // Verify headers
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.headers['x-trace-id']).toBeDefined();
    });

    test('should handle complete proposal.updated flow with stage change', async () => {
      const webhookPayload = {
        event: 'proposal.updated',
        timestamp: '2024-01-16T14:30:00Z',
        source: 'prolibu',
        data: {
          id: 'prop-integration-123',
          external_id: 'ext-integration-456',
          stage: 'negotiation',
          amount: 28000,
          probability: 80,
          client: {
            id: 'client-integration-789',
            name: 'Integration Test Client',
            email: 'integration@test.com'
          },
          changes: {
            stage: { from: 'qualification', to: 'negotiation' },
            amount: { from: 25000, to: 28000 },
            probability: { from: 30, to: 80 }
          },
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-16T14:30:00Z'
        }
      };

      const response = await request(app)
        .post('/webhooks/prolibu')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Proposal updated successfully',
        event: 'proposal.updated',
        data: {
          prolibuId: 'prop-integration-123',
          salesforceStage: 'Negotiation/Review',
          originalStage: 'negotiation',
          amount: 28000,
          changes: {
            stage: { from: 'qualification', to: 'negotiation' },
            amount: { from: 25000, to: 28000 },
            probability: { from: 30, to: 80 }
          }
        }
      });
    });

    test('should handle complete proposal.deleted flow', async () => {
      const webhookPayload = {
        event: 'proposal.deleted',
        timestamp: '2024-01-17T09:15:00Z',
        source: 'prolibu',
        data: {
          id: 'prop-integration-123',
          external_id: 'ext-integration-456',
          stage: 'cancelled',
          deleted_at: '2024-01-17T09:15:00Z',
          deletion_reason: 'Client decided not to proceed'
        }
      };

      const response = await request(app)
        .post('/webhooks/prolibu')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Proposal deleted successfully',
        event: 'proposal.deleted',
        data: {
          prolibuId: 'prop-integration-123',
          externalId: 'ext-integration-456',
          salesforceStage: 'Closed Lost',
          originalStage: 'cancelled',
          deletedAt: '2024-01-17T09:15:00Z',
          reason: 'Client decided not to proceed'
        }
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
          id: 'invalid-prop',
          stage: 'qualification'
        }
      };

      const response = await request(app)
        .post('/webhooks/prolibu')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation Error',
        traceId: expect.any(String)
      });

      expect(response.headers['x-trace-id']).toBeDefined();
    });

    test('should handle unsupported events with proper error', async () => {
      const unsupportedPayload = {
        event: 'proposal.archived',
        timestamp: '2024-01-15T10:00:00Z',
        source: 'prolibu',
        data: {
          id: 'prop-123',
          status: 'archived'
        }
      };

      const response = await request(app)
        .post('/webhooks/prolibu')
        .send(unsupportedPayload)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation Error',
        message: expect.stringContaining('proposal.archived'),
        traceId: expect.any(String)
      });
    });

    test('should handle malformed JSON with proper error', async () => {
      const response = await request(app)
        .post('/webhooks/prolibu')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Bad Request',
        message: expect.stringContaining('JSON')
      });
    });

    test('should handle stage mapping errors gracefully', async () => {
      const webhookPayload = {
        event: 'proposal.created',
        timestamp: '2024-01-15T10:00:00Z',
        source: 'prolibu',
        data: {
          id: 'prop-invalid-stage-123',
          external_id: 'ext-invalid-456',
          stage: 'completely_unknown_stage',
          amount: 10000,
          probability: 20,
          client: {
            id: 'client-789',
            name: 'Test Client',
            email: 'test@client.com'
          },
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        }
      };

      const response = await request(app)
        .post('/webhooks/prolibu')
        .send(webhookPayload)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Stage mapping error',
        message: expect.stringContaining('no tiene mapeo definido'),
        traceId: expect.any(String)
      });
    });
  });

  describe('Health and Status Endpoints Integration', () => {
    test('should provide health check with system status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        service: 'prolibu-webhook-microservice',
        version: expect.any(String)
      });
    });

    test('should provide webhook-specific health check', async () => {
      const response = await request(app)
        .get('/webhooks/prolibu/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'prolibu-webhook',
        supportedEvents: ['proposal.created', 'proposal.updated', 'proposal.deleted'],
        timestamp: expect.any(String)
      });
    });

    test('should provide supported events information', async () => {
      const response = await request(app)
        .get('/webhooks/prolibu/events')
        .expect(200);

      expect(response.body).toMatchObject({
        supportedEvents: ['proposal.created', 'proposal.updated', 'proposal.deleted'],
        count: 3,
        service: 'prolibu-webhook'
      });
    });
  });

  describe('State Mapping Integration', () => {
    test('should correctly map all supported Prolibu stages', async () => {
      const testStages = [
        { prolibu: 'lead', salesforce: 'Prospecting' },
        { prolibu: 'qualification', salesforce: 'Qualification' },
        { prolibu: 'proposal', salesforce: 'Proposal/Price Quote' },
        { prolibu: 'negotiation', salesforce: 'Negotiation/Review' },
        { prolibu: 'won', salesforce: 'Closed Won' },
        { prolibu: 'lost', salesforce: 'Closed Lost' }
      ];

      for (const { prolibu, salesforce } of testStages) {
        const webhookPayload = {
          event: 'proposal.created',
          timestamp: '2024-01-15T10:00:00Z',
          source: 'prolibu',
          data: {
            id: `prop-${prolibu}-123`,
            external_id: `ext-${prolibu}-456`,
            stage: prolibu,
            amount: 10000,
            probability: 50,
            client: {
              id: 'client-789',
              name: 'Test Client',
              email: 'test@client.com'
            },
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T10:00:00Z'
          }
        };

        const response = await request(app)
          .post('/webhooks/prolibu')
          .send(webhookPayload)
          .expect(200);

        expect(response.body.data.salesforceStage).toBe(salesforce);
        expect(response.body.data.originalStage).toBe(prolibu);
      }
    });
  });

  describe('Headers and Middleware Integration', () => {
    test('should set proper security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for security headers (helmet middleware)
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });

    test('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/webhooks/prolibu')
        .set('Origin', 'https://prolibu.com')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    test('should include trace ID in all responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-trace-id']).toBeDefined();
      expect(response.headers['x-trace-id']).toMatch(/^[a-f0-9-]{36}$/);
    });
  });

  describe('404 and Route Handling Integration', () => {
    test('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown/route')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Not Found',
        message: 'Route GET /unknown/route not found',
        traceId: expect.any(String)
      });
    });

    test('should handle 404 for unknown webhook endpoints', async () => {
      const response = await request(app)
        .post('/webhooks/unknown')
        .send({ test: 'data' })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Not Found',
        message: 'Route POST /webhooks/unknown not found'
      });
    });
  });
});
