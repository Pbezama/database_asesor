/**
 * Registro Central de Agentes
 *
 * Este archivo exporta todos los agentes disponibles y provee
 * helpers para obtener agentes por ID.
 */

import controlador from './controlador'
import chatia from './chatia'
import analista from './analista'
import metaAds from './meta-ads'

// Registro de todos los agentes disponibles
export const agents = {
  controlador,
  chatia,
  analista,
  'meta-ads': metaAds
}

/**
 * Obtiene un agente por su ID
 * @param {string} agentId - ID del agente ('controlador', 'chatia', 'analista')
 * @returns {Object} Agente con config, buildPrompt, tools, toolResponseMapper
 * @throws {Error} Si el agente no existe
 */
export const getAgent = (agentId) => {
  const agent = agents[agentId]
  if (!agent) {
    throw new Error(`Agente "${agentId}" no encontrado. Agentes disponibles: ${Object.keys(agents).join(', ')}`)
  }
  return agent
}

/**
 * Obtiene la lista de agentes disponibles para UI
 * @param {boolean} includeDisabled - Si incluir agentes deshabilitados (default: false)
 * @returns {Array} Lista de configs de agentes
 */
export const getAvailableAgents = (includeDisabled = false) => {
  return Object.values(agents)
    .filter(a => includeDisabled || a.config.enabled !== false)
    .map(a => ({
      id: a.config.id,
      name: a.config.name,
      description: a.config.description,
      icon: a.config.icon,
      color: a.config.color,
      capabilities: a.config.capabilities || []
    }))
}

/**
 * Obtiene las tools de un agente específico
 * @param {string} agentId - ID del agente
 * @returns {Array} Array de tools del agente
 */
export const getAgentTools = (agentId) => {
  const agent = getAgent(agentId)
  return agent.tools || []
}

/**
 * Verifica si un agente puede delegar a otro
 * @param {string} fromAgentId - ID del agente que quiere delegar
 * @param {string} toAgentId - ID del agente destino
 * @returns {boolean}
 */
export const canDelegate = (fromAgentId, toAgentId) => {
  const agent = getAgent(fromAgentId)
  return agent.config.canDelegateTo?.includes(toAgentId) || false
}
