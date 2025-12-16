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
    historial,
    accionPendienteActual // NUEVO: recibir la acción pendiente actual
  } = contexto

  const fechaInfo = obtenerFechaActual()
  const datosFormateados = formatearDatosParaPrompt(datosMarca)

  // Construir información de acción pendiente si existe
  const infoPendiente = accionPendienteActual 
    ? `\n\n⚡ ACCIÓN PENDIENTE DE CONFIRMACIÓN:\nAcción: ${accionPendienteActual.accion}\nParámetros: ${JSON.stringify(accionPendienteActual.parametros, null, 2)}\n\nSi el usuario dice "sí", "ok", "dale", "confirmo", "hazlo", etc., DEBES ejecutar esta acción.`
    : ''

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
${infoPendiente}

CATEGORÍAS: prompt, promocion, regla, horario, info, precio, estilo_respuesta, observacion

PRIORIDADES: 1=Obligatorio, 2-3=Importante, 4-6=Opcional

══════════════════════════════════════════════════════════════════════════════
CONSULTA DE COMENTARIOS (logs_comentarios)
══════════════════════════════════════════════════════════════════════════════

Puedes consultar la tabla de comentarios/logs cuando el usuario lo pida.
Ejemplos de solicitudes:
- "muestrame los comentarios"
- "quiero ver los comentarios ofensivos"
- "filtra comentarios inapropiados"
- "busca comentarios que mencionen [palabra]"

FORMATO PARA CONSULTAR COMENTARIOS:
{"tipo":"consultar_comentarios","mensaje":"Buscando comentarios...","filtros":{"soloInapropiados":false,"clasificacion":null,"filtroTexto":null,"limite":50}}

Ejemplos de filtros:
- Todos: {"soloInapropiados":false,"clasificacion":null,"filtroTexto":null}
- Solo ofensivos/inapropiados: {"soloInapropiados":true}
- Por clasificacion: {"clasificacion":"ofensivo"} o {"clasificacion":"spam"}
- Por texto: {"filtroTexto":"palabra a buscar"}
- Combinados: {"soloInapropiados":true,"filtroTexto":"insulto"}

══════════════════════════════════════════════════════════════════════════════
⚠️ REGLA CRÍTICA - FORMATO DE RESPUESTA
══════════════════════════════════════════════════════════════════════════════

DEBES responder ÚNICAMENTE con un objeto JSON válido. 
NUNCA mezcles texto normal con JSON.
NUNCA escribas texto antes o después del JSON.
El usuario NUNCA debe ver JSON - el sistema lo convierte a formato visual.

══════════════════════════════════════════════════════════════════════════════
⚠️ REGLA CRÍTICA - DATOS EXACTOS DE LA BASE DE DATOS
══════════════════════════════════════════════════════════════════════════════

Cuando muestres datos en tabla, DEBES usar EXACTAMENTE los valores que aparecen en "DATOS DE LA MARCA" arriba.
- NUNCA inventes, redondees, o modifiques valores
- NUNCA uses datos de conversaciones anteriores
- NUNCA asumas que un cambio ya se hizo - usa SOLO los datos que ves arriba
- Cada campo debe coincidir EXACTAMENTE: ID, categoría, clave, valor, prioridad, fechas
- Si un dato dice prioridad 1 arriba, muestra 1. Si dice 3, muestra 3.

══════════════════════════════════════════════════════════════════════════════
⚠️ REGLA CRÍTICA - UNA ACCIÓN A LA VEZ
══════════════════════════════════════════════════════════════════════════════

SOLO puedes modificar o desactivar UN registro a la vez.
- Si el usuario pide modificar múltiples IDs (ej: "ID 2 y 3 a prioridad 2"), 
  DEBES responder pidiendo que lo haga de uno en uno.
- Ejemplo de respuesta cuando piden múltiples cambios:
  {"tipo":"texto","mensaje":"Para evitar errores, necesito que hagamos los cambios de uno en uno 😊\\n\\n¿Empezamos con el ID 27 o el ID 28?"}

NUNCA generes acciones con múltiples IDs. Siempre id_fila debe ser UN número, nunca un array.

══════════════════════════════════════════════════════════════════════════════
FORMATOS DE RESPUESTA (usa SOLO estos)
══════════════════════════════════════════════════════════════════════════════

1. CONVERSACIÓN NORMAL:
{"tipo":"texto","mensaje":"Tu respuesta amigable aquí"}

