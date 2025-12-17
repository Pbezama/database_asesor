/**
 * BaseAgent - Clase base para agentes
 *
 * Provee estructura común y validaciones para todos los agentes.
 * Los agentes pueden extender esta clase o usarla como referencia.
 */

/**
 * Valida que un agente tenga la estructura correcta
 * @param {Object} agent - Agente a validar
 * @returns {boolean}
 */
export const validateAgent = (agent) => {
  const requiredFields = ['config', 'buildPrompt', 'tools', 'toolResponseMapper']
  const missingFields = requiredFields.filter(field => !agent[field])

  if (missingFields.length > 0) {
    console.error(`Agente inválido. Campos faltantes: ${missingFields.join(', ')}`)
    return false
  }

  // Validar config
  const requiredConfig = ['id', 'name', 'icon', 'temperature']
  const missingConfig = requiredConfig.filter(field => agent.config[field] === undefined)

  if (missingConfig.length > 0) {
    console.error(`Config del agente inválida. Campos faltantes: ${missingConfig.join(', ')}`)
    return false
  }

  return true
}

/**
 * Estructura base de un agente (para referencia)
 */
export const AgentStructure = {
  config: {
    id: 'string',           // ID único del agente
    name: 'string',         // Nombre para mostrar
    description: 'string',  // Descripción breve
    icon: 'string',         // Icono (ej: '◈')
    color: 'string',        // Color hex (ej: '#3b82f6')
    temperature: 0.7,       // Temperatura del modelo
    canDelegateTo: [],      // IDs de agentes a los que puede delegar
    capabilities: [],       // Lista de capacidades
    enabled: true           // Si el agente está habilitado
  },

  buildPrompt: (context) => {
    // Retorna string con el system prompt
    return ''
  },

  tools: [
    // Array de tools para OpenAI Function Calling
  ],

  toolResponseMapper: {
    // Mapeo de nombre de tool a función que transforma args a respuesta
    // nombre_tool: (args) => ({ tipo: '...', contenido: args.mensaje })
  }
}

export default {
  validateAgent,
  AgentStructure
}
