import { useState, useEffect } from 'react'
import {
  obtenerDatosMarca,
  obtenerTodasLasMarcas,
  agregarDato,
  modificarDato,
  desactivarDato
} from '../services/supabase'
import '../styles/EditorManual.css'

const EditorManual = ({ usuario, esSuperAdmin, onDatosActualizados }) => {
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [formEdicion, setFormEdicion] = useState({})
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false)
  const [formNuevo, setFormNuevo] = useState({
    categoria: '',
    clave: '',
    valor: '',
    prioridad: 3,
    fecha_inicio: '',
    fecha_caducidad: ''
  })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    cargarDatos()
  }, [usuario])

  const cargarDatos = async () => {
    setCargando(true)
    let resultado
    if (esSuperAdmin) {
      resultado = await obtenerTodasLasMarcas()
    } else {
      resultado = await obtenerDatosMarca(usuario.id_marca)
    }
    setDatos(resultado)
    setCargando(false)
  }

  // Obtener categorías únicas
  const categorias = [...new Set(datos.map(d => d.categoria))].filter(Boolean)

  // Filtrar datos
  const datosFiltrados = datos.filter(dato => {
    const coincideCategoria = filtroCategoria === 'todas' || dato.categoria === filtroCategoria
    const coincideBusqueda = !busqueda ||
      dato.clave?.toLowerCase().includes(busqueda.toLowerCase()) ||
      dato.valor?.toLowerCase().includes(busqueda.toLowerCase()) ||
      dato.categoria?.toLowerCase().includes(busqueda.toLowerCase())
    return coincideCategoria && coincideBusqueda
  })

  const mostrarMensaje = (texto, tipo = 'exito') => {
    setMensaje({ texto, tipo })
    setTimeout(() => setMensaje(null), 3000)
  }

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS DE EDICIÓN
  // ═══════════════════════════════════════════════════════════════

  const iniciarEdicion = (dato) => {
    setEditandoId(dato.id)
    setFormEdicion({
      categoria: dato.categoria || '',
      clave: dato.clave || '',
      valor: dato.valor || '',
      prioridad: dato.prioridad || 3,
      fecha_inicio: dato.fecha_inicio ? dato.fecha_inicio.split('T')[0] : '',
      fecha_caducidad: dato.fecha_caducidad ? dato.fecha_caducidad.split('T')[0] : ''
    })
  }

  const cancelarEdicion = () => {
    setEditandoId(null)
    setFormEdicion({})
  }

  const guardarEdicion = async () => {
    if (!formEdicion.clave || !formEdicion.valor) {
      mostrarMensaje('Clave y valor son requeridos', 'error')
      return
    }

    setGuardando(true)
    const resultado = await modificarDato(editandoId, {
      categoria: formEdicion.categoria,
      clave: formEdicion.clave,
      valor: formEdicion.valor,
      prioridad: parseInt(formEdicion.prioridad) || 3,
      fecha_inicio: formEdicion.fecha_inicio || null,
      fecha_caducidad: formEdicion.fecha_caducidad || null
    })

    if (resultado.success) {
      mostrarMensaje('Registro actualizado correctamente')
      await cargarDatos()
      onDatosActualizados?.()
      cancelarEdicion()
    } else {
      mostrarMensaje(resultado.error, 'error')
    }
    setGuardando(false)
  }

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS DE NUEVO REGISTRO
  // ═══════════════════════════════════════════════════════════════

  const guardarNuevo = async () => {
    if (!formNuevo.categoria || !formNuevo.clave || !formNuevo.valor) {
      mostrarMensaje('Categoría, clave y valor son requeridos', 'error')
      return
    }

    setGuardando(true)
    const resultado = await agregarDato({
      'ID marca': usuario.id_marca,
      'Nombre marca': usuario.nombre_marca,
      categoria: formNuevo.categoria,
      clave: formNuevo.clave,
      valor: formNuevo.valor,
      prioridad: parseInt(formNuevo.prioridad) || 3,
      fecha_inicio: formNuevo.fecha_inicio || null,
      fecha_caducidad: formNuevo.fecha_caducidad || null
    })

    if (resultado.success) {
      mostrarMensaje('Registro agregado correctamente')
      await cargarDatos()
      onDatosActualizados?.()
      setMostrarFormNuevo(false)
      setFormNuevo({
        categoria: '',
        clave: '',
        valor: '',
        prioridad: 3,
        fecha_inicio: '',
        fecha_caducidad: ''
      })
    } else {
      mostrarMensaje(resultado.error, 'error')
    }
    setGuardando(false)
  }

  // ═══════════════════════════════════════════════════════════════
  // HANDLER DE DESACTIVAR
  // ═══════════════════════════════════════════════════════════════

  const handleDesactivar = async (id) => {
    if (!window.confirm('¿Estás seguro de desactivar este registro?')) return

    setGuardando(true)
    const resultado = await desactivarDato(id)

    if (resultado.success) {
      mostrarMensaje('Registro desactivado')
      await cargarDatos()
      onDatosActualizados?.()
    } else {
      mostrarMensaje(resultado.error, 'error')
    }
    setGuardando(false)
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="editor-manual">
      {/* Header del Editor */}
      <div className="editor-header">
        <h2>Editor Manual</h2>
        <button
          className="btn-agregar"
          onClick={() => setMostrarFormNuevo(!mostrarFormNuevo)}
        >
          {mostrarFormNuevo ? '✕ Cancelar' : '+ Agregar'}
        </button>
      </div>

      {/* Mensaje de feedback */}
      {mensaje && (
        <div className={`editor-mensaje ${mensaje.tipo}`}>
          {mensaje.texto}
        </div>
      )}

      {/* Formulario para nuevo registro */}
      {mostrarFormNuevo && (
        <div className="form-nuevo">
          <h3>Nuevo Registro</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Categoría *</label>
              <input
                type="text"
                value={formNuevo.categoria}
                onChange={(e) => setFormNuevo({...formNuevo, categoria: e.target.value})}
                placeholder="ej: promociones, horarios..."
                list="categorias-list"
              />
              <datalist id="categorias-list">
                {categorias.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label>Clave *</label>
              <input
                type="text"
                value={formNuevo.clave}
                onChange={(e) => setFormNuevo({...formNuevo, clave: e.target.value})}
                placeholder="ej: descuento_navidad"
              />
            </div>
            <div className="form-group form-group-full">
              <label>Valor *</label>
              <textarea
                value={formNuevo.valor}
                onChange={(e) => setFormNuevo({...formNuevo, valor: e.target.value})}
                placeholder="Contenido del registro..."
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Prioridad</label>
              <select
                value={formNuevo.prioridad}
                onChange={(e) => setFormNuevo({...formNuevo, prioridad: e.target.value})}
              >
                <option value={1}>1 - Máxima</option>
                <option value={2}>2 - Alta</option>
                <option value={3}>3 - Normal</option>
                <option value={4}>4 - Baja</option>
                <option value={5}>5 - Mínima</option>
              </select>
            </div>
            <div className="form-group">
              <label>Fecha inicio</label>
              <input
                type="date"
                value={formNuevo.fecha_inicio}
                onChange={(e) => setFormNuevo({...formNuevo, fecha_inicio: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Fecha término</label>
              <input
                type="date"
                value={formNuevo.fecha_caducidad}
                onChange={(e) => setFormNuevo({...formNuevo, fecha_caducidad: e.target.value})}
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              className="btn-cancelar"
              onClick={() => setMostrarFormNuevo(false)}
            >
              Cancelar
            </button>
            <button
              className="btn-guardar"
              onClick={guardarNuevo}
              disabled={guardando}
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="editor-filtros">
        <div className="filtro-busqueda">
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="filtro-categoria">
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
          >
            <option value="todas">Todas las categorías</option>
            {categorias.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <button className="btn-refresh" onClick={cargarDatos} title="Actualizar">
          ↻
        </button>
      </div>

      {/* Lista de datos */}
      <div className="editor-lista">
        {cargando ? (
          <div className="editor-loading">Cargando datos...</div>
        ) : datosFiltrados.length === 0 ? (
          <div className="editor-empty">
            No hay datos que mostrar
          </div>
        ) : (
          datosFiltrados.map(dato => (
            <div key={dato.id} className={`editor-card ${editandoId === dato.id ? 'editando' : ''}`}>
              {editandoId === dato.id ? (
                // Modo edición
                <div className="card-edicion">
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Categoría</label>
                      <input
                        type="text"
                        value={formEdicion.categoria}
                        onChange={(e) => setFormEdicion({...formEdicion, categoria: e.target.value})}
                        list="categorias-edit-list"
                      />
                      <datalist id="categorias-edit-list">
                        {categorias.map(cat => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                    </div>
                    <div className="form-group">
                      <label>Clave</label>
                      <input
                        type="text"
                        value={formEdicion.clave}
                        onChange={(e) => setFormEdicion({...formEdicion, clave: e.target.value})}
                      />
                    </div>
                    <div className="form-group form-group-full">
                      <label>Valor</label>
                      <textarea
                        value={formEdicion.valor}
                        onChange={(e) => setFormEdicion({...formEdicion, valor: e.target.value})}
                        rows={3}
                      />
                    </div>
                    <div className="form-group">
                      <label>Prioridad</label>
                      <select
                        value={formEdicion.prioridad}
                        onChange={(e) => setFormEdicion({...formEdicion, prioridad: e.target.value})}
                      >
                        <option value={1}>1 - Máxima</option>
                        <option value={2}>2 - Alta</option>
                        <option value={3}>3 - Normal</option>
                        <option value={4}>4 - Baja</option>
                        <option value={5}>5 - Mínima</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Fecha inicio</label>
                      <input
                        type="date"
                        value={formEdicion.fecha_inicio}
                        onChange={(e) => setFormEdicion({...formEdicion, fecha_inicio: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label>Fecha término</label>
                      <input
                        type="date"
                        value={formEdicion.fecha_caducidad}
                        onChange={(e) => setFormEdicion({...formEdicion, fecha_caducidad: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button className="btn-cancelar" onClick={cancelarEdicion}>
                      Cancelar
                    </button>
                    <button
                      className="btn-guardar"
                      onClick={guardarEdicion}
                      disabled={guardando}
                    >
                      {guardando ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              ) : (
                // Modo visualización
                <>
                  <div className="card-header">
                    <span className="card-categoria">{dato.categoria}</span>
                    <span className="card-id">ID: {dato.id}</span>
                  </div>
                  <div className="card-body">
                    <div className="card-clave">{dato.clave}</div>
                    <div className="card-valor">{dato.valor}</div>
                  </div>
                  <div className="card-meta">
                    <span className="meta-prioridad" title="Prioridad">
                      P{dato.prioridad}
                    </span>
                    {dato.fecha_inicio && (
                      <span className="meta-fecha" title="Fecha inicio">
                        Desde: {new Date(dato.fecha_inicio).toLocaleDateString('es-CL')}
                      </span>
                    )}
                    {dato.fecha_caducidad && (
                      <span className="meta-fecha" title="Fecha término">
                        Hasta: {new Date(dato.fecha_caducidad).toLocaleDateString('es-CL')}
                      </span>
                    )}
                  </div>
                  <div className="card-actions">
                    <button
                      className="btn-editar"
                      onClick={() => iniciarEdicion(dato)}
                      title="Editar"
                    >
                      ⟋
                    </button>
                    <button
                      className="btn-desactivar"
                      onClick={() => handleDesactivar(dato.id)}
                      title="Desactivar"
                    >
                      ✕
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Contador */}
      <div className="editor-footer">
        {datosFiltrados.length} de {datos.length} registros
      </div>
    </div>
  )
}

export default EditorManual