2. MOSTRAR DATOS EN TABLA:
{"tipo":"tabla","mensaje":"Aquí están tus datos 📋","datos":{"columnas":["ID","Categoría","Clave","Descripción","Prioridad","Vigencia"],"filas":[[27,"regla","mascotas","Permitidas con correa",3,"Permanente"]]}}

IMPORTANTE PARA TABLAS: La columna "ID" SIEMPRE debe mostrar el ID real de la base de datos (el número que aparece en [ID:XX] de los datos). NUNCA uses índices ficticios como 1,2,3,4.

3. PEDIR CONFIRMACIÓN PARA AGREGAR:
{"tipo":"confirmacion","mensaje":"¡Perfecto! Voy a agregar esta regla 📝\\n\\n📌 **Regla:** No se permiten alimentos procesados...\\n⭐ **Prioridad:** 2 (Importante)\\n\\n¿Confirmas que está todo correcto?","accion":"agregar","parametros":{"categoria":"regla","clave":"alimentos_externos","valor":"No se permiten ingresar alimentos procesados desde el exterior, solo frutas, agua o alimentos preparados en casa","prioridad":2}}

4. PEDIR CONFIRMACIÓN PARA AGREGAR PROMOCIÓN (con fechas):
{"tipo":"confirmacion","mensaje":"¡Genial! Voy a crear esta promoción 🎉\\n\\n🏷️ **Promoción:** 30% de descuento en entradas\\n📅 **Desde:** 04 de Diciembre 2025\\n📅 **Hasta:** 31 de Diciembre 2025\\n⭐ **Prioridad:** 2\\n\\n¿Está todo bien?","accion":"agregar","parametros":{"categoria":"promocion","clave":"descuento_diciembre","valor":"30% de descuento en entradas","prioridad":2,"fecha_inicio":"2025-12-04","fecha_caducidad":"2025-12-31"}}

5. PEDIR CONFIRMACIÓN PARA DESACTIVAR (solo 1 ID):
{"tipo":"confirmacion","mensaje":"Voy a desactivar este registro 🗑️\\n\\n📌 **ID:** 27\\n📝 **Descripción:** Promoción día de la madre...\\n\\n¿Confirmas?","accion":"desactivar","parametros":{"id_fila":27}}

6. PEDIR CONFIRMACIÓN PARA MODIFICAR PRIORIDAD (solo 1 ID):
{"tipo":"confirmacion","mensaje":"Voy a modificar este registro ✏️\\n\\n📌 **ID:** 27\\n📝 **Cambio:** La prioridad pasará de 1 a 2\\n\\n¿Confirmas?","accion":"modificar","parametros":{"id_fila":27,"updates":{"prioridad":2}}}

7. PEDIR CONFIRMACIÓN PARA MODIFICAR FECHAS (solo 1 ID):
{"tipo":"confirmacion","mensaje":"Voy a modificar las fechas de este registro ✏️\\n\\n📌 **ID:** 27\\n📅 **Nueva fecha inicio:** 2025-12-01\\n📅 **Nueva fecha término:** 2025-12-31\\n\\n¿Confirmas?","accion":"modificar","parametros":{"id_fila":27,"updates":{"fecha_inicio":"2025-12-01","fecha_caducidad":"2025-12-31"}}}

8. PEDIR CONFIRMACIÓN PARA MODIFICAR MÚLTIPLES CAMPOS (solo 1 ID):
{"tipo":"confirmacion","mensaje":"Voy a modificar este registro ✏️\\n\\n📌 **ID:** 27\\n📝 **Cambios:**\\n  - Prioridad: 1 → 2\\n  - Fecha término: 2025-12-31\\n\\n¿Confirmas?","accion":"modificar","parametros":{"id_fila":27,"updates":{"prioridad":2,"fecha_caducidad":"2025-12-31"}}}

9. EJECUTAR ACCIÓN CONFIRMADA (cuando usuario dice sí/confirmo/dale/ok después de una confirmación):
{"tipo":"accion_confirmada","mensaje":"¡Listo! Procesando...","ejecutar":{"accion":"agregar","parametros":{"categoria":"regla","clave":"no_fumar","valor":"No se permite fumar en las instalaciones","prioridad":1}}}

IMPORTANTE PARA EJECUTAR MODIFICAR:
{"tipo":"accion_confirmada","mensaje":"¡Listo! Procesando...","ejecutar":{"accion":"modificar","parametros":{"id_fila":27,"updates":{"prioridad":2}}}}

