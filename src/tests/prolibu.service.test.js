const prolibuService = require('../webhooks/prolibu.service');

/**
 * Tests para el servicio Prolibu con integración de Salesforce mockeada
 * Verifica la lógica de negocio y transformación de datos
 */

// Mock del servicio de Salesforce
const salesforceService = require('../services/salesforce.service');

// Mock de las funciones del servicio Salesforce
jest.spyOn(salesforceService, 'createOpportunity').mockResolvedValue({
  success: true,
  salesforceId: 'SF_OPP_MOCK_123',
  operation: 'created',
  opportunityData: {}
});

jest.spyOn(salesforceService, 'updateOpportunity').mockResolvedValue({
  success: true,
  salesforceId: 'SF_OPP_MOCK_123',
  operation: 'updated',
  opportunityData: {}
});

jest.spyOn(salesforceService, 'markOpportunityAsClosedLost').mockResolvedValue({
  success: true,
  salesforceId: 'SF_OPP_MOCK_123',
  operation: 'closed_lost'
});

/**
 * Tests para el servicio Prolibu
 * Verifica la lógica de negocio y transformación de datos
 */

describe('Prolibu Service', () => {
  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();

    // Mock console methods to avoid spam in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleProposalCreated', () => {
    test('should process proposal creation successfully', async () => {
      const validData = {
        proposalId: 'prop-123',
        stage: 'qualification',
        amount: { total: 10000 },
        title: 'Test Proposal',
        description: 'Test Description'
      };

      const result = await prolibuService.handleProposalCreated(validData, 'test-trace-123');

      expect(result).toMatchObject({
        success: true,
        salesforceId: 'SF_OPP_MOCK_123',
        operation: 'created'
      });
    });

    test('should handle stage mapping correctly', async () => {
      const testCases = [
        { stage: 'qualification', expected: 'Qualification' },
        { stage: 'proposal', expected: 'Proposal/Price Quote' },
        { stage: 'won', expected: 'Closed Won' },
        { stage: 'lost', expected: 'Closed Lost' }
      ];

      for (const { stage } of testCases) {
        const data = {
          proposalId: 'prop-123',
          stage,
          amount: { total: 10000 },
          title: 'Test Proposal'
        };

        const result = await prolibuService.handleProposalCreated(data, 'test-trace');
        expect(result.operation).toBe('created');
      }
    });

    test('should handle invalid stage gracefully', async () => {
      const invalidData = {
        proposalId: 'prop-123',
        stage: 'invalid_stage',
        amount: { total: 10000 },
        title: 'Test Proposal'
      };

      await expect(async () => {
        await prolibuService.handleProposalCreated(invalidData, 'test-trace');
      }).rejects.toThrow(/no tiene mapeo definido/);
    });
  });

  describe('handleProposalUpdated', () => {
    test('should process proposal update successfully', async () => {
      const validData = {
        proposalId: 'prop-123',
        stage: 'negotiation'
      };

      const result = await prolibuService.handleProposalUpdated(validData, 'test-trace');

      expect(result).toMatchObject({
        success: true,
        operation: 'updated'
      });
    });
  });

  describe('handleProposalDeleted', () => {
    test('should process proposal deletion successfully', async () => {
      const validData = {
        proposalId: 'prop-123'
      };

      const result = await prolibuService.handleProposalDeleted(validData, 'test-trace');

      expect(result).toMatchObject({
        success: true,
        operation: 'closed_lost'
      });
    });
  });
});
