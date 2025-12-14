import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  obtenerDatosMarca,
  obtenerTodasLasMarcas,
  guardarMensajeChat,
  guardarLogAccion,
  agregarDato,
  modificarDato,
  desactivarDato,
  consultarComentarios
} from '../services/supabase'
import { procesarMensajeIA, chatDirectoIA } from '../services/openai'
import MensajeChat from '../components/MensajeChat'
import EditorManual from '../components/EditorManual'
import '../styles/Chat.css'

const Chat = () => {
  const [mensajes, setMensajes] = useState([])
  const [inputMensaje, setInputMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [datosMarca, setDatosMarca] = useState([])
  const [accionPendiente, setAccionPendiente] = useState(null)
  const [mostrarEditor, setMostrarEditor] = useState(true)
  const [modoChatIA, setModoChatIA] = useState(false)
  // Estado para navegacion movil: 'chat' | 'editor' | 'chatia'
  const [vistaMobile, setVistaMobile] = useState('chat')

  const { usuario, logout, sesionChatId, mensajesCount, incrementarMensajes, reiniciarChat, esSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!usuario) {
      navigate('/login')
      return
    }
    cargarDatosMarca()
    agregarMensajeBienvenida()
  }, [usuario])

  useEffect(() => {
    scrollToBottom()
  }, [mensajes])

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const cargarDatosMarca = async () => {
    let datos
    if (esSuperAdmin) {
      datos = await obtenerTodasLasMarcas()
    } else {
      datos = await obtenerDatosMarca(usuario.id_marca)
    }
    setDatosMarca(datos)
  }

  const agregarMensajeBienvenida = () => {
    const hora = new Date().getHours()
    let saludo = 'Buenos días'
    if (hora >= 12 && hora < 19) saludo = 'Buenas tardes'
    else if (hora >= 19) saludo = 'Buenas noches'

    const mensajeBienvenida = {
      rol: 'assistant',
      contenido: `${saludo}, ${usuario.nombre}.\n\nSoy tu asistente para administrar los datos de **${usuario.nombre_marca}**.\n\nPuedes hablarme en lenguaje natural, por ejemplo:\n\n• "Muéstrame toda mi información"\n• "Quiero agregar una promoción de 20% de descuento hasta fin de mes"\n• "Desactiva la promoción del día de la madre"\n• "Cambia la prioridad del ID 27 a 2"\n• "Muéstrame los comentarios inapropiados"\n• "Buscar comentarios que contengan insultos"`,
      tipo: 'texto',
      mostrarBotonModo: true,
      timestamp: new Date().toISOString()
    }
    setMensajes([mensajeBienvenida])
  }

  const agregarMensajeBienvenidaChatIA = () => {
    const mensajeBienvenida = {
      rol: 'assistant',
      contenido: `Bienvenido al **Modo ChatIA**\n\nAhora puedo ayudarte con cualquier tema:\n\n• Programación y código\n• Consultas generales\n• Ideas creativas\n• Explicaciones\n• Y mucho más...\n\nPregúntame lo que necesites.`,
      tipo: 'texto',
      mostrarBotonModo: true,
      timestamp: new Date().toISOString()
    }
    setMensajes([mensajeBienvenida])
  }

  const toggleModoChatIA = () => {
    setModoChatIA(!modoChatIA)
    setMensajes([])
    setAccionPendiente(null)
    if (!modoChatIA) {
      // Cambiando a modo ChatIA
      agregarMensajeBienvenidaChatIA()
    } else {
      // Volviendo a modo controlador
      agregarMensajeBienvenida()
    }
  }

  // Funcion para cambiar vista en movil
  const cambiarVistaMobile = (vista) => {
    setVistaMobile(vista)
    if (vista === 'chatia') {
      if (!modoChatIA) {
        setModoChatIA(true)
        setMensajes([])
        setAccionPendiente(null)
        agregarMensajeBienvenidaChatIA()
      }
    } else if (vista === 'chat' || vista === 'editor') {
      if (modoChatIA) {
        setModoChatIA(false)
        setMensajes([])
        setAccionPendiente(null)
        agregarMensajeBienvenida()
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MANEJO DE ENVÍO DE MENSAJES
  // ═══════════════════════════════════════════════════════════════

  const handleEnviarMensaje = async (e) => {
    e.preventDefault()
    
    if (!inputMensaje.trim() || enviando) return

    // Verificar límite de mensajes
    if (mensajesCount >= 20) {
      setMensajes(prev => [...prev, {
        rol: 'assistant',
        contenido: 'Has alcanzado el límite de 20 mensajes en esta sesión. Por favor, reinicia la conversación para continuar.',
        tipo: 'error',
        timestamp: new Date().toISOString()
      }])
      return
    }

    const textoMensaje = inputMensaje.trim()
    setInputMensaje('')
    setEnviando(true)
    incrementarMensajes()

    // Agregar mensaje del usuario
    const mensajeUsuario = {
      rol: 'user',
      contenido: textoMensaje,
      timestamp: new Date().toISOString()
    }
    setMensajes(prev => [...prev, mensajeUsuario])

    // Guardar en Supabase
    await guardarMensajeChat({
      usuario_id: usuario.id,
      sesion_id: sesionChatId,
      rol: 'user',
      contenido: textoMensaje
    })

    // Procesar con IA
    try {
      const historial = mensajes.map(m => ({
        rol: m.rol,
        contenido: m.contenido
      }))

      let respuesta

      // Usar función según el modo activo
      if (modoChatIA) {
        // Modo ChatIA: chat directo sin funciones de base de datos
        respuesta = await chatDirectoIA(textoMensaje, historial)
      } else {
        // Modo controlador: con funciones de base de datos
        respuesta = await procesarMensajeIA(textoMensaje, {
          nombreUsuario: usuario.nombre,
          nombreMarca: usuario.nombre_marca,
          idMarca: usuario.id_marca,
          esSuperAdmin,
          datosMarca,
          historial,
          accionPendienteActual: accionPendiente
        })
      }

      console.log('📥 Respuesta de IA:', respuesta)
      console.log('📋 Acción pendiente actual:', accionPendiente)

      // En modo ChatIA, solo mostramos la respuesta sin procesar acciones
      if (modoChatIA) {
        const mensajeRespuesta = {
          rol: 'assistant',
          contenido: respuesta.contenido,
          tipo: respuesta.tipo,
          timestamp: new Date().toISOString()
        }
        setMensajes(prev => [...prev, mensajeRespuesta])

        await guardarMensajeChat({
          usuario_id: usuario.id,
          sesion_id: sesionChatId,
          rol: 'assistant',
          contenido: respuesta.contenido,
          tipo_respuesta: 'chat_ia'
        })

        setEnviando(false)
        inputRef.current?.focus()
        return
      }

      // ═══════════════════════════════════════════════════════════════
      // MANEJO DE CONSULTA DE COMENTARIOS
      // ═══════════════════════════════════════════════════════════════

      if (respuesta.tipo === 'consultar_comentarios') {
        console.log('📝 Consultando comentarios con filtros:', respuesta.filtros)

        const filtros = {
          idMarca: esSuperAdmin ? null : usuario.id_marca,
          ...respuesta.filtros
        }

        const resultadoComentarios = await consultarComentarios(filtros)

        let mensajeResultado
        if (resultadoComentarios.success && resultadoComentarios.data.length > 0) {
          // Crear tabla con las columnas requeridas
          const columnas = ['ID', 'Comentario Original', 'Texto Publicacion', 'Respuesta Comentario', 'Mensaje Inbox', 'Fecha']
          const filas = resultadoComentarios.data.map(c => {
            const comentarioOrig = c.comentario_original || ''
            const textoPubli = c.texto_publicacion || ''
            const respuesta = c.respuesta_comentario || ''
            const inbox = c.mensaje_inbox || ''
            return [
              c.id,
              comentarioOrig.substring(0, 50) + (comentarioOrig.length > 50 ? '...' : '') || '—',
              textoPubli.substring(0, 50) + (textoPubli.length > 50 ? '...' : '') || '—',
              respuesta.substring(0, 50) + (respuesta.length > 50 ? '...' : '') || '—',
              inbox.substring(0, 50) + (inbox.length > 50 ? '...' : '') || '—',
              c.creado_en ? new Date(c.creado_en).toLocaleDateString('es-CL') : '—'
            ]
          })

          mensajeResultado = {
            rol: 'assistant',
            contenido: respuesta.mensaje || `Encontre ${resultadoComentarios.total} comentarios.`,
            tipo: 'tabla',
            datos: { columnas, filas },
            timestamp: new Date().toISOString()
          }
        } else if (resultadoComentarios.success && resultadoComentarios.data.length === 0) {
          mensajeResultado = {
            rol: 'assistant',
            contenido: 'No encontre comentarios con los filtros especificados.',
            tipo: 'texto',
            timestamp: new Date().toISOString()
          }
        } else {
          mensajeResultado = {
            rol: 'assistant',
            contenido: `Error consultando comentarios: ${resultadoComentarios.error}`,
            tipo: 'error',
            timestamp: new Date().toISOString()
          }
        }

        setMensajes(prev => [...prev, mensajeResultado])
        setEnviando(false)
        inputRef.current?.focus()
        return
      }

      // ═══════════════════════════════════════════════════════════════
      // MANEJO DE ACCIONES CONFIRMADAS (solo en modo controlador)
      // ═══════════════════════════════════════════════════════════════

      // Si es una acción confirmada CON ejecutar, ejecutarla
      if (respuesta.tipo === 'accion_confirmada' && respuesta.ejecutar) {
        console.log('🎬 Ejecutando acción desde respuesta.ejecutar:', respuesta.ejecutar)
        await ejecutarAccion(respuesta.ejecutar)
        return
      }

      // Si es una acción confirmada SIN ejecutar, pero tenemos acción pendiente guardada
      if (respuesta.tipo === 'accion_confirmada' && !respuesta.ejecutar && accionPendiente) {
        console.log('🔄 Ejecutando acción desde accionPendiente guardada:', accionPendiente)
        await ejecutarAccion({
          accion: accionPendiente.accion,
          parametros: accionPendiente.parametros
        })
        return
      }

      // ═══════════════════════════════════════════════════════════════
      // MANEJO DE CONFIRMACIONES PENDIENTES
      // ═══════════════════════════════════════════════════════════════

      // Si es una confirmación pendiente, guardar para referencia futura
      if (respuesta.tipo === 'confirmacion' && respuesta.accionPendiente) {
        console.log('💾 Guardando nueva acción pendiente:', respuesta.accionPendiente)
        setAccionPendiente(respuesta.accionPendiente)
      } else if (respuesta.tipo !== 'confirmacion' && respuesta.tipo !== 'accion_confirmada') {
        // Limpiar acción pendiente si la respuesta no es una confirmación ni ejecución
        // (el usuario cambió de tema)
        if (accionPendiente) {
          console.log('🧹 Limpiando acción pendiente (usuario cambió de tema)')
          setAccionPendiente(null)
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // AGREGAR RESPUESTA AL CHAT
      // ═══════════════════════════════════════════════════════════════

      const mensajeRespuesta = {
        rol: 'assistant',
        contenido: respuesta.contenido,
        tipo: respuesta.tipo,
        datos: respuesta.datos,
        timestamp: new Date().toISOString()
      }
      setMensajes(prev => [...prev, mensajeRespuesta])

      // Guardar en Supabase
      await guardarMensajeChat({
        usuario_id: usuario.id,
        sesion_id: sesionChatId,
        rol: 'assistant',
        contenido: respuesta.contenido,
        tipo_respuesta: respuesta.tipo,
        datos_extra: respuesta.datos || respuesta.accionPendiente
      })

    } catch (err) {
      console.error('Error procesando mensaje:', err)
      const mensajeError = {
        rol: 'assistant',
        contenido: `Ups, tuve un problema: ${err.message}`,
        tipo: 'error',
        timestamp: new Date().toISOString()
      }
      setMensajes(prev => [...prev, mensajeError])
    }

    setEnviando(false)
    inputRef.current?.focus()
  }

  // ═══════════════════════════════════════════════════════════════
  // EJECUTAR ACCIONES EN SUPABASE
  // ═══════════════════════════════════════════════════════════════

  const ejecutarAccion = async (ejecutar) => {
    const { accion, parametros } = ejecutar
    console.log('🎬 Ejecutando acción:', accion)
    console.log('📝 Parámetros:', JSON.stringify(parametros, null, 2))

    let resultado

    try {
      switch (accion) {
        case 'agregar':
          console.log('➕ Agregando nuevo registro...')
          resultado = await agregarDato({
            'ID marca': usuario.id_marca,
            'Nombre marca': usuario.nombre_marca,
            categoria: parametros.categoria,
            clave: parametros.clave,
            valor: parametros.valor,
            prioridad: parametros.prioridad || 3,
            fecha_inicio: parametros.fecha_inicio || null,
            fecha_caducidad: parametros.fecha_caducidad || null
          })
          break

        case 'modificar':
          console.log('✏️ Modificando registro ID:', parametros.id_fila)
          console.log('📋 Updates a aplicar:', parametros.updates)
          
          if (!parametros.id_fila) {
            throw new Error('No se especificó el ID del registro a modificar')
          }
          if (!parametros.updates || Object.keys(parametros.updates).length === 0) {
            throw new Error('No se especificaron los cambios a realizar')
          }
          
          resultado = await modificarDato(parametros.id_fila, parametros.updates)
          break

        case 'desactivar':
          console.log('🛑 Desactivando registro ID:', parametros.id_fila)
          
          if (!parametros.id_fila) {
            throw new Error('No se especificó el ID del registro a desactivar')
          }
          
          resultado = await desactivarDato(parametros.id_fila)
          break

        default:
          resultado = { success: false, error: `Acción no reconocida: ${accion}` }
      }

      console.log('📊 Resultado de la acción:', resultado)

      // Log de acción
      await guardarLogAccion({
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre,
        id_marca: usuario.id_marca,
        nombre_marca: usuario.nombre_marca,
        tipo_accion: accion,
        descripcion: JSON.stringify(parametros),
        exito: resultado.success,
        mensaje_resultado: resultado.success ? 'Éxito' : resultado.error
      })

      // Preparar mensaje de resultado
      let mensajeResultado

      if (resultado.success) {
        const datos = resultado.data

        // Construir tabla con el resultado
        const tablaResultado = {
          columnas: ['Campo', 'Valor'],
          filas: [
            ['ID', datos.id],
            ['Categoría', datos.categoria],
            ['Clave', datos.clave],
            ['Valor', datos.valor?.substring(0, 100) + (datos.valor?.length > 100 ? '...' : '')],
            ['Prioridad', datos.prioridad],
            ['Estado', datos.Estado ? '✅ Activo' : '❌ Inactivo'],
            ['Fecha inicio', datos.fecha_inicio ? new Date(datos.fecha_inicio).toLocaleDateString('es-CL') : '—'],
            ['Fecha término', datos.fecha_caducidad ? new Date(datos.fecha_caducidad).toLocaleDateString('es-CL') : '—']
          ]
        }

        const accionTexto = {
          'agregar': 'agregado',
          'modificar': 'modificado',
          'desactivar': 'desactivado'
        }[accion] || 'procesado'

        mensajeResultado = {
          rol: 'assistant',
          contenido: `Listo. El registro ha sido ${accionTexto} exitosamente.`,
          tipo: 'exito',
          datos: tablaResultado,
          timestamp: new Date().toISOString()
        }

        // Recargar datos de la marca para reflejar los cambios
        console.log('🔄 Recargando datos de la marca...')
        await cargarDatosMarca()
      } else {
        mensajeResultado = {
          rol: 'assistant',
          contenido: `No pude completar la acción: ${resultado.error}`,
          tipo: 'error',
          timestamp: new Date().toISOString()
        }
      }

      setMensajes(prev => [...prev, mensajeResultado])
      
      // Limpiar acción pendiente después de ejecutar
      setAccionPendiente(null)
      console.log('🧹 Acción pendiente limpiada')

    } catch (err) {
      console.error('❌ Error ejecutando acción:', err)
      const mensajeError = {
        rol: 'assistant',
        contenido: `Error ejecutando la acción: ${err.message}`,
        tipo: 'error',
        timestamp: new Date().toISOString()
      }
      setMensajes(prev => [...prev, mensajeError])
      setAccionPendiente(null)
    }

    setEnviando(false)
  }

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const handleReiniciarChat = () => {
    reiniciarChat()
    setMensajes([])
    setAccionPendiente(null)
    agregarMensajeBienvenida()
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviarMensaje(e)
    }
  }

  // Función para manejar respuestas rápidas desde los botones Sí/No
  const handleRespuestaRapida = async (respuesta) => {
    if (enviando) return

    setEnviando(true)
    incrementarMensajes()

    // Agregar mensaje del usuario
    const mensajeUsuario = {
      rol: 'user',
      contenido: respuesta,
      timestamp: new Date().toISOString()
    }
    setMensajes(prev => [...prev, mensajeUsuario])

    // Guardar en Supabase
    await guardarMensajeChat({
      usuario_id: usuario.id,
      sesion_id: sesionChatId,
      rol: 'user',
      contenido: respuesta
    })

    // Procesar la respuesta
    if (respuesta.toLowerCase() === 'sí' || respuesta.toLowerCase() === 'si') {
      // Ejecutar la acción pendiente
      if (accionPendiente) {
        await ejecutarAccion({
          accion: accionPendiente.accion,
          parametros: accionPendiente.parametros
        })
      } else {
        setEnviando(false)
      }
    } else {
      // Cancelar la acción
      const mensajeCancelado = {
        rol: 'assistant',
        contenido: 'Entendido, he cancelado la acción. ¿En qué más puedo ayudarte?',
        tipo: 'texto',
        timestamp: new Date().toISOString()
      }
      setMensajes(prev => [...prev, mensajeCancelado])
      setAccionPendiente(null)
      setEnviando(false)
    }
  }

  if (!usuario) return null

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="app-layout">
      {/* Header Global */}
      <header className="chat-header">
        <div className="header-left">
          <span className="header-logo">◈</span>
          <div className="header-info">
            <h1>Admin Panel - Your Friend</h1>
            <span className="header-marca">{usuario.nombre_marca}</span>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-name">{usuario.nombre}</span>
            {esSuperAdmin && <span className="badge-admin">Super Admin</span>}
          </div>
          {modoChatIA && (
            <span className="badge-modo-chat">◆ Modo ChatIA</span>
          )}
          {!modoChatIA && (
            <button
              onClick={() => setMostrarEditor(!mostrarEditor)}
              className={`btn-icon btn-toggle-editor desktop-only ${mostrarEditor ? 'active' : ''}`}
              title={mostrarEditor ? 'Ocultar editor' : 'Mostrar editor'}
            >
              ≡
            </button>
          )}
          <button onClick={handleReiniciarChat} className="btn-icon" title="Reiniciar chat">
            ↻
          </button>
          <button onClick={handleLogout} className="btn-icon btn-logout" title="Cerrar sesion">
            ⏻
          </button>
        </div>
      </header>

      {/* Layout principal dividido */}
      <div className="main-layout">
        {/* Panel izquierdo: Chat */}
        <div className={`chat-panel ${!mostrarEditor ? 'full-width' : ''} mobile-panel ${vistaMobile === 'chat' || vistaMobile === 'chatia' ? 'mobile-visible' : 'mobile-hidden'}`}>
          {/* Indicador de accion pendiente (solo en modo controlador) */}
          {!modoChatIA && accionPendiente && (
            <div className="accion-pendiente-indicator">
              <span>●</span>
              <span>Accion pendiente: <strong>{accionPendiente.accion}</strong></span>
              <span className="accion-id">
                {accionPendiente.accion === 'modificar' && accionPendiente.parametros?.id_fila &&
                  `(ID: ${accionPendiente.parametros.id_fila})`
                }
              </span>
            </div>
          )}

          {/* Mensajes */}
          <main className="chat-messages">
            {mensajes.map((mensaje, index) => (
              <MensajeChat
                key={index}
                mensaje={mensaje}
                modoChatIA={modoChatIA}
                onToggleModo={toggleModoChatIA}
                onRespuestaRapida={handleRespuestaRapida}
              />
            ))}

            {enviando && (
              <div className="mensaje-loading">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span>Pensando...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </main>

          {/* Input */}
          <footer className="chat-input-container">
            <div className="mensajes-restantes">
              {20 - mensajesCount} mensajes restantes
            </div>
            <form onSubmit={handleEnviarMensaje} className="chat-input-form">
              <textarea
                ref={inputRef}
                value={inputMensaje}
                onChange={(e) => setInputMensaje(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje..."
                disabled={enviando || mensajesCount >= 20}
                rows={1}
              />
              <button
                type="submit"
                disabled={enviando || !inputMensaje.trim() || mensajesCount >= 20}
                className="btn-enviar"
              >
                {enviando ? '...' : '→'}
              </button>
            </form>
          </footer>
        </div>

        {/* Panel derecho: Editor Manual (solo en modo controlador) */}
        {!modoChatIA && mostrarEditor && (
          <div className={`editor-panel mobile-panel ${vistaMobile === 'editor' ? 'mobile-visible' : 'mobile-hidden'}`}>
            <EditorManual
              usuario={usuario}
              esSuperAdmin={esSuperAdmin}
              onDatosActualizados={cargarDatosMarca}
            />
          </div>
        )}

        {/* Editor para movil cuando esta en vista editor pero modoChatIA esta activo */}
        {vistaMobile === 'editor' && modoChatIA && (
          <div className="editor-panel mobile-panel mobile-visible mobile-only">
            <EditorManual
              usuario={usuario}
              esSuperAdmin={esSuperAdmin}
              onDatosActualizados={cargarDatosMarca}
            />
          </div>
        )}

        {/* Boton flotante para alternar entre modos - SOLO DESKTOP */}
        <button
          className={`btn-flotante-modo desktop-only ${modoChatIA ? 'modo-controlador' : 'modo-chatia'}`}
          onClick={toggleModoChatIA}
        >
          <span className="btn-flotante-icon">{modoChatIA ? '◀' : '◆'}</span>
          <span className="btn-flotante-texto">
            {modoChatIA ? 'Volver al Controlador' : 'Modo ChatIA'}
          </span>
        </button>
      </div>

      {/* Barra de navegacion inferior - SOLO MOVIL */}
      <nav className="mobile-nav">
        <button
          className={`mobile-nav-btn ${vistaMobile === 'chat' ? 'active' : ''}`}
          onClick={() => cambiarVistaMobile('chat')}
        >
          <span className="mobile-nav-icon">◈</span>
          <span className="mobile-nav-label">Chat BD</span>
        </button>
        <button
          className={`mobile-nav-btn ${vistaMobile === 'editor' ? 'active' : ''}`}
          onClick={() => cambiarVistaMobile('editor')}
        >
          <span className="mobile-nav-icon">≡</span>
          <span className="mobile-nav-label">Editor</span>
        </button>
        <button
          className={`mobile-nav-btn ${vistaMobile === 'chatia' ? 'active' : ''}`}
          onClick={() => cambiarVistaMobile('chatia')}
        >
          <span className="mobile-nav-icon">◆</span>
          <span className="mobile-nav-label">Chat IA</span>
        </button>
      </nav>
    </div>
  )
}

export default Chat