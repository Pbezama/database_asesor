import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loginUsuario } from '../services/supabase'
import '../styles/Login.css'

const Login = () => {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!usuario.trim() || !contrasena.trim()) {
      setError('Por favor completa todos los campos')
      setLoading(false)
      return
    }

    const resultado = await loginUsuario(usuario.trim(), contrasena.trim())

    if (resultado.success) {
      login(resultado.usuario)
      navigate('/chat')
    } else {
      setError(resultado.error)
    }

    setLoading(false)
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-icon">🚀</span>
          </div>
          <h1>Admin Database</h1>
          <p>Panel de Administración</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="input-group">
            <label htmlFor="usuario">Usuario</label>
            <input
              type="text"
              id="usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ingresa tu usuario"
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <label htmlFor="contrasena">Contraseña</label>
            <input
              type="password"
              id="contrasena"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="Ingresa tu contraseña"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Ingresando...
              </>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Sistema de gestión de datos con IA</p>
        </div>
      </div>
    </div>
  )
}

export default Login