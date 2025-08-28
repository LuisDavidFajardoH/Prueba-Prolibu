/**
 * Adaptador para convertir webhooks de Prolibu al formato interno
 * Transforma el formato real de Prolibu al formato esperado por nuestro microservicio
 */

const { logger } = require('../app/libs/logger');

/**
 * Verifica si el webhook recibido es del formato nativo de Prolibu
 * @param {Object} body - El cuerpo del webhook
 * @returns {boolean} true si es formato de Prolibu, false si no
 */
function isProlibuWebhook(body) {
  // Un webhook de Prolibu tiene esta estructura específica
  // Formato con model/action (webhook format)
  if (body && body.model === 'proposal' && body.action && body.body) {
    return true;
  }

  // Formato directo de Prolibu (sin wrapper de webhook)
  if (body && body.proposalNumber && typeof body.title === 'string') {
    return true;
  }

  return false;
}

/**
 * Mapea las acciones de Prolibu a nuestros eventos internos
 */
const ACTION_TO_EVENT_MAP = {
  create: 'proposal.created',
  update: 'proposal.updated',
  delete: 'proposal.deleted',
  destroy: 'proposal.deleted',
};

/**
 * Mapea los estados de Prolibu a estados de Salesforce
 */
const STATUS_TO_STAGE_MAP = {
  Draft: 'qualification',
  Open: 'qualification',
  Sent: 'proposal',
  Viewed: 'proposal',
  Accepted: 'won',
  Rejected: 'lost',
  Expired: 'lost',
  Cancelled: 'lost',
};

/**
 * Convierte un webhook de Prolibu al formato interno
 * @param {Object} prolibuWebhook - Webhook en formato de Prolibu
 * @returns {Object} Webhook en formato interno
 */