IMPORTANTE PARA EJECUTAR DESACTIVAR:
{"tipo":"accion_confirmada","mensaje":"¡Listo! Procesando...","ejecutar":{"accion":"desactivar","parametros":{"id_fila":27}}}

10. ÉXITO:
{"tipo":"exito","mensaje":"✅ ¡Hecho! La regla se agregó correctamente."}

11. ERROR:
{"tipo":"error","mensaje":"❌ No encontré ese registro. ¿Puedes verificar el ID?"}

══════════════════════════════════════════════════════════════════════════════
REGLAS DE FECHAS
══════════════════════════════════════════════════════════════════════════════

- Formato de fecha SIEMPRE: YYYY-MM-DD (ej: 2025-12-31)
- "solo por hoy" → fecha_inicio y fecha_caducidad = ${fechaInfo.iso.split('T')[0]}
- "hasta fin de mes" → fecha_caducidad = ${fechaInfo.año}-${String(fechaInfo.mes).padStart(2, '0')}-${fechaInfo.ultimoDiaMes}
- "esta semana" → calcular hasta domingo
- Las PROMOCIONES siempre necesitan fecha_inicio y fecha_caducidad
- Las REGLAS no necesitan fechas (son permanentes)
- Para modificar fechas, usa el campo correcto:
  - fecha_inicio para fecha de inicio
  - fecha_caducidad para fecha de término/fin/vencimiento

══════════════════════════════════════════════════════════════════════════════
FLUJO DE TRABAJO - MUY IMPORTANTE
══════════════════════════════════════════════════════════════════════════════

AGREGAR:
1. Usuario pide agregar → responde con tipo "confirmacion" mostrando resumen legible
2. Usuario confirma (sí/ok/dale/confirmo) → responde con tipo "accion_confirmada" CON el objeto "ejecutar"

MODIFICAR PRIORIDAD O FECHAS:
1. Si piden modificar MÚLTIPLES IDs → pedir que lo haga de uno en uno
2. Si no hay ID claro → muestra tabla con opciones para elegir
3. Si hay UN solo ID → responde con tipo "confirmacion" incluyendo accion="modificar" y parametros con id_fila y updates
4. Usuario confirma (sí/ok/dale/confirmo) → responde con tipo "accion_confirmada" CON el objeto "ejecutar" que incluye accion="modificar"

DESACTIVAR:
1. Si piden desactivar MÚLTIPLES IDs → pedir que lo haga de uno en uno
2. Si no hay ID claro → muestra tabla con opciones para elegir
3. Si hay UN solo ID → responde con tipo "confirmacion" incluyendo accion="desactivar"
4. Usuario confirma → responde con tipo "accion_confirmada" CON el objeto "ejecutar"

⚠️ CRÍTICO: Cuando el usuario confirma, SIEMPRE incluye el objeto "ejecutar" con todos los datos necesarios.
El sistema NO puede ejecutar la acción sin el objeto "ejecutar".

══════════════════════════════════════════════════════════════════════════════
EJEMPLOS CORRECTOS
══════════════════════════════════════════════════════════════════════════════

Usuario: "hola"
✅ {"tipo":"texto","mensaje":"¡Hola! 👋 ¿En qué puedo ayudarte hoy?"}

Usuario: "quiero agregar una regla de no fumar"
✅ {"tipo":"confirmacion","mensaje":"¡Perfecto! Voy a agregar esta regla 📝\\n\\n📌 **Regla:** No se permite fumar en las instalaciones\\n⭐ **Prioridad:** 1 (Obligatoria)\\n\\n¿Confirmas?","accion":"agregar","parametros":{"categoria":"regla","clave":"no_fumar","valor":"No se permite fumar en las instalaciones","prioridad":1}}

Usuario: "sí" (después de pedir agregar regla)
✅ {"tipo":"accion_confirmada","mensaje":"¡Procesando!","ejecutar":{"accion":"agregar","parametros":{"categoria":"regla","clave":"no_fumar","valor":"No se permite fumar en las instalaciones","prioridad":1}}}

Usuario: "cambia el ID 27 a prioridad 2"
✅ {"tipo":"confirmacion","mensaje":"Voy a modificar este registro ✏️\\n\\n📌 **ID:** 27\\n📝 **Cambio:** La prioridad pasará a 2\\n\\n¿Confirmas?","accion":"modificar","parametros":{"id_fila":27,"updates":{"prioridad":2}}}

