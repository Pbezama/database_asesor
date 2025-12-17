import { useState } from 'react'
import '../styles/PreviewCargaMasiva.css'

const PreviewCargaMasiva = ({
  datos,
  onConfirmar,
  onCancelar,
  progreso,
  nombreMarca
}) => {
  const [datosEditables, setDatosEditables] = useState(datos)

  const categorias = [
    { value: 'regla', label: 'Regla' },
    { value: 'promocion', label: 'Promocion' },
    { value: 'horario', label: 'Horario' },
    { value: 'info', label: 'Informacion' },
    { value: 'precio', label: 'Precio' },
    { value: 'estilo_respuesta', label: 'Estilo Respuesta' },
    { value: 'observacion', label: 'Observacion' },
    { value: 'contacto', label: 'Contacto' },
    { value: 'servicio', label: 'Servicio' },
    { value: 'prompt', label: 'Prompt' }
  ]

  const handleEditarCampo = (indice, campo, valor) => {
    setDatosEditables(prev => {
      const nuevos = [...prev]
      nuevos[indice] = { ...nuevos[indice], [campo]: valor }
      return nuevos
    })
  }

  const handleEliminarFila = (indice) => {
    setDatosEditables(prev => prev.filter((_, i) => i !== indice))
  }

  // Vista de progreso durante insercion - MEJORADA
  if (progreso) {
    return (
      <div className="preview-carga-masiva">
        <div className="preview-header progreso-activo">
          <div className="preview-titulo">
            <span className="preview-icon">...</span>
            <span>Insertando registros...</span>
          </div>
          <span className="preview-contador">{progreso.actual} de {progreso.total}</span>
        </div>

        {/* Barra de progreso */}
        <div className="progreso-barra-container">
          <div
            className="progreso-barra"
            style={{ width: `${progreso.porcentaje}%` }}
          />
        </div>

        {/* Log de inserciones */}
        <div className="progreso-log">
          {progreso.logs && progreso.logs.map((log, i) => (
            <div key={i} className={`log-item ${log.exito ? 'log-exito' : 'log-error'}`}>
              <span className="log-icon">{log.exito ? '✓' : '✕'}</span>
              <span className="log-numero">#{log.numero}</span>
              <span className="log-clave">{log.clave}</span>
              <span className="log-status">{log.exito ? 'OK' : 'ERROR'}</span>
            </div>
          ))}

          {/* Indicador de insercion actual */}
          {progreso.actual < progreso.total && (
            <div className="log-item log-procesando">
              <span className="log-icon spinning">...</span>
              <span className="log-numero">#{progreso.actual + 1}</span>
              <span className="log-clave">Procesando...</span>
            </div>
          )}
        </div>

        {/* Resumen de errores si hay */}
        {progreso.errores && progreso.errores.length > 0 && (
          <div className="progreso-errores">
            {progreso.errores.length} error(es) encontrado(s)
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="preview-carga-masiva">
      <div className="preview-header">
        <div className="preview-titulo">
          <span className="preview-icon">+</span>
          <span>Preview de Carga Masiva</span>
        </div>
        <span className="preview-contador">{datosEditables.length} registros</span>
      </div>

      <div className="preview-info">
        Los siguientes datos seran agregados a <strong>{nombreMarca}</strong>
      </div>

      {datosEditables.length === 0 ? (
        <div className="preview-vacio">
          No hay datos para agregar
        </div>
      ) : (
        <div className="preview-tabla-scroll">
          <table className="preview-tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Categoria</th>
                <th>Clave</th>
                <th>Valor</th>
                <th>Prioridad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {datosEditables.map((dato, i) => (
                <tr key={i}>
                  <td className="celda-numero">{i + 1}</td>
                  <td>
                    <select
                      value={dato.categoria}
                      onChange={(e) => handleEditarCampo(i, 'categoria', e.target.value)}
                      className="input-editable"
                    >
                      {categorias.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={dato.clave}
                      onChange={(e) => handleEditarCampo(i, 'clave', e.target.value)}
                      className="input-editable"
                    />
                  </td>
                  <td>
                    <textarea
                      value={dato.valor}
                      onChange={(e) => handleEditarCampo(i, 'valor', e.target.value)}
                      className="input-editable textarea-valor"
                      rows={2}
                    />
                  </td>
                  <td>
                    <select
                      value={dato.prioridad}
                      onChange={(e) => handleEditarCampo(i, 'prioridad', parseInt(e.target.value))}
                      className="input-editable input-prioridad"
                    >
                      <option value={1}>1 - Obligatorio</option>
                      <option value={2}>2 - Muy Importante</option>
                      <option value={3}>3 - Importante</option>
                      <option value={4}>4 - Normal</option>
                      <option value={5}>5 - Opcional</option>
                      <option value={6}>6 - Baja</option>
                    </select>
                  </td>
                  <td>
                    <button
                      className="btn-eliminar-fila"
                      onClick={() => handleEliminarFila(i)}
                      title="Eliminar este registro"
                    >
                      X
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="preview-acciones">
        <button className="btn-cancelar-masivo" onClick={onCancelar}>
          Cancelar
        </button>
        <button
          className="btn-confirmar-masivo"
          onClick={() => onConfirmar(datosEditables)}
          disabled={datosEditables.length === 0}
        >
          Confirmar e Insertar ({datosEditables.length})
        </button>
      </div>
    </div>
  )
}

export default PreviewCargaMasiva
