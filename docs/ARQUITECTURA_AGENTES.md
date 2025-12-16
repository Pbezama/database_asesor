# Arquitectura Modular de Agentes con Function Calling

## Objetivo

Crear un sistema modular donde cada agente sea independiente, con sus propias tools/funciones, y pueda ser agregado sin modificar el resto del sistema. El chat sirve como repositorio único de conversación.

---

## 1. Nueva Estructura de Carpetas Propuesta

```
src/
├── agents/                          # Carpeta de agentes
│   ├── index.js                     # Registro central de agentes
│   ├── base/
│   │   └── BaseAgent.js             # Clase base con estructura común
│   ├── controlador/
│   │   ├── index.js                 # Exporta el agente
│   │   ├── config.js                # Configuración (nombre, descripción, icono)
│   │   ├── prompt.js                # System prompt del agente
│   │   └── tools.js                 # Tools/funciones del agente
│   ├── chatia/
│   │   ├── index.js
│   │   ├── config.js
│   │   ├── prompt.js
│   │   └── tools.js
│   └── [nuevo-agente]/              # Fácil agregar más agentes
│       ├── index.js
│       ├── config.js
│       ├── prompt.js
│       └── tools.js
├── services/
│   ├── agentManager.js              # Orquestador de agentes
│   ├── conversationManager.js       # Gestión del historial
│   ├── openai.js                    # Simplificado: solo llamadas a API
│   └── supabase.js                  # Sin cambios
├── hooks/
│   └── useAgent.js                  # Hook para usar agentes
└── ... (resto sin cambios)
```

---

## 2. Estructura de un Agente

### 2.1 Archivo `config.js`

```javascript
// agents/controlador/config.js
export const config = {
  id: 'controlador',
  name: 'Controlador',
  description: 'Gestiona datos de marca en la base de datos',
  icon: '◈',
  color: '#3b82f6',  // Azul
  temperature: 0.7,
  canDelegateTo: ['chatia'],  // Agentes a los que puede delegar
  capabilities: [
    'Agregar datos',
    'Modificar datos',
    'Desactivar datos',
    'Consultar comentarios',
    'Mostrar información'
  ]
}
```

### 2.2 Archivo `prompt.js`

```javascript
// agents/controlador/prompt.js
export const buildPrompt = (context) => {
  const { nombreMarca, nombreUsuario, datosMarca, fechaInfo } = context

  return `Eres un asistente para administrar los datos de la marca "${nombreMarca}".

DATOS ACTUALES DE LA MARCA:
${formatearDatos(datosMarca)}

FECHA ACTUAL: ${fechaInfo.fecha}

INSTRUCCIONES:
- Usa las funciones disponibles para responder
- Siempre confirma antes de modificar datos
- Habla en español chileno cercano y profesional
...`
}
```

### 2.3 Archivo `tools.js` (Function Calling)

