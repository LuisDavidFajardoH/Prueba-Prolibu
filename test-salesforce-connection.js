#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Script para probar la conexión a Salesforce
 * Verifica que las credenciales estén configuradas correctamente
 */

// Cargar configuración de entorno
require('./src/app/libs/env').loadAndValidateEnv();

const salesforceService = require('./src/services/salesforce.service');

async function testSalesforceConnection() {
  console.log('🔄 Probando conexión a Salesforce...');

  try {
    // Intentar conectar
    await salesforceService.connect();
    console.log('✅ Conexión exitosa a Salesforce');

    // Probar una consulta simple
    console.log('🔍 Probando consulta básica...');
    const result = await salesforceService.connection.query('SELECT Id, Name FROM Account LIMIT 1');
    console.log(`✅ Consulta exitosa. Encontradas ${result.totalSize} cuentas.`);

    // Desconectar
    await salesforceService.disconnect();
    console.log('✅ Desconexión exitosa');
  } catch (error) {
    console.error('❌ Error en la conexión:', error.message);
    console.error('\n📝 Verificar:');
    console.error('1. Que las credenciales en .env sean correctas');
    console.error(
      '2. Que SF_LOGIN_URL sea la correcta (login.salesforce.com o test.salesforce.com)'
    );
    console.error('3. Que el Security Token esté actualizado');
    console.error('4. Que no haya restricciones de IP en Salesforce');
    process.exit(1);
  }
}

testSalesforceConnection();
