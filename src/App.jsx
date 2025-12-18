import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ViewProvider } from './context/ViewContext'
import Login from './pages/Login'
import Chat from './pages/Chat'
import './App.css'

// Componente para rutas protegidas
const ProtectedRoute = ({ children }) => {
  const { usuario, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Componente para rutas públicas (redirige si ya está logueado)
const PublicRoute = ({ children }) => {
  const { usuario, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  if (usuario) {
    return <Navigate to="/chat" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } 
      />
      <Route 
        path="/chat" 
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <ViewProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ViewProvider>
    </AuthProvider>
  )
}

export default App