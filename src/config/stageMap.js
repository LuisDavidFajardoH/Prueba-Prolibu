/**
 * Mapeo de estados de propuestas desde Prolibu hacia Salesforce
 * Define la correspondencia entre los estados del sistema de origen y destino
 */

const { logger } = require('../app/libs/logger');

/**
 * Mapeo principal de estados Prolibu → Salesforce StageName
 * Basado en el proceso de ventas estándar de Salesforce
 */
const STAGE_MAPPING = {
  // Estados iniciales
  lead: 'Prospecting',
  qualification: 'Qualification',
  qualified: 'Qualification',

  // Estados de desarrollo de propuesta
  analysis: 'Needs Analysis',
  needs_analysis: 'Needs Analysis',
  solution_design: 'Value Proposition',
  proposal: 'Proposal/Price Quote',
  proposal_draft: 'Proposal/Price Quote',
  proposal_review: 'Proposal/Price Quote',

  // Estados de negociación
  negotiation: 'Negotiation/Review',
  review: 'Negotiation/Review',
  final_review: 'Negotiation/Review',

  // Estados de cierre positivo
  approved: 'Closed Won',
  won: 'Closed Won',
  closed_won: 'Closed Won',
  accepted: 'Closed Won',

  // Estados de cierre negativo
  rejected: 'Closed Lost',
  lost: 'Closed Lost',
  closed_lost: 'Closed Lost',
  cancelled: 'Closed Lost',
  declined: 'Closed Lost',
};

/**
 * Estados válidos de Salesforce Opportunity
 * Lista completa de valores permitidos para StageName
 */
const VALID_SALESFORCE_STAGES = [
  'Prospecting',
  'Qualification',
  'Needs Analysis',
  'Value Proposition',
  'Id. Decision Makers',
  'Perception Analysis',
  'Proposal/Price Quote',
  'Negotiation/Review',
  'Closed Won',
  'Closed Lost',
];

/**
 * Estados que indican que la oportunidad está cerrada
 * Útil para determinar si se debe establecer CloseDate
 */
const CLOSED_STAGES = ['Closed Won', 'Closed Lost'];

/**
 * Probabilidades por defecto para cada estado
 * Salesforce usa estos valores para forecasting
 */
const STAGE_PROBABILITIES = {
  Prospecting: 10,
  Qualification: 20,
  'Needs Analysis': 30,
  'Value Proposition': 40,
  'Id. Decision Makers': 50,
  'Perception Analysis': 60,
  'Proposal/Price Quote': 70,
  'Negotiation/Review': 80,
  'Closed Won': 100,
  'Closed Lost': 0,
};

/**
 * Convierte un estado de Prolibu a un estado válido de Salesforce
 *
 * @param {string} prolibsStage - Estado desde Prolibu
 * @returns {string} Estado válido de Salesforce
 * @throws {Error} Si el estado no tiene mapeo definido
 */
function mapStageToSalesforce(prolibsStage) {
  if (!prolibsStage || typeof prolibsStage !== 'string') {
    throw new Error('El estado de Prolibu debe ser una cadena no vacía');
  }

  // Normalizar: convertir a lowercase y limpiar espacios
  const normalizedStage = prolibsStage.toLowerCase().trim();

  // Buscar mapeo exacto
  const mappedStage = STAGE_MAPPING[normalizedStage];

  if (!mappedStage) {
    // Log para debugging en desarrollo
    if (process.env.NODE_ENV === 'development') {
      logger.warn({ prolibsStage }, `Estado de Prolibu sin mapeo: "${prolibsStage}"`);
    }

    throw new Error(
      `Estado de Prolibu "${prolibsStage}" no tiene mapeo definido. ` +
        `Estados válidos: ${Object.keys(STAGE_MAPPING).join(', ')}`
    );
  }

  return mappedStage;
}

/**
 * Verifica si un estado de Salesforce es válido
 *
 * @param {string} salesforceStage - Estado de Salesforce a validar
 * @returns {boolean} true si es válido
 */
function isValidSalesforceStage(salesforceStage) {
  return VALID_SALESFORCE_STAGES.includes(salesforceStage);
}

/**
 * Determina si un estado indica que la oportunidad está cerrada
 *
 * @param {string} salesforceStage - Estado de Salesforce
 * @returns {boolean} true si está cerrado
 */
function isStageClosed(salesforceStage) {
  return CLOSED_STAGES.includes(salesforceStage);
}

/**
 * Obtiene la probabilidad por defecto para un estado
 *
 * @param {string} salesforceStage - Estado de Salesforce
 * @returns {number} Probabilidad entre 0 y 100
 */
function getStageProbability(salesforceStage) {
  return STAGE_PROBABILITIES[salesforceStage] || 0;
}

/**
 * Mapeo inverso: de Salesforce a Prolibu (para debugging/logs)
 *
 * @param {string} salesforceStage - Estado de Salesforce
 * @returns {string[]} Posibles estados de Prolibu que mapean a este estado
 */
function getProlibuStagesForSalesforce(salesforceStage) {
  return Object.entries(STAGE_MAPPING)
    .filter(([_, sfStage]) => sfStage === salesforceStage)
    .map(([prolibsStage, _]) => prolibsStage);
}

/**
 * Información completa sobre el mapeo de estados
 * Útil para documentación y debugging
 */
function getMappingInfo() {
  return {
    totalMappings: Object.keys(STAGE_MAPPING).length,
    prolibsStages: Object.keys(STAGE_MAPPING),
    salesforceStages: VALID_SALESFORCE_STAGES,
    closedStages: CLOSED_STAGES,
    mappingTable: STAGE_MAPPING,
  };
}

module.exports = {
  // Mapeos principales
  STAGE_MAPPING,
  VALID_SALESFORCE_STAGES,
  CLOSED_STAGES,
  STAGE_PROBABILITIES,

  // Funciones de conversión
  mapStageToSalesforce,
  isValidSalesforceStage,
  isStageClosed,
  getStageProbability,

  // Funciones utilitarias
  getProlibuStagesForSalesforce,
  getMappingInfo,
};
