/**
 * AgentManager - Orquestador de Agentes
 *
 * Responsable de:
 * - Mantener el agente activo
 * - Construir prompts del agente
 * - Llamar a OpenAI con tools del agente
 * - Traducir tool_calls a respuesta estándar del frontend
 *
 * NO contiene lógica de negocio - solo orquestación.
 */

import OpenAI from 'openai'
import { getAgent } from '../agents'

// Cliente OpenAI
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

/**
 * Clase AgentManager
 *
 * Gestiona la comunicación entre agentes y OpenAI usando Function Calling.
 */
export class AgentManager {
  constructor() {
    this.currentAgentId = 'controlador'
  }

  /**
   * Cambia el agente activo
   * @param {string} agentId - ID del nuevo agente
   */
  setAgent(agentId) {
    const agent = getAgent(agentId)  // Valida que exista
    const anterior = this.currentAgentId
    this.currentAgentId = agentId
    if (anterior !== agentId) {
      console.log(`\n🔄 AgentManager: Cambio de agente "${anterior}" → "${agent.config.name}"`)
    }
  }

  /**
   * Obtiene el agente activo
   * @returns {Object} Agente actual
   */
  getCurrentAgent() {
    return getAgent(this.currentAgentId)
  }

  /**
   * Procesa un mensaje del usuario usando Function Calling
   *
   * @param {string} userMessage - Mensaje del usuario
   * @param {Object} context - Contexto (nombreMarca, datosMarca, etc.)
   * @param {Array} historial - Historial de mensajes previos
   * @returns {Promise<Object>} Respuesta normalizada para el frontend
   */
  async processMessage(userMessage, context, historial = []) {
    const agent = this.getCurrentAgent()
    const tiempoInicio = performance.now()

    console.log('\n╔══════════════════════════════════════════════════════════════')
    console.log('║ 🤖 AGENTMANAGER: PROCESANDO MENSAJE')
    console.log('╠══════════════════════════════════════════════════════════════')
    console.log(`║ 🎭 Agente activo: ${agent.config.name}`)
    console.log(`║ 🌡️  Temperatura: ${agent.config.temperature}`)
    console.log(`║ 🔧 Tools disponibles: ${agent.tools.map(t => t.function.name).join(', ')}`)
    console.log(`║ 💬 Mensaje: "${userMessage.substring(0, 60)}${userMessage.length > 60 ? '...' : ''}"`)
    console.log('╚══════════════════════════════════════════════════════════════\n')

    // Construir prompt del agente con contexto
    const systemPrompt = agent.buildPrompt(context)
    console.log(`   📝 AgentManager: System prompt construido (${systemPrompt.length} chars)`)

    // Formatear historial para OpenAI
    const formattedHistory = this.formatHistory(historial)
    console.log(`   📜 AgentManager: Historial formateado (${formattedHistory.length} mensajes)`)

    // Construir mensajes para OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...formattedHistory,
      { role: 'user', content: userMessage }
    ]

    console.log(`   📤 AgentManager: Enviando ${messages.length} mensajes a OpenAI (modelo: gpt-5.1)...`)

    try {
      // Llamar a OpenAI con Function Calling
      const response = await openai.chat.completions.create({
        model: 'gpt-5.1',
        messages,
        tools: agent.tools,
        tool_choice: 'required',  // DEBE usar una tool
        temperature: agent.config.temperature
      })

      const tiempoOpenAI = performance.now()
      const message = response.choices[0].message

      console.log(`   📥 AgentManager: Respuesta recibida de OpenAI (${(tiempoOpenAI - tiempoInicio).toFixed(0)}ms)`)

      // Procesar tool_calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0]
        const functionName = toolCall.function.name
        const args = JSON.parse(toolCall.function.arguments)

        console.log('\n╔══════════════════════════════════════════════════════════════')
        console.log('║ 🔧 TOOL CALL RECIBIDA')
        console.log('╠══════════════════════════════════════════════════════════════')
        console.log(`║ 📌 Función: ${functionName}`)
        console.log(`║ 📋 Parámetros clave:`)
        if (args.mensaje) console.log(`║    └─ mensaje: "${args.mensaje.substring(0, 50)}${args.mensaje.length > 50 ? '...' : ''}"`)
        if (args.accion) console.log(`║    └─ accion: ${args.accion}`)
        if (args.agente_destino) console.log(`║    └─ agente_destino: ${args.agente_destino}`)
        if (args.columnas) console.log(`║    └─ columnas: [${args.columnas.length} cols]`)
        if (args.filas) console.log(`║    └─ filas: [${args.filas.length} filas]`)
        console.log('╚══════════════════════════════════════════════════════════════\n')

        // Usar el mapper del agente para convertir a respuesta frontend
        const mapper = agent.toolResponseMapper[functionName]
        if (mapper) {
          const result = mapper(args)
          result.modoOrigen = this.currentAgentId === 'chatia' ? 'chatia' : 'controlador'

          const tiempoTotal = performance.now()
          console.log(`   ✅ AgentManager: Respuesta mapeada → tipo="${result.tipo}"`)
          console.log(`   ⏱️  AgentManager: Tiempo total de procesamiento: ${(tiempoTotal - tiempoInicio).toFixed(0)}ms\n`)

          return result
        } else {
          console.warn(`⚠️ AgentManager: No hay mapper para tool "${functionName}"`)
          return {
            tipo: 'error',
            contenido: `Error interno: tool "${functionName}" no tiene mapper definido.`,
            modoOrigen: this.currentAgentId
          }
        }
      }