```javascript
// agents/controlador/tools.js
export const tools = [
  {
    type: "function",
    function: {
      name: "responder_texto",
      description: "Responder con texto al usuario",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          mensaje: { type: "string" }
        },
        required: ["mensaje"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "mostrar_datos",
      description: "Mostrar datos de la marca en formato tabla",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          columnas: { type: "array", items: { type: "string" } },
          filas: { type: "array", items: { type: "array" } }
        },
        required: ["mensaje", "columnas", "filas"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pedir_confirmacion",
      description: "Pedir confirmación antes de agregar/modificar/eliminar",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          accion: { type: "string", enum: ["agregar", "modificar", "desactivar"] },
          parametros: {
            type: "object",
            properties: {
              categoria: { type: ["string", "null"] },
              clave: { type: ["string", "null"] },
              valor: { type: ["string", "null"] },
              prioridad: { type: ["number", "null"] },
              id_fila: { type: ["number", "null"] }
            },
            required: ["categoria", "clave", "valor", "prioridad", "id_fila"],
            additionalProperties: false
          }
        },
        required: ["mensaje", "accion", "parametros"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ejecutar_accion",
      description: "Ejecutar acción ya confirmada por el usuario",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          accion: { type: "string", enum: ["agregar", "modificar", "desactivar"] },
          parametros: { type: "object" }
        },
        required: ["mensaje", "accion", "parametros"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "consultar_comentarios",
      description: "Buscar comentarios con filtros",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          filtros: {
            type: "object",
            properties: {
              soloInapropiados: { type: ["boolean", "null"] },
              busqueda: { type: ["string", "null"] },
              limite: { type: ["number", "null"] }
            },
            required: ["soloInapropiados", "busqueda", "limite"],
            additionalProperties: false
          }
        },
        required: ["mensaje", "filtros"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sugerir_delegacion",
      description: "Sugerir que otro agente maneje la tarea",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          agente_destino: { type: "string", enum: ["chatia"] },
          razon: { type: "string" }
        },
        required: ["mensaje", "agente_destino", "razon"],
        additionalProperties: false
      }
    }
  }
]

// Mapeo de función llamada → tipo de respuesta
export const toolResponseMapper = {
  responder_texto: (args) => ({ tipo: 'texto', contenido: args.mensaje }),
  mostrar_datos: (args) => ({
    tipo: 'tabla',
    contenido: args.mensaje,
    datos: { columnas: args.columnas, filas: args.filas }
  }),
  pedir_confirmacion: (args) => ({
    tipo: 'confirmacion',
    contenido: args.mensaje,
    accionPendiente: { accion: args.accion, parametros: args.parametros }
  }),
  ejecutar_accion: (args) => ({
    tipo: 'accion_confirmada',
    contenido: args.mensaje,
    ejecutar: { accion: args.accion, parametros: args.parametros }
  }),
  consultar_comentarios: (args) => ({
    tipo: 'consultar_comentarios',
    contenido: args.mensaje,
    filtros: args.filtros
  }),
  sugerir_delegacion: (args) => ({
    tipo: 'texto',
    contenido: args.mensaje,
    delegacion: { sugerida: true, agenteDestino: args.agente_destino, razon: args.razon }
  })
}
```

### 2.4 Archivo `index.js` del agente

```javascript
// agents/controlador/index.js
import { config } from './config'
import { buildPrompt } from './prompt'
import { tools, toolResponseMapper } from './tools'

export default {
  config,
  buildPrompt,
  tools,
  toolResponseMapper
}
```

---

## 3. Registro Central de Agentes

```javascript
// agents/index.js
import controlador from './controlador'
import chatia from './chatia'

// Registro de todos los agentes disponibles
export const agents = {
  controlador,
  chatia
}

// Helper para obtener agente por ID
export const getAgent = (agentId) => {
  const agent = agents[agentId]
  if (!agent) {
    throw new Error(`Agente "${agentId}" no encontrado`)
  }
  return agent
}

// Lista de agentes disponibles (para UI)
export const getAvailableAgents = () => {
  return Object.values(agents).map(a => ({
    id: a.config.id,
    name: a.config.name,
    description: a.config.description,
    icon: a.config.icon,
    color: a.config.color
  }))
}

// Obtener tools de un agente específico
export const getAgentTools = (agentId) => {
  const agent = getAgent(agentId)
  return agent.tools
}
```

---

## 4. Agent Manager (Orquestador)

