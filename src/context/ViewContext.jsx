/**
 * ViewContext - Contexto para navegacion entre vistas de agentes
 *
 * Maneja el estado de la vista activa y permite cambiar entre:
 * - Chat principal
 * - Vistas especializadas de agentes (MetaAdsView, etc.)
 */

import { createContext, useContext, useState, useCallback } from 'react'

const ViewContext = createContext(null)

export const useView = () => {
  const context = useContext(ViewContext)
  if (!context) {
    throw new Error('useView debe usarse dentro de ViewProvider')
  }
  return context
}

export const ViewProvider = ({ children }) => {
  // Vista activa: 'chat' | 'meta-ads' | 'tareas' | etc.
  const [vistaActiva, setVistaActiva] = useState('chat')

  // Contexto adicional para la vista (ej: filtros, datos de la conversacion)
  const [contextoVista, setContextoVista] = useState(null)

  // Historial de vistas para poder volver
  const [historialVistas, setHistorialVistas] = useState(['chat'])

  /**
   * Navegar a una vista especifica
   * @param {string} vista - ID de la vista ('chat', 'meta-ads', etc.)
   * @param {Object} contexto - Contexto adicional para la vista
   */
  const navegarA = useCallback((vista, contexto = null) => {
    console.log(`Navegando a vista: ${vista}`, contexto)

    setHistorialVistas(prev => [...prev, vista])
    setVistaActiva(vista)
    setContextoVista(contexto)
  }, [])

  /**
   * Volver al chat principal
   */
  const volverAlChat = useCallback(() => {
    console.log('Volviendo al chat')

    setVistaActiva('chat')
    setContextoVista(null)
    setHistorialVistas(prev => [...prev, 'chat'])
  }, [])

  /**
   * Volver a la vista anterior
   */
  const volverAtras = useCallback(() => {
    if (historialVistas.length > 1) {
      const nuevoHistorial = [...historialVistas]
      nuevoHistorial.pop() // Quitar vista actual
      const vistaAnterior = nuevoHistorial[nuevoHistorial.length - 1]

      setHistorialVistas(nuevoHistorial)
      setVistaActiva(vistaAnterior)
      setContextoVista(null)
    } else {
      volverAlChat()
    }
  }, [historialVistas, volverAlChat])

  /**
   * Verificar si estamos en el chat
   */
  const estaEnChat = vistaActiva === 'chat'

  const value = {
    vistaActiva,
    contextoVista,
    historialVistas,
    navegarA,
    volverAlChat,
    volverAtras,
    estaEnChat
  }

  return (
    <ViewContext.Provider value={value}>
      {children}
    </ViewContext.Provider>
  )
}

export default ViewContext