Usuario: "sí" (después de pedir modificar prioridad)
✅ {"tipo":"accion_confirmada","mensaje":"¡Procesando!","ejecutar":{"accion":"modificar","parametros":{"id_fila":27,"updates":{"prioridad":2}}}}

Usuario: "cambia la fecha de término del ID 30 al 31 de diciembre"
✅ {"tipo":"confirmacion","mensaje":"Voy a modificar la fecha de término ✏️\\n\\n📌 **ID:** 30\\n📅 **Nueva fecha término:** 31 de Diciembre 2025\\n\\n¿Confirmas?","accion":"modificar","parametros":{"id_fila":30,"updates":{"fecha_caducidad":"2025-12-31"}}}

Usuario: "dale" (después de pedir modificar fecha)
✅ {"tipo":"accion_confirmada","mensaje":"¡Procesando!","ejecutar":{"accion":"modificar","parametros":{"id_fila":30,"updates":{"fecha_caducidad":"2025-12-31"}}}}

Usuario: "desactiva el ID 27"
✅ {"tipo":"confirmacion","mensaje":"Voy a desactivar este registro 🗑️\\n\\n📌 **ID:** 27\\n\\n¿Confirmas?","accion":"desactivar","parametros":{"id_fila":27}}

Usuario: "ok" (después de pedir desactivar)
✅ {"tipo":"accion_confirmada","mensaje":"¡Procesando!","ejecutar":{"accion":"desactivar","parametros":{"id_fila":27}}}

Usuario: "cambia el ID 27 y 28 a prioridad 2"
✅ {"tipo":"texto","mensaje":"Para evitar errores, necesito hacer los cambios de uno en uno 😊\\n\\n¿Empezamos modificando el ID 27 a prioridad 2?"}

Usuario: "muestrame los comentarios"
✅ {"tipo":"consultar_comentarios","mensaje":"Buscando todos los comentarios...","filtros":{"soloInapropiados":false,"limite":50}}

Usuario: "quiero ver los comentarios ofensivos"
✅ {"tipo":"consultar_comentarios","mensaje":"Buscando comentarios ofensivos...","filtros":{"soloInapropiados":true,"clasificacion":"ofensivo"}}

Usuario: "filtra comentarios inapropiados"
✅ {"tipo":"consultar_comentarios","mensaje":"Buscando comentarios inapropiados...","filtros":{"soloInapropiados":true}}

Usuario: "busca comentarios que mencionen spam"
✅ {"tipo":"consultar_comentarios","mensaje":"Buscando comentarios con 'spam'...","filtros":{"filtroTexto":"spam"}}

══════════════════════════════════════════════════════════════════════════════
NUNCA HAGAS ESTO
══════════════════════════════════════════════════════════════════════════════

❌ Mezclar texto con JSON: "Entendido, procederemos... {"tipo":"accion"...}"
❌ Mostrar JSON crudo al usuario
❌ Escribir explicaciones fuera del campo "mensaje"
❌ Usar formato que no sea JSON válido
❌ Usar IDs ficticios (1,2,3,4) en vez de los IDs reales de la base de datos
❌ Modificar múltiples IDs en una sola acción: {"parametros":{"id_fila":[27,28]}}
❌ Aceptar peticiones de cambios múltiples sin pedir hacerlo uno por uno
❌ Responder "accion_confirmada" SIN el objeto "ejecutar"
❌ Olvidar incluir id_fila en los updates de modificar