```javascript
// services/agentManager.js
import OpenAI from 'openai'
import { getAgent } from '../agents'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

export class AgentManager {
  constructor() {
    this.currentAgentId = 'controlador'
    this.conversationHistory = []
  }

  // Cambiar agente activo
  setAgent(agentId) {
    this.currentAgentId = agentId
  }

  // Obtener agente actual
  getCurrentAgent() {
    return getAgent(this.currentAgentId)
  }

  // Procesar mensaje con el agente actual
  async processMessage(userMessage, context) {
    const agent = this.getCurrentAgent()

    // Construir prompt del agente
    const systemPrompt = agent.buildPrompt(context)

    // Formatear historial
    const formattedHistory = this.formatHistory()

    // Llamar a OpenAI con las tools del agente
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...formattedHistory,
        { role: 'user', content: userMessage }
      ],
      tools: agent.tools,
      tool_choice: 'required',
      temperature: agent.config.temperature
    })

    // Procesar respuesta
    const message = response.choices[0].message

    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0]
      const functionName = toolCall.function.name
      const args = JSON.parse(toolCall.function.arguments)

      // Usar el mapper del agente para convertir a respuesta
      const mapper = agent.toolResponseMapper[functionName]
      if (mapper) {
        const result = mapper(args)
        result.agentId = this.currentAgentId
        return result
      }
    }

    // Fallback
    return {
      tipo: 'texto',
      contenido: message.content || 'No pude procesar tu solicitud.',
      agentId: this.currentAgentId
    }
  }

  // Agregar mensaje al historial
  addToHistory(message) {
    this.conversationHistory.push({
      ...message,
      agentId: this.currentAgentId,
      timestamp: new Date().toISOString()
    })
  }

  // Formatear historial para OpenAI
  formatHistory() {
    return this.conversationHistory.slice(-30).map(m => {
      let content = m.contenido

      // Agregar prefijo si es de otro agente
      if (m.agentId && m.agentId !== this.currentAgentId) {
        const agent = getAgent(m.agentId)
        content = `[${agent.config.name}] ${content}`
      }

      // Incluir datos si existen
      if (m.datos) {
        content += `\n[DATOS]: ${JSON.stringify(m.datos)}`
      }

      return {
        role: m.rol === 'user' ? 'user' : 'assistant',
        content
      }
    })
  }

  // Limpiar historial
  clearHistory() {
    this.conversationHistory = []
  }
}

// Singleton
export const agentManager = new AgentManager()
```

---

## 5. Hook para React

```javascript
// hooks/useAgent.js
import { useState, useCallback } from 'react'
import { agentManager } from '../services/agentManager'
import { getAvailableAgents, getAgent } from '../agents'

export const useAgent = () => {
  const [currentAgentId, setCurrentAgentId] = useState('controlador')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([])

  // Cambiar agente
  const switchAgent = useCallback((agentId) => {
    agentManager.setAgent(agentId)
    setCurrentAgentId(agentId)

    // Agregar separador visual
    const agent = getAgent(agentId)
    setMessages(prev => [...prev, {
      tipo: 'separador',
      contenido: `Cambiando a ${agent.config.name}`,
      agentId
    }])
  }, [])

  // Enviar mensaje
  const sendMessage = useCallback(async (text, context) => {
    setLoading(true)

    // Agregar mensaje del usuario
    const userMessage = {
      rol: 'user',
      contenido: text,
      agentId: currentAgentId,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])
    agentManager.addToHistory(userMessage)

    try {
      // Procesar con el agente actual
      const response = await agentManager.processMessage(text, context)

      // Agregar respuesta
      const assistantMessage = {
        rol: 'assistant',
        ...response,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, assistantMessage])
      agentManager.addToHistory(assistantMessage)

      return response
    } catch (error) {
      const errorMessage = {
        rol: 'assistant',
        tipo: 'error',
        contenido: `Error: ${error.message}`,
        agentId: currentAgentId
      }
      setMessages(prev => [...prev, errorMessage])
      return errorMessage
    } finally {
      setLoading(false)
    }
  }, [currentAgentId])

  // Manejar delegación
  const handleDelegation = useCallback(async (delegacion, context) => {
    const { agenteDestino, razon } = delegacion

    // Agregar mensaje de delegación
    setMessages(prev => [...prev, {
      tipo: 'delegacion',
      contenido: razon,
      desde: currentAgentId,
      hacia: agenteDestino
    }])

    // Cambiar agente
    switchAgent(agenteDestino)

    // Enviar contexto al nuevo agente
    return sendMessage(`Contexto delegado: ${razon}`, context)
  }, [currentAgentId, switchAgent, sendMessage])

  return {
    currentAgentId,
    currentAgent: getAgent(currentAgentId),
    availableAgents: getAvailableAgents(),
    messages,
    loading,
    switchAgent,
    sendMessage,
    handleDelegation,
    clearMessages: () => {
      setMessages([])
      agentManager.clearHistory()
    }
  }
}
```

---

## 6. Chat.jsx Simplificado

