const pino = require('pino');

/**
 * Configuración del logger usando Pino
 * Proporciona logging estructurado con diferentes niveles según el entorno
 *
 * @returns {pino.Logger} Instancia configurada del logger
 */
function createLogger() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const logLevel = process.env.LOG_LEVEL || 'info';

  const config = {
    level: logLevel,
    // En desarrollo, usar pretty print para mejor legibilidad
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    // En producción, usar formato JSON estructurado
    formatters: isDevelopment
      ? undefined
      : {
          level: label => ({ level: label }),
        },
  };

  return pino(config);
}

// Crear instancia singleton del logger
const logger = createLogger();

/**
 * Crea un logger hijo con contexto adicional
 * Útil para añadir información de contexto como requestId, userId, etc.
 *
 * @param {Object} context - Objeto con propiedades de contexto
 * @returns {pino.Logger} Logger hijo con contexto
 */
function createChildLogger(context) {
  return logger.child(context);
}

/**
 * Genera un ID único para tracking de requests
 * @returns {string} ID único de 8 caracteres
 */
function generateTraceId() {
  return Math.random().toString(36).substring(2, 10);
}

module.exports = {
  logger,
  createChildLogger,
  generateTraceId,
};
