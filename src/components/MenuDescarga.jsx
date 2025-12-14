import { useState } from 'react'
import {
  descargarCSV,
  descargarJSON,
  descargarExcel,
  descargarPDF,
  descargarHTML,
  filtrarPorFechas,
  prepararDatosDescarga
} from '../services/downloadService'
import {
  analizarDatosMarca,
  analizarComentarios,
  generarInformePDF,
  descargarInformeTexto
} from '../services/analysisService'
import '../styles/MenuDescarga.css'

const MenuDescarga = ({
  datos,
  columnas,
  mapeoColumnas,
  nombreArchivo = 'datos',
  titulo = 'Datos',
  tipo = 'datos', // 'datos' | 'comentarios'
  nombreMarca = '',
  campoFecha = 'creado_en',
  mostrarAnalisisIA = true
}) => {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [modalFechas, setModalFechas] = useState(false)
  const [modalAnalisis, setModalAnalisis] = useState(false)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [accionPendiente, setAccionPendiente] = useState(null)
  const [analizando, setAnalizando] = useState(false)
  const [resultadoAnalisis, setResultadoAnalisis] = useState(null)
  const [errorAnalisis, setErrorAnalisis] = useState(null)

  // Preparar datos según el mapeo de columnas
  const obtenerDatosPreparados = (datosOriginales) => {
    if (mapeoColumnas) {
      return prepararDatosDescarga(datosOriginales, mapeoColumnas)
    }
    return { columnas, datos: datosOriginales }
  }

  // Filtrar datos por fecha si es necesario
  const obtenerDatosFiltrados = () => {
    if (fechaDesde || fechaHasta) {
      return filtrarPorFechas(datos, campoFecha, fechaDesde, fechaHasta)
    }
    return datos
  }

  // Ejecutar descarga
  const ejecutarDescarga = (formato) => {
    const datosFiltrados = obtenerDatosFiltrados()
    const { columnas: cols, datos: datosPrep } = obtenerDatosPreparados(datosFiltrados)

    const nombreConFecha = fechaDesde || fechaHasta
      ? `${nombreArchivo}_${fechaDesde || 'inicio'}_${fechaHasta || 'fin'}`
      : nombreArchivo

    switch (formato) {
      case 'csv':
        descargarCSV(datosPrep, cols, nombreConFecha)
        break
      case 'json':
        descargarJSON(datosFiltrados, nombreConFecha)
        break
      case 'excel':
        descargarExcel(datosPrep, cols, nombreConFecha)
        break
      case 'pdf':
        descargarPDF(datosPrep, cols, nombreConFecha, titulo)
        break
      case 'html':
        descargarHTML(datosPrep, cols, nombreConFecha, titulo)
        break
    }

    setMenuAbierto(false)
    setModalFechas(false)
    resetearFechas()
  }

  // Abrir modal de fechas
  const abrirModalFechas = (accion) => {
    setAccionPendiente(accion)
    setModalFechas(true)
    setMenuAbierto(false)
  }

  // Ejecutar análisis IA
  const ejecutarAnalisis = async () => {
    setAnalizando(true)
    setErrorAnalisis(null)
    setResultadoAnalisis(null)

    try {
      const datosFiltrados = obtenerDatosFiltrados()

      let resultado
      if (tipo === 'comentarios') {
        resultado = await analizarComentarios(datosFiltrados, nombreMarca)
      } else {
        resultado = await analizarDatosMarca(datosFiltrados, nombreMarca)
      }

      if (resultado.success) {
        setResultadoAnalisis(resultado)
      } else {
        setErrorAnalisis(resultado.error)
      }
    } catch (error) {
      setErrorAnalisis(error.message)
    }

    setAnalizando(false)
  }

  // Abrir modal de análisis
  const abrirModalAnalisis = () => {
    setModalAnalisis(true)
    setMenuAbierto(false)
    setResultadoAnalisis(null)
    setErrorAnalisis(null)
  }

  // Resetear fechas
  const resetearFechas = () => {
    setFechaDesde('')
    setFechaHasta('')
    setAccionPendiente(null)
  }

  // Cerrar modal
  const cerrarModal = () => {
    setModalFechas(false)
    setModalAnalisis(false)
    resetearFechas()
    setResultadoAnalisis(null)
    setErrorAnalisis(null)
  }

  // Continuar con acción pendiente
  const continuarAccion = () => {
    if (accionPendiente === 'analisis') {
      setModalFechas(false)
      setModalAnalisis(true)
    } else {
      ejecutarDescarga(accionPendiente)
    }
  }

  return (
    <div className="menu-descarga-container">
      {/* Botón principal */}
      <button
        className="btn-descarga-principal"
        onClick={() => setMenuAbierto(!menuAbierto)}
      >
        <span className="btn-icon-descarga">↓</span>
        Descargar
      </button>

      {/* Menú desplegable */}
      {menuAbierto && (
        <div className="menu-descarga-dropdown">
          <div className="menu-seccion">
            <div className="menu-seccion-titulo">Descargar Datos</div>
            <button onClick={() => abrirModalFechas('csv')}>
              <span className="formato-icon">📄</span> CSV
            </button>
            <button onClick={() => abrirModalFechas('excel')}>
              <span className="formato-icon">📊</span> Excel
            </button>
            <button onClick={() => abrirModalFechas('json')}>
              <span className="formato-icon">{ }</span> JSON
            </button>
            <button onClick={() => abrirModalFechas('pdf')}>
              <span className="formato-icon">📕</span> PDF
            </button>
            <button onClick={() => abrirModalFechas('html')}>
              <span className="formato-icon">🌐</span> HTML
            </button>
          </div>

          {mostrarAnalisisIA && (
            <div className="menu-seccion">
              <div className="menu-seccion-titulo">Análisis con IA</div>
              <button onClick={() => abrirModalFechas('analisis')} className="btn-analisis-ia">
                <span className="formato-icon">🤖</span> Generar Informe IA
              </button>
            </div>
          )}
        </div>
      )}

      {/* Overlay para cerrar menú */}
      {menuAbierto && (
        <div className="menu-overlay" onClick={() => setMenuAbierto(false)} />
      )}

      {/* Modal de selección de fechas */}
      {modalFechas && (
        <div className="modal-overlay">
          <div className="modal-descarga">
            <div className="modal-header">
              <h3>Seleccionar Rango de Fechas</h3>
              <button className="btn-cerrar-modal" onClick={cerrarModal}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-descripcion">
                Selecciona el rango de fechas para {accionPendiente === 'analisis' ? 'analizar' : 'descargar'}.
                Deja vacío para incluir todos los registros.
              </p>
              <div className="fechas-grid">
                <div className="fecha-grupo">
                  <label>Desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                  />
                </div>
                <div className="fecha-grupo">
                  <label>Hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-info">
                <span className="info-icon">ℹ</span>
                {obtenerDatosFiltrados().length} registros seleccionados
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancelar" onClick={cerrarModal}>
                Cancelar
              </button>
              <button
                className="btn-continuar"
                onClick={continuarAccion}
                disabled={obtenerDatosFiltrados().length === 0}
              >
                {accionPendiente === 'analisis' ? 'Continuar al Análisis' : 'Descargar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de análisis IA */}
      {modalAnalisis && (
        <div className="modal-overlay">
          <div className="modal-analisis">
            <div className="modal-header">
              <h3>
                {tipo === 'comentarios'
                  ? 'Análisis de Comentarios con IA'
                  : 'Análisis de Marca con IA'}
              </h3>
              <button className="btn-cerrar-modal" onClick={cerrarModal}>✕</button>
            </div>
            <div className="modal-body">
              {!resultadoAnalisis && !analizando && !errorAnalisis && (
                <div className="analisis-inicio">
                  <div className="analisis-icono">🤖</div>
                  <p>
                    {tipo === 'comentarios'
                      ? `Se analizarán ${obtenerDatosFiltrados().length} comentarios para generar un informe detallado con análisis de sentimiento, detección de problemas y recomendaciones.`
                      : `Se analizarán ${obtenerDatosFiltrados().length} registros de la marca para evaluar la comunicación, coherencia y ofrecer recomendaciones de mejora.`
                    }
                  </p>
                  <button className="btn-iniciar-analisis" onClick={ejecutarAnalisis}>
                    Iniciar Análisis
                  </button>
                </div>
              )}

              {analizando && (
                <div className="analisis-cargando">
                  <div className="spinner"></div>
                  <p>Analizando {tipo === 'comentarios' ? 'comentarios' : 'datos'}...</p>
                  <p className="texto-secundario">Esto puede tomar unos segundos</p>
                </div>
              )}

              {errorAnalisis && (
                <div className="analisis-error">
                  <div className="error-icono">✕</div>
                  <p>Error al generar el análisis</p>
                  <p className="texto-secundario">{errorAnalisis}</p>
                  <button className="btn-reintentar" onClick={ejecutarAnalisis}>
                    Reintentar
                  </button>
                </div>
              )}

              {resultadoAnalisis && (
                <div className="analisis-resultado">
                  <div className="resultado-exito">
                    <span className="exito-icono">✓</span>
                    Análisis completado exitosamente
                  </div>
                  <div className="resultado-preview">
                    <pre>{resultadoAnalisis.informe.substring(0, 500)}...</pre>
                  </div>
                  <div className="resultado-acciones">
                    <button
                      className="btn-descargar-informe"
                      onClick={() => generarInformePDF(resultadoAnalisis, tipo)}
                    >
                      📕 Ver/Imprimir PDF
                    </button>
                    <button
                      className="btn-descargar-texto"
                      onClick={() => descargarInformeTexto(resultadoAnalisis, tipo)}
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
    </div>
  )
}

export default MenuDescarga
