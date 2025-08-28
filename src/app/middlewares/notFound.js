const { logger } = require('../libs/logger');

/**
 * Middleware para manejar rutas no encontradas (404)
 * Se ejecuta cuando ninguna ruta coincide con el request
 * Responde con formato JSON consistente y logea el intento
 *
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} _next - Siguiente middleware (no usado, es el último)
 */
function notFound(req, res, _next) {
  // Logger con contexto del request
  const requestLogger = logger.child({
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  requestLogger.warn('Ruta no encontrada');

  res.status(404).json({
    error: 'not_found',
    message: `La ruta ${req.method} ${req.path} no existe`,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  notFound,
};
