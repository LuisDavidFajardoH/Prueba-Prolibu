const request = require('supertest');
const { createServer } = require('../app/server');

/**
 * Tests para el controlador de webhooks de Prolibu
 * Verifica que los endpoints funcionen correctamente y manejen errores apropiadamente
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

describe('Prolibu Webhook Controller', () => {
  let app;

  beforeAll(() => {
    // Crear instancia de la app para testing
    app = createServer();
  });

  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Limpiar después de los tests
    if (app && app.close) {
      app.close();
    }
  });

  describe('POST /webhooks/prolibu', () => {
    describe('Casos exitosos', () => {
      test('should process proposal.created successfully', async () => {
        const payload = {
          event: 'proposal.created',
          data: {
            proposalId: 'TEST-CREATED-001',
            title: 'Test Proposal Created',
            amount: { total: 1000.5 },
            stage: 'qualification',
            description: 'Test proposal for unit testing',
          },
          timestamp: '2025-08-28T10:00:00.000Z',
          webhookId: 'test-webhook-created-001',
        };

        const response = await request(app).post('/webhooks/prolibu').send(payload).expect(200);

        expect(response.body).toMatchObject({
          status: 'ok',
          message: 'Webhook procesado exitosamente',
          data: {
            event: 'proposal.created',
            proposalId: 'TEST-CREATED-001',
            processed: true,
          },
        });

        expect(response.body.traceId).toBeDefined();
        expect(response.body.data.salesforceId).toMatch(/^SF_OPP_\d+$/);
      });

      test('should process proposal.updated successfully', async () => {
        const payload = {
          event: 'proposal.updated',
          data: {
            proposalId: 'TEST-UPDATED-001',
            title: 'Updated Test Proposal',
            amount: { total: 1500.75 },
            stage: 'proposal',
          },
          timestamp: '2025-08-28T11:00:00.000Z',
        };

        const response = await request(app).post('/webhooks/prolibu').send(payload).expect(200);

        expect(response.body).toMatchObject({
          status: 'ok',
          message: 'Webhook procesado exitosamente',
          data: {
            event: 'proposal.updated',
            proposalId: 'TEST-UPDATED-001',
            processed: true,
          },
        });
      });

      test('should process proposal.deleted successfully', async () => {
        const payload = {
          event: 'proposal.deleted',
          data: {
            proposalId: 'TEST-DELETED-001',
            closeDate: '2025-08-28',
            reason: 'Test deletion',
          },
          timestamp: '2025-08-28T12:00:00.000Z',
        };

        const response = await request(app).post('/webhooks/prolibu').send(payload).expect(200);

        expect(response.body).toMatchObject({
          status: 'ok',
          message: 'Webhook procesado exitosamente',
          data: {
            event: 'proposal.deleted',
            proposalId: 'TEST-DELETED-001',
            processed: true,
          },
        });
      });
    });

    describe('Casos de error de validación', () => {
      test('should reject invalid event type', async () => {
        const payload = {
          event: 'invalid.event',
          data: { proposalId: 'TEST-001' },
        };

        const response = await request(app).post('/webhooks/prolibu').send(payload).expect(400);

        expect(response.body).toMatchObject({
          error: 'validation_error',
          message: 'Los datos enviados no son válidos',
        });

        expect(response.body.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'event',
              message: expect.stringContaining('proposal.created'),
            }),
          ])
        );
      });

      test('should reject proposal.created without required fields', async () => {
        const payload = {
          event: 'proposal.created',
          data: {
            proposalId: 'TEST-001',
            // Faltan: title, amount.total, stage
          },
        };

        const response = await request(app).post('/webhooks/prolibu').send(payload).expect(400);

        expect(response.body.error).toBe('validation_error');
        expect(response.body.details.length).toBeGreaterThan(0);
      });

      test('should reject proposal.updated without proposalId', async () => {
        const payload = {
          event: 'proposal.updated',
          data: {
            title: 'Test without ID',
          },
        };

        const response = await request(app).post('/webhooks/prolibu').send(payload).expect(400);

        expect(response.body.error).toBe('validation_error');
      });

      test('should reject negative amount', async () => {
        const payload = {
          event: 'proposal.created',
          data: {
            proposalId: 'TEST-NEGATIVE-001',
            title: 'Test Negative Amount',
            amount: { total: -100 },
            stage: 'qualification',
          },
        };

        const response = await request(app).post('/webhooks/prolibu').send(payload).expect(400);

        expect(response.body.error).toBe('validation_error');
      });

      test('should reject invalid date format', async () => {
        const payload = {
          event: 'proposal.deleted',
          data: {
            proposalId: 'TEST-BAD-DATE-001',
            closeDate: '28-08-2025', // Formato incorrecto
          },
        };

        const response = await request(app).post('/webhooks/prolibu').send(payload).expect(400);

        expect(response.body.error).toBe('validation_error');
      });
    });

    describe('Casos de error de formato', () => {
      test('should reject empty body', async () => {
        const response = await request(app).post('/webhooks/prolibu').send({}).expect(400);

        expect(response.body.error).toBe('empty_body');
      });

      test('should reject malformed JSON', async () => {
        const response = await request(app)
          .post('/webhooks/prolibu')
          .set('Content-Type', 'application/json')
          .send('{"invalid": json}')
          .expect(400);

        expect(response.body.error).toBe('invalid_json');
      });
    });
  });

  describe('GET /webhooks/prolibu/health', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/webhooks/prolibu/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'prolibu-webhooks',
        version: expect.any(String),
        environment: expect.any(String),
        uptime: expect.any(Number),
      });
    });
  });

  describe('GET /webhooks/prolibu/info', () => {
    test('should return webhook information', async () => {
      const response = await request(app).get('/webhooks/prolibu/info').expect(200);

      expect(response.body).toMatchObject({
        supportedEvents: ['proposal.created', 'proposal.updated', 'proposal.deleted'],
        requiredFields: {
          'proposal.created': expect.arrayContaining([
            'proposalId',
            'title',
            'amount.total',
            'stage',
          ]),
          'proposal.updated': ['proposalId'],
          'proposal.deleted': ['proposalId'],
        },
        stageMapping: expect.objectContaining({
          totalMappings: expect.any(Number),
          prolibsStages: expect.any(Array),
          salesforceStages: expect.any(Array),
        }),
      });
    });
  });
});
