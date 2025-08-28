const jsforce = require('jsforce');
const { logger } = require('../app/libs/logger');

/**
 * Servicio para integración con Salesforce
 * Maneja la conexión, autenticación y operaciones CRUD en Salesforce
 */

class SalesforceService {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 3;
    this.serviceLogger = logger.child({
      component: 'salesforce.service',
    });
  }

  /**
   * Establece conexión con Salesforce usando credenciales del entorno
   * Implementa retry logic para reconexión automática
   */
  async connect() {
    const connectLogger = this.serviceLogger.child({
      operation: 'connect',
      attempt: this.connectionRetries + 1,
    });

    try {
      // Validar que las credenciales básicas estén presentes
      const requiredVars = ['SF_LOGIN_URL', 'SF_USERNAME', 'SF_PASSWORD', 'SF_TOKEN'];
      const missingVars = requiredVars.filter(varName => !process.env[varName]);

      if (missingVars.length > 0) {
        throw new Error(
          `Credenciales de Salesforce no configuradas: ${missingVars.join(', ')}. ` +
            'Verifica las variables: SF_USERNAME, SF_PASSWORD, SF_TOKEN, SF_LOGIN_URL'
        );
      }

      connectLogger.info('Iniciando conexión con Salesforce');

      // Crear nueva conexión
      this.connection = new jsforce.Connection({
        loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
      });

      // Autenticar con username/password + security token
      const loginResult = await this.connection.login(
        process.env.SF_USERNAME,
        process.env.SF_PASSWORD + process.env.SF_TOKEN
      );

      this.isConnected = true;
      this.connectionRetries = 0;

      connectLogger.info(
        {
          organizationId: loginResult.organizationId,
          userId: loginResult.id,
          serverUrl: loginResult.serverUrl,
        },
        'Conexión con Salesforce establecida exitosamente'
      );

      return {
        success: true,
        organizationId: loginResult.organizationId,
        userId: loginResult.id,
        serverUrl: loginResult.serverUrl,
      };
    } catch (error) {
      this.isConnected = false;
      this.connectionRetries++;

      connectLogger.error(
        {
          error: error.message,
          errorCode: error.errorCode,
          attempt: this.connectionRetries,
          maxRetries: this.maxRetries,
        },
        'Error conectando con Salesforce'
      );

      // Retry logic
      if (this.connectionRetries < this.maxRetries) {
        connectLogger.warn(
          `Reintentando conexión en 5 segundos (intento ${this.connectionRetries}/${this.maxRetries})`
        );

        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.connect();
      }

      throw new Error(
        `Failed to connect to Salesforce after ${this.maxRetries} attempts: ${error.message}`
      );
    }
  }

  /**
   * Verifica si la conexión está activa y reconecta si es necesario
   */
  async ensureConnection() {
    if (!this.isConnected || !this.connection) {
      await this.connect();
    }

    // Test de conectividad simple
    try {
      await this.connection.query('SELECT Id FROM Organization LIMIT 1');
    } catch (error) {
      this.serviceLogger.warn('Conexión perdida, reconectando...');
      this.isConnected = false;
      await this.connect();
    }
  }

  /**
   * Crea una nueva Opportunity en Salesforce
   *
   * @param {Object} opportunityData - Datos de la opportunity
   * @param {string} traceId - ID de trazabilidad
   * @returns {Promise<Object>} Resultado de la creación
   */
  async createOpportunity(opportunityData, traceId) {
    const createLogger = this.serviceLogger.child({
      operation: 'createOpportunity',
      traceId,
      prolibuId: opportunityData.Prolibu_External_Id__c,
    });

    try {
      await this.ensureConnection();

      createLogger.info(
        {
          opportunityName: opportunityData.Name,
          stage: opportunityData.StageName,
          amount: opportunityData.Amount,
        },
        'Creando Opportunity en Salesforce'
      );

      // Verificar si ya existe una opportunity con este External ID
      const existingOpportunity = await this.connection.sobject('Opportunity').findOne({
        Prolibu_External_Id__c: opportunityData.Prolibu_External_Id__c,
      });

      if (existingOpportunity) {
        createLogger.warn(
          { existingSalesforceId: existingOpportunity.Id },
          'Opportunity ya existe, actualizando en lugar de crear'
        );
        return this.updateOpportunity(opportunityData, traceId);
      }

      // Crear nueva opportunity
      const result = await this.connection.sobject('Opportunity').create(opportunityData);

      if (!result.success) {
        throw new Error(`Salesforce creation failed: ${JSON.stringify(result.errors)}`);
      }

      createLogger.info(
        {
          salesforceId: result.id,
          opportunityName: opportunityData.Name,
        },
        'Opportunity creada exitosamente en Salesforce'
      );

      return {
        success: true,
        salesforceId: result.id,
        operation: 'created',
        opportunityData,
      };
    } catch (error) {
      createLogger.error(
        {
          error: error.message,
          opportunityData,
        },
        'Error creando Opportunity en Salesforce'
      );

      throw error;
    }
  }

  /**
   * Actualiza una Opportunity existente en Salesforce
   *
   * @param {Object} opportunityData - Datos actualizados
   * @param {string} traceId - ID de trazabilidad
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updateOpportunity(opportunityData, traceId) {
    const updateLogger = this.serviceLogger.child({
      operation: 'updateOpportunity',
      traceId,
      prolibuId: opportunityData.Prolibu_External_Id__c,
    });

    try {
      await this.ensureConnection();

      updateLogger.info('Actualizando Opportunity en Salesforce');

      // Buscar opportunity por External ID
      const existingOpportunity = await this.connection.sobject('Opportunity').findOne({
        Prolibu_External_Id__c: opportunityData.Prolibu_External_Id__c,
      });

      if (!existingOpportunity) {
        updateLogger.warn('Opportunity no encontrada, creando nueva');
        return this.createOpportunity(opportunityData, traceId);
      }

      // Actualizar opportunity existente
      const updateData = { ...opportunityData, Id: existingOpportunity.Id };
      const result = await this.connection.sobject('Opportunity').update(updateData);

      if (!result.success) {
        throw new Error(`Salesforce update failed: ${JSON.stringify(result.errors)}`);
      }

      updateLogger.info(
        {
          salesforceId: existingOpportunity.Id,
          updatedFields: Object.keys(opportunityData),
        },
        'Opportunity actualizada exitosamente en Salesforce'
      );

      return {
        success: true,
        salesforceId: existingOpportunity.Id,
        operation: 'updated',
        opportunityData,
      };
    } catch (error) {
      updateLogger.error(
        {
          error: error.message,
          opportunityData,
        },
        'Error actualizando Opportunity en Salesforce'
      );

      throw error;
    }
  }

  /**
   * Marca una Opportunity como Closed Lost en Salesforce
   *
   * @param {string} prolibuId - ID externo de Prolibu
   * @param {string} traceId - ID de trazabilidad
   * @param {string} reason - Razón de eliminación (opcional)
   * @returns {Promise<Object>} Resultado de la operación
   */
  async markOpportunityAsClosedLost(prolibuId, traceId, reason = null) {
    const deleteLogger = this.serviceLogger.child({
      operation: 'markOpportunityAsClosedLost',
      traceId,
      prolibuId,
    });

    try {
      await this.ensureConnection();

      deleteLogger.info('Marcando Opportunity como Closed Lost en Salesforce');

      // Buscar opportunity por External ID
      const existingOpportunity = await this.connection.sobject('Opportunity').findOne({
        Prolibu_External_Id__c: prolibuId,
      });

      if (!existingOpportunity) {
        deleteLogger.warn('Opportunity no encontrada en Salesforce');
        return {
          success: false,
          message: 'Opportunity not found in Salesforce',
          salesforceId: null,
        };
      }

      // Actualizar a Closed Lost
      const updateData = {
        Id: existingOpportunity.Id,
        StageName: 'Closed Lost',
        CloseDate: new Date().toISOString().split('T')[0],
      };

      // Agregar razón si se proporciona
      if (reason) {
        updateData.Description =
          `${existingOpportunity.Description || ''}\n\nClosed Reason: ${reason}`.trim();
      }

      const result = await this.connection.sobject('Opportunity').update(updateData);

      if (!result.success) {
        throw new Error(`Salesforce update failed: ${JSON.stringify(result.errors)}`);
      }

      deleteLogger.info(
        {
          salesforceId: existingOpportunity.Id,
          reason,
        },
        'Opportunity marcada como Closed Lost exitosamente'
      );

      return {
        success: true,
        salesforceId: existingOpportunity.Id,
        operation: 'closed_lost',
        reason,
      };
    } catch (error) {
      deleteLogger.error(
        {
          error: error.message,
          prolibuId,
          reason,
        },
        'Error marcando Opportunity como Closed Lost'
      );

      throw error;
    }
  }

  /**
   * Obtiene información de una Opportunity por External ID
   *
   * @param {string} prolibuId - ID externo de Prolibu
   * @param {string} traceId - ID de trazabilidad
   * @returns {Promise<Object>} Datos de la opportunity
   */
  async getOpportunityByProlibuId(prolibuId, traceId) {
    const getLogger = this.serviceLogger.child({
      operation: 'getOpportunityByProlibuId',
      traceId,
      prolibuId,
    });

    try {
      await this.ensureConnection();

      getLogger.info('Buscando Opportunity en Salesforce por Prolibu ID');

      const opportunity = await this.connection.sobject('Opportunity').findOne(
        {
          Prolibu_External_Id__c: prolibuId,
        },
        {
          Id: 1,
          Name: 1,
          StageName: 1,
          Amount: 1,
          CloseDate: 1,
          Description: 1,
          Prolibu_External_Id__c: 1,
          CreatedDate: 1,
          LastModifiedDate: 1,
        }
      );

      if (!opportunity) {
        getLogger.info('Opportunity no encontrada en Salesforce');
        return null;
      }

      getLogger.info(
        {
          salesforceId: opportunity.Id,
          stage: opportunity.StageName,
        },
        'Opportunity encontrada en Salesforce'
      );

      return opportunity;
    } catch (error) {
      getLogger.error(
        {
          error: error.message,
          prolibuId,
        },
        'Error buscando Opportunity en Salesforce'
      );

      throw error;
    }
  }

  /**
   * Obtiene estadísticas de salud de la conexión con Salesforce
   *
   * @returns {Promise<Object>} Estado de la conexión
   */
  async getConnectionHealth() {
    try {
      if (!this.isConnected) {
        return {
          status: 'disconnected',
          lastError: 'No connection established',
        };
      }

      // Test simple de conectividad
      const orgInfo = await this.connection.query('SELECT Id, Name FROM Organization LIMIT 1');

      return {
        status: 'connected',
        organizationName: orgInfo.records[0]?.Name,
        serverUrl: this.connection.instanceUrl,
        connectionRetries: this.connectionRetries,
      };
    } catch (error) {
      return {
        status: 'error',
        lastError: error.message,
        connectionRetries: this.connectionRetries,
      };
    }
  }

  /**
   * Cierra la conexión con Salesforce
   */
  async disconnect() {
    if (this.connection) {
      try {
        await this.connection.logout();
        this.serviceLogger.info('Desconectado de Salesforce exitosamente');
      } catch (error) {
        this.serviceLogger.warn(
          { error: error.message },
          'Error durante desconexión de Salesforce'
        );
      }
    }

    this.connection = null;
    this.isConnected = false;
    this.connectionRetries = 0;
  }
}

// Singleton instance
const salesforceService = new SalesforceService();

module.exports = salesforceService;
