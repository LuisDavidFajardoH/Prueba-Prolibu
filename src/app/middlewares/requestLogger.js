const { logger, generateTraceId } = require('../libs/logger');

/**
 * Middleware para logging de requests HTTP
 * Registra información de cada request: método, path, duración, status, etc.
 * Añade trace ID al request para seguimiento en logs
 *
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Siguiente middleware
 */
function requestLogger(req, res, next) {
  // Generar trace ID único para este request
  const traceId = generateTraceId();

  // Añadir trace ID al request para uso en otros middlewares
  req.traceId = traceId;

  // Timestamp de inicio
  const startTime = Date.now();

  // Crear logger con contexto del request
  const reqLogger = logger.child({
    traceId,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    ip: req.ip,
  });

  // Log del request entrante
  reqLogger.info(
    {
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      bodySize: req.get('Content-Length') || 0,
    },
    'Request entrante'
  );

  // Interceptar el final de la respuesta para log de salida
  const originalSend = res.send;
  res.send = function (body) {
    // Calcular duración
    const duration = Date.now() - startTime;

    // Determinar nivel de log según status code
    const status = res.statusCode;
    let logLevel = 'info';
    if (status >= 500) {
      logLevel = 'error';
    } else if (status >= 400) {
      logLevel = 'warn';
    }

    // Log de respuesta
    reqLogger[logLevel](
      {
        statusCode: status,
        duration: `${duration}ms`,
        responseSize: body ? Buffer.byteLength(body, 'utf8') : 0,
      },
      'Request completado'
    );

    // Llamar al método original
    originalSend.call(this, body);
  };

  // Manejar errores en el stream de respuesta
  res.on('error', error => {
    reqLogger.error(
      {
        error: error.message,
        duration: `${Date.now() - startTime}ms`,
      },
      'Error en stream de respuesta'
    );
  });

  next();
}

/**
 * Middleware simplificado para endpoints de health check
 * Evita spam en logs para requests de monitoreo
 *
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Siguiente middleware
 */
function healthCheckLogger(req, res, next) {
  // Solo log para health checks si hay errores
  if (req.path === '/health' || req.path === '/ping') {
    const traceId = generateTraceId();
    req.traceId = traceId;

    const originalSend = res.send;
    res.send = function (body) {
      // Solo logear si no es 200 OK
      if (res.statusCode !== 200) {
        logger.warn(
          {
            traceId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
          },
          'Health check falló'
        );
      }
      originalSend.call(this, body);
    };
  }

  next();
}

module.exports = {
  requestLogger,
  healthCheckLogger,
};
