const { validateWebhook } = require('./prolibu.schema');
const { processWebhookEvent } = require('./prolibu.service');
const { logger } = require('../app/libs/logger');
const { BusinessError } = require('../app/middlewares/errorHandler');

/**
 * Controlador para manejar webhooks de Prolibu
 * Valida payloads, procesa eventos y responde apropiadamente
 */

/**
 * Maneja el endpoint POST /webhooks/prolibu
 * Recibe eventos de proposal.created, proposal.updated, proposal.deleted
 *
 * @param {Object} req - Request de Express con el webhook payload
 * @param {Object} res - Response de Express
 * @param {Function} next - Función next de Express para manejo de errores
 */
async function handleProlibuWebhook(req, res, next) {
  const controllerLogger = logger.child({
    component: 'prolibu.controller',
    operation: 'handleProlibuWebhook',
    traceId: req.traceId,
    method: req.method,
    path: req.path,
  });

  controllerLogger.info(
    {
      contentType: req.get('Content-Type'),
      bodySize: JSON.stringify(req.body).length,
      userAgent: req.get('User-Agent'),
    },
    'Webhook recibido'
  );

  try {
    // Validar que el body existe
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new BusinessError('El body del request está vacío o no es válido', 'empty_body', 400);
    }

    // Validar estructura del webhook usando schema de Zod
    let validatedWebhook;
    try {
      validatedWebhook = validateWebhook(req.body);
    } catch (validationError) {
      controllerLogger.warn(
        {
          validationError: validationError.message,
          receivedPayload: req.body,
        },
        'Error de validación en webhook'
      );

      // El errorHandler middleware se encargará de formatear el error de Zod
      throw validationError;
    }

    controllerLogger.info(
      {
        event: validatedWebhook.event,
        proposalId: validatedWebhook.data.proposalId,
        webhookId: validatedWebhook.webhookId,
      },
      'Webhook validado exitosamente'
    );

    // Procesar el evento usando el servicio
    const result = await processWebhookEvent(
      validatedWebhook.event,
      validatedWebhook.data,
      req.traceId
    );

    controllerLogger.info(
      {
        event: validatedWebhook.event,
        proposalId: validatedWebhook.data.proposalId,
        success: result.success,
        salesforceId: result.salesforceId,
      },
      'Webhook procesado exitosamente'
    );

    // Respuesta exitosa estándar
    res.status(200).json({
      status: 'ok',
      message: 'Webhook procesado exitosamente',
      traceId: req.traceId,
      data: {
        event: validatedWebhook.event,
        proposalId: validatedWebhook.data.proposalId,
        salesforceId: result.salesforceId,
        processed: true,
      },
    });
  } catch (error) {
    controllerLogger.error(
      {
        error: error.message,
        stack: error.stack,
        receivedPayload: req.body,
      },
      'Error procesando webhook'
    );

    // Delegar manejo de error al middleware errorHandler
    next(error);
  }
}

/**
 * Endpoint de health check específico para webhooks
 * Verifica que el servicio esté operativo y listo para recibir webhooks
 *
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Función next de Express
 */
async function healthCheck(req, res, next) {
  const controllerLogger = logger.child({
    component: 'prolibu.controller',
    operation: 'healthCheck',
    traceId: req.traceId,
  });

  try {
    // Verificar configuración básica
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'prolibu-webhooks',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    // TODO: En pasos futuros, verificar conexión con Salesforce
    // healthStatus.salesforce = await checkSalesforceConnection();

    controllerLogger.debug(healthStatus, 'Health check completado');

    res.status(200).json(healthStatus);
  } catch (error) {
    controllerLogger.error(
      {
        error: error.message,
      },
      'Error en health check'
    );

    next(error);
  }
}

/**
 * Endpoint para obtener información sobre eventos soportados
 * Útil para documentación y debugging
 *
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Función next de Express
 */
function getSupportedEvents(req, res, next) {
  const controllerLogger = logger.child({
    component: 'prolibu.controller',
    operation: 'getSupportedEvents',
    traceId: req.traceId,
  });

  try {
    const { SUPPORTED_EVENTS, REQUIRED_FIELDS } = require('./prolibu.schema');
    const { getMappingInfo } = require('../config/stageMap');

    const info = {
      supportedEvents: SUPPORTED_EVENTS,
      requiredFields: REQUIRED_FIELDS,
      stageMapping: getMappingInfo(),
      endpoints: {
        webhook: 'POST /webhooks/prolibu',
        health: 'GET /webhooks/prolibu/health',
        info: 'GET /webhooks/prolibu/info',
      },
      documentation: {
        description: 'Microservicio para sincronizar webhooks de Prolibu con Salesforce',
        examples: '/examples/',
      },
    };

    controllerLogger.debug('Información de eventos servida');

    res.status(200).json(info);
  } catch (error) {
    controllerLogger.error(
      {
        error: error.message,
      },
      'Error obteniendo información de eventos'
    );

    next(error);
  }
}

module.exports = {
  handleProlibuWebhook,
  healthCheck,
  getSupportedEvents,
};
