/**
 * Agente Analista (Placeholder)
 *
 * Este agente está DESHABILITADO (enabled: false).
 * Las tools se implementarán cuando se active.
 *
 * Por ahora solo exporta la configuración base.
 */

import { config } from './config'

// Prompt placeholder
const buildPrompt = (context) => {
  return `Eres un analista de datos especializado en marcas y redes sociales.
Este agente está en desarrollo. Por favor usa Controlador o ChatIA.`
}

// Tools placeholder - vacío hasta implementación
const tools = []

// Mapper placeholder
const toolResponseMapper = {}

export default {
  config,
  buildPrompt,
  tools,
  toolResponseMapper
}
