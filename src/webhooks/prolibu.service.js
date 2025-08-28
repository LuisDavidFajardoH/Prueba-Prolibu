const { logger } = require('../app/libs/logger');
const { mapStageToSalesforce, isStageClosed } = require('../config/stageMap');

/**
 * Servicio para manejar la lógica de negocio de webhooks de Prolibu
 * Procesa eventos y prepara datos para sincronización con Salesforce
 * En este paso contiene stubs - la integración real se implementará posteriormente
 */

/**
 * Procesa un evento de creación de propuesta
 * Convierte datos de Prolibu al formato esperado por Salesforce
 *
 * @param {Object} proposalData - Datos de la propuesta desde Prolibu
 * @param {string} traceId - ID de trazabilidad del request
 * @returns {Promise<Object>} Resultado del procesamiento
 */
async function handleProposalCreated(proposalData, traceId) {
  const serviceLogger = logger.child({
    component: 'prolibu.service',
    operation: 'handleProposalCreated',
    traceId,
    proposalId: proposalData.proposalId,
  });

  serviceLogger.info('Procesando creación de propuesta');

  try {
    // Mapear estado de Prolibu a Salesforce
    const salesforceStage = mapStageToSalesforce(proposalData.stage);

    // Preparar datos para Salesforce
    const opportunityData = {
      Name: proposalData.title,
      Amount: proposalData.amount.total,
      StageName: salesforceStage,
      Prolibu_External_Id__c: proposalData.proposalId,
      Description: proposalData.description || null,
      // Fecha de cierre: si está cerrado, usar hoy; si no, estimar en 30 días
      CloseDate: isStageClosed(salesforceStage)
        ? new Date().toISOString().split('T')[0]
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    // TODO: Integrar con Salesforce (Paso 10)
    // const salesforceResult = await salesforceService.createOpportunity(opportunityData);

    // STUB: Simular creación exitosa
    const stubResult = {
      success: true,
      salesforceId: `SF_OPP_${Date.now()}`, // ID simulado
      opportunityData,
      message: 'Opportunity creada exitosamente (simulado)',
    };

    serviceLogger.info(
      {
        salesforceStage,
        salesforceId: stubResult.salesforceId,
        amount: opportunityData.Amount,
      },
      'Propuesta creada exitosamente'
    );

    return stubResult;
  } catch (error) {
    serviceLogger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      'Error al procesar creación de propuesta'
    );

    throw error;
  }
}

/**
 * Procesa un evento de actualización de propuesta
 * Actualiza la Opportunity existente en Salesforce
 *
 * @param {Object} proposalData - Datos actualizados de la propuesta
 * @param {string} traceId - ID de trazabilidad del request
 * @returns {Promise<Object>} Resultado del procesamiento
 */
async function handleProposalUpdated(proposalData, traceId) {
  const serviceLogger = logger.child({
    component: 'prolibu.service',
    operation: 'handleProposalUpdated',
    traceId,
    proposalId: proposalData.proposalId,
  });

  serviceLogger.info('Procesando actualización de propuesta');

  try {
    // Preparar objeto de actualización solo con campos que vienen
    const updateData = {
      Prolibu_External_Id__c: proposalData.proposalId, // Para buscar el registro
    };

    // Añadir campos solo si están presentes
    if (proposalData.title) {
      updateData.Name = proposalData.title;
    }

    if (proposalData.amount?.total) {
      updateData.Amount = proposalData.amount.total;
    }

    if (proposalData.stage) {
      const salesforceStage = mapStageToSalesforce(proposalData.stage);
      updateData.StageName = salesforceStage;

      // Si el nuevo estado está cerrado, actualizar fecha de cierre
      if (isStageClosed(salesforceStage)) {
        updateData.CloseDate = proposalData.closeDate || new Date().toISOString().split('T')[0];
      }
    }

    if (proposalData.description) {
      updateData.Description = proposalData.description;
    }

    // TODO: Integrar con Salesforce (Paso 10)
    // const salesforceResult = await salesforceService.updateOpportunity(updateData);

    // STUB: Simular actualización exitosa
    const stubResult = {
      success: true,
      salesforceId: `SF_OPP_${proposalData.proposalId}`, // ID simulado
      updateData,
      fieldsUpdated: Object.keys(updateData).filter(key => key !== 'Prolibu_External_Id__c'),
      message: 'Opportunity actualizada exitosamente (simulado)',
    };

    serviceLogger.info(
      {
        fieldsUpdated: stubResult.fieldsUpdated,
        salesforceId: stubResult.salesforceId,
      },
      'Propuesta actualizada exitosamente'
    );

    return stubResult;
  } catch (error) {
    serviceLogger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      'Error al procesar actualización de propuesta'
    );

    throw error;
  }
}

