/**
 * Agente ChatIA
 *
 * Asistente creativo responsable de:
 * - Conversación libre y amigable
 * - Idear promociones, reglas, contenido
 * - Brainstorming y lluvia de ideas
 * - Explicaciones y ayuda general
 */

import { config } from './config'
import { buildPrompt } from './prompt'
import { tools, toolResponseMapper } from './tools'

export default {
  config,
  buildPrompt,
  tools,
  toolResponseMapper
}
