const {
  mapStageToSalesforce,
  isValidSalesforceStage,
  isStageClosed,
  getStageProbability,
  getProlibuStagesForSalesforce,
  getMappingInfo,
  STAGE_MAPPING,
  VALID_SALESFORCE_STAGES,
  CLOSED_STAGES
} = require('../config/stageMap');

/**
 * Tests para mapeo de estados Prolibu → Salesforce
 * Verifica que las conversiones de estados funcionen correctamente
 */

describe('Stage Mapping', () => {
  describe('mapStageToSalesforce', () => {
    test('should map qualification to Qualification', () => {
      const result = mapStageToSalesforce('qualification');
      expect(result).toBe('Qualification');
    });

    test('should map proposal to Proposal/Price Quote', () => {
      const result = mapStageToSalesforce('proposal');
      expect(result).toBe('Proposal/Price Quote');
    });

    test('should map won to Closed Won', () => {
      const result = mapStageToSalesforce('won');
      expect(result).toBe('Closed Won');
    });

    test('should map lost to Closed Lost', () => {
      const result = mapStageToSalesforce('lost');
      expect(result).toBe('Closed Lost');
    });

    test('should handle case insensitive mapping', () => {
      expect(mapStageToSalesforce('QUALIFICATION')).toBe('Qualification');
      expect(mapStageToSalesforce('Proposal')).toBe('Proposal/Price Quote');
      expect(mapStageToSalesforce('WON')).toBe('Closed Won');
    });

    test('should handle states with extra whitespace', () => {
      expect(mapStageToSalesforce('  qualification  ')).toBe('Qualification');
      expect(mapStageToSalesforce('\tproposal\n')).toBe('Proposal/Price Quote');
    });

    test('should throw error for unmapped states', () => {
      expect(() => mapStageToSalesforce('unknown_state')).toThrow(/no tiene mapeo definido/);
    });

    test('should throw error for empty or invalid input', () => {
      expect(() => mapStageToSalesforce('')).toThrow(/debe ser una cadena no vacía/);
      expect(() => mapStageToSalesforce(null)).toThrow(/debe ser una cadena no vacía/);
      expect(() => mapStageToSalesforce(undefined)).toThrow(/debe ser una cadena no vacía/);
    });

    test('should map all documented states correctly', () => {
      const testCases = [
        { prolibu: 'lead', salesforce: 'Prospecting' },
        { prolibu: 'qualification', salesforce: 'Qualification' },
        { prolibu: 'qualified', salesforce: 'Qualification' },
        { prolibu: 'analysis', salesforce: 'Needs Analysis' },
        { prolibu: 'needs_analysis', salesforce: 'Needs Analysis' },
        { prolibu: 'solution_design', salesforce: 'Value Proposition' },
        { prolibu: 'proposal', salesforce: 'Proposal/Price Quote' },
        { prolibu: 'proposal_draft', salesforce: 'Proposal/Price Quote' },
        { prolibu: 'proposal_review', salesforce: 'Proposal/Price Quote' },
        { prolibu: 'negotiation', salesforce: 'Negotiation/Review' },
        { prolibu: 'review', salesforce: 'Negotiation/Review' },
        { prolibu: 'final_review', salesforce: 'Negotiation/Review' },
        { prolibu: 'approved', salesforce: 'Closed Won' },
        { prolibu: 'won', salesforce: 'Closed Won' },
        { prolibu: 'closed_won', salesforce: 'Closed Won' },
        { prolibu: 'accepted', salesforce: 'Closed Won' },
        { prolibu: 'rejected', salesforce: 'Closed Lost' },
        { prolibu: 'lost', salesforce: 'Closed Lost' },
        { prolibu: 'closed_lost', salesforce: 'Closed Lost' },
        { prolibu: 'cancelled', salesforce: 'Closed Lost' },
        { prolibu: 'declined', salesforce: 'Closed Lost' }
      ];

      testCases.forEach(({ prolibu, salesforce }) => {
        expect(mapStageToSalesforce(prolibu)).toBe(salesforce);
      });
    });
  });

  describe('isValidSalesforceStage', () => {
    test('should validate correct Salesforce stages', () => {
      expect(isValidSalesforceStage('Prospecting')).toBe(true);
      expect(isValidSalesforceStage('Qualification')).toBe(true);
      expect(isValidSalesforceStage('Needs Analysis')).toBe(true);
      expect(isValidSalesforceStage('Closed Won')).toBe(true);
      expect(isValidSalesforceStage('Closed Lost')).toBe(true);
    });

    test('should reject invalid Salesforce stages', () => {
      expect(isValidSalesforceStage('Invalid Stage')).toBe(false);
      expect(isValidSalesforceStage('random_stage')).toBe(false);
      expect(isValidSalesforceStage('')).toBe(false);
    });
  });

  describe('isStageClosed', () => {
    test('should identify closed stages correctly', () => {
      expect(isStageClosed('Closed Won')).toBe(true);
      expect(isStageClosed('Closed Lost')).toBe(true);
    });

    test('should identify open stages correctly', () => {
      expect(isStageClosed('Prospecting')).toBe(false);
      expect(isStageClosed('Qualification')).toBe(false);
      expect(isStageClosed('Needs Analysis')).toBe(false);
      expect(isStageClosed('Proposal/Price Quote')).toBe(false);
      expect(isStageClosed('Negotiation/Review')).toBe(false);
    });
  });

  describe('getStageProbability', () => {
    test('should return correct probabilities for stages', () => {
      expect(getStageProbability('Prospecting')).toBe(10);
      expect(getStageProbability('Qualification')).toBe(20);
      expect(getStageProbability('Needs Analysis')).toBe(30);
      expect(getStageProbability('Proposal/Price Quote')).toBe(70);
      expect(getStageProbability('Closed Won')).toBe(100);
      expect(getStageProbability('Closed Lost')).toBe(0);
    });

    test('should return 0 for unknown stages', () => {
      expect(getStageProbability('Unknown Stage')).toBe(0);
    });
  });

  describe('getProlibuStagesForSalesforce', () => {
    test('should return correct Prolibu stages for Salesforce stage', () => {
      const qualificationStages = getProlibuStagesForSalesforce('Qualification');
      expect(qualificationStages).toContain('qualification');
      expect(qualificationStages).toContain('qualified');

      const proposalStages = getProlibuStagesForSalesforce('Proposal/Price Quote');
      expect(proposalStages).toContain('proposal');
      expect(proposalStages).toContain('proposal_draft');
      expect(proposalStages).toContain('proposal_review');

      const closedWonStages = getProlibuStagesForSalesforce('Closed Won');
      expect(closedWonStages).toContain('won');
      expect(closedWonStages).toContain('approved');
      expect(closedWonStages).toContain('accepted');
    });

    test('should return empty array for unmapped Salesforce stage', () => {
      const result = getProlibuStagesForSalesforce('Unknown Stage');
      expect(result).toEqual([]);
    });
  });

  describe('getMappingInfo', () => {
    test('should return complete mapping information', () => {
      const info = getMappingInfo();

      expect(info).toMatchObject({
        totalMappings: expect.any(Number),
        prolibsStages: expect.any(Array),
        salesforceStages: expect.any(Array),
        closedStages: expect.any(Array),
        mappingTable: expect.any(Object)
      });

      expect(info.totalMappings).toBeGreaterThan(0);
      expect(info.prolibsStages.length).toBeGreaterThan(0);
      expect(info.salesforceStages).toEqual(VALID_SALESFORCE_STAGES);
      expect(info.closedStages).toEqual(CLOSED_STAGES);
    });

    test('should have consistent mapping count', () => {
      const info = getMappingInfo();
      expect(info.totalMappings).toBe(Object.keys(STAGE_MAPPING).length);
      expect(info.prolibsStages).toEqual(Object.keys(STAGE_MAPPING));
    });
  });

  describe('Constants', () => {
    test('STAGE_MAPPING should be properly defined', () => {
      expect(typeof STAGE_MAPPING).toBe('object');
      expect(Object.keys(STAGE_MAPPING).length).toBeGreaterThan(0);
    });

    test('VALID_SALESFORCE_STAGES should contain expected stages', () => {
      const expectedStages = [
        'Prospecting',
        'Qualification',
        'Needs Analysis',
        'Value Proposition',
        'Id. Decision Makers',
        'Perception Analysis',
        'Proposal/Price Quote',
        'Negotiation/Review',
        'Closed Won',
        'Closed Lost'
      ];

      expectedStages.forEach(stage => {
        expect(VALID_SALESFORCE_STAGES).toContain(stage);
      });
    });

    test('CLOSED_STAGES should contain only closed stages', () => {
      expect(CLOSED_STAGES).toEqual(['Closed Won', 'Closed Lost']);
    });
  });
});
