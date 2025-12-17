/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ARCHIVO LEGACY - BACKUP DEL SISTEMA ORIGINAL
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Este archivo contiene la implementación original con parsing JSON manual.
 * Se mantiene como backup para rollback en caso de problemas con Function Calling.
 *
 * Para usar este archivo en vez del nuevo:
 * 1. En openai.js cambiar USE_FUNCTION_CALLING = false
 * 2. O renombrar este archivo a openai.js
 *
 * Funciones exportadas:
 * - procesarMensajeIALegacy (antes procesarMensajeIA)
 * - chatDirectoIALegacy (antes chatDirectoIA)
 * - transcribirAudio (sin cambios)
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

// ═══════════════════════════════════════════════════════════════
// UTILIDADES DE FECHA
// ═══════════════════════════════════════════════════════════════

const obtenerFechaActual = () => {
  const now = new Date()
  return {
    fecha: now.toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    hora: now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    iso: now.toISOString(),
    año: now.getFullYear(),
    mes: now.getMonth() + 1,
    dia: now.getDate(),
    ultimoDiaMes: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  }
}

// ═══════════════════════════════════════════════════════════════
// FORMATEAR HISTORIAL COMPARTIDO ENTRE AGENTES
// ═══════════════════════════════════════════════════════════════

const formatearHistorialCompartido = (historial, modoActual) => {
  return historial.slice(-30).map(m => {
    if (m.tipo === 'separador' || m.tipo === 'delegacion') return null

    let contenido = typeof m.contenido === 'string' ? m.contenido : JSON.stringify(m.contenido)

    if (m.comentariosCompletos && Array.isArray(m.comentariosCompletos) && m.comentariosCompletos.length > 0) {
      const comentariosFormateados = m.comentariosCompletos.map((c, i) => {
        return `${i + 1}. ID:${c.id} | Comentario: "${c.comentario_original || 'N/A'}" | Respuesta: "${c.respuesta_comentario || 'Sin respuesta'}" | Fecha: ${c.creado_en ? new Date(c.creado_en).toLocaleDateString('es-CL') : 'N/A'}`
      }).join('\n')
      contenido += `\n\n[COMENTARIOS CONSULTADOS (${m.comentariosCompletos.length} total)]:\n${comentariosFormateados}`
    }

    if (m.datos) {
      if (m.datos.columnas && m.datos.filas) {
        const { columnas, filas } = m.datos
        const tablaFormateada = filas.map(fila => {
          return columnas.map((col, i) => `${col}: ${fila[i] || 'N/A'}`).join(' | ')
        }).join('\n')
        contenido += `\n\n[TABLA MOSTRADA]:\n${tablaFormateada}`
      }
      else if (Array.isArray(m.datos) && m.datos.length > 0) {
        const datosFormateados = m.datos.map(d => {
          if (typeof d === 'object') {
            return Object.entries(d)
              .map(([key, val]) => `${key}: ${val}`)
              .join(' | ')
          }
          return String(d)
        }).join('\n')
        contenido += `\n\n[DATOS MOSTRADOS]:\n${datosFormateados}`
      }
    }

    if (m.tabla_preview && Array.isArray(m.tabla_preview) && m.tabla_preview.length > 0) {
      const tablaFormateada = m.tabla_preview.map(row => {
        if (typeof row === 'object') {
          return Object.entries(row)
            .map(([key, val]) => `${key}: ${val}`)
            .join(' | ')
        }
        return String(row)
      }).join('\n')
      contenido += `\n\n[PREVIEW]:\n${tablaFormateada}`
    }

    if (m.modoOrigen && m.modoOrigen !== modoActual) {
      const prefijo = m.modoOrigen === 'chatia' ? '[ChatIA]' : '[Controlador]'
      contenido = `${prefijo} ${contenido}`
    }

    return { role: m.rol === 'user' ? 'user' : 'assistant', content: contenido }
  }).filter(Boolean)
}

