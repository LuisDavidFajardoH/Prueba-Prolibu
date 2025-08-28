#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Script para reenviar webhooks desde webhook.site a nuestro servidor local
 * Útil para testing cuando webhook.site recibe datos de Prolibu
 */

const https = require('https');
const http = require('http');

// URL de webhook.site para obtener datos
const WEBHOOK_SITE_TOKEN = '4daae5a0-283b-4aec-8c52-e29c26769a20';
const WEBHOOK_SITE_URL = `https://webhook.site/token/${WEBHOOK_SITE_TOKEN}/requests`;

// URL de nuestro servidor local
const LOCAL_SERVER_URL = 'http://localhost:3000/webhooks/prolibu';

console.log('🔄 Monitor de webhook.site iniciado...');
console.log(`📡 Monitoreando: https://webhook.site/${WEBHOOK_SITE_TOKEN}`);
console.log(`🎯 Reenviando a: ${LOCAL_SERVER_URL}`);
console.log('');

/**
 * Obtiene los últimos webhooks de webhook.site
 */
async function fetchWebhooks() {
  return new Promise((resolve, reject) => {
    https
      .get(WEBHOOK_SITE_URL, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const webhooks = JSON.parse(data);
            resolve(webhooks.data || []);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * Reenvía un webhook a nuestro servidor local
 */
async function forwardWebhook(webhookData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(webhookData);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/webhooks/prolibu',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = http.request(options, res => {
      let responseData = '';

      res.on('data', chunk => {
        responseData += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: responseData,
        });
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Set para trackear webhooks ya procesados
const processedWebhooks = new Set();

/**
 * Función principal de monitoreo
 */
async function monitorWebhooks() {
  try {
    const webhooks = await fetchWebhooks();

    for (const webhook of webhooks) {
      // Solo procesar webhooks POST con content JSON
      if (webhook.method === 'POST' && webhook.content && !processedWebhooks.has(webhook.uuid)) {
        try {
          const webhookPayload = JSON.parse(webhook.content);

          // Verificar que sea un webhook de Prolibu válido
          if (webhookPayload.event && webhookPayload.data) {
            console.log(`📨 Nuevo webhook recibido: ${webhookPayload.event}`);
            console.log(`   ID: ${webhookPayload.data.proposalId || 'N/A'}`);
            console.log(`   Timestamp: ${webhook.created_at}`);

            // Reenviar al servidor local
            const response = await forwardWebhook(webhookPayload);

            if (response.statusCode === 200) {
              console.log('✅ Webhook reenviado exitosamente');
              const responseJson = JSON.parse(response.data);
              console.log(`   Salesforce ID: ${responseJson.data?.salesforceId || 'N/A'}`);
              console.log(`   Trace ID: ${responseJson.traceId || 'N/A'}`);
            } else {
              console.log(`❌ Error al reenviar webhook: ${response.statusCode}`);
            }

            processedWebhooks.add(webhook.uuid);
            console.log('');
          }
        } catch (error) {
          // Ignorar webhooks con JSON inválido
        }
      }
    }
  } catch (error) {
    console.error('❌ Error al obtener webhooks:', error.message);
  }
}

// Monitorear cada 5 segundos
console.log('⏱️  Verificando nuevos webhooks cada 5 segundos...');
console.log('   Presiona Ctrl+C para detener');
console.log('');

setInterval(monitorWebhooks, 5000);

// Verificación inicial
monitorWebhooks();
