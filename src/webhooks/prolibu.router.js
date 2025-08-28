const express = require('express');
const { handleProlibuWebhook, healthCheck, getSupportedEvents } = require('./prolibu.controller');
const { prolibuWebhookAdapter } = require('./prolibu.adapter');

/**
 * Router para manejar todos los endpoints relacionados con webhooks de Prolibu
 * Monta los controladores en las rutas apropiadas
 */
const router = express.Router();

/**
 * POST /webhooks/prolibu
 * Endpoint principal para recibir webhooks de Prolibu
 * Acepta eventos: proposal.created, proposal.updated, proposal.deleted
 *
 * Headers requeridos:
 * - Content-Type: application/json
 *
 * Body: Ver schemas en prolibu.schema.js
 */
router.post('/', prolibuWebhookAdapter, handleProlibuWebhook);

/**
 * GET /webhooks/prolibu/health
 * Health check específico para el servicio de webhooks
 * Útil para monitoreo y verificación de estado
 */
router.get('/health', healthCheck);

/**
 * GET /webhooks/prolibu/info
 * Información sobre eventos soportados, campos requeridos y mapeo de estados
 * Útil para documentación y debugging
 */
router.get('/info', getSupportedEvents);

module.exports = router;
