const { z } = require('zod');
const { logger } = require('./logger');

/**
 * Schema de validación para variables de entorno requeridas
 * Define tipos, valores por defecto y validaciones para todas las env vars
 */
const envSchema = z.object({
  // Configuración básica del servidor
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0 && val < 65536, {
      message: 'PORT debe ser un número entre 1 y 65535',
    })
    .default('3000'),

  // Configuración de logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Variables de Salesforce (opcionales por ahora, requeridas en paso posterior)
  SF_LOGIN_URL: z.string().url().optional(),
  SF_USERNAME: z.string().optional(),
  SF_PASSWORD: z.string().optional(),
  SF_TOKEN: z.string().optional(),
  SF_CLIENT_ID: z.string().optional(),
  SF_CLIENT_SECRET: z.string().optional(),
});

/**
 * Carga y valida las variables de entorno
 * Falla rápido si hay configuraciones inválidas
 *
 * @returns {Object} Variables de entorno validadas y transformadas
 * @throws {Error} Si la validación falla
 */
function loadAndValidateEnv() {
  try {
    // Cargar dotenv solo si no estamos en test (Jest puede manejar esto)
    if (process.env.NODE_ENV !== 'test') {
      require('dotenv').config();
    }

    // Validar usando el schema de zod
    const env = envSchema.parse(process.env);

    logger.info(
      {
        nodeEnv: env.NODE_ENV,
        port: env.PORT,
        logLevel: env.LOG_LEVEL,
      },
      'Variables de entorno cargadas y validadas correctamente'
    );

    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error(
        {
          validationErrors: error.errors,
        },
        'Error de validación en variables de entorno'
      );

      // Crear mensaje de error más legible
      const errorMessages = error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');

      throw new Error(`Variables de entorno inválidas: ${errorMessages}`);
    }

    logger.error({ error: error.message }, 'Error inesperado al cargar variables de entorno');
    throw error;
  }
}

/**
 * Valida que las variables críticas de Salesforce estén presentes
 * Se usará en pasos posteriores cuando implementemos la integración
 *
 * @param {Object} env - Variables de entorno validadas
 * @returns {boolean} true si todas las variables de SF están presentes
 */
function validateSalesforceConfig(env) {
  const requiredSfVars = [
    'SF_LOGIN_URL',
    'SF_USERNAME',
    'SF_PASSWORD',
    'SF_CLIENT_ID',
    'SF_CLIENT_SECRET',
  ];

  const missing = requiredSfVars.filter(varName => !env[varName]);

  if (missing.length > 0) {
    logger.warn(
      {
        missingVars: missing,
      },
      'Variables de Salesforce no configuradas - funcionalidad limitada'
    );
    return false;
  }

  return true;
}

// Cargar y exportar configuración
let config;
try {
  config = loadAndValidateEnv();
} catch (error) {
  // En entorno de test, permitir configuración mínima
  if (process.env.NODE_ENV === 'test') {
    config = {
      NODE_ENV: 'test',
      PORT: 3000,
      LOG_LEVEL: 'silent',
    };
  } else {
    throw error;
  }
}

module.exports = {
  config,
  loadAndValidateEnv,
  validateSalesforceConfig,
  envSchema,
};
