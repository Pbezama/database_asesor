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
// FORMATEAR DATOS PARA EL PROMPT
// ═══════════════════════════════════════════════════════════════

const formatearDatosParaPrompt = (datosMarca) => {
  if (!datosMarca || datosMarca.length === 0) {
    return 'No hay datos registrados para esta marca.'
  }

  // Agrupar por categoría
  const porCategoria = {}
  datosMarca.forEach(d => {
    const cat = d.categoria || 'sin_categoria'
    if (!porCategoria[cat]) porCategoria[cat] = []
    porCategoria[cat].push(d)
  })

  let texto = ''
  
  // Ordenar categorías por prioridad promedio
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
// PROCESADOR PRINCIPAL DE MENSAJES
// ═══════════════════════════════════════════════════════════════

export const procesarMensajeIA = async (mensajeUsuario, contexto) => {
  const {
    nombreUsuario,
    nombreMarca,
    idMarca,
    esSuperAdmin,
    datosMarca,
    historial
  } = contexto

  const fechaInfo = obtenerFechaActual()
  const datosFormateados = formatearDatosParaPrompt(datosMarca)

  const systemPrompt = `Eres un asistente amigable para administrar datos de marcas. Hablas en español chileno cercano y profesional.

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

CATEGORÍAS: prompt, promocion, regla, horario, info, precio, estilo_respuesta, observacion

PRIORIDADES: 1=Obligatorio, 2-3=Importante, 4-6=Opcional

══════════════════════════════════════════════════════════════════════════════
⚠️ REGLA CRÍTICA - FORMATO DE RESPUESTA
══════════════════════════════════════════════════════════════════════════════

DEBES responder ÚNICAMENTE con un objeto JSON válido. 
NUNCA mezcles texto normal con JSON.
NUNCA escribas texto antes o después del JSON.
El usuario NUNCA debe ver JSON - el sistema lo convierte a formato visual.

══════════════════════════════════════════════════════════════════════════════
FORMATOS DE RESPUESTA (usa SOLO estos)
══════════════════════════════════════════════════════════════════════════════

1. CONVERSACIÓN NORMAL:
{"tipo":"texto","mensaje":"Tu respuesta amigable aquí"}

2. MOSTRAR DATOS EN TABLA:
{"tipo":"tabla","mensaje":"Aquí están tus datos 📋","datos":{"columnas":["ID","Categoría","Clave","Descripción","Prioridad","Vigencia"],"filas":[[1,"regla","mascotas","Permitidas con correa",3,"Permanente"]]}}

3. PEDIR CONFIRMACIÓN PARA AGREGAR:
{"tipo":"confirmacion","mensaje":"¡Perfecto! Voy a agregar esta regla 📝\\n\\n📌 **Regla:** No se permiten alimentos procesados...\\n⭐ **Prioridad:** 2 (Importante)\\n\\n¿Confirmas que está todo correcto?","accion":"agregar","parametros":{"categoria":"regla","clave":"alimentos_externos","valor":"No se permiten ingresar alimentos procesados desde el exterior, solo frutas, agua o alimentos preparados en casa","prioridad":2}}

4. PEDIR CONFIRMACIÓN PARA AGREGAR PROMOCIÓN (con fechas):
{"tipo":"confirmacion","mensaje":"¡Genial! Voy a crear esta promoción 🎉\\n\\n🏷️ **Promoción:** 30% de descuento en entradas\\n📅 **Desde:** 04 de Diciembre 2025\\n📅 **Hasta:** 31 de Diciembre 2025\\n⭐ **Prioridad:** 2\\n\\n¿Está todo bien?","accion":"agregar","parametros":{"categoria":"promocion","clave":"descuento_diciembre","valor":"30% de descuento en entradas","prioridad":2,"fecha_inicio":"2025-12-04","fecha_caducidad":"2025-12-31"}}

5. PEDIR CONFIRMACIÓN PARA DESACTIVAR:
{"tipo":"confirmacion","mensaje":"Voy a desactivar este registro 🗑️\\n\\n📌 **ID:** 15\\n📝 **Descripción:** Promoción día de la madre...\\n\\n¿Confirmas?","accion":"desactivar","parametros":{"id_fila":15}}

6. PEDIR CONFIRMACIÓN PARA MODIFICAR:
{"tipo":"confirmacion","mensaje":"Voy a modificar este registro ✏️\\n\\n📌 **ID:** 12\\n📝 **Cambio:** El valor pasará a ser...\\n\\n¿Confirmas?","accion":"modificar","parametros":{"id_fila":12,"updates":{"valor":"nuevo valor aquí"}}}

7. EJECUTAR ACCIÓN (cuando usuario dice sí/confirmo/dale/ok):
{"tipo":"accion_confirmada","mensaje":"¡Listo! Procesando...","ejecutar":{"accion":"agregar","parametros":{"categoria":"regla","clave":"alimentos","valor":"No se permiten...","prioridad":2}}}

8. ÉXITO:
{"tipo":"exito","mensaje":"✅ ¡Hecho! La regla se agregó correctamente."}

9. ERROR:
{"tipo":"error","mensaje":"❌ No encontré ese registro. ¿Puedes verificar el ID?"}

══════════════════════════════════════════════════════════════════════════════
REGLAS DE FECHAS
══════════════════════════════════════════════════════════════════════════════

- "solo por hoy" → fecha_inicio y fecha_caducidad = ${fechaInfo.iso.split('T')[0]}
- "hasta fin de mes" → fecha_caducidad = ${fechaInfo.año}-${String(fechaInfo.mes).padStart(2, '0')}-${fechaInfo.ultimoDiaMes}
- "esta semana" → calcular hasta domingo
- Las PROMOCIONES siempre necesitan fecha_inicio y fecha_caducidad
- Las REGLAS no necesitan fechas (son permanentes)

══════════════════════════════════════════════════════════════════════════════
FLUJO DE TRABAJO
══════════════════════════════════════════════════════════════════════════════

AGREGAR:
1. Usuario pide agregar → responde con tipo "confirmacion" mostrando resumen legible
2. Usuario confirma → responde con tipo "accion_confirmada"

MODIFICAR/DESACTIVAR:
1. Si no hay ID claro → muestra tabla con opciones para elegir
2. Si hay ID → responde con tipo "confirmacion"
3. Usuario confirma → responde con tipo "accion_confirmada"

══════════════════════════════════════════════════════════════════════════════
EJEMPLOS CORRECTOS
══════════════════════════════════════════════════════════════════════════════

Usuario: "hola"
✅ {"tipo":"texto","mensaje":"¡Hola! 👋 ¿En qué puedo ayudarte hoy?"}

Usuario: "quiero agregar una regla de no fumar"
✅ {"tipo":"confirmacion","mensaje":"¡Perfecto! Voy a agregar esta regla 📝\\n\\n📌 **Regla:** No se permite fumar en las instalaciones\\n⭐ **Prioridad:** 1 (Obligatoria)\\n\\n¿Confirmas?","accion":"agregar","parametros":{"categoria":"regla","clave":"no_fumar","valor":"No se permite fumar en las instalaciones","prioridad":1}}

Usuario: "sí" (después de una confirmación)
✅ {"tipo":"accion_confirmada","mensaje":"¡Procesando!","ejecutar":{"accion":"agregar","parametros":{"categoria":"regla","clave":"no_fumar","valor":"No se permite fumar en las instalaciones","prioridad":1}}}

══════════════════════════════════════════════════════════════════════════════
❌ NUNCA HAGAS ESTO
══════════════════════════════════════════════════════════════════════════════

❌ Mezclar texto con JSON: "Entendido, procederemos... {"tipo":"accion"...}"
❌ Mostrar JSON crudo al usuario
❌ Escribir explicaciones fuera del campo "mensaje"
❌ Usar formato que no sea JSON válido

✅ SIEMPRE responde con UN SOLO objeto JSON válido
✅ Todo el texto amigable va dentro del campo "mensaje"
✅ Usa \\n para saltos de línea dentro del mensaje
✅ Usa **texto** para negritas dentro del mensaje`

  // Construir mensajes del historial
  const messages = [
    { role: 'system', content: systemPrompt },
    ...historial.slice(-18).map(m => ({
      role: m.rol === 'user' ? 'user' : 'assistant',
      content: typeof m.contenido === 'string' ? m.contenido : JSON.stringify(m.contenido)
    })),
    { role: 'user', content: mensajeUsuario }
  ]

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7
    })

    const respuestaRaw = response.choices[0].message.content

    // Intentar parsear JSON
    try {
      let respuestaLimpia = respuestaRaw.trim()
      
      // Remover bloques de código markdown si existen
      if (respuestaLimpia.startsWith('```')) {
        const match = respuestaLimpia.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (match) {
          respuestaLimpia = match[1].trim()
        }
      }

      const parsed = JSON.parse(respuestaLimpia)
      
      // Normalizar la respuesta según el nuevo formato simplificado
      const respuestaNormalizada = {
        tipo: parsed.tipo || 'texto',
        contenido: parsed.mensaje || parsed.contenido || respuestaRaw,
        datos: parsed.datos || null,
        ejecutar: parsed.ejecutar || null
      }

      // Si es confirmación, guardar los parámetros para cuando el usuario confirme
      if (parsed.tipo === 'confirmacion' && parsed.accion && parsed.parametros) {
        respuestaNormalizada.accionPendiente = {
          accion: parsed.accion,
          parametros: parsed.parametros
        }
      }

      return respuestaNormalizada
    } catch {
      // Si no es JSON válido, devolver como texto
      return {
        tipo: 'texto',
        contenido: respuestaRaw
      }
    }
  } catch (err) {
    console.error('Error con OpenAI:', err)
    return {
      tipo: 'error',
      contenido: `Ups, tuve un problema procesando tu solicitud: ${err.message}`
    }
  }
}