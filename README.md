# Prolibu-Salesforce Webhook Integration

Microservicio para sincronizar propuestas de Prolibu con Opportunities en Salesforce mediante webhooks.

## � Inicio Rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con credenciales de Salesforce
```

### 3. Verificar conexión

```bash
npm run test:salesforce
npm run verify:field
```

### 4. Iniciar servidor

```bash
npm run dev  # desarrollo
npm start    # producción
```

## ⚙️ Configuración (.env)

```bash
# Servidor
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Salesforce
SF_LOGIN_URL=https://login.salesforce.com
SF_USERNAME=tu-usuario@empresa.com
SF_PASSWORD=tu-password
SF_TOKEN=tu-security-token
```

## 📡 Webhook Endpoint

```
POST http://localhost:3000/webhooks/prolibu
Content-Type: application/json
```

## 🔄 Mapeo de Estados

El sistema mapea automáticamente los estados de Prolibu a etapas de Salesforce:

| Estado Prolibu                                             | Etapa Salesforce     |
| ---------------------------------------------------------- | -------------------- |
| `lead`                                                     | Prospecting          |
| `qualification`, `qualified`                               | Qualification        |
| `analysis`, `needs_analysis`                               | Needs Analysis       |
| `solution_design`                                          | Value Proposition    |
| `proposal`, `proposal_draft`, `proposal_review`            | Proposal/Price Quote |
| `negotiation`, `review`, `final_review`                    | Negotiation/Review   |
| `approved`, `won`, `closed_won`, `accepted`                | Closed Won           |
| `rejected`, `lost`, `closed_lost`, `cancelled`, `declined` | Closed Lost          |

## 🧪 Probar con Ejemplos

### Usar ejemplo incluido

```bash
# Asegúrate que el servidor esté corriendo en otra terminal
npm run dev

# En otra terminal, enviar ejemplo
curl -X POST http://localhost:3000/webhooks/prolibu \
  -H "Content-Type: application/json" \
  -d @examples/prolibu-real-payload.json
```

### Payload de ejemplo

```json
{
  "model": "proposal",
  "action": "create",
  "body": {
    "proposalId": "prop-123",
    "title": "Desarrollo de aplicación móvil",
    "stage": "proposal",
    "amount": {
      "total": 50000
    },
    "clientName": "Empresa XYZ",
    "clientEmail": "contacto@empresa.com"
  }
}
```

### Respuesta esperada

```json
{
  "success": true,
  "operation": "created",
  "proposalId": "prop-123",
  "salesforceId": "006XXXXXXXXXX",
  "message": "Opportunity created successfully"
}
```

## 🧪 Scripts de Testing

```bash
npm test                    # Ejecutar todos los tests
npm run test:salesforce     # Probar conexión a Salesforce
npm run verify:field        # Verificar campo personalizado
npm run test:watch          # Tests en modo watch
```

## 🛠️ Utilidades

### Monitor de webhooks

```bash
node webhook-monitor.js
```

Monitorea webhooks desde webhook.site y los reenvía al servidor local.

### Verificar campo personalizado

```bash
npm run verify:field
```

Crea automáticamente el campo `Prolibu_External_Id__c` en Salesforce si no existe.

## 📁 Ejemplos Incluidos

- `examples/prolibu-real-payload.json` - Payload real de Prolibu
- `examples/prolibu-real-format.json` - Formato simplificado
- `examples/created.json` - Ejemplo de creación
- `examples/updated.json` - Ejemplo de actualización
- `examples/deleted.json` - Ejemplo de eliminación

## 🐛 Troubleshooting

### Error de autenticación Salesforce

```bash
npm run test:salesforce
```

- Verificar credenciales en `.env`
- Verificar security token (Settings → Reset My Security Token)

### Campo personalizado no existe

```bash
npm run verify:field
```

El script creará automáticamente el campo `Prolibu_External_Id__c`.

### Webhook no llega

- Verificar que el servidor esté corriendo: `npm run dev`
- Verificar URL en configuración de Prolibu
- Usar ngrok para exponer puerto local: `ngrok http 3000`

## 📊 Logs

Los logs incluyen información estructurada para debugging:

```bash
# Logs con formato pretty (desarrollo)
NODE_ENV=development npm run dev

# Logs JSON (producción)
NODE_ENV=production npm start
```

## 🏗️ Estructura

```
src/
├── webhooks/
│   ├── prolibu.adapter.js     # Convierte formato Prolibu
│   ├── prolibu.controller.js  # Maneja webhooks
│   ├── prolibu.service.js     # Lógica de negocio
│   └── prolibu.schema.js      # Validaciones
├── services/
│   └── salesforce.service.js  # Integración Salesforce
├── config/
│   └── stageMap.js           # Mapeo de estados
└── app/                      # Configuración Express
```

## 📄 Licencia

MIT License
