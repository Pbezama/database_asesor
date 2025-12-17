/**
 * Agente Controlador
 *
 * Responsable de gestionar datos de marca:
 * - Agregar / modificar / desactivar datos
 * - Consultar información estructurada
 * - Pedir confirmación antes de cambios
 * - Consultar comentarios
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