function adaptProlibuWebhook(prolibuWebhook) {
  const adaptLogger = logger.child({
    component: 'prolibu.adapter',
    operation: 'adaptWebhook',
  });

  try {
    let proposalData;
    let action = 'update'; // Acción por defecto

    // Determinar si es formato wrapper (con model/action) o formato directo
    if (prolibuWebhook.model === 'proposal' && prolibuWebhook.action && prolibuWebhook.body) {
      // Formato wrapper de webhook
      action = prolibuWebhook.action;
      proposalData = prolibuWebhook.body;

      if (!proposalData.proposalNumber && !proposalData.id) {
        throw new Error('No se encontró ID de propuesta en el webhook wrapper');
      }
    } else if (prolibuWebhook.proposalNumber) {
      // Formato directo de Prolibu
      proposalData = prolibuWebhook;

      // Inferir acción basada en los datos (si es nuevo o actualización)
      action = 'update'; // Por defecto es actualización
    } else {
      throw new Error('Formato de webhook de Prolibu no reconocido');
    }

    // Extraer datos de la propuesta
    const proposalId = proposalData.proposalNumber || proposalData.id;
    if (!proposalId) {
      throw new Error('No se encontró ID de propuesta en el webhook');
    }

    // Mapear acción a evento
    const event = ACTION_TO_EVENT_MAP[action];
    if (!event) {
      throw new Error(`Acción no soportada: ${action}`);
    }

    // Determinar el stage basado en el status o stage
    const status = proposalData.status || proposalData.stage || 'Draft';
    let stage = STATUS_TO_STAGE_MAP[status];

    // Si no se encontró el stage en el mapeo, usar qualification como default
    if (!stage) {
      stage = 'qualification';
    }

    // Calcular closeDate - usar expectedCloseDate de Prolibu o calcular una por defecto
    const closeDate =
      proposalData.expectedCloseDate ||
      proposalData.closeDate ||
      proposalData.close_date ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Calcular el total basado en los productos, total directo o workingTime
    let totalAmount = 0;
    if (proposalData.total && proposalData.total > 0) {
      // Asegurar que sea un número
      totalAmount =
        typeof proposalData.total === 'string'
          ? parseFloat(proposalData.total) || 0
          : proposalData.total;
    } else if (proposalData.amount && proposalData.amount > 0) {
      // Asegurar que sea un número
      totalAmount =
        typeof proposalData.amount === 'string'
          ? parseFloat(proposalData.amount) || 0
          : proposalData.amount;
    } else if (
      proposalData.products &&
      Array.isArray(proposalData.products) &&
      proposalData.products.length > 0
    ) {
      // Calcular total de productos si existe
      totalAmount = proposalData.products.reduce((sum, product) => {
        const price =
          typeof product.price === 'string' ? parseFloat(product.price) || 0 : product.price || 0;
        const quantity =
          typeof product.quantity === 'string'
            ? parseFloat(product.quantity) || 0
            : product.quantity || 0;
        return sum + price * quantity;
      }, 0);
    } else if (proposalData.workingTime) {
      // Estimar basado en tiempo de trabajo (ejemplo: $100/hora)
      // workingTime puede venir como string o number
      const workingHours =
        typeof proposalData.workingTime === 'string'
          ? parseFloat(proposalData.workingTime) || 0
          : proposalData.workingTime || 0;
      totalAmount = workingHours * 100;
    }

    // Si no hay monto, usar un valor por defecto de 1000 para evitar errores de validación
    if (totalAmount <= 0) {
      totalAmount = 1000;
    }

    // Asegurar que totalAmount sea un número válido
    totalAmount = Math.round(totalAmount * 100) / 100; // Redondear a 2 decimales

    // Construir el webhook adaptado
    const adaptedWebhook = {
      event,
      timestamp: new Date().toISOString(),
      data: {
        proposalId,
        title: proposalData.title || `Propuesta ${proposalId}`,
        stage,
        closeDate,
        amount: {
          total: totalAmount,
          currency: proposalData.currency || 'USD',
        },
        description:
          proposalData.specialObservations ||
          proposalData.content ||
          `Propuesta creada desde Prolibu - ${proposalId}`,

        // Datos adicionales de Prolibu
        prolibu: {
          proposalNumber: proposalData.proposalNumber,
          status: status,
          stage: proposalData.stage,
          stagePosition: proposalData.stagePosition,
          workingTime:
            typeof proposalData.workingTime === 'string'
              ? parseFloat(proposalData.workingTime) || 0
              : proposalData.workingTime,
          numberOfPayments: proposalData.numberOfPayments,
          expectedCloseDate: proposalData.expectedCloseDate,
          expirationDate: proposalData.expirationDate,
          referenceNumber: proposalData.referenceNumber,
          source: proposalData.source,
          responsible: proposalData.responsible,
          relatedLead: proposalData.relatedLead,
          relatedUser: proposalData.relatedUser,
          pdfUrl: proposalData.pdfUrl,
          comparativeProposal: proposalData.comparativeProposal,
          unpublishProposal: proposalData.unpublishProposal,
          rating: proposalData.rating,
          customExchangeRate: proposalData.customExchangeRate,
          exchangeRate: proposalData.exchangeRate,
          createdBy: proposalData.createdBy?.email || proposalData.createdBy?.id,
          updatedBy: proposalData.updatedBy,
        },
      },
    };

    // Para eliminaciones, agregar razón
    if (event === 'proposal.deleted') {
      adaptedWebhook.data.reason = `Propuesta ${action} en Prolibu`;
    }

    adaptLogger.info(
      {
        originalAction: action,
        adaptedEvent: event,
        proposalId,
        stage,
        amount: adaptedWebhook.data.amount.total,
        fullAdaptedWebhook: JSON.stringify(adaptedWebhook, null, 2),
      },
      'Webhook de Prolibu adaptado exitosamente'
    );

    return adaptedWebhook;
  } catch (error) {
    adaptLogger.error(
      {
        error: error.message,
        webhook: prolibuWebhook,
      },
      'Error adaptando webhook de Prolibu'
    );
    throw error;
  }
}

/**
 * Middleware para adaptar webhooks de Prolibu
 */
function prolibuWebhookAdapter(req, res, next) {
  const adapterLogger = logger.child({
    component: 'prolibu.adapter',
    operation: 'middleware',
    traceId: req.traceId,
  });

  try {
    // Verificar si es un webhook de Prolibu
    if (isProlibuWebhook(req.body)) {
      adapterLogger.info('Detectado webhook de Prolibu, aplicando adaptación');

      // Adaptar el webhook
      const adaptedWebhook = adaptProlibuWebhook(req.body);

      // Reemplazar el body con el formato adaptado
      req.body = adaptedWebhook;
      req.isProlibuWebhook = true;

      adapterLogger.info(
        {
          adaptedEvent: adaptedWebhook.event,
        },
        'Webhook adaptado correctamente'
      );
    }

    next();
  } catch (error) {
    adapterLogger.error(
      {
        error: error.message,
        body: req.body,
      },
      'Error en adaptador de webhook de Prolibu'
    );

    // Enviar error específico para webhooks de Prolibu malformados
    res.status(400).json({
      status: 'error',
      message: 'Formato de webhook de Prolibu inválido',
      error: error.message,
      traceId: req.traceId,
    });
  }
}

module.exports = {
  isProlibuWebhook,
  adaptProlibuWebhook,
  prolibuWebhookAdapter,
  ACTION_TO_EVENT_MAP,
  STATUS_TO_STAGE_MAP,
};
