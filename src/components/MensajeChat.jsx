import { useState } from 'react'
import {
  descargarCSV,
  descargarJSON,
  descargarExcel,
  descargarPDF,
  descargarHTML
} from '../services/downloadService'
import '../styles/MensajeChat.css'

const FILAS_POR_PAGINA = 20

const MensajeChat = ({ mensaje, onConfirmar, onCancelar, modoChatIA, onToggleModo, onRespuestaRapida }) => {
  const { rol, contenido, tipo, datos, tabla_preview, resumen, mostrarBotonModo } = mensaje
  const esUsuario = rol === 'user'
  const [respondido, setRespondido] = useState(false)
  const [paginaTabla, setPaginaTabla] = useState(1)
  const [menuDescargaAbierto, setMenuDescargaAbierto] = useState(false)

  // Función para descargar tabla
  const descargarTabla = (formato, tablaData) => {
    if (!tablaData || !tablaData.columnas || !tablaData.filas) return

    // Convertir filas a objetos
    const datosObj = tablaData.filas.map(fila => {
      const obj = {}
      tablaData.columnas.forEach((col, i) => {
        obj[col] = fila[i]
      })
      return obj
    })

    const nombreArchivo = `datos_${new Date().toISOString().split('T')[0]}`

    switch (formato) {
      case 'csv':
        descargarCSV(datosObj, tablaData.columnas, nombreArchivo)
        break
      case 'json':
        descargarJSON(datosObj, nombreArchivo)
        break
      case 'excel':
        descargarExcel(datosObj, tablaData.columnas, nombreArchivo)
        break
      case 'pdf':
        descargarPDF(datosObj, tablaData.columnas, nombreArchivo, 'Datos del Chat')
        break
      case 'html':
        descargarHTML(datosObj, tablaData.columnas, nombreArchivo, 'Datos del Chat')
        break
    }
    setMenuDescargaAbierto(false)
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZAR TABLA CON PAGINACION
  // ═══════════════════════════════════════════════════════════════

  const renderizarTabla = (tablaData, titulo = null) => {
    if (!tablaData || !tablaData.columnas || !tablaData.filas) return null

    const totalFilas = tablaData.filas.length
    const totalPaginas = Math.ceil(totalFilas / FILAS_POR_PAGINA)
    const necesitaPaginacion = totalFilas > FILAS_POR_PAGINA

    // Calcular filas a mostrar
    const filasPaginadas = necesitaPaginacion
      ? tablaData.filas.slice(
          (paginaTabla - 1) * FILAS_POR_PAGINA,
          paginaTabla * FILAS_POR_PAGINA
        )
      : tablaData.filas

    return (
      <div className="tabla-container">
        <div className="tabla-header-acciones">
          {titulo && <div className="tabla-titulo">{titulo}</div>}
          {totalFilas > 0 && (
            <div className="tabla-descarga-container">
              <button
                className="btn-descarga-tabla"
                onClick={() => setMenuDescargaAbierto(!menuDescargaAbierto)}
              >
                ↓ Descargar
              </button>
              {menuDescargaAbierto && (
                <>
                  <div className="menu-descarga-overlay" onClick={() => setMenuDescargaAbierto(false)} />
                  <div className="menu-descarga-tabla">
                    <button onClick={() => descargarTabla('csv', tablaData)}>📄 CSV</button>
                    <button onClick={() => descargarTabla('excel', tablaData)}>📊 Excel</button>
                    <button onClick={() => descargarTabla('json', tablaData)}>{ } JSON</button>
                    <button onClick={() => descargarTabla('pdf', tablaData)}>📕 PDF</button>
                    <button onClick={() => descargarTabla('html', tablaData)}>🌐 HTML</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {necesitaPaginacion && (
          <div className="tabla-info-paginacion">
            Mostrando {((paginaTabla - 1) * FILAS_POR_PAGINA) + 1}-{Math.min(paginaTabla * FILAS_POR_PAGINA, totalFilas)} de {totalFilas} registros
          </div>
        )}
        <div className="tabla-scroll">
          <table className="tabla-datos">
            <thead>
              <tr>
                {tablaData.columnas.map((col, i) => (
                  <th key={i}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasPaginadas.map((fila, i) => (
                <tr key={i}>
                  {fila.map((celda, j) => (
                    <td key={j}>
                      {celda === null || celda === undefined || celda === 'N/A'
                        ? <span className="celda-vacia">—</span>
                        : String(celda)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Controles de paginacion */}
        {necesitaPaginacion && (
          <div className="paginacion-controles">
            <button
              className="btn-paginacion"
              onClick={() => setPaginaTabla(p => Math.max(1, p - 1))}
              disabled={paginaTabla === 1}
            >
              ← Anterior
            </button>
            <span className="paginacion-info">
              Página {paginaTabla} de {totalPaginas}
            </span>
            <button
              className="btn-paginacion"
              onClick={() => setPaginaTabla(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaTabla === totalPaginas}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZAR CONFIRMACIÓN
  // ═══════════════════════════════════════════════════════════════

  const handleRespuestaRapida = (respuesta) => {
    if (respondido) return
    setRespondido(true)
    if (onRespuestaRapida) {
      onRespuestaRapida(respuesta)
    }
  }

  const renderizarConfirmacion = () => {
    return (
      <div className="confirmacion-container">
        <div className="confirmacion-header">
          <span className="confirmacion-icon">●</span>
          <span>Acción pendiente de confirmación</span>
        </div>

        {tabla_preview && renderizarTabla(tabla_preview, 'Vista previa de los cambios')}

        <div className="confirmacion-acciones">
          {!respondido ? (
            <div className="confirmacion-botones">
              <button
                className="btn-confirmar btn-si"
                onClick={() => handleRespuestaRapida('sí')}
              >
                Confirmar
              </button>
              <button
                className="btn-confirmar btn-no"
                onClick={() => handleRespuestaRapida('no')}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <span className="confirmacion-respondido">
              Respuesta enviada
            </span>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZAR CONTENIDO SEGÚN TIPO
  // ═══════════════════════════════════════════════════════════════

  const renderizarContenido = () => {
    // Si es mensaje de usuario, solo mostrar texto
    if (esUsuario) {
      return <div className="mensaje-texto">{contenido}</div>
    }

    // Según el tipo de respuesta
    switch (tipo) {
      case 'tabla':
        return (
          <>
            {contenido && <div className="mensaje-texto">{contenido}</div>}
            {datos && renderizarTabla(datos)}
          </>
        )

      case 'confirmacion':
        return (
          <>
            {contenido && <div className="mensaje-texto">{contenido}</div>}
            {renderizarConfirmacion()}
          </>
        )

      case 'exito':
        return (
          <div className="mensaje-exito">
            <span className="exito-icon">✓</span>
            <div className="exito-texto">{contenido}</div>
          </div>
        )

      case 'error':
        return (
          <div className="mensaje-error">
            <span className="error-icon">✕</span>
            <div className="error-texto">{contenido}</div>
          </div>
        )

      case 'accion_confirmada':
        return (
          <div className="mensaje-procesando">
            <span className="procesando-icon">◌</span>
            <div className="procesando-texto">{contenido}</div>
          </div>
        )

      case 'texto':
      default:
        // Procesar markdown básico para el texto
        return (
          <div className="mensaje-texto">{procesarTexto(contenido)}</div>
        )
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PROCESAR TEXTO (markdown básico)
  // ═══════════════════════════════════════════════════════════════

  const procesarTexto = (texto) => {
    if (!texto) return null
    
    // Convertir **texto** a negrita y dividir por saltos de línea
    const lineas = texto.split('\n')
    
    return lineas.map((linea, i) => {
      // Procesar negritas
      const partes = linea.split(/(\*\*[^*]+\*\*)/g)
      const contenidoLinea = partes.map((parte, j) => {
        if (parte.startsWith('**') && parte.endsWith('**')) {
          return <strong key={j}>{parte.slice(2, -2)}</strong>
        }
        return parte
      })

      return (
        <span key={i}>
          {contenidoLinea}
          {i < lineas.length - 1 && <br />}
        </span>
      )
    })
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className={`mensaje ${esUsuario ? 'mensaje-usuario' : 'mensaje-asistente'} ${tipo ? `mensaje-tipo-${tipo}` : ''}`}>
      <div className="mensaje-avatar">
        {esUsuario ? '◯' : '◈'}
      </div>
      <div className="mensaje-contenido">
        {renderizarContenido()}
        <div className="mensaje-timestamp">
          {new Date(mensaje.timestamp).toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  )
}

export default MensajeChat