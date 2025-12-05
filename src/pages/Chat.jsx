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
  desactivarDato 
} from '../services/supabase'
import { procesarMensajeIA } from '../services/openai'
import MensajeChat from '../components/MensajeChat'
import '../styles/Chat.css'

const Chat = () => {
  const [mensajes, setMensajes] = useState([])
  const [inputMensaje, setInputMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [datosMarca, setDatosMarca] = useState([])
  const [accionPendiente, setAccionPendiente] = useState(null)
  
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
      contenido: `¡${saludo}, ${usuario.nombre}! 👋\n\nSoy tu asistente para administrar los datos de **${usuario.nombre_marca}**.\n\nPuedes hablarme en lenguaje natural, por ejemplo:\n\n• "Muéstrame toda mi información"\n• "Quiero agregar una promoción de 20% de descuento hasta fin de mes"\n• "Desactiva la promoción del día de la madre"\n• "Agrega una regla: no se permiten mascotas sin correa"`,
      tipo: 'texto',
      timestamp: new Date().toISOString()
    }
    setMensajes([mensajeBienvenida])
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

      const respuesta = await procesarMensajeIA(textoMensaje, {
        nombreUsuario: usuario.nombre,
        nombreMarca: usuario.nombre_marca,
        idMarca: usuario.id_marca,
        esSuperAdmin,
        datosMarca,
        historial
      })

      console.log('📥 Respuesta de IA:', respuesta)

      // Si es una acción confirmada, ejecutarla automáticamente
      if (respuesta.tipo === 'accion_confirmada' && respuesta.ejecutar) {
        await ejecutarAccion(respuesta.ejecutar)
        return
      }

      // Si es una confirmación pendiente, guardar para referencia
      if (respuesta.tipo === 'confirmacion' && respuesta.resumen) {
        setAccionPendiente(respuesta.resumen)
      }

      // Agregar respuesta al chat
      const mensajeRespuesta = {
        rol: 'assistant',
        contenido: respuesta.contenido,
        tipo: respuesta.tipo,
        datos: respuesta.datos,
        tabla_preview: respuesta.tabla_preview,
        resumen: respuesta.resumen,
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
        datos_extra: respuesta.datos || respuesta.tabla_preview || respuesta.resumen
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
    console.log('🎬 Ejecutando acción:', accion, parametros)

    let resultado

    try {
      switch (accion) {
        case 'agregar':
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
          resultado = await modificarDato(parametros.id_fila, parametros.updates)
          break

        case 'desactivar':
          resultado = await desactivarDato(parametros.id_fila)
          break

        default:
          resultado = { success: false, error: 'Acción no reconocida' }
      }

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
            ['Fecha vencimiento', datos.fecha_caducidad ? new Date(datos.fecha_caducidad).toLocaleDateString('es-CL') : '—']
          ]
        }

        const accionTexto = {
          'agregar': 'agregado',
          'modificar': 'modificado',
          'desactivar': 'desactivado'
        }[accion] || 'procesado'

        mensajeResultado = {
          rol: 'assistant',
          contenido: `¡Listo! El registro ha sido ${accionTexto} exitosamente. 🎉`,
          tipo: 'exito',
          datos: tablaResultado,
          timestamp: new Date().toISOString()
        }

        // Recargar datos
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
      setAccionPendiente(null)

    } catch (err) {
      console.error('Error ejecutando acción:', err)
      const mensajeError = {
        rol: 'assistant',
        contenido: `Error ejecutando la acción: ${err.message}`,
        tipo: 'error',
        timestamp: new Date().toISOString()
      }
      setMensajes(prev => [...prev, mensajeError])
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

  if (!usuario) return null

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="chat-container">
      {/* Header */}
      <header className="chat-header">
        <div className="header-left">
          <span className="header-logo">🚀</span>
          <div className="header-info">
            <h1>Admin Panel</h1>
            <span className="header-marca">{usuario.nombre_marca}</span>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-name">{usuario.nombre}</span>
            {esSuperAdmin && <span className="badge-admin">Super Admin</span>}
          </div>
          <button onClick={handleReiniciarChat} className="btn-icon" title="Reiniciar chat">
            🔄
          </button>
          <button onClick={handleLogout} className="btn-icon btn-logout" title="Cerrar sesión">
            🚪
          </button>
        </div>
      </header>

      {/* Mensajes */}
      <main className="chat-messages">
        {mensajes.map((mensaje, index) => (
          <MensajeChat key={index} mensaje={mensaje} />
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
          {20 - mensajesCount} mensajes restantes en esta sesión
        </div>
        <form onSubmit={handleEnviarMensaje} className="chat-input-form">
          <textarea
            ref={inputRef}
            value={inputMensaje}
            onChange={(e) => setInputMensaje(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje... (Enter para enviar)"
            disabled={enviando || mensajesCount >= 20}
            rows={1}
          />
          <button 
            type="submit" 
            disabled={enviando || !inputMensaje.trim() || mensajesCount >= 20}
            className="btn-enviar"
          >
            {enviando ? '⏳' : '📤'}
          </button>
        </form>
      </footer>
    </div>
  )
}

export default Chat