/**
 * Configuracion del Agente Meta Ads
 *
 * Responsable de:
 * - Mostrar dashboard de campanas
 * - Gestionar campanas de Meta Ads (futuro)
 * - Mostrar metricas y reportes
 */

export const config = {
  id: 'meta-ads',
  name: 'Meta Ads',
  description: 'Gestiona campanas publicitarias en Meta (Facebook/Instagram)',
  icon: '◇',
  color: '#1877F2',  // Azul Meta
  temperature: 0.6,
  enabled: true,
  canDelegateTo: ['controlador', 'chatia'],

  // Configuracion de vista especializada
  view: {
    enabled: true,
    component: 'MetaAdsView',
    route: '/meta-ads'
  },

  capabilities: [
    'Ver dashboard de campanas',
    'Mostrar metricas de rendimiento',
    'Consultar estado de anuncios',
    'Crear nuevas campanas (futuro)',
    'Pausar/activar campanas (futuro)'
  ]
}
