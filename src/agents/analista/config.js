/**
 * Configuración del Agente Analista (Placeholder)
 *
 * Este agente está DESHABILITADO hasta que se implemente completamente.
 * Preparado para futuras funcionalidades de análisis.
 *
 * Responsabilidades futuras:
 * - Analizar tendencias en comentarios
 * - Generar informes de rendimiento
 * - Detectar patrones en datos
 * - Sugerir optimizaciones
 */

export const config = {
  id: 'analista',
  name: 'Analista',
  description: 'Analiza datos y genera informes (próximamente)',
  icon: '◇',
  color: '#10b981',  // Verde
  temperature: 0.5,  // Más preciso
  canDelegateTo: ['controlador', 'chatia'],
  enabled: false,  // DESHABILITADO - placeholder
  capabilities: [
    'Analizar tendencias',
    'Generar informes',
    'Detectar patrones',
    'Sugerir optimizaciones'
  ]
}