/**
 * Procesa un evento de eliminación de propuesta
 * Marca la Opportunity como "Closed Lost" en Salesforce
 *
 * @param {Object} proposalData - Datos de la propuesta a eliminar
 * @param {string} traceId - ID de trazabilidad del request
 * @returns {Promise<Object>} Resultado del procesamiento
 */
async function handleProposalDeleted(proposalData, traceId) {
  const serviceLogger = logger.child({
    component: 'prolibu.service',
    operation: 'handleProposalDeleted',
    traceId,
    proposalId: proposalData.proposalId,
  });

  serviceLogger.info('Procesando eliminación de propuesta');

  try {
    // Preparar datos para marcar como cerrada perdida
    const deleteData = {
      Prolibu_External_Id__c: proposalData.proposalId,
      StageName: 'Closed Lost',
      CloseDate: proposalData.closeDate || new Date().toISOString().split('T')[0],
      // Añadir razón en descripción si está disponible
      Description: proposalData.reason
        ? `Propuesta eliminada: ${proposalData.reason}`
        : 'Propuesta eliminada desde Prolibu',
    };

    // TODO: Integrar con Salesforce (Paso 10)
    // Opción 1: Actualizar a "Closed Lost"
    // const salesforceResult = await salesforceService.updateOpportunity(deleteData);

    // Opción 2: Eliminar físicamente (menos recomendado)
    // const salesforceResult = await salesforceService.deleteOpportunity(proposalData.proposalId);

    // STUB: Simular eliminación/cierre exitoso
    const stubResult = {
      success: true,
      salesforceId: `SF_OPP_${proposalData.proposalId}`, // ID simulado
      action: 'marked_as_closed_lost', // o 'physically_deleted'
      deleteData,
      message: 'Opportunity marcada como Closed Lost exitosamente (simulado)',
    };

    serviceLogger.info(
      {
        action: stubResult.action,
        salesforceId: stubResult.salesforceId,
        reason: proposalData.reason,
      },
      'Propuesta eliminada exitosamente'
    );

    return stubResult;
  } catch (error) {
    serviceLogger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      'Error al procesar eliminación de propuesta'
    );

    throw error;
  }
}

/**
 * Procesa cualquier evento de webhook según su tipo
 * Función principal que delega a los handlers específicos
 *
 * @param {string} eventType - Tipo de evento (proposal.created, etc.)
 * @param {Object} proposalData - Datos de la propuesta
 * @param {string} traceId - ID de trazabilidad del request
 * @returns {Promise<Object>} Resultado del procesamiento
 */
async function processWebhookEvent(eventType, proposalData, traceId) {
  const serviceLogger = logger.child({
    component: 'prolibu.service',
    operation: 'processWebhookEvent',
    traceId,
    eventType,
    proposalId: proposalData.proposalId,
  });

  serviceLogger.info('Iniciando procesamiento de evento webhook');

  try {
    let result;

    switch (eventType) {
      case 'proposal.created':
        result = await handleProposalCreated(proposalData, traceId);
        break;

      case 'proposal.updated':
        result = await handleProposalUpdated(proposalData, traceId);
        break;

      case 'proposal.deleted':
        result = await handleProposalDeleted(proposalData, traceId);
        break;

      default:
        throw new Error(`Tipo de evento no soportado: ${eventType}`);
    }

    serviceLogger.info(
      {
        eventType,
        success: result.success,
      },
      'Evento webhook procesado exitosamente'
    );

    return result;
  } catch (error) {
    serviceLogger.error(
      {
        eventType,
        error: error.message,
        stack: error.stack,
      },
      'Error al procesar evento webhook'
    );

    throw error;
  }
}

module.exports = {
  handleProposalCreated,
  handleProposalUpdated,
  handleProposalDeleted,
  processWebhookEvent,
};
