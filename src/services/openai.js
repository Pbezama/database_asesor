/**
 * ══════════════════════════════════════════════════════════════════════════════
 * OpenAI Service - Versión con Function Calling
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Este archivo provee la API pública para el sistema de IA.
 * Usa Function Calling (tools) de OpenAI en modo strict para garantizar JSON válido.
 *
 * Feature Flag:
 * - USE_FUNCTION_CALLING = true  → Usa AgentManager con Function Calling
 * - USE_FUNCTION_CALLING = false → Usa funciones legacy con parsing JSON manual
 *
 * Funciones exportadas (API pública - NO CAMBIAR):
 * - procesarMensajeIA(mensajeUsuario, contexto) → Para modo Controlador
 * - chatDirectoIA(mensajeUsuario, historial, contextoMarca) → Para modo ChatIA
 * - transcribirAudio(audioBlob) → Whisper API
 */

import { agentManager } from './agentManager'
import {
  procesarMensajeIALegacy,
  chatDirectoIALegacy,
  transcribirAudio as transcribirAudioLegacy
} from './openai.legacy'

// ═══════════════════════════════════════════════════════════════
// FEATURE FLAG - Cambiar a false para rollback
// ═══════════════════════════════════════════════════════════════

const USE_FUNCTION_CALLING = true

// ═══════════════════════════════════════════════════════════════
// UTILIDADES DE FECHA (exportada para uso externo)
// ═══════════════════════════════════════════════════════════════

export const obtenerFechaActual = () => {
  const now = new Date()
  return {
    fecha: now.toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    hora: now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    iso: now.toISOString(),
    año: now.getFullYear(),
    mes: now.getMonth() + 1,
    dia: now.getDate(),
    ultimoDiaMes: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  }
}

// ═══════════════════════════════════════════════════════════════
// PROCESADOR PRINCIPAL - CONTROLADOR
// ═══════════════════════════════════════════════════════════════

/**
 * Procesa un mensaje en modo Controlador
 *
 * @param {string} mensajeUsuario - Mensaje del usuario
 * @param {Object} contexto - Contexto de la sesión
 * @param {string} contexto.nombreUsuario - Nombre del usuario
 * @param {string} contexto.nombreMarca - Nombre de la marca
 * @param {number} contexto.idMarca - ID de la marca
 * @param {boolean} contexto.esSuperAdmin - Si es super admin
 * @param {Array} contexto.datosMarca - Datos de la marca
 * @param {Array} contexto.historial - Historial de mensajes
 * @param {Object} contexto.accionPendienteActual - Acción pendiente de confirmación
 * @returns {Promise<Object>} Respuesta normalizada { tipo, contenido, datos?, ejecutar?, etc. }
 */
const procesarMensajeIANuevo = async (mensajeUsuario, contexto) => {
  const { historial, ...resto } = contexto

  // Configurar agente
  agentManager.setAgent('controlador')

  // Construir contexto para el agente
  const context = {
    ...resto,
    fechaInfo: obtenerFechaActual()
  }

  try {
    console.log('🤖 OpenAI: Procesando mensaje con Function Calling (Controlador)')
    return await agentManager.processMessage(mensajeUsuario, context, historial || [])
  } catch (err) {
    console.error('❌ OpenAI: Error en procesarMensajeIA:', err)
    return {
      tipo: 'error',
      contenido: `Ups, tuve un problema procesando tu solicitud: ${err.message}`,
      modoOrigen: 'controlador'
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// CHAT DIRECTO - CHATIA
// ═══════════════════════════════════════════════════════════════

/**
 * Procesa un mensaje en modo ChatIA
 *
 * @param {string} mensajeUsuario - Mensaje del usuario
 * @param {Array} historial - Historial de mensajes
 * @param {Object} contextoMarca - Contexto opcional de la marca
 * @returns {Promise<Object>} Respuesta normalizada { tipo, contenido, delegacion? }
 */
const chatDirectoIANuevo = async (mensajeUsuario, historial = [], contextoMarca = null) => {
  // Configurar agente
  agentManager.setAgent('chatia')

  // Construir contexto mínimo para ChatIA
  const context = {
    nombreMarca: contextoMarca?.nombreMarca || '',
    nombreUsuario: contextoMarca?.nombreUsuario || '',
    datosMarca: contextoMarca?.datosMarca || [],
    fechaInfo: obtenerFechaActual()
  }

  try {
    console.log('🤖 OpenAI: Procesando mensaje con Function Calling (ChatIA)')
    return await agentManager.processMessage(mensajeUsuario, context, historial)
  } catch (err) {
    console.error('❌ OpenAI: Error en chatDirectoIA:', err)
    return {
      tipo: 'error',
      contenido: `Ups, tuve un problema: ${err.message}`,
      modoOrigen: 'chatia'
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// API PÚBLICA - Exportaciones con Feature Flag
// ═══════════════════════════════════════════════════════════════

/**
 * Procesa mensaje en modo Controlador
 * Usa Function Calling o Legacy según feature flag
 */
export const procesarMensajeIA = USE_FUNCTION_CALLING
  ? procesarMensajeIANuevo
  : procesarMensajeIALegacy

/**
 * Procesa mensaje en modo ChatIA
 * Usa Function Calling o Legacy según feature flag
 */
export const chatDirectoIA = USE_FUNCTION_CALLING
  ? chatDirectoIANuevo
  : chatDirectoIALegacy

/**
 * Transcribe audio usando Whisper API
 * Sin cambios - no necesita Function Calling
 */
export const transcribirAudio = transcribirAudioLegacy

// ═══════════════════════════════════════════════════════════════
// EXPORTACIONES ADICIONALES
// ═══════════════════════════════════════════════════════════════

// Exportar funciones legacy directamente por si se necesitan
export {
  procesarMensajeIALegacy,
  chatDirectoIALegacy
}

// Exportar el feature flag para debugging
export const isUsingFunctionCalling = () => USE_FUNCTION_CALLING
