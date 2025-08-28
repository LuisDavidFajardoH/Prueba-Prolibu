const express = require('express');
const { config } = require('./libs/env');

// Importar routers
const prolibuWebhookRouter = require('../webhooks/prolibu.router');
const salesforceRouter = require('../salesforce/salesforce.router');

/**
 * Configuración de rutas principales de la aplicación
 * Monta todos los routers y define endpoints base
 */
const router = express.Router();

/**
 * GET /
 * Endpoint raíz con información básica del servicio
 */
router.get('/', (req, res) => {
  res.json({
    service: 'Prolibu-Salesforce Webhook Microservice',
    version: process.env.npm_package_version || '1.0.0',
    description: 'Microservicio para sincronizar webhooks de Prolibu con Salesforce Opportunities',
    environment: config.NODE_ENV,
    endpoints: {
      webhook: 'POST /webhooks/prolibu',
      health: 'GET /health',
      webhookHealth: 'GET /webhooks/prolibu/health',
      webhookInfo: 'GET /webhooks/prolibu/info',
      salesforceHealth: 'GET /salesforce/health',
      salesforceReconnect: 'POST /salesforce/reconnect',
      getOpportunity: 'GET /salesforce/opportunity/:prolibuId',
    },
    documentation: {
      examples: '/examples/',
      curl: 'curl -X POST http://localhost:3000/webhooks/prolibu -H "Content-Type: application/json" -d @examples/created.json',
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health
 * Health check global del servicio
 */
router.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    service: 'prolibu-salesforce-webhook',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.NODE_ENV,
    port: config.PORT,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      external: Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100,
    },
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };

  res.json(healthData);
});

/**
 * GET /ping
 * Endpoint simple para verificación rápida
 */
router.get('/ping', (req, res) => {
  res.json({
    message: 'pong',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Montar routers específicos
 */

// Webhooks de Prolibu en /webhooks/prolibu
router.use('/webhooks/prolibu', prolibuWebhookRouter);

// Endpoints de Salesforce en /salesforce
router.use('/salesforce', salesforceRouter);

module.exports = router;