```javascript
// pages/Chat.jsx (simplificado)
import { useAgent } from '../hooks/useAgent'

const Chat = () => {
  const {
    currentAgent,
    availableAgents,
    messages,
    loading,
    switchAgent,
    sendMessage,
    handleDelegation
  } = useAgent()

  const context = {
    nombreMarca: usuario.nombre_marca,
    nombreUsuario: usuario.nombre,
    datosMarca,
    // ...
  }

  const handleSubmit = async (text) => {
    const response = await sendMessage(text, context)

    // Manejar acciones específicas
    if (response.tipo === 'accion_confirmada' && response.ejecutar) {
      await ejecutarAccion(response.ejecutar)
    }

    if (response.tipo === 'consultar_comentarios') {
      await consultarComentarios(response.filtros)
    }
  }

  return (
    <div>
      {/* Selector de agente */}
      <AgentSelector
        agents={availableAgents}
        currentId={currentAgent.config.id}
        onSelect={switchAgent}
      />

      {/* Chat */}
      <ChatMessages
        messages={messages}
        onDelegation={(d) => handleDelegation(d, context)}
      />

      {/* Input */}
      <ChatInput onSubmit={handleSubmit} disabled={loading} />
    </div>
  )
}
```

---

## 7. Agregar un Nuevo Agente (Ejemplo: "Analista")

### Paso 1: Crear carpeta y archivos

```
src/agents/analista/
├── index.js
├── config.js
├── prompt.js
└── tools.js
```

### Paso 2: Definir configuración

```javascript
// agents/analista/config.js
export const config = {
  id: 'analista',
  name: 'Analista',
  description: 'Analiza datos y genera informes',
  icon: '◇',
  color: '#10b981',  // Verde
  temperature: 0.5,
  canDelegateTo: ['controlador', 'chatia'],
  capabilities: [
    'Analizar tendencias',
    'Generar informes',
    'Detectar patrones'
  ]
}
```

### Paso 3: Definir tools específicas

```javascript
// agents/analista/tools.js
export const tools = [
  {
    type: "function",
    function: {
      name: "generar_informe",
      description: "Generar informe de análisis",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          resumen: { type: "string" },
          hallazgos: { type: "array", items: { type: "string" } },
          recomendaciones: { type: "array", items: { type: "string" } }
        },
        required: ["titulo", "resumen", "hallazgos", "recomendaciones"],
        additionalProperties: false
      }
    }
  },
  // ... más tools específicas del analista
]
```

### Paso 4: Registrar en index

```javascript
// agents/index.js
import controlador from './controlador'
import chatia from './chatia'
import analista from './analista'  // NUEVO

export const agents = {
  controlador,
  chatia,
  analista  // NUEVO
}
```

**¡Listo!** El nuevo agente está disponible automáticamente.

---

## 8. Beneficios de Esta Arquitectura

| Aspecto | Antes | Después |
|---------|-------|---------|
| Agregar agente | Modificar openai.js (700+ líneas) | Crear carpeta con 4 archivos |
| Modificar tools | Editar prompt gigante | Editar tools.js del agente |
| Cambiar prompt | Buscar en archivo de 700 líneas | Editar prompt.js específico |
| Testear agente | Difícil, todo acoplado | Importar y testear aislado |
| Reutilizar | Imposible | Importar agente en otro proyecto |

---

## 9. Archivos a Crear/Modificar

### Crear:
- `src/agents/index.js`
- `src/agents/controlador/index.js`
- `src/agents/controlador/config.js`
- `src/agents/controlador/prompt.js`
- `src/agents/controlador/tools.js`
- `src/agents/chatia/index.js`
- `src/agents/chatia/config.js`
- `src/agents/chatia/prompt.js`
- `src/agents/chatia/tools.js`
- `src/services/agentManager.js`
- `src/hooks/useAgent.js`

### Modificar:
- `src/services/openai.js` - Simplificar a llamadas básicas
- `src/pages/Chat.jsx` - Usar useAgent hook

### Sin cambios:
- `src/services/supabase.js`
- `src/components/MensajeChat.jsx`
- `src/components/EditorManual.jsx`

---

## 10. Orden de Implementación

1. **Fase 1**: Crear estructura de carpetas y archivos base
2. **Fase 2**: Migrar Controlador a estructura modular
3. **Fase 3**: Migrar ChatIA a estructura modular
4. **Fase 4**: Crear AgentManager
5. **Fase 5**: Crear useAgent hook
6. **Fase 6**: Refactorizar Chat.jsx para usar hook
7. **Fase 7**: Testing y ajustes
8. **Fase 8**: Documentar cómo agregar nuevos agentes
