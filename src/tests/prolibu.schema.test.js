const {
  validateWebhook,
  validateProposalData,
  proposalCreatedDataSchema,
  proposalUpdatedDataSchema,
  proposalDeletedDataSchema,
  SUPPORTED_EVENTS,
  REQUIRED_FIELDS,
} = require('../webhooks/prolibu.schema');

/**
 * Tests para schemas de validación de webhooks
 * Verifica que las validaciones Zod funcionen correctamente
 */

describe('Prolibu Schema Validation', () => {
  describe('validateWebhook', () => {
    describe('proposal.created', () => {
      test('should validate correct proposal.created payload', () => {
        const payload = {
          event: 'proposal.created',
          data: {
            proposalId: 'TEST-001',
            title: 'Test Proposal',
            amount: { total: 1000.5 },
            stage: 'qualification',
          },
          timestamp: '2025-08-28T10:00:00.000Z',
          webhookId: 'webhook-001',
        };

        const result = validateWebhook(payload);

        expect(result).toMatchObject({
          event: 'proposal.created',
          data: {
            proposalId: 'TEST-001',
            title: 'Test Proposal',
            amount: { total: 1000.5 },
            stage: 'qualification',
          },
        });
      });

      test('should reject proposal.created without required fields', () => {
        const payload = {
          event: 'proposal.created',
          data: {
            proposalId: 'TEST-001',
            // Faltan: title, amount, stage
          },
        };

        expect(() => validateWebhook(payload)).toThrow();
      });

      test('should reject proposal.created with negative amount', () => {
        const payload = {
          event: 'proposal.created',
          timestamp: '2024-01-15T10:00:00Z',
          source: 'prolibu',
          data: {
            proposalId: 'prop-123',
            stage: 'qualification',
            amount: { total: -1000 },
          },
        };

        expect(() => validateWebhook(payload)).toThrow(/no son válidos para el tipo de evento/);
      });

      test('should reject proposal.created with empty proposalId', () => {
        const payload = {
          event: 'proposal.created',
          data: {
            proposalId: '',
            title: 'Test Proposal',
            amount: { total: 100 },
            stage: 'qualification',
          },
        };

        expect(() => validateWebhook(payload)).toThrow();
      });
    });

    describe('proposal.updated', () => {
      test('should validate correct proposal.updated payload', () => {
        const payload = {
          event: 'proposal.updated',
          data: {
            proposalId: 'TEST-002',
            title: 'Updated Proposal',
            amount: { total: 2000.75 },
            stage: 'proposal',
          },
        };

        const result = validateWebhook(payload);

        expect(result.event).toBe('proposal.updated');
        expect(result.data.proposalId).toBe('TEST-002');
      });

      test('should validate proposal.updated with only proposalId', () => {
        const payload = {
          event: 'proposal.updated',
          data: {
            proposalId: 'TEST-002',
          },
        };

        const result = validateWebhook(payload);

        expect(result.event).toBe('proposal.updated');
        expect(result.data.proposalId).toBe('TEST-002');
      });

      test('should reject proposal.updated without proposalId', () => {
        const payload = {
          event: 'proposal.updated',
          data: {
            title: 'Updated Proposal',
          },
        };

        expect(() => validateWebhook(payload)).toThrow();
      });

      test('should validate optional fields if present', () => {
        const payload = {
          event: 'proposal.updated',
          data: {
            proposalId: 'TEST-002',
            amount: { total: 1500.25 },
          },
        };

        const result = validateWebhook(payload);

        expect(result.data.amount.total).toBe(1500.25);
      });
    });

    describe('proposal.deleted', () => {
      test('should validate correct proposal.deleted payload', () => {
        const payload = {
          event: 'proposal.deleted',
          data: {
            proposalId: 'TEST-003',
            closeDate: '2025-08-28',
            reason: 'Client cancelled',
          },
        };

        const result = validateWebhook(payload);

        expect(result.event).toBe('proposal.deleted');
        expect(result.data.proposalId).toBe('TEST-003');
        expect(result.data.closeDate).toBe('2025-08-28');
      });

      test('should validate proposal.deleted with only proposalId', () => {
        const payload = {
          event: 'proposal.deleted',
          data: {
            proposalId: 'TEST-003',
          },
        };

        const result = validateWebhook(payload);

        expect(result.event).toBe('proposal.deleted');
        expect(result.data.proposalId).toBe('TEST-003');
      });

      test('should reject proposal.deleted with invalid date format', () => {
        const payload = {
          event: 'proposal.deleted',
          data: {
            proposalId: 'TEST-003',
            closeDate: '28/08/2025', // Formato incorrecto
          },
        };

        expect(() => validateWebhook(payload)).toThrow(/no son válidos para el tipo de evento/);
      });
    });

    describe('Invalid events', () => {
      test('should reject unsupported event types', () => {
        const payload = {
          event: 'proposal.invalid',
          data: {
            proposalId: 'TEST-001',
          },
        };

        expect(() => validateWebhook(payload)).toThrow();
      });

      test('should reject missing event field', () => {
        const payload = {
          data: {
            proposalId: 'TEST-001',
          },
        };

        expect(() => validateWebhook(payload)).toThrow();
      });
    });
  });

  describe('validateProposalData', () => {
    test('should validate proposal data by event type', () => {
      const createdData = {
        proposalId: 'TEST-001',
        title: 'Test',
        amount: { total: 100 },
        stage: 'qualification',
      };

      const result = validateProposalData('proposal.created', createdData);

      expect(result.proposalId).toBe('TEST-001');
    });

    test('should reject invalid event type', () => {
      const data = { proposalId: 'TEST-001' };

      expect(() => validateProposalData('invalid.event', data)).toThrow(/Tipo de evento no válido/);
    });
  });

  describe('Schema constants', () => {
    test('should export supported events', () => {
      expect(SUPPORTED_EVENTS).toEqual([
        'proposal.created',
        'proposal.updated',
        'proposal.deleted',
      ]);
    });

    test('should export required fields', () => {
      expect(REQUIRED_FIELDS).toMatchObject({
        'proposal.created': expect.arrayContaining([
          'proposalId',
          'title',
          'amount.total',
          'stage',
        ]),
        'proposal.updated': ['proposalId'],
        'proposal.deleted': ['proposalId'],
      });
    });
  });

  describe('Individual schemas', () => {
    test('proposalCreatedDataSchema should work independently', () => {
      const data = {
        proposalId: 'TEST-001',
        title: 'Test',
        amount: { total: 100 },
        stage: 'qualification',
      };

      const result = proposalCreatedDataSchema.parse(data);

      expect(result.proposalId).toBe('TEST-001');
    });

    test('proposalUpdatedDataSchema should work independently', () => {
      const data = {
        proposalId: 'TEST-002',
      };

      const result = proposalUpdatedDataSchema.parse(data);

      expect(result.proposalId).toBe('TEST-002');
    });

    test('proposalDeletedDataSchema should work independently', () => {
      const data = {
        proposalId: 'TEST-003',
        closeDate: '2025-08-28',
      };

      const result = proposalDeletedDataSchema.parse(data);

      expect(result.proposalId).toBe('TEST-003');
      expect(result.closeDate).toBe('2025-08-28');
    });
  });
});
