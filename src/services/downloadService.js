/**
 * Servicio de descarga de datos en múltiples formatos
 */

// ═══════════════════════════════════════════════════════════════
// DESCARGA CSV
// ═══════════════════════════════════════════════════════════════

export const descargarCSV = (datos, columnas, nombreArchivo = 'datos') => {
  if (!datos || datos.length === 0) {
    alert('No hay datos para descargar')
    return
  }

  // Crear encabezados
  const headers = columnas.join(',')

  // Crear filas
  const filas = datos.map(fila => {
    return columnas.map(col => {
      const valor = fila[col] ?? ''
      // Escapar comillas y envolver en comillas si contiene comas o saltos de línea
      const valorStr = String(valor).replace(/"/g, '""')
      return valorStr.includes(',') || valorStr.includes('\n') || valorStr.includes('"')
        ? `"${valorStr}"`
        : valorStr
    }).join(',')
  })

  const contenido = [headers, ...filas].join('\n')
  const blob = new Blob(['\ufeff' + contenido], { type: 'text/csv;charset=utf-8;' })
  descargarBlob(blob, `${nombreArchivo}.csv`)
}

// ═══════════════════════════════════════════════════════════════
// DESCARGA JSON
// ═══════════════════════════════════════════════════════════════

export const descargarJSON = (datos, nombreArchivo = 'datos') => {
  if (!datos || datos.length === 0) {
    alert('No hay datos para descargar')
    return
  }

  const contenido = JSON.stringify(datos, null, 2)
  const blob = new Blob([contenido], { type: 'application/json;charset=utf-8;' })
  descargarBlob(blob, `${nombreArchivo}.json`)
}

// ═══════════════════════════════════════════════════════════════
// DESCARGA EXCEL (XLSX) - usando formato XML simplificado
// ═══════════════════════════════════════════════════════════════

export const descargarExcel = (datos, columnas, nombreArchivo = 'datos') => {
  if (!datos || datos.length === 0) {
    alert('No hay datos para descargar')
    return
  }

  // Crear XML para Excel
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<?mso-application progid="Excel.Sheet"?>\n'
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n'
  xml += '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n'
  xml += '  <Styles>\n'
  xml += '    <Style ss:ID="Header">\n'
  xml += '      <Font ss:Bold="1" ss:Size="12"/>\n'
  xml += '      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>\n'
  xml += '    </Style>\n'
  xml += '    <Style ss:ID="Date">\n'
  xml += '      <NumberFormat ss:Format="yyyy-mm-dd hh:mm:ss"/>\n'
  xml += '    </Style>\n'
  xml += '  </Styles>\n'
  xml += '  <Worksheet ss:Name="Datos">\n'
  xml += '    <Table>\n'

  // Encabezados
  xml += '      <Row>\n'
  columnas.forEach(col => {
    xml += `        <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col)}</Data></Cell>\n`
  })
  xml += '      </Row>\n'

  // Datos
  datos.forEach(fila => {
    xml += '      <Row>\n'
    columnas.forEach(col => {
      const valor = fila[col] ?? ''
      const tipo = typeof valor === 'number' ? 'Number' : 'String'
      xml += `        <Cell><Data ss:Type="${tipo}">${escapeXml(String(valor))}</Data></Cell>\n`
    })
    xml += '      </Row>\n'
  })

  xml += '    </Table>\n'
  xml += '  </Worksheet>\n'
  xml += '</Workbook>'

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  descargarBlob(blob, `${nombreArchivo}.xls`)
}

// ═══════════════════════════════════════════════════════════════
// DESCARGA PDF - usando HTML convertido
// ═══════════════════════════════════════════════════════════════

export const descargarPDF = (datos, columnas, nombreArchivo = 'datos', titulo = 'Reporte de Datos') => {
  if (!datos || datos.length === 0) {
    alert('No hay datos para descargar')
    return
  }

  // Crear HTML para imprimir como PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #1e293b; font-size: 24px; margin-bottom: 10px; }
    .fecha { color: #64748b; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #1e293b; color: white; padding: 10px 8px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <h1>${titulo}</h1>
  <div class="fecha">Generado el ${new Date().toLocaleString('es-CL')}</div>
  <table>
    <thead>
      <tr>
        ${columnas.map(col => `<th>${col}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${datos.map(fila => `
        <tr>
          ${columnas.map(col => `<td>${fila[col] ?? '—'}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">
    Total de registros: ${datos.length} | Admin Panel - Your Friend
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
// DESCARGA HTML
// ═══════════════════════════════════════════════════════════════

export const descargarHTML = (datos, columnas, nombreArchivo = 'datos', titulo = 'Reporte de Datos') => {
  if (!datos || datos.length === 0) {
    alert('No hay datos para descargar')
    return
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #faf8f5; }
    h1 { color: #1e293b; font-size: 24px; margin-bottom: 10px; }
    .fecha { color: #64748b; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #3b82f6; color: white; padding: 12px 10px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    tr:hover { background: #f1f5f9; }
    .footer { margin-top: 20px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <h1>${titulo}</h1>
  <div class="fecha">Generado el ${new Date().toLocaleString('es-CL')}</div>
  <table>
    <thead>
      <tr>
        ${columnas.map(col => `<th>${col}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${datos.map(fila => `
        <tr>
          ${columnas.map(col => `<td>${fila[col] ?? '—'}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">
    Total de registros: ${datos.length} | Admin Panel - Your Friend
  </div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
  descargarBlob(blob, `${nombreArchivo}.html`)
}

// ═══════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════

const descargarBlob = (blob, nombreArchivo) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nombreArchivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const escapeXml = (str) => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ═══════════════════════════════════════════════════════════════
// FILTRAR POR RANGO DE FECHAS
// ═══════════════════════════════════════════════════════════════

export const filtrarPorFechas = (datos, campoFecha, fechaDesde, fechaHasta) => {
  if (!fechaDesde && !fechaHasta) return datos

  return datos.filter(item => {
    const fecha = new Date(item[campoFecha])
    if (fechaDesde && fecha < new Date(fechaDesde)) return false
    if (fechaHasta && fecha > new Date(fechaHasta + 'T23:59:59')) return false
    return true
  })
}

// ═══════════════════════════════════════════════════════════════
// PREPARAR DATOS PARA DESCARGA (desde array de objetos)
// ═══════════════════════════════════════════════════════════════

export const prepararDatosDescarga = (datos, mapeoColumnas) => {
  // mapeoColumnas: { nombreMostrar: 'nombreCampo' }
  const columnas = Object.keys(mapeoColumnas)
  const datosFormateados = datos.map(item => {
    const fila = {}
    columnas.forEach(col => {
      const campo = mapeoColumnas[col]
      let valor = item[campo]

      // Formatear fechas
      if (campo.includes('fecha') || campo.includes('creado') || campo === 'creado_en') {
        valor = valor ? new Date(valor).toLocaleString('es-CL') : ''
      }

      fila[col] = valor ?? ''
    })
    return fila
  })

  return { columnas, datos: datosFormateados }
}
