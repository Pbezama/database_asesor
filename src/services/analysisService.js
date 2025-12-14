/**
 * Servicio de análisis con IA para datos de marca y comentarios
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

// ═══════════════════════════════════════════════════════════════
// ANÁLISIS DE DATOS DE MARCA
// ═══════════════════════════════════════════════════════════════

export const analizarDatosMarca = async (datos, nombreMarca) => {
  if (!datos || datos.length === 0) {
    throw new Error('No hay datos para analizar')
  }

  // Preparar resumen de datos para el análisis
  const resumenDatos = datos.map(d => ({
    categoria: d.categoria,
    clave: d.clave,
    valor: d.valor?.substring(0, 500),
    prioridad: d.prioridad
  }))

  const prompt = `Eres un experto en marketing digital, comunicación empresarial y branding. Analiza los siguientes datos de configuración de la marca "${nombreMarca}" y genera un informe profesional.

DATOS DE LA MARCA:
${JSON.stringify(resumenDatos, null, 2)}

Genera un informe completo que incluya:

## 1. RESUMEN EJECUTIVO
- Visión general de la marca basada en los datos
- Puntos fuertes identificados
- Áreas de oportunidad

## 2. ANÁLISIS DE COMUNICACIÓN
- Evaluación del tono y estilo de comunicación
- Coherencia en los mensajes
- Sugerencias de mejora en los textos

## 3. EVALUACIÓN DE CONTENIDO
- Calidad de las descripciones y valores
- Claridad de la información
- Completitud de los datos

## 4. RECOMENDACIONES ESPECÍFICAS
Para cada categoría de datos encontrada, proporciona:
- Qué está bien
- Qué se puede mejorar
- Ejemplo de texto mejorado (si aplica)

## 5. PUNTUACIÓN GENERAL
Da una puntuación del 1 al 10 en:
- Claridad de comunicación: X/10
- Profesionalismo: X/10
- Completitud de información: X/10
- Atractivo comercial: X/10
- PUNTUACIÓN GLOBAL: X/10

## 6. PLAN DE ACCIÓN
Lista de 5-7 acciones prioritarias para mejorar la presencia de la marca.

Responde en español, de forma profesional pero accesible.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un consultor experto en marketing y branding. Generas informes profesionales y accionables.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.7
    })

    return {
      success: true,
      informe: response.choices[0].message.content,
      fecha: new Date().toISOString(),
      nombreMarca,
      totalDatosAnalizados: datos.length
    }
  } catch (error) {
    console.error('Error en análisis de marca:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ANÁLISIS DE COMENTARIOS
// ═══════════════════════════════════════════════════════════════

export const analizarComentarios = async (comentarios, nombreMarca) => {
  if (!comentarios || comentarios.length === 0) {
    throw new Error('No hay comentarios para analizar')
  }

  // Preparar resumen de comentarios
  const resumenComentarios = comentarios.slice(0, 100).map(c => ({
    comentario: c.comentario_original?.substring(0, 200) || c.texto_publicacion?.substring(0, 200),
    respuesta: c.respuesta_comentario?.substring(0, 150),
    fecha: c.creado_en,
    esInapropiado: c.es_inapropiado,
    razon: c.razon_inapropiado
  }))

  // Contar estadísticas
  const totalComentarios = comentarios.length
  const inapropiados = comentarios.filter(c => c.es_inapropiado).length
  const conRespuesta = comentarios.filter(c => c.respuesta_comentario).length

  const prompt = `Eres un experto en gestión de comunidades, atención al cliente y análisis de sentimiento. Analiza los siguientes comentarios de la marca "${nombreMarca}" y genera un informe profesional.

ESTADÍSTICAS GENERALES:
- Total de comentarios: ${totalComentarios}
- Comentarios marcados como inapropiados: ${inapropiados}
- Comentarios con respuesta: ${conRespuesta}

MUESTRA DE COMENTARIOS (máximo 100):
${JSON.stringify(resumenComentarios, null, 2)}

Genera un informe completo que incluya:

## 1. RESUMEN EJECUTIVO
- Visión general del estado de los comentarios
- Tendencias principales identificadas
- Nivel de engagement general

## 2. ANÁLISIS DE SENTIMIENTO
- Porcentaje estimado de comentarios positivos
- Porcentaje estimado de comentarios negativos
- Porcentaje estimado de comentarios neutros
- Temas más mencionados

## 3. COMENTARIOS PROBLEMÁTICOS
- Tipos de comentarios negativos detectados
- Patrones de quejas recurrentes
- Nivel de gravedad de los problemas

## 4. EVALUACIÓN DE RESPUESTAS
- Calidad de las respuestas dadas
- Tiempo de respuesta (si es posible inferir)
- Tono y profesionalismo

## 5. GUÍA DE MANEJO DE CRISIS
Para los tipos de comentarios problemáticos detectados, proporciona:
- Tipo de comentario
- Respuesta sugerida
- Qué NO hacer

## 6. RECOMENDACIONES
Lista de 5-7 acciones para mejorar la gestión de comentarios.

## 7. PUNTUACIÓN
- Salud de la comunidad: X/10
- Calidad de respuestas: X/10
- Gestión de crisis: X/10
- PUNTUACIÓN GLOBAL: X/10

Responde en español, de forma profesional y práctica.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en community management y atención al cliente. Generas informes profesionales con recomendaciones prácticas.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.7
    })

    return {
      success: true,
      informe: response.choices[0].message.content,
      fecha: new Date().toISOString(),
      nombreMarca,
      estadisticas: {
        totalComentarios,
        inapropiados,
        conRespuesta,
        porcentajeInapropiados: ((inapropiados / totalComentarios) * 100).toFixed(1)
      }
    }
  } catch (error) {
    console.error('Error en análisis de comentarios:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// GENERAR PDF DEL INFORME IA
// ═══════════════════════════════════════════════════════════════

export const generarInformePDF = (resultado, tipo = 'marca') => {
  if (!resultado || !resultado.success) {
    alert('No hay informe para descargar')
    return
  }

  const titulo = tipo === 'marca'
    ? `Informe de Análisis de Marca - ${resultado.nombreMarca}`
    : `Informe de Análisis de Comentarios - ${resultado.nombreMarca}`

  // Convertir markdown a HTML básico
  let contenidoHTML = resultado.informe
    .replace(/## (.*)/g, '<h2>$1</h2>')
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/- (.*)/g, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
      color: #1e293b;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 3px solid #3b82f6;
      margin-bottom: 30px;
    }
    h1 {
      color: #1e293b;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .fecha {
      color: #64748b;
      font-size: 14px;
    }
    .badge {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      margin-top: 10px;
    }
    h2 {
      color: #3b82f6;
      font-size: 20px;
      margin-top: 30px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    h3 {
      color: #475569;
      font-size: 16px;
      margin-top: 20px;
    }
    p { margin: 10px 0; }
    li { margin: 5px 0; margin-left: 20px; }
    strong { color: #1e293b; }
    .stats {
      background: #f1f5f9;
      padding: 20px;
      border-radius: 10px;
      margin: 20px 0;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    .stat-item {
      background: white;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #3b82f6;
    }
    .stat-label {
      font-size: 12px;
      color: #64748b;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
    @media print {
      body { padding: 20px; }
      .header { page-break-after: avoid; }
      h2 { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${titulo}</h1>
    <div class="fecha">Generado el ${new Date(resultado.fecha).toLocaleString('es-CL')}</div>
    <span class="badge">Análisis con IA</span>
  </div>

  ${tipo === 'comentarios' && resultado.estadisticas ? `
  <div class="stats">
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">${resultado.estadisticas.totalComentarios}</div>
        <div class="stat-label">Total Comentarios</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${resultado.estadisticas.inapropiados}</div>
        <div class="stat-label">Inapropiados</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${resultado.estadisticas.conRespuesta}</div>
        <div class="stat-label">Con Respuesta</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${resultado.estadisticas.porcentajeInapropiados}%</div>
        <div class="stat-label">% Inapropiados</div>
      </div>
    </div>
  </div>
  ` : ''}

  <div class="content">
    <p>${contenidoHTML}</p>
  </div>

  <div class="footer">
    Informe generado automáticamente por Admin Panel - Your Friend | Análisis realizado con IA
  </div>
</body>
</html>`

  // Abrir ventana de impresión
  const ventana = window.open('', '_blank')
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  setTimeout(() => {
    ventana.print()
  }, 500)
}

// ═══════════════════════════════════════════════════════════════
// DESCARGAR INFORME COMO TEXTO
// ═══════════════════════════════════════════════════════════════

export const descargarInformeTexto = (resultado, tipo = 'marca') => {
  if (!resultado || !resultado.success) {
    alert('No hay informe para descargar')
    return
  }

  const titulo = tipo === 'marca'
    ? `INFORME DE ANÁLISIS DE MARCA - ${resultado.nombreMarca.toUpperCase()}`
    : `INFORME DE ANÁLISIS DE COMENTARIOS - ${resultado.nombreMarca.toUpperCase()}`

  let contenido = `${titulo}\n`
  contenido += `${'='.repeat(60)}\n\n`
  contenido += `Fecha de generación: ${new Date(resultado.fecha).toLocaleString('es-CL')}\n`
  contenido += `Tipo de análisis: ${tipo === 'marca' ? 'Datos de Marca' : 'Comentarios'}\n`

  if (tipo === 'comentarios' && resultado.estadisticas) {
    contenido += `\nESTADÍSTICAS:\n`
    contenido += `- Total de comentarios: ${resultado.estadisticas.totalComentarios}\n`
    contenido += `- Inapropiados: ${resultado.estadisticas.inapropiados}\n`
    contenido += `- Con respuesta: ${resultado.estadisticas.conRespuesta}\n`
  }

  contenido += `\n${'='.repeat(60)}\n\n`
  contenido += resultado.informe
  contenido += `\n\n${'='.repeat(60)}\n`
  contenido += `Generado por Admin Panel - Your Friend | Análisis con IA\n`

  const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `informe_${tipo}_${resultado.nombreMarca.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