      // Fallback si no hay tool_calls (no debería pasar con tool_choice: required)
      console.warn('⚠️ AgentManager: No se recibió tool_call, usando content como fallback')
      return {
        tipo: 'texto',
        contenido: message.content || 'No pude procesar tu solicitud.',
        modoOrigen: this.currentAgentId === 'chatia' ? 'chatia' : 'controlador'
      }

    } catch (error) {
      console.error('\n❌ AgentManager: Error en llamada a OpenAI')
      console.error(`   └─ Código: ${error.code || 'desconocido'}`)
      console.error(`   └─ Mensaje: ${error.message}\n`)

      // Manejar errores específicos
      if (error.code === 'invalid_api_key') {
        return {
          tipo: 'error',
          contenido: 'Error de configuración: API Key de OpenAI inválida.',
          modoOrigen: this.currentAgentId
        }
      }

      if (error.code === 'rate_limit_exceeded') {
        return {
          tipo: 'error',
          contenido: 'Demasiadas solicitudes. Por favor espera un momento e intenta de nuevo.',
          modoOrigen: this.currentAgentId
        }
      }

      return {
        tipo: 'error',
        contenido: `Error al procesar mensaje: ${error.message}`,
        modoOrigen: this.currentAgentId
      }
    }
  }

  /**
   * Formatea el historial de mensajes para OpenAI
   *
   * Incluye:
   * - Mensajes de usuario y asistente
   * - Comentarios completos consultados
   * - Datos de tablas mostradas
   * - Prefijos de agente origen si es diferente al actual
   *
   * @param {Array} historial - Array de mensajes del chat
   * @returns {Array} Mensajes formateados para OpenAI
   */
  formatHistory(historial) {
    if (!historial || historial.length === 0) return []

    return historial
      .slice(-30)  // Últimos 30 mensajes para no exceder tokens
      .map(m => {
        // Ignorar separadores y delegaciones en el historial
        if (m.tipo === 'separador' || m.tipo === 'delegacion') {
          return null
        }

        let contenido = typeof m.contenido === 'string'
          ? m.contenido
          : JSON.stringify(m.contenido)

        // Incluir comentarios completos si existen (crítico para contexto compartido)
        if (m.comentariosCompletos && Array.isArray(m.comentariosCompletos) && m.comentariosCompletos.length > 0) {
          const comentariosTexto = m.comentariosCompletos.map((c, i) => {
            return `${i + 1}. ID:${c.id} | Comentario: "${c.comentario_original || 'N/A'}" | Respuesta: "${c.respuesta_comentario || 'Sin respuesta'}" | Fecha: ${c.creado_en ? new Date(c.creado_en).toLocaleDateString('es-CL') : 'N/A'}`
          }).join('\n')
          contenido += `\n\n[COMENTARIOS CONSULTADOS (${m.comentariosCompletos.length} total)]:\n${comentariosTexto}`
        }

        // Incluir datos de tabla si existen
        if (m.datos) {
          if (m.datos.columnas && m.datos.filas) {
            // Formato {columnas, filas}
            const tablaTexto = m.datos.filas.slice(0, 10).map(fila => {
              return m.datos.columnas.map((col, i) => `${col}: ${fila[i]}`).join(' | ')
            }).join('\n')
            const truncado = m.datos.filas.length > 10 ? `\n... y ${m.datos.filas.length - 10} más` : ''
            contenido += `\n\n[TABLA MOSTRADA]:\n${tablaTexto}${truncado}`
          } else if (Array.isArray(m.datos)) {
            // Array de objetos
            const datosTexto = m.datos.slice(0, 5).map(d => JSON.stringify(d)).join('\n')
            contenido += `\n\n[DATOS]: ${datosTexto}`
          }
        }

        // Incluir preview de tabla si existe
        if (m.tabla_preview && Array.isArray(m.tabla_preview)) {
          const previewTexto = m.tabla_preview.slice(0, 5).map(d => JSON.stringify(d)).join('\n')
          contenido += `\n\n[PREVIEW]: ${previewTexto}`
        }

        // Agregar prefijo si el mensaje viene de otro agente
        if (m.modoOrigen && m.modoOrigen !== this.currentAgentId) {
          const prefijo = m.modoOrigen === 'chatia' ? '[ChatIA]' : '[Controlador]'
          contenido = `${prefijo} ${contenido}`
        }

        return {
          role: m.rol === 'user' ? 'user' : 'assistant',
          content: contenido
        }
      })
      .filter(Boolean)  // Eliminar nulls
  }

  /**
   * Limpia el estado del manager
   */
  reset() {
    this.currentAgentId = 'controlador'
    console.log('🔄 AgentManager: Reset a estado inicial')
  }
}

// Singleton exportado
export const agentManager = new AgentManager()

export default AgentManager
