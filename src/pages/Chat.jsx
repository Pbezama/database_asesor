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
import { procesarMensajeIA, chatDirectoIA, transcribirAudio } from '../services/openai'
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
  // Modo del agente: 'controlador' | 'chatia'
  const [modoActivo, setModoActivo] = useState('controlador')
  // Estado para navegacion movil: 'chat' | 'editor'
  const [vistaMobile, setVistaMobile] = useState('chat')
  // Estado para el menu desplegable del input
  const [menuInputAbierto, setMenuInputAbierto] = useState(false)
  // Estados para grabacion de voz
  const [grabandoVoz, setGrabandoVoz] = useState(false)
  const [transcribiendo, setTranscribiendo] = useState(false)

  // Estados para divisor redimensionable
  const [anchoChat, setAnchoChat] = useState(() => {
    const guardado = localStorage.getItem('anchoPanelChat')
    return guardado ? parseFloat(guardado) : 60
  })
  const [arrastrando, setArrastrando] = useState(false)

  const { usuario, logout, sesionChatId, mensajesCount, incrementarMensajes, reiniciarChat, esSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)
  const menuInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)

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

  // Cerrar menu al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuInputRef.current && !menuInputRef.current.contains(event.target)) {
        setMenuInputAbierto(false)
      }
    }

    if (menuInputAbierto) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [menuInputAbierto])

  // Logica de arrastre para el divisor redimensionable
  const iniciarArrastre = (e) => {
    e.preventDefault()
    setArrastrando(true)
  }

  useEffect(() => {
    const manejarMovimiento = (e) => {
      if (!arrastrando) return
      const contenedor = document.querySelector('.main-layout')
      if (!contenedor) return
      const rect = contenedor.getBoundingClientRect()
      const nuevoAncho = ((e.clientX - rect.left) / rect.width) * 100
      // Limitar entre 30% y 70%
      setAnchoChat(Math.min(70, Math.max(30, nuevoAncho)))
    }

    const finalizarArrastre = () => {
      if (arrastrando) {
        setArrastrando(false)
        // Guardar en localStorage al soltar
        localStorage.setItem('anchoPanelChat', anchoChat.toString())
      }
    }

    if (arrastrando) {
      document.addEventListener('mousemove', manejarMovimiento)
      document.addEventListener('mouseup', finalizarArrastre)
    }

    return () => {
      document.removeEventListener('mousemove', manejarMovimiento)
      document.removeEventListener('mouseup', finalizarArrastre)
    }
  }, [arrastrando, anchoChat])

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

  // Función genérica para cambiar entre modos
  const cambiarModo = (nuevoModo) => {
    if (nuevoModo === modoActivo) return

    const nombresModo = {
      controlador: 'Controlador',
      chatia: 'ChatIA'
    }

    // Agregar separador visual
    const separador = {
      rol: 'system',
      tipo: 'separador',
      contenido: `Cambiaste a ${nombresModo[nuevoModo]}`,
      timestamp: new Date().toISOString(),
      modoOrigen: nuevoModo
    }
    setMensajes(prev => [...prev, separador])
    setModoActivo(nuevoModo)
    setAccionPendiente(null)
  }

  // Función legacy para compatibilidad
  const toggleModoChatIA = () => {
    cambiarModo(modoActivo === 'chatia' ? 'controlador' : 'chatia')
  }

  // Nueva funcion para ejecutar delegacion automatica
  const ejecutarDelegacion = async (delegacion) => {
    const { agenteDestino, datosParaDelegar, razon } = delegacion

    const nombresModo = {
      controlador: 'Controlador',
      chatia: 'ChatIA'
    }

    console.log('\n╔══════════════════════════════════════════════════════════════')
    console.log('║ 🔀 DELEGACIÓN EN PROCESO')
    console.log('╠══════════════════════════════════════════════════════════════')
    console.log(`║ 📤 Desde: ${nombresModo[modoActivo]}`)
    console.log(`║ 📥 Hacia: ${nombresModo[agenteDestino]}`)
    console.log(`║ 💡 Razón: ${razon}`)
    console.log(`║ 📦 Datos a transferir: ${datosParaDelegar ? 'Sí' : 'No'}`)
    console.log('╚══════════════════════════════════════════════════════════════\n')

    // Agregar mensaje de delegacion
    const msgDelegacion = {
      rol: 'system',
      tipo: 'delegacion',
      contenido: `${nombresModo[modoActivo]} delegó a ${nombresModo[agenteDestino]}`,
      desde: modoActivo,
      hacia: agenteDestino,
      timestamp: new Date().toISOString()
    }
    setMensajes(prev => [...prev, msgDelegacion])

    // Cambiar modo
    setModoActivo(agenteDestino)
    setAccionPendiente(null)

    // Si hay datos para delegar, enviarlos automaticamente al nuevo agente
    if (datosParaDelegar) {
      // Pequeño delay para que el cambio de modo se refleje
      setTimeout(() => {
        enviarMensajeConContextoDelegado(datosParaDelegar, razon)
      }, 100)
    }
  }

  // Enviar mensaje con contexto de delegacion
  const enviarMensajeConContextoDelegado = async (datos, razon) => {
    setEnviando(true)

    // Formatear datos de manera clara para el agente destino
    let datosFormateados = ''
    if (datos) {
      if (datos.categoria) datosFormateados += `- Categoría: ${datos.categoria}\n`
      if (datos.clave) datosFormateados += `- Clave: ${datos.clave}\n`
      if (datos.valor) datosFormateados += `- Valor: ${datos.valor}\n`
      if (datos.prioridad) datosFormateados += `- Prioridad: ${datos.prioridad}\n`
      // Si hay otros datos no estructurados
      if (!datosFormateados && Object.keys(datos).length > 0) {
        datosFormateados = JSON.stringify(datos, null, 2)
      }
    }

    // Contexto completo para la IA (no visible al usuario)
    const contextoInicial = `[DELEGACION RECIBIDA]
Razón: ${razon}

Datos a procesar:
${datosFormateados || 'Sin datos específicos'}

El usuario ya aprobó esta delegación al hacer click en el botón. Procede a pedir confirmación para agregar estos datos a la base.`

    // Mensaje simplificado para mostrar al usuario
    const mensajeContexto = {
      rol: 'user',
      contenido: 'Acción delegada',
      contenidoCompleto: contextoInicial, // Guardamos el contexto completo para la IA
      timestamp: new Date().toISOString(),
      modoOrigen: modoActivo,
      esDelegacion: true
    }
    setMensajes(prev => [...prev, mensajeContexto])

    // Procesar con la IA correspondiente
    try {
      const historial = mensajes.map(m => ({
        rol: m.rol,
        contenido: m.contenidoCompleto || m.contenido, // Usar contenido completo si existe (para delegaciones)
        modoOrigen: m.modoOrigen,
        tipo: m.tipo,
        comentariosCompletos: m.comentariosCompletos,
        datos: m.datos,
        tabla_preview: m.tabla_preview
      }))

      let respuesta
      if (modoActivo === 'chatia') {
        respuesta = await chatDirectoIA(contextoInicial, historial)
      } else {
        respuesta = await procesarMensajeIA(contextoInicial, {
          nombreUsuario: usuario.nombre,
          nombreMarca: usuario.nombre_marca,
          idMarca: usuario.id_marca,
          esSuperAdmin,
          datosMarca,
          historial,
          accionPendienteActual: accionPendiente
        })
      }

      const mensajeRespuesta = {
        rol: 'assistant',
        contenido: respuesta.contenido,
        tipo: respuesta.tipo,
        datos: respuesta.datos,
        delegacion: respuesta.delegacion,
        sugerencias: respuesta.sugerencias,
        timestamp: new Date().toISOString(),
        modoOrigen: modoActivo
      }
      setMensajes(prev => [...prev, mensajeRespuesta])

      // Si hay accion pendiente, guardarla
      if (respuesta.accionPendiente) {
        setAccionPendiente(respuesta.accionPendiente)
      }
    } catch (err) {
      console.error('Error procesando delegacion:', err)
    }

    setEnviando(false)
  }

  // Funcion para cambiar vista en movil (solo chat/editor ahora)
  const cambiarVistaMobile = (vista) => {
    setVistaMobile(vista)
  }

  // Manejar acciones del menu de input
  const handleMenuInputAction = (accion) => {
    setMenuInputAbierto(false)
    switch (accion) {
      case 'toggle-modo':
        toggleModoChatIA()
        break
      case 'reiniciar':
        handleReiniciarChat()
        break
      default:
        break
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

    let textoMensaje = inputMensaje.trim()
    const tiempoInicio = performance.now()

    // Detectar cambio de modo por comando o intención
    const textoLower = textoMensaje.toLowerCase()
    let modoParaProcesar = modoActivo

    const nombresModo = {
      controlador: 'Controlador',
      chatia: 'ChatIA'
    }

    console.log('\n╔══════════════════════════════════════════════════════════════')
    console.log('║ 📩 NUEVO MENSAJE DEL USUARIO')
    console.log('╠══════════════════════════════════════════════════════════════')
    console.log(`║ 👤 Usuario: ${usuario.nombre}`)
    console.log(`║ 🏷️  Marca: ${usuario.nombre_marca}`)
    console.log(`║ 🎯 Modo activo: ${nombresModo[modoParaProcesar]}`)
    console.log(`║ 💬 Mensaje: "${textoMensaje.substring(0, 100)}${textoMensaje.length > 100 ? '...' : ''}"`)
    console.log(`║ 📊 Mensajes en sesión: ${mensajesCount + 1}/20`)
    if (accionPendiente) {
      console.log(`║ ⏳ Acción pendiente: ${accionPendiente.accion} (ID: ${accionPendiente.parametros?.id_fila || 'nuevo'})`)
    }
    console.log('╚══════════════════════════════════════════════════════════════\n')

    setInputMensaje('')
    setEnviando(true)
    incrementarMensajes()

    // Agregar mensaje del usuario con modoOrigen
    const mensajeUsuario = {
      rol: 'user',
      contenido: textoMensaje,
      timestamp: new Date().toISOString(),
      modoOrigen: modoParaProcesar
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
        contenido: m.contenidoCompleto || m.contenido, // Usar contenido completo si existe (para delegaciones)
        modoOrigen: m.modoOrigen,
        tipo: m.tipo,
        comentariosCompletos: m.comentariosCompletos,
        datos: m.datos,
        tabla_preview: m.tabla_preview
      }))

      console.log(`🔄 Chat.jsx: Enviando a ${nombresModo[modoParaProcesar]}...`)
      console.log(`📜 Chat.jsx: Historial con ${historial.length} mensajes`)

      let respuesta

      // Usar función según el modo activo
      if (modoParaProcesar === 'chatia') {
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

      const tiempoFin = performance.now()
      console.log('\n╔══════════════════════════════════════════════════════════════')
      console.log('║ 📤 RESPUESTA RECIBIDA')
      console.log('╠══════════════════════════════════════════════════════════════')
      console.log(`║ ⏱️  Tiempo: ${(tiempoFin - tiempoInicio).toFixed(0)}ms`)
      console.log(`║ 📋 Tipo: ${respuesta.tipo}`)
      console.log(`║ 💬 Contenido: "${(respuesta.contenido || '').substring(0, 80)}${(respuesta.contenido || '').length > 80 ? '...' : ''}"`)
      if (respuesta.delegacion?.sugerida) {
        console.log(`║ 🔀 Delegación sugerida: → ${respuesta.delegacion.agenteDestino}`)
      }
      if (respuesta.accionPendiente) {
        console.log(`║ ⏳ Nueva acción pendiente: ${respuesta.accionPendiente.accion}`)
      }
      if (respuesta.ejecutar) {
        console.log(`║ ▶️  Acción a ejecutar: ${respuesta.ejecutar.accion}`)
      }
      console.log('╚══════════════════════════════════════════════════════════════\n')

      // En modo ChatIA, mostramos la respuesta con posible delegacion/sugerencias
      if (modoParaProcesar === 'chatia') {
        const mensajeRespuesta = {
          rol: 'assistant',
          contenido: respuesta.contenido,
          tipo: respuesta.tipo,
          timestamp: new Date().toISOString(),
          modoOrigen: modoParaProcesar,
          delegacion: respuesta.delegacion || null,
          sugerencias: respuesta.sugerencias || null,
          puntosClave: respuesta.puntosClave || null
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
            // Guardar comentarios completos para el historial compartido
            comentariosCompletos: resultadoComentarios.data,
            timestamp: new Date().toISOString(),
            modoOrigen: 'controlador'
          }
        } else if (resultadoComentarios.success && resultadoComentarios.data.length === 0) {
          mensajeResultado = {
            rol: 'assistant',
            contenido: 'No encontre comentarios con los filtros especificados.',
            tipo: 'texto',
            timestamp: new Date().toISOString(),
            modoOrigen: 'controlador'
          }
        } else {
          mensajeResultado = {
            rol: 'assistant',
            contenido: `Error consultando comentarios: ${resultadoComentarios.error}`,
            tipo: 'error',
            timestamp: new Date().toISOString(),
            modoOrigen: 'controlador'
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
        timestamp: new Date().toISOString(),
        modoOrigen: 'controlador',
        delegacion: respuesta.delegacion || null
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
    const tiempoInicio = performance.now()

    console.log('\n╔══════════════════════════════════════════════════════════════')
    console.log('║ ⚡ EJECUTANDO ACCIÓN EN BASE DE DATOS')
    console.log('╠══════════════════════════════════════════════════════════════')
    console.log(`║ 🎯 Acción: ${accion.toUpperCase()}`)
    console.log(`║ 📍 ID registro: ${parametros.id_fila || 'NUEVO'}`)
    console.log(`║ 📁 Categoría: ${parametros.categoria || '—'}`)
    console.log(`║ 🔑 Clave: ${parametros.clave || '—'}`)
    if (parametros.updates) {
      console.log(`║ 📝 Campos a modificar: ${Object.keys(parametros.updates).filter(k => parametros.updates[k] !== null).join(', ')}`)
    }
    console.log('╚══════════════════════════════════════════════════════════════\n')

    let resultado

    try {
      switch (accion) {
        case 'agregar':
          console.log('   ➕ Supabase: Insertando nuevo registro...')
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
          console.log('   ✏️  Supabase: Modificando registro...')
          if (!parametros.id_fila) {
            throw new Error('No se especificó el ID del registro a modificar')
          }
          if (!parametros.updates || Object.keys(parametros.updates).length === 0) {
            throw new Error('No se especificaron los cambios a realizar')
          }
          resultado = await modificarDato(parametros.id_fila, parametros.updates)
          break

        case 'desactivar':
          console.log('   🛑 Supabase: Desactivando registro...')
          if (!parametros.id_fila) {
            throw new Error('No se especificó el ID del registro a desactivar')
          }
          resultado = await desactivarDato(parametros.id_fila)
          break

        default:
          resultado = { success: false, error: `Acción no reconocida: ${accion}` }
      }

      const tiempoFin = performance.now()
      console.log('\n╔══════════════════════════════════════════════════════════════')
      console.log(`║ ${resultado.success ? '✅ ACCIÓN COMPLETADA' : '❌ ACCIÓN FALLIDA'}`)
      console.log('╠══════════════════════════════════════════════════════════════')
      console.log(`║ ⏱️  Tiempo: ${(tiempoFin - tiempoInicio).toFixed(0)}ms`)
      if (resultado.success) {
        console.log(`║ 🆔 ID resultado: ${resultado.data?.id}`)
        console.log(`║ 📁 Categoría: ${resultado.data?.categoria}`)
        console.log(`║ 🔑 Clave: ${resultado.data?.clave}`)
      } else {
        console.log(`║ ❌ Error: ${resultado.error}`)
      }
      console.log('╚══════════════════════════════════════════════════════════════\n')

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

  // ═══════════════════════════════════════════════════════════════
  // GRABACION DE VOZ
  // ═══════════════════════════════════════════════════════════════

  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        // Detener el stream del microfono
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }

        // Transcribir el audio
        setTranscribiendo(true)
        try {
          const textoTranscrito = await transcribirAudio(audioBlob)
          if (textoTranscrito) {
            setInputMensaje(prev => prev + (prev ? ' ' : '') + textoTranscrito)
          }
        } catch (error) {
          console.error('Error transcribiendo:', error)
        }
        setTranscribiendo(false)
      }

      mediaRecorder.start()
      setGrabandoVoz(true)
    } catch (error) {
      console.error('Error accediendo al microfono:', error)
    }
  }

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && grabandoVoz) {
      mediaRecorderRef.current.stop()
      setGrabandoVoz(false)
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
          {modoActivo === 'chatia' && (
            <span className="badge-modo-chat badge-chatia">◆ Modo ChatIA</span>
          )}
          <button
            onClick={() => setMostrarEditor(!mostrarEditor)}
            className={`btn-icon btn-toggle-editor desktop-only ${mostrarEditor ? 'active' : ''}`}
            title={mostrarEditor ? 'Ocultar editor' : 'Mostrar editor'}
          >
            ≡
          </button>
          <button onClick={handleReiniciarChat} className="btn-icon" title="Reiniciar chat">
            ↻
          </button>
          <button onClick={handleLogout} className="btn-icon btn-logout" title="Cerrar sesion">
            ⏻
          </button>
        </div>
      </header>

      {/* Layout principal dividido */}
      <div className={`main-layout ${arrastrando ? 'arrastrando' : ''}`}>
        {/* Panel izquierdo: Chat */}
        <div
          className={`chat-panel ${!mostrarEditor ? 'full-width' : ''} mobile-panel ${vistaMobile === 'chat' || vistaMobile === 'chatia' ? 'mobile-visible' : 'mobile-hidden'}`}
          style={mostrarEditor ? { flex: `0 0 ${anchoChat}%`, maxWidth: `${anchoChat}%` } : undefined}
        >
          {/* Indicador de accion pendiente (solo en modo controlador) */}
          {modoActivo === 'controlador' && accionPendiente && (
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
                modoActivo={modoActivo}
                onToggleModo={toggleModoChatIA}
                onCambiarModo={cambiarModo}
                onRespuestaRapida={handleRespuestaRapida}
                onDelegacion={ejecutarDelegacion}
                nombreMarca={usuario.nombre_marca}
                usuario={usuario}
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
              {/* Menu desplegable de opciones - 3 modos */}
              <div className="menu-input-wrapper" ref={menuInputRef}>
                <button
                  type="button"
                  className={`btn-menu-input modo-${modoActivo}`}
                  onClick={() => setMenuInputAbierto(!menuInputAbierto)}
                  aria-expanded={menuInputAbierto}
                  aria-haspopup="true"
                >
                  <span className="menu-input-icon">
                    {modoActivo === 'controlador' ? '◈' : '◆'}
                  </span>
                  <span className="menu-input-texto">
                    {modoActivo === 'controlador' ? 'Controlador' : 'ChatIA'}
                  </span>
                  <span className="menu-input-arrow">{menuInputAbierto ? '▴' : '▾'}</span>
                </button>

                {/* Dropdown del menu con 2 modos */}
                {menuInputAbierto && (
                  <div className="menu-input-dropdown">
                    {modoActivo !== 'controlador' && (
                      <button
                        type="button"
                        className="menu-input-option"
                        onClick={() => { cambiarModo('controlador'); setMenuInputAbierto(false) }}
                      >
                        <span className="option-icon">◈</span>
                        <span className="option-texto">Controlador</span>
                        <span className="option-desc">Gestionar datos</span>
                      </button>
                    )}
                    {modoActivo !== 'chatia' && (
                      <button
                        type="button"
                        className="menu-input-option"
                        onClick={() => { cambiarModo('chatia'); setMenuInputAbierto(false) }}
                      >
                        <span className="option-icon">◆</span>
                        <span className="option-texto">ChatIA</span>
                        <span className="option-desc">Chat general</span>
                      </button>
                    )}
                    <div className="menu-input-divider"></div>
                    <button
                      type="button"
                      className="menu-input-option option-reiniciar"
                      onClick={() => handleMenuInputAction('reiniciar')}
                    >
                      <span className="option-icon">↻</span>
                      <span className="option-texto">Reiniciar chat</span>
                    </button>
                  </div>
                )}
              </div>

              <textarea
                ref={inputRef}
                value={inputMensaje}
                onChange={(e) => setInputMensaje(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  modoActivo === 'controlador' ? "Escribe tu mensaje..." : "Pregunta lo que quieras..."
                }
                disabled={enviando || mensajesCount >= 20 || grabandoVoz}
                rows={1}
              />
              <button
                type="button"
                onClick={grabandoVoz ? detenerGrabacion : iniciarGrabacion}
                className={`btn-microfono ${grabandoVoz ? 'grabando' : ''} ${transcribiendo ? 'transcribiendo' : ''}`}
                disabled={enviando || transcribiendo}
                title={grabandoVoz ? 'Detener grabacion' : 'Grabar mensaje de voz'}
              >
                {transcribiendo ? '...' : grabandoVoz ? '■' : '🎤'}
              </button>
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

        {/* Divisor redimensionable (solo desktop, con editor visible) */}
        {mostrarEditor && (
          <div
            className={`panel-divider ${arrastrando ? 'dragging' : ''}`}
            onMouseDown={iniciarArrastre}
          />
        )}

        {/* Panel derecho: Editor Manual (visible en todos los modos si está habilitado) */}
        {mostrarEditor && (
          <div
            className={`editor-panel mobile-panel ${vistaMobile === 'editor' ? 'mobile-visible' : 'mobile-hidden'}`}
            style={{ flex: `0 0 ${100 - anchoChat}%`, minWidth: `${100 - anchoChat}%` }}
          >
            <EditorManual
              usuario={usuario}
              esSuperAdmin={esSuperAdmin}
              onDatosActualizados={cargarDatosMarca}
            />
          </div>
        )}
      </div>

      {/* Barra de navegacion inferior - SOLO MOVIL (2 tabs) */}
      <nav className="mobile-nav">
        <button
          className={`mobile-nav-btn ${vistaMobile === 'chat' ? 'active' : ''}`}
          onClick={() => cambiarVistaMobile('chat')}
        >
          <span className="mobile-nav-icon">
            {modoActivo === 'controlador' ? '◈' : '◆'}
          </span>
          <span className="mobile-nav-label">Chat</span>
        </button>
        <button
          className={`mobile-nav-btn ${vistaMobile === 'editor' ? 'active' : ''}`}
          onClick={() => cambiarVistaMobile('editor')}
        >
          <span className="mobile-nav-icon">≡</span>
          <span className="mobile-nav-label">Editor</span>
        </button>
      </nav>
    </div>
  )
}

export default Chat