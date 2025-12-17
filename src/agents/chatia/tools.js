/**
 * Tools del Agente ChatIA
 *
 * ChatIA tiene solo 2 tools:
 * - responder_texto: Para conversación y creatividad
 * - sugerir_delegacion: Para derivar al Controlador cuando hay que guardar
 */

/**
 * Tools disponibles para ChatIA
 */
export const tools = [
  // 1. RESPONDER TEXTO - Conversación creativa
  {
    type: 'function',
    function: {
      name: 'responder_texto',
      description: 'Responder con texto al usuario. Usar para ideas, sugerencias, explicaciones, brainstorming, análisis, redacción y cualquier conversación.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          mensaje: {
            type: 'string',
            description: 'Respuesta amigable y útil. Puede incluir **negrita**, listas con - , y saltos de línea \\n para formato.'
          }
        },
        required: ['mensaje'],
        additionalProperties: false
      }
    }
  },

  // 2. SUGERIR DELEGACIÓN al Controlador
  {
    type: 'function',
    function: {
      name: 'sugerir_delegacion',
      description: 'Sugerir que el Controlador maneje operaciones de BD: agregar, modificar, eliminar datos. Usar cuando el usuario quiere guardar una idea o acceder a datos.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          mensaje: {
            type: 'string',
            description: 'Mensaje explicando QUÉ se va a delegar. NUNCA decir "ya quedó guardado" - la acción aún no se ejecuta. Ejemplo: "El usuario quiere agregar esta información a la base. Delego al Controlador para que lo procese."'
          },
          agente_destino: {
            type: 'string',
            enum: ['controlador'],
            description: 'Agente destino (siempre controlador para ChatIA)'
          },
          razon: {
            type: 'string',
            description: 'Razón de la delegación: qué quiere hacer el usuario'
          },
          datos_sugeridos: {
            type: ['object', 'null'],
            description: 'Sugerencia de datos para agregar/modificar',
            properties: {
              categoria: {
                type: ['string', 'null'],
                description: 'Categoría sugerida: promocion, regla, info, etc.'
              },
              clave: {
                type: ['string', 'null'],
                description: 'Nombre/título sugerido para el dato'
              },
              valor: {
                type: ['string', 'null'],
                description: 'Contenido/descripción del dato'
              },
              prioridad: {
                type: ['number', 'null'],
                description: 'Prioridad sugerida 1-6'
              }
            },
            required: ['categoria', 'clave', 'valor', 'prioridad'],
            additionalProperties: false
          }
        },
        required: ['mensaje', 'agente_destino', 'razon', 'datos_sugeridos'],
        additionalProperties: false
      }
    }
  }
]

/**
 * Mapeo de tool_calls a estructura de respuesta del frontend
 */
export const toolResponseMapper = {
  /**
   * Respuesta de texto
   * @param {Object} args - { mensaje: string }
   * @returns {{ tipo: 'texto', contenido: string }}
   */
  responder_texto: (args) => ({
    tipo: 'texto',
    contenido: args.mensaje
  }),

  /**
   * Sugerir delegación al Controlador
   * @param {Object} args - { mensaje: string, agente_destino: string, razon: string, datos_sugeridos: object }
   * @returns {{ tipo: 'texto', contenido: string, delegacion: object }}
   */
  sugerir_delegacion: (args) => ({
    tipo: 'texto',
    contenido: args.mensaje,
    delegacion: {
      sugerida: true,
      agenteDestino: args.agente_destino,
      razon: args.razon,
      datosParaDelegar: args.datos_sugeridos
    }
  })
}

export default { tools, toolResponseMapper }
