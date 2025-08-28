const { z } = require('zod');
const { logger, generateTraceId } = require('../libs/logger');

/**
 * Middleware centralizado para manejo de errores
 * Convierte diferentes tipos de errores en respuestas HTTP apropiadas
 * Logea errores con trace IDs para debugging
 *
 * @param {Error} err - Error capturado
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Siguiente middleware
 */
function errorHandler(err, req, res, next) {
  // Si ya se envió la respuesta, delegamos al error handler por defecto de Express
  if (res.headersSent) {
    return next(err);
  }

  // Generar trace ID para seguimiento
  const traceId = generateTraceId();

  // Logger con contexto del request
  const requestLogger = logger.child({
    traceId,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
  });

  // Manejar errores de validación de Zod
  if (err instanceof z.ZodError) {
    requestLogger.warn(
      {
        error: 'validation_error',
        validationErrors: err.errors,
      },
      'Error de validación en request'
    );

    // Formatear errores de Zod de manera más legible
    const formattedErrors = err.errors.map(error => ({
      field: error.path.join('.'),
      message: error.message,
      received: error.received,
    }));

    return res.status(400).json({
      error: 'validation_error',
      message: 'Los datos enviados no son válidos',
      details: formattedErrors,
      traceId,
    });
  }

  // Manejar errores de sintaxis JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    requestLogger.warn(
      {
        error: 'invalid_json',
        message: err.message,
      },
      'JSON malformado en request'
    );

    return res.status(400).json({
      error: 'invalid_json',
      message: 'El formato JSON enviado no es válido',
      traceId,
    });
  }

  // Manejar errores de negocio personalizados
  if (err.name === 'BusinessError') {
    requestLogger.warn(
      {
        error: 'business_error',
        message: err.message,
        code: err.code,
      },
      'Error de lógica de negocio'
    );

    return res.status(err.statusCode || 400).json({
      error: err.code || 'business_error',
      message: err.message,
      traceId,
    });
  }

  // Manejar errores de Salesforce (para pasos futuros)
  if (err.name === 'SalesforceError') {
    requestLogger.error(
      {
        error: 'salesforce_error',
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
      },
      'Error en integración con Salesforce'
    );

    return res.status(502).json({
      error: 'salesforce_integration_error',
      message: 'Error temporal en la sincronización con Salesforce',
      traceId,
    });
  }

  // Error genérico no manejado
  requestLogger.error(
    {
      error: err.message,
      stack: err.stack,
      name: err.name,
    },
    'Error interno no manejado'
  );

  // En desarrollo, incluir más detalles del error
  const isDevelopment = process.env.NODE_ENV === 'development';

  return res.status(500).json({
    error: 'internal_error',
    message: 'Error interno del servidor',
    traceId,
    ...(isDevelopment && {
      details: {
        message: err.message,
        stack: err.stack,
        name: err.name,
      },
    }),
  });
}

/**
 * Clase para errores de negocio personalizados
 * Permite crear errores con códigos y status HTTP específicos
 */
class BusinessError extends Error {
  constructor(message, code = 'business_error', statusCode = 400) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Clase para errores de Salesforce (para uso futuro)
 * Permite manejar errores específicos de la integración con SF
 */
class SalesforceError extends Error {
  constructor(message, code = 'sf_error', statusCode = 502) {
    super(message);
    this.name = 'SalesforceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

module.exports = {
  errorHandler,
  BusinessError,
  SalesforceError,
};
