const express = require('express');
const salesforceService = require('../services/salesforce.service');
const { logger } = require('../app/libs/logger');

const router = express.Router();

/**
 * Endpoint para verificar el estado de la conexión con Salesforce
 * GET /salesforce/health
 */
router.get('/health', async (req, res, next) => {
  const sfLogger = logger.child({
    component: 'salesforce.controller',
    operation: 'health',
    traceId: req.traceId,
  });

  try {
    sfLogger.info('Verificando estado de conexión con Salesforce');

    const healthStatus = await salesforceService.getConnectionHealth();

    const response = {
      timestamp: new Date().toISOString(),
      service: 'salesforce-integration',
      ...healthStatus,
    };

    sfLogger.info({ status: healthStatus.status }, 'Estado de Salesforce verificado');

    // Status code basado en el estado
    const statusCode = healthStatus.status === 'connected' ? 200 : 503;

    res.status(statusCode).json(response);
  } catch (error) {
    sfLogger.error({ error: error.message }, 'Error verificando estado de Salesforce');

    next(error);
  }
});

/**
 * Endpoint para forzar reconexión con Salesforce
 * POST /salesforce/reconnect
 */
router.post('/reconnect', async (req, res, next) => {
  const sfLogger = logger.child({
    component: 'salesforce.controller',
    operation: 'reconnect',
    traceId: req.traceId,
  });

  try {
    sfLogger.info('Iniciando reconexión forzada con Salesforce');

    // Desconectar primero
    await salesforceService.disconnect();

    // Reconectar
    const connectionResult = await salesforceService.connect();

    sfLogger.info(
      { organizationId: connectionResult.organizationId },
      'Reconexión con Salesforce exitosa'
    );

    res.status(200).json({
      status: 'ok',
      message: 'Reconexión exitosa',
      timestamp: new Date().toISOString(),
      traceId: req.traceId,
      connectionInfo: connectionResult,
    });
  } catch (error) {
    sfLogger.error({ error: error.message }, 'Error en reconexión con Salesforce');

    next(error);
  }
});

/**
 * Endpoint para obtener información de una Opportunity por Prolibu ID
 * GET /salesforce/opportunity/:prolibuId
 */
router.get('/opportunity/:prolibuId', async (req, res, next) => {
  const { prolibuId } = req.params;

  const sfLogger = logger.child({
    component: 'salesforce.controller',
    operation: 'getOpportunity',
    traceId: req.traceId,
    prolibuId,
  });

  try {
    sfLogger.info('Buscando Opportunity en Salesforce');

    const opportunity = await salesforceService.getOpportunityByProlibuId(prolibuId, req.traceId);

    if (!opportunity) {
      return res.status(404).json({
        status: 'not_found',
        message: `Opportunity con Prolibu ID '${prolibuId}' no encontrada`,
        traceId: req.traceId,
      });
    }

    sfLogger.info({ salesforceId: opportunity.Id }, 'Opportunity encontrada');

    res.status(200).json({
      status: 'ok',
      traceId: req.traceId,
      opportunity,
    });
  } catch (error) {
    sfLogger.error({ error: error.message, prolibuId }, 'Error buscando Opportunity');

    next(error);
  }
});

module.exports = router;
