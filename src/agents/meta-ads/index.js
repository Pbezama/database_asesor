/**
 * Agente Meta Ads
 *
 * Especialista en gestion de campanas publicitarias Meta:
 * - Dashboard de campanas
 * - Metricas y reportes
 * - Creacion y optimizacion de anuncios
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