// ═══════════════════════════════════════════════════════════════
// FORMATEAR DATOS PARA EL PROMPT
// ═══════════════════════════════════════════════════════════════

const formatearDatosParaPrompt = (datosMarca) => {
  if (!datosMarca || datosMarca.length === 0) {
    return 'No hay datos registrados para esta marca.'
  }

  const porCategoria = {}
  datosMarca.forEach(d => {
    const cat = d.categoria || 'sin_categoria'
    if (!porCategoria[cat]) porCategoria[cat] = []
    porCategoria[cat].push(d)
  })

  let texto = ''

  const categoriasOrdenadas = Object.keys(porCategoria).sort((a, b) => {
    const promA = porCategoria[a].reduce((sum, d) => sum + (d.prioridad || 3), 0) / porCategoria[a].length
    const promB = porCategoria[b].reduce((sum, d) => sum + (d.prioridad || 3), 0) / porCategoria[b].length
    return promA - promB
  })

  categoriasOrdenadas.forEach(cat => {
    const nombreCategoria = {
      'prompt': '📝 PROMPT PRINCIPAL',
      'promocion': '🎉 PROMOCIONES',
      'promo': '🎉 PROMOCIONES',
      'regla': '⚠️ REGLAS',
      'horario': '🕐 HORARIOS',
      'info': 'ℹ️ INFORMACIÓN',
      'precio': '💰 PRECIOS',
      'estilo_respuesta': '💬 ESTILO DE RESPUESTA',
      'observacion': '👁️ OBSERVACIONES'
    }[cat] || `📌 ${cat.toUpperCase()}`

    texto += `\n${nombreCategoria}:\n`

    porCategoria[cat]
      .sort((a, b) => (a.prioridad || 3) - (b.prioridad || 3))
      .forEach(d => {
        const prioridadIcon = d.prioridad === 1 ? '🔴' : d.prioridad <= 3 ? '🟡' : '🟢'
        const fechas = d.fecha_inicio || d.fecha_caducidad
          ? ` [${d.fecha_inicio ? 'Desde: ' + new Date(d.fecha_inicio).toLocaleDateString('es-CL') : ''} ${d.fecha_caducidad ? 'Hasta: ' + new Date(d.fecha_caducidad).toLocaleDateString('es-CL') : ''}]`
          : ''
        texto += `  ${prioridadIcon} [ID:${d.id}] ${d.clave}: ${d.valor}${fechas}\n`
      })
  })

  return texto
}

// ═══════════════════════════════════════════════════════════════
// PROCESADOR PRINCIPAL DE MENSAJES (LEGACY)
// ═══════════════════════════════════════════════════════════════

