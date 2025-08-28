/**
 * Barrel export para todos los middlewares
 * Facilita la importación desde otros módulos
 */

const { errorHandler, BusinessError, SalesforceError } = require('./errorHandler');
const { notFound } = require('./notFound');
const { requestLogger, healthCheckLogger } = require('./requestLogger');

module.exports = {
  // Error handling
  errorHandler,
  BusinessError,
  SalesforceError,

  // Request lifecycle
  requestLogger,
  healthCheckLogger,
  notFound,
};
