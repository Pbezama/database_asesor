import { useState } from 'react'
import '../styles/MensajeChat.css'

const MensajeChat = ({ mensaje, onConfirmar, onCancelar }) => {
  const { rol, contenido, tipo, datos, tabla_preview, resumen } = mensaje
  const esUsuario = rol === 'user'

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZAR TABLA
  // ═══════════════════════════════════════════════════════════════
  
  const renderizarTabla = (tablaData, titulo = null) => {
    if (!tablaData || !tablaData.columnas || !tablaData.filas) return null

    return (
      <div className="tabla-container">
        {titulo && <div className="tabla-titulo">{titulo}</div>}
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
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZAR CONFIRMACIÓN
  // ═══════════════════════════════════════════════════════════════

  const renderizarConfirmacion = () => {
    return (
      <div className="confirmacion-container">
        <div className="confirmacion-header">
          <span className="confirmacion-icon">⚡</span>
          <span>Acción pendiente de confirmación</span>
        </div>
        
        {tabla_preview && renderizarTabla(tabla_preview, '📋 Vista previa de los cambios')}
        
        <div className="confirmacion-acciones">
          <span className="confirmacion-hint">
            Responde <strong>"sí"</strong> para confirmar o <strong>"no"</strong> para cancelar
          </span>
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
            <span className="exito-icon">✅</span>
            <div className="exito-texto">{contenido}</div>
          </div>
        )

      case 'error':
        return (
          <div className="mensaje-error">
            <span className="error-icon">❌</span>
            <div className="error-texto">{contenido}</div>
          </div>
        )

      case 'accion_confirmada':
        return (
          <div className="mensaje-procesando">
            <span className="procesando-icon">⏳</span>
            <div className="procesando-texto">{contenido}</div>
          </div>
        )

      case 'texto':
      default:
        // Procesar markdown básico para el texto
        return <div className="mensaje-texto">{procesarTexto(contenido)}</div>
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
        {esUsuario ? '👤' : '🤖'}
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