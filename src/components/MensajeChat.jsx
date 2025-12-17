import { useState, useMemo } from 'react'
import {
  descargarCSV,
  descargarJSON,
  descargarExcel,
  descargarPDF,
  descargarHTML,
  filtrarPorFechas
} from '../services/downloadService'
import {
  analizarComentarios,
  analizarDatosMarca,
  generarInformePDF,
  descargarInformeTexto
} from '../services/analysisService'
import '../styles/MensajeChat.css'

const MensajeChat = ({
  mensaje,
  onConfirmar,
  onCancelar,
  modoActivo,
  onToggleModo,
  onCambiarModo,
  onRespuestaRapida,
  onDelegacion,
  nombreMarca = '',
  usuario = null
}) => {
  const { rol, contenido, tipo, datos, tabla_preview, resumen, mostrarBotonModo, modoOrigen, delegacion, desde, hacia } = mensaje
  const esUsuario = rol === 'user'
  const [respondido, setRespondido] = useState(false)

  // Estados para tabla avanzada
  const [paginaTabla, setPaginaTabla] = useState(1)
  const [filasPorPagina, setFilasPorPagina] = useState(20)
  const [ordenColumna, setOrdenColumna] = useState(null)
  const [ordenDireccion, setOrdenDireccion] = useState('desc')
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroId, setFiltroId] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  // Estados para menú de descarga y análisis
  const [menuDescargaAbierto, setMenuDescargaAbierto] = useState(false)
  const [modalFechasDescarga, setModalFechasDescarga] = useState(false)
  const [formatoDescargaPendiente, setFormatoDescargaPendiente] = useState(null)
  const [fechaDescargaDesde, setFechaDescargaDesde] = useState('')
  const [fechaDescargaHasta, setFechaDescargaHasta] = useState('')
  const [modalAnalisis, setModalAnalisis] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [resultadoAnalisis, setResultadoAnalisis] = useState(null)
  const [errorAnalisis, setErrorAnalisis] = useState(null)

  // ═══════════════════════════════════════════════════════════════
  // PROCESAR DATOS DE TABLA
  // ═══════════════════════════════════════════════════════════════

  const procesarDatosTabla = (tablaData) => {
    if (!tablaData || !tablaData.columnas || !tablaData.filas) return { filas: [], total: 0 }

    // Convertir filas a objetos para facilitar el procesamiento
    let filasObj = tablaData.filas.map((fila, idx) => {
      const obj = { _index: idx }
      tablaData.columnas.forEach((col, i) => {
        obj[col] = fila[i]
      })
      return obj
    })

    // Filtrar por ID
    if (filtroId) {
      const idBuscar = filtroId.toLowerCase()
      filasObj = filasObj.filter(f => {
        const id = String(f['ID'] || f['id'] || '').toLowerCase()
        return id.includes(idBuscar)
      })
    }

    // Filtrar por texto
    if (filtroTexto) {
      const textoBuscar = filtroTexto.toLowerCase()
      filasObj = filasObj.filter(f => {
        return Object.values(f).some(val =>
          String(val || '').toLowerCase().includes(textoBuscar)
        )
      })
    }

    // Filtrar por fecha
    if (fechaDesde || fechaHasta) {
      const colFecha = tablaData.columnas.find(c =>
        c.toLowerCase().includes('fecha') || c.toLowerCase() === 'creado_en'
      )
      if (colFecha) {
        filasObj = filasObj.filter(f => {
          const fechaVal = f[colFecha]
          if (!fechaVal || fechaVal === '—') return false

          // Intentar parsear la fecha
          let fecha
          if (typeof fechaVal === 'string' && fechaVal.includes('/')) {
            // Formato dd/mm/yyyy
            const partes = fechaVal.split(/[\/\s,]/)
            fecha = new Date(partes[2], partes[1] - 1, partes[0])
          } else {
            fecha = new Date(fechaVal)
          }

          if (isNaN(fecha.getTime())) return true

          if (fechaDesde && fecha < new Date(fechaDesde)) return false
          if (fechaHasta && fecha > new Date(fechaHasta + 'T23:59:59')) return false
          return true
        })
      }
    }

    // Ordenar
    if (ordenColumna) {
      filasObj.sort((a, b) => {
        let valorA = a[ordenColumna]
        let valorB = b[ordenColumna]

        // Manejar valores nulos
        if (valorA === '—' || valorA === null || valorA === undefined) valorA = ''
        if (valorB === '—' || valorB === null || valorB === undefined) valorB = ''

        // Detectar si es número
        const numA = parseFloat(String(valorA).replace(/[^\d.-]/g, ''))
        const numB = parseFloat(String(valorB).replace(/[^\d.-]/g, ''))

        if (!isNaN(numA) && !isNaN(numB)) {
          return ordenDireccion === 'asc' ? numA - numB : numB - numA
        }

        // Ordenar como string
        const strA = String(valorA).toLowerCase()
        const strB = String(valorB).toLowerCase()

        if (strA < strB) return ordenDireccion === 'asc' ? -1 : 1
        if (strA > strB) return ordenDireccion === 'asc' ? 1 : -1
        return 0
      })
    }

    return { filasObj, total: filasObj.length }
  }

  // ═══════════════════════════════════════════════════════════════
  // FUNCIONES DE DESCARGA
  // ═══════════════════════════════════════════════════════════════

  // Abrir modal de fechas antes de descargar
  const abrirModalFechasDescarga = (formato) => {
    setFormatoDescargaPendiente(formato)
    setFechaDescargaDesde('')
    setFechaDescargaHasta('')
    setModalFechasDescarga(true)
    setMenuDescargaAbierto(false)
  }

  // Filtrar datos por fechas de descarga
  const filtrarDatosPorFechasDescarga = (filasObj, tablaData) => {
    if (!fechaDescargaDesde && !fechaDescargaHasta) return filasObj

    const colFecha = tablaData.columnas.find(c =>
      c.toLowerCase().includes('fecha') || c.toLowerCase() === 'creado_en'
    )
    if (!colFecha) return filasObj

    return filasObj.filter(f => {
      const fechaVal = f[colFecha]
      if (!fechaVal || fechaVal === '—') return false

      let fecha
      if (typeof fechaVal === 'string' && fechaVal.includes('/')) {
        const partes = fechaVal.split(/[\/\s,]/)
        fecha = new Date(partes[2], partes[1] - 1, partes[0])
      } else {
        fecha = new Date(fechaVal)
      }

      if (isNaN(fecha.getTime())) return true

      if (fechaDescargaDesde && fecha < new Date(fechaDescargaDesde)) return false
      if (fechaDescargaHasta && fecha > new Date(fechaDescargaHasta + 'T23:59:59')) return false
      return true
    })
  }

  // Contar registros con filtro de fecha
  const contarRegistrosFechaDescarga = (tablaData) => {
    if (!tablaData || !tablaData.filas) return 0
    const { filasObj } = procesarDatosTabla(tablaData)
    return filtrarDatosPorFechasDescarga(filasObj, tablaData).length
  }

  // Ejecutar descarga con fechas seleccionadas
  const ejecutarDescargaConFechas = (tablaData) => {
    const { filasObj } = procesarDatosTabla(tablaData)
    const filasFiltradas = filtrarDatosPorFechasDescarga(filasObj, tablaData)

    if (filasFiltradas.length === 0) {
      alert('No hay datos en el rango de fechas seleccionado')
      return
    }

    descargarTabla(formatoDescargaPendiente, tablaData, filasFiltradas)
    setModalFechasDescarga(false)
    setFormatoDescargaPendiente(null)
  }

  const descargarTabla = (formato, tablaData, filasObj) => {
    if (!tablaData || !filasObj || filasObj.length === 0) return

    // Usar las filas filtradas/ordenadas
    const datosParaDescargar = filasObj.map(f => {
      const obj = {}
      tablaData.columnas.forEach(col => {
        obj[col] = f[col]
      })
      return obj
    })

    const fechaSufijo = fechaDescargaDesde || fechaDescargaHasta
      ? `_${fechaDescargaDesde || 'inicio'}_${fechaDescargaHasta || 'fin'}`
      : `_${new Date().toISOString().split('T')[0]}`
    const nombreArchivo = `${nombreMarca || 'datos'}${fechaSufijo}`
    const titulo = `Datos - ${nombreMarca || 'Exportación'}`

    switch (formato) {
      case 'csv':
        descargarCSV(datosParaDescargar, tablaData.columnas, nombreArchivo)
        break
      case 'json':
        descargarJSON(datosParaDescargar, nombreArchivo)
        break
      case 'excel':
        descargarExcel(datosParaDescargar, tablaData.columnas, nombreArchivo)
        break
      case 'pdf':
        descargarPDF(datosParaDescargar, tablaData.columnas, nombreArchivo, titulo)
        break
      case 'html':
        descargarHTML(datosParaDescargar, tablaData.columnas, nombreArchivo, titulo)
        break
    }
    setMenuDescargaAbierto(false)
  }

  // ═══════════════════════════════════════════════════════════════
  // ANÁLISIS CON IA
  // ═══════════════════════════════════════════════════════════════

  const ejecutarAnalisis = async (tablaData, filasObj) => {
    setAnalizando(true)
    setErrorAnalisis(null)
    setResultadoAnalisis(null)

    try {
      // Convertir filas a formato para análisis
      const datosParaAnalizar = filasObj.map(f => {
        const obj = {}
        tablaData.columnas.forEach(col => {
          // Mapear nombres de columnas a campos
          if (col === 'ID') obj.id = f[col]
          else if (col.toLowerCase().includes('comentario')) obj.comentario_original = f[col]
          else if (col.toLowerCase().includes('texto')) obj.texto_publicacion = f[col]
          else if (col.toLowerCase().includes('respuesta')) obj.respuesta_comentario = f[col]
          else if (col.toLowerCase().includes('inbox')) obj.mensaje_inbox = f[col]
          else if (col.toLowerCase().includes('fecha')) obj.creado_en = f[col]
          else obj[col.toLowerCase().replace(/\s+/g, '_')] = f[col]
        })
        return obj
      })

      // Detectar si es tabla de comentarios o datos
      const esComentarios = tablaData.columnas.some(c =>
        c.toLowerCase().includes('comentario') ||
        c.toLowerCase().includes('inbox') ||
        c.toLowerCase().includes('respuesta')
      )

      let resultado
      if (esComentarios) {
        resultado = await analizarComentarios(datosParaAnalizar, nombreMarca)
      } else {
        resultado = await analizarDatosMarca(datosParaAnalizar, nombreMarca)
      }

      if (resultado.success) {
        setResultadoAnalisis({ ...resultado, tipo: esComentarios ? 'comentarios' : 'marca' })
      } else {
        setErrorAnalisis(resultado.error)
      }
    } catch (error) {
      setErrorAnalisis(error.message)
    }

    setAnalizando(false)
  }

  // ═══════════════════════════════════════════════════════════════
  // CAMBIAR ORDEN
  // ═══════════════════════════════════════════════════════════════

  const cambiarOrden = (columna) => {
    if (ordenColumna === columna) {
      setOrdenDireccion(ordenDireccion === 'asc' ? 'desc' : 'asc')
    } else {
      setOrdenColumna(columna)
      setOrdenDireccion('desc')
    }
    setPaginaTabla(1)
  }

  const iconoOrden = (columna) => {
    if (ordenColumna !== columna) return ''
    return ordenDireccion === 'asc' ? ' ↑' : ' ↓'
  }

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltroTexto('')
    setFiltroId('')
    setFechaDesde('')
    setFechaHasta('')
    setPaginaTabla(1)
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZAR TABLA CON TODAS LAS FUNCIONALIDADES
  // ═══════════════════════════════════════════════════════════════

  const renderizarTabla = (tablaData, titulo = null) => {
    if (!tablaData || !tablaData.columnas || !tablaData.filas) return null

    const { filasObj, total } = procesarDatosTabla(tablaData)
    const totalPaginas = Math.ceil(filasObj.length / filasPorPagina)
    const necesitaPaginacion = filasObj.length > filasPorPagina

    // Paginar
    const filasPaginadas = filasObj.slice(
      (paginaTabla - 1) * filasPorPagina,
      paginaTabla * filasPorPagina
    )

    // Detectar si tiene columna de fecha
    const tieneFecha = tablaData.columnas.some(c =>
      c.toLowerCase().includes('fecha') || c.toLowerCase() === 'creado_en'
    )

    // Detectar si tiene columna ID
    const tieneId = tablaData.columnas.some(c =>
      c.toLowerCase() === 'id'
    )

    const hayFiltrosActivos = filtroTexto || filtroId || fechaDesde || fechaHasta

    return (
      <div className="tabla-container tabla-avanzada">
        {/* Header con título y botones */}
        <div className="tabla-header-acciones">
          <div className="tabla-header-izq">
            {titulo && <div className="tabla-titulo">{titulo}</div>}
            <span className="tabla-contador">{filasObj.length} registros</span>
          </div>
          <div className="tabla-header-der">
            <button
              className={`btn-filtros-tabla ${mostrarFiltros ? 'activo' : ''}`}
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
            >
              ⚙ Filtros
            </button>
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
                    <div className="menu-seccion-titulo">Exportar datos</div>
                    <button onClick={() => abrirModalFechasDescarga('csv')}>📄 CSV</button>
                    <button onClick={() => abrirModalFechasDescarga('excel')}>📊 Excel</button>
                    <button onClick={() => abrirModalFechasDescarga('json')}>{ } JSON</button>
                    <button onClick={() => abrirModalFechasDescarga('pdf')}>📕 PDF</button>
                    <button onClick={() => abrirModalFechasDescarga('html')}>🌐 HTML</button>
                    {nombreMarca && (
                      <>
                        <div className="menu-seccion-titulo">Análisis IA</div>
                        <button
                          className="btn-analisis-menu"
                          onClick={() => {
                            setMenuDescargaAbierto(false)
                            setFechaDescargaDesde('')
                            setFechaDescargaHasta('')
                            setModalAnalisis(true)
                          }}
                        >
                          🤖 Generar Informe IA
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Panel de filtros */}
        {mostrarFiltros && (
          <div className="tabla-filtros-panel">
            <div className="filtros-grid">
              {tieneId && (
                <div className="filtro-grupo">
                  <label>Filtrar por ID</label>
                  <input
                    type="text"
                    placeholder="Ej: 123"
                    value={filtroId}
                    onChange={(e) => {
                      setFiltroId(e.target.value)
                      setPaginaTabla(1)
                    }}
                  />
                </div>
              )}
              <div className="filtro-grupo filtro-texto">
                <label>Buscar en texto</label>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={filtroTexto}
                  onChange={(e) => {
                    setFiltroTexto(e.target.value)
                    setPaginaTabla(1)
                  }}
                />
              </div>
              {tieneFecha && (
                <>
                  <div className="filtro-grupo">
                    <label>Desde</label>
                    <input
                      type="date"
                      value={fechaDesde}
                      onChange={(e) => {
                        setFechaDesde(e.target.value)
                        setPaginaTabla(1)
                      }}
                    />
                  </div>
                  <div className="filtro-grupo">
                    <label>Hasta</label>
                    <input
                      type="date"
                      value={fechaHasta}
                      onChange={(e) => {
                        setFechaHasta(e.target.value)
                        setPaginaTabla(1)
                      }}
                    />
                  </div>
                </>
              )}
              <div className="filtro-grupo">
                <label>Filas por página</label>
                <select
                  value={filasPorPagina}
                  onChange={(e) => {
                    setFilasPorPagina(Number(e.target.value))
                    setPaginaTabla(1)
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            {hayFiltrosActivos && (
              <button className="btn-limpiar-filtros" onClick={limpiarFiltros}>
                ✕ Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* Info de paginación */}
        {filasObj.length > 0 && (
          <div className="tabla-info-paginacion">
            Mostrando {((paginaTabla - 1) * filasPorPagina) + 1}-{Math.min(paginaTabla * filasPorPagina, filasObj.length)} de {filasObj.length}
            {hayFiltrosActivos && ` (filtrado de ${tablaData.filas.length} totales)`}
          </div>
        )}

        {/* Tabla */}
        <div className="tabla-scroll">
          <table className="tabla-datos">
            <thead>
              <tr>
                {tablaData.columnas.map((col, i) => (
                  <th
                    key={i}
                    className="th-ordenable"
                    onClick={() => cambiarOrden(col)}
                  >
                    {col}{iconoOrden(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasPaginadas.length === 0 ? (
                <tr>
                  <td colSpan={tablaData.columnas.length} className="celda-vacia-mensaje">
                    No hay datos que coincidan con los filtros
                  </td>
                </tr>
              ) : (
                filasPaginadas.map((fila, i) => (
                  <tr key={fila._index}>
                    {tablaData.columnas.map((col, j) => (
                      <td key={j}>
                        {fila[col] === null || fila[col] === undefined || fila[col] === 'N/A' || fila[col] === ''
                          ? <span className="celda-vacia">—</span>
                          : String(fila[col])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Controles de paginación */}
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
              Página {paginaTabla} de {totalPaginas || 1}
            </span>
            <button
              className="btn-paginacion"
              onClick={() => setPaginaTabla(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaTabla >= totalPaginas}
            >
              Siguiente →
            </button>
          </div>
        )}

        {/* Modal de análisis IA */}
        {modalAnalisis && (
          <div className="modal-overlay-chat" onClick={() => setModalAnalisis(false)}>
            <div className="modal-analisis-chat" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Análisis con IA</h3>
                <button className="btn-cerrar-modal" onClick={() => setModalAnalisis(false)}>✕</button>
              </div>
              <div className="modal-body">
                {!resultadoAnalisis && !analizando && !errorAnalisis && (
                  <div className="analisis-inicio">
                    <div className="analisis-icono">🤖</div>
                    <p>
                      Se analizarán {filasObj.length} registros para generar un informe
                      detallado con recomendaciones y puntuaciones.
                    </p>
                    <button
                      className="btn-iniciar-analisis"
                      onClick={() => ejecutarAnalisis(tablaData, filasObj)}
                    >
                      Iniciar Análisis
                    </button>
                  </div>
                )}

                {analizando && (
                  <div className="analisis-cargando">
                    <div className="spinner"></div>
                    <p>Analizando datos...</p>
                    <p className="texto-secundario">Esto puede tomar unos segundos</p>
                  </div>
                )}

                {errorAnalisis && (
                  <div className="analisis-error">
                    <div className="error-icono">✕</div>
                    <p>Error al generar el análisis</p>
                    <p className="texto-secundario">{errorAnalisis}</p>
                    <button
                      className="btn-reintentar"
                      onClick={() => ejecutarAnalisis(tablaData, filasObj)}
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {resultadoAnalisis && (
                  <div className="analisis-resultado">
                    <div className="resultado-exito">
                      <span className="exito-icono">✓</span>
                      Análisis completado
                    </div>
                    <div className="resultado-preview">
                      <pre>{resultadoAnalisis.informe.substring(0, 500)}...</pre>
                    </div>
                    <div className="resultado-acciones">
                      <button
                        className="btn-descargar-informe"
                        onClick={() => generarInformePDF(resultadoAnalisis, resultadoAnalisis.tipo)}
                      >
                        📕 Ver/Imprimir PDF
                      </button>
                      <button
                        className="btn-descargar-texto"
                        onClick={() => descargarInformeTexto(resultadoAnalisis, resultadoAnalisis.tipo)}
                      >
                        📄 Descargar TXT
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de selección de fechas para descarga */}
        {modalFechasDescarga && (
          <div className="modal-overlay-chat" onClick={() => setModalFechasDescarga(false)}>
            <div className="modal-fechas-descarga" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Seleccionar Rango de Fechas</h3>
                <button
                  className="btn-cerrar-modal"
                  onClick={() => setModalFechasDescarga(false)}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <p className="modal-descripcion">
                  Selecciona el rango de fechas para descargar.
                  Deja vacío para incluir todos los registros.
                </p>
                <div className="fechas-grid">
                  <div className="fecha-grupo">
                    <label>Desde</label>
                    <input
                      type="date"
                      value={fechaDescargaDesde}
                      onChange={(e) => setFechaDescargaDesde(e.target.value)}
                    />
                  </div>
                  <div className="fecha-grupo">
                    <label>Hasta</label>
                    <input
                      type="date"
                      value={fechaDescargaHasta}
                      onChange={(e) => setFechaDescargaHasta(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-info">
                  <span className="info-icon">ℹ</span>
                  {contarRegistrosFechaDescarga(tablaData)} registros seleccionados
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn-cancelar"
                  onClick={() => setModalFechasDescarga(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn-continuar"
                  onClick={() => ejecutarDescargaConFechas(tablaData)}
                  disabled={contarRegistrosFechaDescarga(tablaData) === 0}
                >
                  Descargar {formatoDescargaPendiente?.toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZAR TABLA SIMPLE (sin controles de descarga/filtros)
  // ═══════════════════════════════════════════════════════════════

  const renderizarTablaSimple = (tablaData) => {
    if (!tablaData || !tablaData.columnas || !tablaData.filas) return null

    return (
      <div className="tabla-container tabla-simple">
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
              {tablaData.filas.map((fila, i) => (
                <tr key={i}>
                  {fila.map((celda, j) => (
                    <td key={j}>
                      {celda === null || celda === undefined || celda === 'N/A' || celda === ''
                        ? <span className="celda-vacia">—</span>
                        : String(celda)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    if (esUsuario) {
      return <div className="mensaje-texto">{contenido}</div>
    }

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
            {datos && renderizarTablaSimple(datos)}
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

    const lineas = texto.split('\n')

    return lineas.map((linea, i) => {
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
  // RENDERIZAR SEPARADOR DE CAMBIO DE MODO
  // ═══════════════════════════════════════════════════════════════

  // Obtener icono según modo
  const obtenerIconoModo = (modo) => {
    switch (modo) {
      case 'chatia': return '◆'
      default: return '◈'
    }
  }

  const renderizarSeparador = () => {
    return (
      <div className={`mensaje-separador separador-a-${modoOrigen}`}>
        <div className="separador-linea">
          <span className="separador-texto">
            {obtenerIconoModo(modoOrigen)} {contenido}
          </span>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZAR DELEGACION AUTOMATICA
  // ═══════════════════════════════════════════════════════════════

  const renderizarDelegacion = () => {
    return (
      <div className={`mensaje-delegacion delegacion-${desde}-a-${hacia}`}>
        <div className="delegacion-contenido">
          <span className="delegacion-icono">→</span>
          <span className="delegacion-texto">{contenido}</span>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZAR SUGERENCIA DE DELEGACION
  // ═══════════════════════════════════════════════════════════════

  // Obtener nombre de agente para mostrar
  const obtenerNombreAgente = (agentId) => {
    switch (agentId) {
      case 'chatia': return 'ChatIA'
      case 'controlador': return 'Controlador'
      default: return agentId
    }
  }

  const renderizarSugerenciaDelegacion = () => {
    if (!delegacion?.sugerida) return null

    return (
      <div className={`mensaje-sugerencia-delegacion delegacion-a-${delegacion.agenteDestino}`}>
        <p className="delegacion-razon">{delegacion.razon}</p>
        <button
          className={`btn-delegar btn-delegar-${delegacion.agenteDestino}`}
          onClick={() => onDelegacion && onDelegacion(delegacion)}
        >
          → Delegar a {obtenerNombreAgente(delegacion.agenteDestino)}
        </button>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════

  // Renderizar separador si es tipo separador
  if (tipo === 'separador') {
    return renderizarSeparador()
  }

  // Renderizar delegacion si es tipo delegacion
  if (tipo === 'delegacion') {
    return renderizarDelegacion()
  }

  // Clase adicional por modo de origen
  const claseModo = modoOrigen ? `mensaje-modo-${modoOrigen}` : ''

  return (
    <div className={`mensaje ${esUsuario ? 'mensaje-usuario' : 'mensaje-asistente'} ${tipo ? `mensaje-tipo-${tipo}` : ''} ${claseModo}`}>
      <div className="mensaje-avatar">
        {esUsuario ? '◯' : obtenerIconoModo(modoOrigen)}
      </div>
      <div className="mensaje-contenido">
        {renderizarContenido()}
        {renderizarSugerenciaDelegacion()}
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