export const procesarMensajeIALegacy = async (mensajeUsuario, contexto) => {
  const {
    nombreUsuario,
    nombreMarca,
    idMarca,
    esSuperAdmin,
    datosMarca,
    historial,
    accionPendienteActual
  } = contexto

  const fechaInfo = obtenerFechaActual()
  const datosFormateados = formatearDatosParaPrompt(datosMarca)

  const infoPendiente = accionPendienteActual
    ? `\n\n⚡ ACCIÓN PENDIENTE DE CONFIRMACIÓN:\nAcción: ${accionPendienteActual.accion}\nParámetros: ${JSON.stringify(accionPendienteActual.parametros, null, 2)}\n\nSi el usuario dice "sí", "ok", "dale", "confirmo", "hazlo", etc., DEBES ejecutar esta acción.`
    : ''

  // System prompt completo (igual que el original)
  const systemPrompt = `Eres un asistente amigable para administrar los DATOS DE CONOCIMIENTO de marcas.

CONTEXTO DEL SISTEMA:
Estos datos son las INSTRUCCIONES/PROMPT que usará un asistente de IA que actúa como
LA VOZ DE LA MARCA para responder comentarios en redes sociales (Instagram, Facebook, etc.).

Ese asistente representa directamente a la marca frente a los clientes. Cuando el usuario
agrega/modifica datos aquí, está configurando:
- Qué información tendrá la marca para responder a sus clientes
- Cómo debe hablar la marca (tono, estilo)
- Qué promociones puede mencionar la marca
- Qué reglas debe seguir la marca al responder

Hablas en español chileno cercano y profesional.

CONTEXTO:
- Usuario: ${nombreUsuario}
- Marca: ${nombreMarca}
- ID Marca: ${idMarca}
- Super Admin: ${esSuperAdmin ? 'Sí' : 'No'}
- Fecha: ${fechaInfo.fecha}
- Hora: ${fechaInfo.hora}
- Último día del mes: ${fechaInfo.ultimoDiaMes}

DATOS DE LA MARCA:
${datosFormateados}
${infoPendiente}

CATEGORÍAS:
- prompt, promocion, regla, horario, info, precio, estilo_respuesta, observacion

PRIORIDADES: 1=Obligatorio, 2-3=Importante, 4-6=Opcional

DEBES responder ÚNICAMENTE con un objeto JSON válido.
FORMATOS: texto, tabla, confirmacion, accion_confirmada, consultar_comentarios, exito, error`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formatearHistorialCompartido(historial, 'controlador'),
    { role: 'user', content: mensajeUsuario }
  ]

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages,
      temperature: 0.7
    })

    const respuestaRaw = response.choices[0].message.content

    try {
      let respuestaLimpia = respuestaRaw.trim()

      if (respuestaLimpia.includes('```')) {
        const match = respuestaLimpia.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (match) {
          respuestaLimpia = match[1].trim()
        }
      }

      const jsonStart = respuestaLimpia.indexOf('{')
      const jsonEnd = respuestaLimpia.lastIndexOf('}')

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        respuestaLimpia = respuestaLimpia.substring(jsonStart, jsonEnd + 1)
      }

      const parsed = JSON.parse(respuestaLimpia)

      // Validación de seguridad
      if (parsed.parametros?.id_fila && Array.isArray(parsed.parametros.id_fila)) {
        return {
          tipo: 'texto',
          contenido: 'Para evitar errores, necesito hacer los cambios de uno en uno 😊\n\n¿Con cuál ID empezamos?'
        }
      }

      if (parsed.ejecutar?.parametros?.id_fila && Array.isArray(parsed.ejecutar.parametros.id_fila)) {
        return {
          tipo: 'texto',
          contenido: 'Para evitar errores, necesito hacer los cambios de uno en uno 😊\n\n¿Con cuál ID empezamos?'
        }
      }

      let contenidoLimpio = parsed.mensaje || parsed.contenido || ''

      if (contenidoLimpio.includes('{"tipo"')) {
        const jsonIndex = contenidoLimpio.indexOf('{"tipo"')
        if (jsonIndex > 0) {
          contenidoLimpio = contenidoLimpio.substring(0, jsonIndex).trim()
        } else if (jsonIndex === 0) {
          try {
            const jsonInterno = JSON.parse(contenidoLimpio)
            if (jsonInterno.mensaje) {
              contenidoLimpio = jsonInterno.mensaje
              if (jsonInterno.delegacion && !parsed.delegacion) {
                parsed.delegacion = jsonInterno.delegacion
              }
            }
          } catch {
            contenidoLimpio = ''
          }
        }
      }

      const respuestaNormalizada = {
        tipo: parsed.tipo || 'texto',
        contenido: contenidoLimpio || parsed.mensaje || parsed.contenido || 'Mensaje procesado',
        datos: parsed.datos || null,
        ejecutar: parsed.ejecutar || null,
        accionPendiente: null,
        filtros: parsed.filtros || null,
        mensaje: parsed.mensaje || null,
        delegacion: parsed.delegacion || null
      }

      if (parsed.tipo === 'confirmacion' && parsed.accion && parsed.parametros) {
        respuestaNormalizada.accionPendiente = {
          accion: parsed.accion,
          parametros: parsed.parametros
        }
      }

      if (parsed.tipo === 'accion_confirmada' && !parsed.ejecutar && accionPendienteActual) {
        respuestaNormalizada.ejecutar = {
          accion: accionPendienteActual.accion,
          parametros: accionPendienteActual.parametros
        }
      }

      return respuestaNormalizada
    } catch {
      console.warn('⚠️ Legacy: Respuesta no es JSON válido:', respuestaRaw)

      let contenidoFinal = respuestaRaw
      let delegacionExtraida = null

      const jsonMatch = contenidoFinal.match(/\{[\s\S]*"tipo"[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const jsonExtraido = JSON.parse(jsonMatch[0])
          if (jsonExtraido.mensaje) {
            contenidoFinal = jsonExtraido.mensaje
          }
          if (jsonExtraido.delegacion) {
            delegacionExtraida = jsonExtraido.delegacion
          }

          return {
            tipo: jsonExtraido.tipo || 'texto',
            contenido: contenidoFinal,
            delegacion: delegacionExtraida
          }
        } catch {
          contenidoFinal = contenidoFinal.replace(jsonMatch[0], '').trim()
        }
      }

      if (!contenidoFinal) {
        contenidoFinal = respuestaRaw
      }

      return {
        tipo: 'texto',
        contenido: contenidoFinal,
        delegacion: delegacionExtraida
      }
    }
  } catch (err) {
    console.error('Error con OpenAI (Legacy):', err)
    return {
      tipo: 'error',
      contenido: `Ups, tuve un problema procesando tu solicitud: ${err.message}`
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// CHAT DIRECTO (LEGACY)
// ═══════════════════════════════════════════════════════════════

export const chatDirectoIALegacy = async (mensajeUsuario, historial = [], contextoMarca = null) => {
  const systemPrompt = `Eres ChatIA, un asistente de inteligencia artificial amigable y útil.
Hablas en español de forma cercana y profesional.
Puedes ayudar con cualquier tema: programación, escritura, consultas generales, ideas creativas, explicaciones, etc.
Responde de forma clara y concisa.

SIEMPRE responde con JSON válido: {"tipo":"texto","mensaje":"tu respuesta"}`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formatearHistorialCompartido(historial, 'chatia'),
    { role: 'user', content: mensajeUsuario }
  ]

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages,
      temperature: 0.8
    })

    const respuestaRaw = response.choices[0].message.content

    try {
      let respuestaLimpia = respuestaRaw.trim()

      if (respuestaLimpia.includes('```')) {
        const match = respuestaLimpia.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (match) {
          respuestaLimpia = match[1].trim()
        }
      }

      const jsonStart = respuestaLimpia.indexOf('{')
      const jsonEnd = respuestaLimpia.lastIndexOf('}')

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        respuestaLimpia = respuestaLimpia.substring(jsonStart, jsonEnd + 1)
      }

      const parsed = JSON.parse(respuestaLimpia)

      return {
        tipo: 'texto',
        contenido: parsed.mensaje || respuestaRaw,
        delegacion: parsed.delegacion || null
      }
    } catch {
      return {
        tipo: 'texto',
        contenido: respuestaRaw,
        delegacion: null
      }
    }
  } catch (err) {
    console.error('Error con OpenAI (Chat Directo Legacy):', err)
    return {
      tipo: 'error',
      contenido: `Ups, tuve un problema: ${err.message}`
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// TRANSCRIPCION DE AUDIO (sin cambios)
// ═══════════════════════════════════════════════════════════════

export const transcribirAudio = async (audioBlob) => {
  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.webm')
  formData.append('model', 'whisper-1')
  formData.append('language', 'es')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
    },
    body: formData
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || 'Error en la transcripcion')
  }

  const data = await response.json()
  return data.text
}
