/**
 * Configuración del Agente ChatIA
 *
 * Responsable de:
 * - Conversación libre y creativa
 * - Idear promociones, reglas, contenido
 * - Brainstorming y lluvia de ideas
 * - Explicaciones y ayuda general
 */

export const config = {
  id: 'chatia',
  name: 'ChatIA',
  description: 'Asistente creativo para ideación y conversación libre',
  icon: '◆',
  color: '#f59e0b',  // Amarillo/Dorado
  temperature: 0.8,  // Más creativo
  canDelegateTo: ['controlador'],
  enabled: true,
  capabilities: [
    'Idear promociones y ofertas',
    'Crear reglas y políticas',
    'Brainstorming creativo',
    'Redacción de textos',
    'Explicaciones y ayuda',
    'Análisis de comentarios'
  ]
}
