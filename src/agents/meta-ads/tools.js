/**
 * Tools del Agente Meta Ads
 *
 * Incluye la tool especial "abrir_dashboard" que navega a la vista
 */

export const tools = [
  // 1. RESPONDER TEXTO
  {
    type: 'function',
    function: {
      name: 'responder_texto',
      description: 'Responder con texto conversacional. Usar para explicaciones sobre metricas, estrategia, recomendaciones.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          mensaje: {
            type: 'string',
            description: 'Mensaje para el usuario. Puede incluir **negrita** y saltos de linea.'
          }
        },
        required: ['mensaje'],
        additionalProperties: false
      }
    }
  },

  // 2. ABRIR DASHBOARD - Navega a la vista de Meta Ads
  {
    type: 'function',
    function: {
      name: 'abrir_dashboard',
      description: 'Abrir el dashboard de campanas Meta Ads. Usar cuando el usuario quiere VER campanas, metricas, o gestionar anuncios.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          mensaje: {
            type: 'string',
            description: 'Mensaje antes de abrir el dashboard'
          },
          contexto: {
            type: ['string', 'null'],
            description: 'Contexto adicional para la vista (ej: filtro de campana especifica)'
          }
        },
        required: ['mensaje', 'contexto'],
        additionalProperties: false
      }
    }
  },

  // 3. MOSTRAR CAMPANAS EN CHAT - Resumen rapido sin salir del chat
  {
    type: 'function',
    function: {
      name: 'mostrar_resumen_campanas',
      description: 'Mostrar un resumen rapido de campanas en el chat (sin abrir dashboard). Usar para consultas rapidas.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          mensaje: {
            type: 'string',
            description: 'Mensaje introductorio'
          },
          columnas: {
            type: 'array',
            items: { type: 'string' },
            description: 'Columnas de la tabla: Nombre, Estado, Presupuesto, CTR, etc.'
          },
          filas: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'string' }
            },
            description: 'Datos de campanas'
          }
        },
        required: ['mensaje', 'columnas', 'filas'],
        additionalProperties: false
      }
    }
  },

  // 4. SUGERIR DELEGACION
  {
    type: 'function',
    function: {
      name: 'sugerir_delegacion',
      description: 'Sugerir derivar a otro agente. ChatIA para creativos, Controlador para datos de marca.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          mensaje: {
            type: 'string',
            description: 'Mensaje explicando la delegacion'
          },
          agente_destino: {
            type: 'string',
            enum: ['chatia', 'controlador'],
            description: 'Agente destino'
          },
          razon: {
            type: 'string',
            description: 'Razon de la delegacion'
          },
          datos_contexto: {
            type: ['object', 'null'],
            description: 'Datos para el otro agente',
            properties: {
              tema: { type: ['string', 'null'] },
              datos_relevantes: { type: ['string', 'null'] },
              solicitud_original: { type: ['string', 'null'] }
            },
            required: ['tema', 'datos_relevantes', 'solicitud_original'],
            additionalProperties: false
          }
        },
        required: ['mensaje', 'agente_destino', 'razon', 'datos_contexto'],
        additionalProperties: false
      }
    }
  }
]

/**
 * Mapeo de tools a respuesta del frontend
 */
export const toolResponseMapper = {
  responder_texto: (args) => ({
    tipo: 'texto',
    contenido: args.mensaje
  }),

  // NUEVA: Navegacion a vista
  abrir_dashboard: (args) => ({
    tipo: 'navegacion',
    contenido: args.mensaje,
    destino: 'meta-ads',
    contexto: args.contexto
  }),

  mostrar_resumen_campanas: (args) => ({
    tipo: 'tabla',
    contenido: args.mensaje,
    datos: {
      columnas: args.columnas,
      filas: args.filas
    }
  }),

  sugerir_delegacion: (args) => ({
    tipo: 'texto',
    contenido: args.mensaje,
    delegacion: {
      sugerida: true,
      agenteDestino: args.agente_destino,
      razon: args.razon,
      datosParaDelegar: args.datos_contexto
    }
  })
}

export default { tools, toolResponseMapper }
