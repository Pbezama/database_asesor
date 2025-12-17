/**
 * useAgent Hook
 *
 * Hook de React para gestionar agentes de IA.
 * Encapsula la lógica de:
 * - Cambio de agentes
 * - Envío de mensajes
 * - Manejo de delegaciones
 * - Estado de carga
 */

import { useState, useCallback, useMemo } from 'react'
import { agentManager } from '../services/agentManager'
import { getAvailableAgents, getAgent, canDelegate } from '../agents'

/**
 * Hook para gestionar interacciones con agentes de IA
 *
 * @param {string} initialAgentId - ID del agente inicial (default: 'controlador')
 * @returns {Object} API del hook
 */
export const useAgent = (initialAgentId = 'controlador') => {
  // Estado del agente actual
  const [currentAgentId, setCurrentAgentId] = useState(initialAgentId)

  // Estado de carga
  const [loading, setLoading] = useState(false)

  // Último error
  const [error, setError] = useState(null)

  /**
   * Cambia el agente activo
   * @param {string} agentId - ID del nuevo agente
   * @returns {Object|null} Mensaje separador para agregar al chat, o null si no cambió
   */
  const switchAgent = useCallback((agentId) => {
    if (agentId === currentAgentId) {
      return null
    }

    try {
      agentManager.setAgent(agentId)
      setCurrentAgentId(agentId)
      setError(null)

      const agent = getAgent(agentId)

      // Retornar mensaje separador para el chat
      return {
        rol: 'system',
        tipo: 'separador',
        contenido: `Cambiaste a ${agent.config.name}`,
        timestamp: new Date().toISOString(),
        modoOrigen: agentId === 'chatia' ? 'chatia' : 'controlador'
      }
    } catch (err) {
      setError(err.message)
      console.error('Error al cambiar agente:', err)
      return null
    }
  }, [currentAgentId])

  /**
   * Envía un mensaje al agente actual
   *
   * @param {string} text - Texto del mensaje
   * @param {Object} context - Contexto (nombreMarca, datosMarca, etc.)
   * @param {Array} historial - Historial de mensajes
   * @returns {Promise<Object>} Respuesta del agente
   */
  const sendMessage = useCallback(async (text, context, historial = []) => {
    setLoading(true)
    setError(null)

    try {
      const response = await agentManager.processMessage(text, context, historial)
      return response
    } catch (err) {
      setError(err.message)
      console.error('Error al enviar mensaje:', err)
      return {
        tipo: 'error',
        contenido: `Error: ${err.message}`,
        modoOrigen: currentAgentId === 'chatia' ? 'chatia' : 'controlador'
      }
    } finally {
      setLoading(false)
    }
  }, [currentAgentId])

  /**
   * Maneja una delegación sugerida por un agente
   *
   * @param {Object} delegacion - Objeto de delegación { agenteDestino, razon, datosParaDelegar }
   * @param {Object} context - Contexto para el nuevo agente
   * @param {Array} historial - Historial de mensajes
   * @returns {Promise<Object>} Objeto con separador, delegacion y respuesta
   */
  const handleDelegation = useCallback(async (delegacion, context, historial = []) => {
    const { agenteDestino, razon, datosParaDelegar } = delegacion

    // Verificar si puede delegar
    if (!canDelegate(currentAgentId, agenteDestino)) {
      console.warn(`⚠️ useAgent: ${currentAgentId} no puede delegar a ${agenteDestino}`)
      return null
    }

    // Crear mensaje de delegación
    const msgDelegacion = {
      rol: 'system',
      tipo: 'delegacion',
      contenido: `${currentAgentId === 'chatia' ? 'ChatIA' : 'Controlador'} delegó a ${agenteDestino === 'chatia' ? 'ChatIA' : 'Controlador'}`,
      desde: currentAgentId,
      hacia: agenteDestino,
      razon,
      timestamp: new Date().toISOString()
    }

    // Cambiar agente
    const separador = switchAgent(agenteDestino)

    // Si hay datos para delegar, enviar contexto al nuevo agente
    let respuesta = null
    if (datosParaDelegar) {
      const mensajeContexto = `Contexto delegado: ${razon}. ${datosParaDelegar.contexto || JSON.stringify(datosParaDelegar)}`
      respuesta = await sendMessage(mensajeContexto, context, historial)
    }

    return {
      separador,
      delegacion: msgDelegacion,
      respuesta
    }
  }, [currentAgentId, switchAgent, sendMessage])

  /**
   * Resetea el hook a estado inicial
   */
  const reset = useCallback(() => {
    agentManager.reset()
    setCurrentAgentId('controlador')
    setLoading(false)
    setError(null)
  }, [])

  // Agente actual memoizado
  const currentAgent = useMemo(() => {
    try {
      return getAgent(currentAgentId)
    } catch {
      return null
    }
  }, [currentAgentId])

  // Lista de agentes disponibles (solo habilitados)
  const availableAgents = useMemo(() => {
    return getAvailableAgents(false)
  }, [])

  return {
    // Estado
    currentAgentId,
    currentAgent,
    availableAgents,
    loading,
    error,

    // Acciones
    switchAgent,
    sendMessage,
    handleDelegation,
    reset,

    // Helpers
    isControlador: currentAgentId === 'controlador',
    isChatIA: currentAgentId === 'chatia'
  }
}

export default useAgent
