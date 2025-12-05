import { createContext, useContext, useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sesionChatId, setSesionChatId] = useState(null)
  const [mensajesCount, setMensajesCount] = useState(0)

  useEffect(() => {
    // Verificar si hay sesión guardada
    const usuarioGuardado = localStorage.getItem('usuario')
    if (usuarioGuardado) {
      const parsed = JSON.parse(usuarioGuardado)
      setUsuario(parsed)
      setSesionChatId(uuidv4())
    }
    setLoading(false)
  }, [])

  const login = (datosUsuario) => {
    setUsuario(datosUsuario)
    setSesionChatId(uuidv4())
    setMensajesCount(0)
    localStorage.setItem('usuario', JSON.stringify(datosUsuario))
  }

  const logout = () => {
    setUsuario(null)
    setSesionChatId(null)
    setMensajesCount(0)
    localStorage.removeItem('usuario')
  }

  const reiniciarChat = () => {
    setSesionChatId(uuidv4())
    setMensajesCount(0)
  }

  const incrementarMensajes = () => {
    setMensajesCount(prev => prev + 1)
  }

  const value = {
    usuario,
    loading,
    sesionChatId,
    mensajesCount,
    login,
    logout,
    reiniciarChat,
    incrementarMensajes,
    esSuperAdmin: usuario?.es_super_admin || false
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}