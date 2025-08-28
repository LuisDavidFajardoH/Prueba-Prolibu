#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Script para verificar y crear el campo personalizado Prolibu_External_Id__c
 * en el objeto Opportunity de Salesforce
 */

// Cargar configuración de entorno
require('./src/app/libs/env').loadAndValidateEnv();

const salesforceService = require('./src/services/salesforce.service');

async function checkCustomField() {
  console.log('🔄 Verificando campo personalizado Prolibu_External_Id__c...');

  try {
    await salesforceService.connect();

    // Intentar hacer una consulta que use el campo personalizado
    const testQuery = 'SELECT Id, Name, Prolibu_External_Id__c FROM Opportunity LIMIT 1';
    await salesforceService.connection.query(testQuery);

    console.log('✅ Campo Prolibu_External_Id__c existe y es accesible');

    await salesforceService.disconnect();
  } catch (error) {
    console.error('❌ Error al verificar campo personalizado:', error.message);

    if (error.message.includes('No such column')) {
      console.error('\n📝 El campo Prolibu_External_Id__c NO existe.');
      console.error('Necesitas crear este campo en Salesforce:');
      console.error('1. Ve a Setup → Object Manager → Opportunity');
      console.error('2. Crear nuevo campo:');
      console.error('   - Tipo: Text');
      console.error('   - Label: Prolibu External ID');
      console.error('   - API Name: Prolibu_External_Id__c');
      console.error('   - Length: 50');
      console.error('   - Unique: true');
      console.error('   - External ID: true');
    }

    process.exit(1);
  }
}

checkCustomField();
