const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

// Importar configuración y librerías
const { config } = require('./libs/env');
const { logger } = require('./libs/logger');

// Importar middlewares
const { requestLogger, healthCheckLogger, errorHandler, notFound } = require('./middlewares');

// Importar rutas
const routes = require('./routes');

/**
 * Crea y configura la instancia de Express
 * Aplica middlewares, rutas y manejo de errores
 *
 * @returns {express.Application} Aplicación Express configurada
 */
function createServer() {
  const app = express();

  // ===== MIDDLEWARES DE SEGURIDAD =====

  // Helmet para headers de seguridad
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // CORS configurado para webhooks
  app.use(
    cors({
      origin:
        config.NODE_ENV === 'development'
          ? true // En desarrollo, permitir cualquier origen
          : [
              'https://api.prolibu.com',
              'https://app.prolibu.com',
              // Agregar otros orígenes autorizados según necesidad
            ],
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: false,
    })
  );

  // ===== MIDDLEWARES DE PARSING =====

  // Parser JSON con límite de tamaño
  app.use(
    express.json({
      limit: '1mb',
      strict: true,
      type: 'application/json',
    })
  );

  // Parser URL-encoded (por si se necesita en el futuro)
  app.use(
    express.urlencoded({
      extended: true,
      limit: '1mb',
    })
  );

  // ===== MIDDLEWARES DE LOGGING =====

  // Logger especial para health checks (evita spam)
  app.use(healthCheckLogger);

  // Logger principal para requests
  app.use(requestLogger);

  // ===== CONFIANZA EN PROXY =====

  // Configurar trust proxy si estamos detrás de un load balancer
  if (config.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // ===== RUTAS PRINCIPALES =====

  app.use('/', routes);

  // ===== MIDDLEWARE DE 404 =====

  app.use(notFound);

  // ===== MIDDLEWARE DE MANEJO DE ERRORES =====

  app.use(errorHandler);

  return app;
}

/**
 * Inicia el servidor en el puerto configurado
 * Maneja graceful shutdown y logging de inicio
 *
 * @returns {http.Server} Servidor HTTP iniciado
 */
function startServer() {
  const app = createServer();

  const server = app.listen(config.PORT, () => {
    logger.info(
      {
        port: config.PORT,
        environment: config.NODE_ENV,
        nodeVersion: process.version,
      },
      `🚀 Servidor iniciado en puerto ${config.PORT}`
    );

    logger.info(
      {
        endpoints: {
          root: `http://localhost:${config.PORT}/`,
          webhook: `http://localhost:${config.PORT}/webhooks/prolibu`,
          health: `http://localhost:${config.PORT}/health`,
          ping: `http://localhost:${config.PORT}/ping`,
        },
      },
      'Endpoints disponibles'
    );
  });

  // ===== GRACEFUL SHUTDOWN =====

  const gracefulShutdown = signal => {
    logger.info({ signal }, `Recibida señal ${signal}, iniciando graceful shutdown...`);

    server.close(err => {
      if (err) {
        logger.error({ error: err.message }, 'Error durante el shutdown');
        process.exit(1);
      }

      logger.info('Servidor cerrado correctamente');
      process.exit(0);
    });

    // Forzar cierre después de 10 segundos
    setTimeout(() => {
      logger.error('Forzando cierre después de timeout');
      process.exit(1);
    }, 10000);
  };

  // Escuchar señales de terminación
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Manejar errores no capturados
  process.on('uncaughtException', error => {
    logger.fatal(
      {
        error: error.message,
        stack: error.stack,
      },
      'Excepción no capturada'
    );
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal(
      {
        reason,
        promise,
      },
      'Promise rejection no manejada'
    );
    process.exit(1);
  });

  return server;
}

module.exports = {
  createServer,
  startServer,
};
