const { logger } = require('../libs/logger');

/**
 * Middleware especializado para manejo de errores de Salesforce
 * Convierte errores de jsforce en respuestas HTTP apropiadas
 */

/**
 * Maneja errores específicos de Salesforce API
 *
 * @param {Error} error - Error de Salesforce
 * @param {string} traceId - ID de trazabilidad
 * @returns {Object} Error estructurado para respuesta HTTP
 */
function handleSalesforceError(error, traceId) {
  const sfLogger = logger.child({
    component: 'salesforce.errorHandler',
    traceId,
    errorType: error.name || 'SalesforceError',
  });

  // Errores de autenticación/autorización
  if (error.name === 'INVALID_LOGIN' || error.errorCode === 'INVALID_LOGIN') {
    sfLogger.error('Error de autenticación en Salesforce');
    return {
      statusCode: 401,
      error: 'salesforce_auth_error',
      message: 'Error de autenticación con Salesforce. Verifica credenciales.',
      details: 'Las credenciales de Salesforce son inválidas o han expirado',
    };
  }

  // Errores de conexión/red
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    sfLogger.error('Error de conectividad con Salesforce');
    return {
      statusCode: 503,
      error: 'salesforce_connection_error',
      message: 'No se puede conectar con Salesforce. Servicio temporalmente no disponible.',
      details: 'Problema de conectividad de red o Salesforce no disponible',
    };
  }

  // Errores de permisos
  if (
    error.errorCode === 'INSUFFICIENT_ACCESS_OR_READONLY' ||
    error.errorCode === 'INSUFFICIENT_ACCESS'
  ) {
    sfLogger.error('Error de permisos en Salesforce');
    return {
      statusCode: 403,
      error: 'salesforce_permission_error',
      message: 'Permisos insuficientes para realizar la operación en Salesforce.',
      details: 'El usuario no tiene permisos para crear/editar Opportunities',
    };
  }

  // Errores de validación de datos
  if (
    error.errorCode === 'REQUIRED_FIELD_MISSING' ||
    error.errorCode === 'FIELD_CUSTOM_VALIDATION_EXCEPTION'
  ) {
    sfLogger.error('Error de validación de datos en Salesforce');
    return {
      statusCode: 400,
      error: 'salesforce_validation_error',
      message: 'Los datos enviados no cumplen las validaciones de Salesforce.',
      details: error.message || 'Error de validación en campos requeridos',
    };
  }

  // Errores de límites de API
  if (error.errorCode === 'REQUEST_LIMIT_EXCEEDED') {
    sfLogger.error('Límite de API de Salesforce excedido');
    return {
      statusCode: 429,
      error: 'salesforce_rate_limit',
      message: 'Límite de llamadas a la API de Salesforce excedido.',
      details: 'Demasiadas peticiones. Intenta nuevamente más tarde.',
    };
  }

  // Errores de duplicados
  if (error.errorCode === 'DUPLICATE_VALUE') {
    sfLogger.error('Error de duplicado en Salesforce');
    return {
      statusCode: 409,
      error: 'salesforce_duplicate_error',
      message: 'Ya existe un registro con los mismos datos en Salesforce.',
      details: 'Violación de regla de duplicados',
    };
  }

  // Error genérico de Salesforce
  sfLogger.error(
    {
      errorCode: error.errorCode,
      errorMessage: error.message,
      stack: error.stack,
    },
    'Error genérico de Salesforce'
  );

  return {
    statusCode: 500,
    error: 'salesforce_error',
    message: 'Error interno de Salesforce. Contacta al administrador.',
    details: error.message || 'Error desconocido en la integración con Salesforce',
  };
}

/**
 * Middleware Express para manejo de errores de Salesforce
 * Se ejecuta cuando hay errores en operaciones de Salesforce
 */
function salesforceErrorMiddleware(error, req, res, next) {
  // Solo procesar si el error viene de operaciones de Salesforce
  const isSalesforceError =
    error.name === 'INVALID_LOGIN' ||
    error.errorCode ||
    req.path.includes('/salesforce') ||
    error.message.includes('Salesforce') ||
    error.stack.includes('jsforce');

  if (!isSalesforceError) {
    return next(error);
  }

  const handledError = handleSalesforceError(error, req.traceId);

  res.status(handledError.statusCode).json({
    ...handledError,
    traceId: req.traceId,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  });
}

/**
 * Verifica si un error es recuperable (puede reintentar)
 *
 * @param {Error} error - Error a verificar
 * @returns {boolean} True si es recuperable
 */
function isRecoverableError(error) {
  const recoverableErrors = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'REQUEST_LIMIT_EXCEEDED'];

  return recoverableErrors.includes(error.code) || recoverableErrors.includes(error.errorCode);
}

/**
 * Obtiene tiempo de espera recomendado para retry
 *
 * @param {Error} error - Error ocurrido
 * @param {number} attempt - Número de intento actual
 * @returns {number} Milisegundos a esperar
 */
function getRetryDelay(error, attempt = 1) {
  // Para rate limiting, esperar más tiempo
  if (error.errorCode === 'REQUEST_LIMIT_EXCEEDED') {
    return Math.min(30000 * attempt, 300000); // Max 5 minutos
  }

  // Para errores de conexión, backoff exponencial
  return Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30 segundos
}

module.exports = {
  handleSalesforceError,
  salesforceErrorMiddleware,
  isRecoverableError,
  getRetryDelay,
};
