/**
 * Punto de entrada principal del microservicio
 * Arranca el servidor Express y maneja la configuración inicial
 */

const { logger } = require('./app/libs/logger');
const { config } = require('./app/libs/env');
const { startServer } = require('./app/server');

/**
 * Función principal de arranque
 */
async function main() {
  try {
    logger.info(
      {
        service: 'prolibu-salesforce-webhook',
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        environment: config.NODE_ENV,
        port: config.PORT,
      },
      '🌟 Iniciando microservicio Prolibu-Salesforce'
    );

    // Verificar configuración crítica
    logger.info(
      {
        hasEnvFile: !!process.env.NODE_ENV,
        logLevel: config.LOG_LEVEL,
      },
      'Configuración cargada'
    );

    // Iniciar servidor
    startServer();

    // Log adicional para desarrollo
    if (config.NODE_ENV === 'development') {
      logger.info('📖 Para probar el servicio:');
      logger.info(`   curl http://localhost:${config.PORT}/health`);
      logger.info(
        `   curl -X POST http://localhost:${config.PORT}/webhooks/prolibu -H "Content-Type: application/json" -d @examples/created.json`
      );
    }
  } catch (error) {
    logger.fatal(
      {
        error: error.message,
        stack: error.stack,
      },
      '💥 Error fatal al iniciar el servidor'
    );

    process.exit(1);
  }
}

// Ejecutar solo si este archivo es el módulo principal
if (require.main === module) {
  main();
}

module.exports = { main };