✅ SIEMPRE responde con UN SOLO objeto JSON válido
✅ Todo el texto amigable va dentro del campo "mensaje"
✅ Usa \\n para saltos de línea dentro del mensaje
✅ Usa **texto** para negritas dentro del mensaje
✅ Usa los IDs reales de Supabase (los que aparecen en [ID:XX])
✅ Solo UN id_fila por acción de modificar/desactivar
✅ SIEMPRE incluye "ejecutar" cuando el usuario confirma una acción`

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
      model: 'gpt-5.1',
      messages,
      temperature: 0.7
    })

    const respuestaRaw = response.choices[0].message.content

    // Intentar parsear JSON
    try {
      let respuestaLimpia = respuestaRaw.trim()

      // Remover bloques de código markdown si existen
      if (respuestaLimpia.includes('```')) {
        const match = respuestaLimpia.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (match) {
          respuestaLimpia = match[1].trim()
        }
      }

      // Si hay texto antes del JSON, extraer solo el JSON
      // Buscar el primer { y el último } para extraer el objeto JSON
      const jsonStart = respuestaLimpia.indexOf('{')
      const jsonEnd = respuestaLimpia.lastIndexOf('}')

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        respuestaLimpia = respuestaLimpia.substring(jsonStart, jsonEnd + 1)
      }

      const parsed = JSON.parse(respuestaLimpia)
      
      // ═══════════════════════════════════════════════════════════════
      // VALIDACIÓN DE SEGURIDAD: Rechazar múltiples IDs
      // ═══════════════════════════════════════════════════════════════
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

      // ═══════════════════════════════════════════════════════════════
      // NORMALIZAR RESPUESTA
      // ═══════════════════════════════════════════════════════════════

      // Limpiar el mensaje de posibles JSON residuales
      let contenidoLimpio = parsed.mensaje || parsed.contenido || ''

      // Si el contenido contiene un JSON al final, removerlo
      if (contenidoLimpio.includes('{"tipo"')) {
        const jsonIndex = contenidoLimpio.indexOf('{"tipo"')
        if (jsonIndex > 0) {
          contenidoLimpio = contenidoLimpio.substring(0, jsonIndex).trim()
        }
      }

      const respuestaNormalizada = {
        tipo: parsed.tipo || 'texto',
        contenido: contenidoLimpio || respuestaRaw,
        datos: parsed.datos || null,
        ejecutar: parsed.ejecutar || null,
        accionPendiente: null,
        filtros: parsed.filtros || null,
        mensaje: parsed.mensaje || null
      }

      // Si es confirmación, guardar los parámetros para cuando el usuario confirme
      if (parsed.tipo === 'confirmacion' && parsed.accion && parsed.parametros) {
        respuestaNormalizada.accionPendiente = {
          accion: parsed.accion,
          parametros: parsed.parametros
        }
        console.log('📋 Acción pendiente guardada:', respuestaNormalizada.accionPendiente)
      }

      // Si es accion_confirmada pero NO tiene ejecutar, y tenemos acción pendiente del contexto
      if (parsed.tipo === 'accion_confirmada' && !parsed.ejecutar && accionPendienteActual) {
        console.log('🔄 Usando acción pendiente del contexto para ejecutar')
        respuestaNormalizada.ejecutar = {
          accion: accionPendienteActual.accion,
          parametros: accionPendienteActual.parametros
        }
      }

      return respuestaNormalizada
    } catch {
      // Si no es JSON válido, intentar limpiar el texto de JSON residual
      console.warn('⚠️ Respuesta no es JSON válido:', respuestaRaw)

      let contenidoFinal = respuestaRaw

      // Remover cualquier JSON visible al final del texto
      const jsonMatch = contenidoFinal.match(/\{"tipo"[\s\S]*\}$/)
      if (jsonMatch) {
        contenidoFinal = contenidoFinal.replace(jsonMatch[0], '').trim()
      }

      // Si quedó vacío después de limpiar, usar el original
      if (!contenidoFinal) {
        contenidoFinal = respuestaRaw
      }

      return {
        tipo: 'texto',
        contenido: contenidoFinal
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

// ═══════════════════════════════════════════════════════════════
// CHAT DIRECTO CON CHATGPT (SIN FUNCIONES DE BASE DE DATOS)
// ═══════════════════════════════════════════════════════════════

export const chatDirectoIA = async (mensajeUsuario, historial = []) => {
  const systemPrompt = `Eres ChatIA, un asistente de inteligencia artificial amigable y útil.
Hablas en español de forma cercana y profesional.
Puedes ayudar con cualquier tema: programación, escritura, consultas generales, ideas creativas, explicaciones, etc.
Responde de forma clara y concisa.
NO tienes acceso a bases de datos ni funciones de administración en este modo.
Estás en modo conversación libre.`

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
      model: 'gpt-5.1',
      messages,
      temperature: 0.8
    })

    return {
      tipo: 'texto',
      contenido: response.choices[0].message.content
    }
  } catch (err) {
    console.error('Error con OpenAI (Chat Directo):', err)
    return {
      tipo: 'error',
      contenido: `Ups, tuve un problema: ${err.message}`
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// TRANSCRIPCION DE AUDIO (Whisper API)
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