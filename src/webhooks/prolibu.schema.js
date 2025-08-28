const { z } = require('zod');

/**
 * Schemas de validación para webhooks de Prolibu
 * Define la estructura y validaciones para todos los eventos soportados
 */

// Schema base para el monto (amount)
const amountSchema = z.object({
  total: z.number().positive('El monto total debe ser mayor a 0'),
  currency: z.string().optional(), // Para futuras expansiones multi-moneda
});

// Schema base para datos de propuesta
const baseProposalDataSchema = z.object({
  proposalId: z.string().min(1, 'proposalId es requerido y no puede estar vacío'),
  title: z.string().optional(),
  amount: amountSchema.optional(),
  stage: z.string().optional(),
  closeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'closeDate debe tener formato YYYY-MM-DD')
    .optional(),
  description: z.string().optional(), // Campo adicional común
  clientId: z.string().optional(), // Para futuras relaciones con Account/Contact
  clientName: z.string().optional(),
});

/**
 * Schema para evento proposal.created
 * Requiere: proposalId, title, amount.total, stage
 */
const proposalCreatedDataSchema = baseProposalDataSchema.extend({
  proposalId: z.string().min(1, 'proposalId es requerido para crear una propuesta'),
  title: z.string().min(1, 'title es requerido para crear una propuesta'),
  amount: amountSchema.refine(
    amount => amount.total !== undefined,
    'amount.total es requerido para crear una propuesta'
  ),
  stage: z.string().min(1, 'stage es requerido para crear una propuesta'),
});

/**
 * Schema para evento proposal.updated
 * Requiere: proposalId
 * Opcionales: title, amount, stage, closeDate (pero bien tipados si vienen)
 */
const proposalUpdatedDataSchema = baseProposalDataSchema.extend({
  proposalId: z.string().min(1, 'proposalId es requerido para actualizar una propuesta'),
  // Los demás campos son opcionales pero validados si están presentes
});

/**
 * Schema para evento proposal.deleted
 * Requiere: proposalId
 * Opcional: closeDate
 */
const proposalDeletedDataSchema = z.object({
  proposalId: z.string().min(1, 'proposalId es requerido para eliminar una propuesta'),
  closeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'closeDate debe tener formato YYYY-MM-DD')
    .optional(),
  reason: z.string().optional(), // Razón de eliminación
});

/**
 * Schema principal para el webhook completo
 * Valida la estructura base y delega a schemas específicos según el evento
 */
const webhookSchema = z
  .object({
    event: z.enum(['proposal.created', 'proposal.updated', 'proposal.deleted'], {
      errorMap: () => ({
        message: 'event debe ser uno de: proposal.created, proposal.updated, proposal.deleted',
      }),
    }),
    data: z.object({}).passthrough(), // Será validado específicamente según el evento
    timestamp: z.string().datetime().optional(), // ISO 8601 timestamp
    webhookId: z.string().optional(), // ID único del webhook para deduplicación
  })
  .refine(
    webhook => {
      // Validación condicional según el tipo de evento
      try {
        switch (webhook.event) {
          case 'proposal.created':
            proposalCreatedDataSchema.parse(webhook.data);
            break;
          case 'proposal.updated':
            proposalUpdatedDataSchema.parse(webhook.data);
            break;
          case 'proposal.deleted':
            proposalDeletedDataSchema.parse(webhook.data);
            break;
        }
        return true;
      } catch {
        return false;
      }
    },
    {
      message: 'Los datos no son válidos para el tipo de evento especificado',
      path: ['data'],
    }
  );

/**
 * Función helper para validar un webhook completo
 * Proporciona mejor manejo de errores y contexto
 *
 * @param {Object} payload - Payload del webhook a validar
 * @returns {Object} Datos validados y transformados
 * @throws {z.ZodError} Si la validación falla
 */
function validateWebhook(payload) {
  // Primero validar estructura base
  const baseValidation = webhookSchema.safeParse(payload);

  if (!baseValidation.success) {
    throw baseValidation.error;
  }

  const { event, data } = baseValidation.data;

  // Validar datos específicos según el evento
  let validatedData;
  switch (event) {
    case 'proposal.created':
      validatedData = proposalCreatedDataSchema.parse(data);
      break;
    case 'proposal.updated':
      validatedData = proposalUpdatedDataSchema.parse(data);
      break;
    case 'proposal.deleted':
      validatedData = proposalDeletedDataSchema.parse(data);
      break;
    default:
      throw new Error(`Evento no soportado: ${event}`);
  }

  return {
    event,
    data: validatedData,
    timestamp: payload.timestamp,
    webhookId: payload.webhookId,
  };
}

/**
 * Función helper para validar solo los datos de una propuesta
 * Útil para testing o validaciones parciales
 *
 * @param {string} eventType - Tipo de evento
 * @param {Object} data - Datos a validar
 * @returns {Object} Datos validados
 */
function validateProposalData(eventType, data) {
  switch (eventType) {
    case 'proposal.created':
      return proposalCreatedDataSchema.parse(data);
    case 'proposal.updated':
      return proposalUpdatedDataSchema.parse(data);
    case 'proposal.deleted':
      return proposalDeletedDataSchema.parse(data);
    default:
      throw new Error(`Tipo de evento no válido: ${eventType}`);
  }
}

/**
 * Lista de eventos soportados
 * Útil para validaciones y documentación
 */
const SUPPORTED_EVENTS = ['proposal.created', 'proposal.updated', 'proposal.deleted'];

/**
 * Lista de campos requeridos por evento
 * Útil para documentación y validaciones de API
 */
const REQUIRED_FIELDS = {
  'proposal.created': ['proposalId', 'title', 'amount.total', 'stage'],
  'proposal.updated': ['proposalId'],
  'proposal.deleted': ['proposalId'],
};

module.exports = {
  // Schemas principales
  webhookSchema,
  proposalCreatedDataSchema,
  proposalUpdatedDataSchema,
  proposalDeletedDataSchema,

  // Schemas auxiliares
  amountSchema,
  baseProposalDataSchema,

  // Funciones de validación
  validateWebhook,
  validateProposalData,

  // Constantes
  SUPPORTED_EVENTS,
  REQUIRED_FIELDS,
};
