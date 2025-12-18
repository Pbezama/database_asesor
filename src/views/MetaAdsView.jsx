/**
 * MetaAdsView - Dashboard de Campanas Meta Ads
 *
 * Vista especializada para gestion de campanas publicitarias.
 * Por ahora usa datos mock, en el futuro se conectara con Meta API.
 */

import { useState } from 'react'
import { useView } from '../context/ViewContext'
import '../styles/MetaAdsView.css'

// Datos mock de campanas
const campanasDemo = [
  {
    id: '1',
    nombre: 'Campana Verano 2025',
    objetivo: 'Trafico',
    estado: 'activa',
    presupuestoDiario: 50000,
    gastado: 125000,
    alcance: 45200,
    clicks: 1230,
    ctr: 2.72,
    cpc: 102,
    fechaInicio: '2025-01-01',
    fechaFin: '2025-02-28'
  },
  {
    id: '2',
    nombre: 'Promocion Dia del Padre',
    objetivo: 'Conversiones',
    estado: 'pausada',
    presupuestoDiario: 30000,
    gastado: 89000,
    alcance: 28100,
    clicks: 890,
    ctr: 3.17,
    cpc: 100,
    fechaInicio: '2025-06-01',
    fechaFin: '2025-06-21'
  },
  {
    id: '3',
    nombre: 'Awareness Marca',
    objetivo: 'Reconocimiento',
    estado: 'activa',
    presupuestoDiario: 20000,
    gastado: 42000,
    alcance: 98500,
    clicks: 520,
    ctr: 0.53,
    cpc: 81,
    fechaInicio: '2025-01-15',
    fechaFin: null
  },
  {
    id: '4',
    nombre: 'Retargeting Carritos',
    objetivo: 'Conversiones',
    estado: 'activa',
    presupuestoDiario: 15000,
    gastado: 67500,
    alcance: 12300,
    clicks: 456,
    ctr: 3.71,
    cpc: 148,
    fechaInicio: '2025-02-01',
    fechaFin: null
  }
]

// Formatear numero como moneda CLP
const formatearMoneda = (valor) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(valor)
}

// Formatear numero grande
const formatearNumero = (valor) => {
  if (valor >= 1000000) return `${(valor / 1000000).toFixed(1)}M`
  if (valor >= 1000) return `${(valor / 1000).toFixed(1)}K`
  return valor.toString()
}

// Componente Card de Campana
const CampanaCard = ({ campana, onSelect }) => {
  const estadoClase = {
    activa: 'estado-activa',
    pausada: 'estado-pausada',
    finalizada: 'estado-finalizada'
  }

  return (
    <div className={`campana-card ${estadoClase[campana.estado]}`} onClick={() => onSelect(campana)}>
      <div className="campana-header">
        <h3>{campana.nombre}</h3>
        <span className={`estado-badge ${campana.estado}`}>
          {campana.estado === 'activa' ? '● Activa' : campana.estado === 'pausada' ? '○ Pausada' : '◌ Finalizada'}
        </span>
      </div>

      <div className="campana-objetivo">
        <span className="objetivo-label">Objetivo:</span>
        <span className="objetivo-valor">{campana.objetivo}</span>
      </div>

      <div className="campana-metricas">
        <div className="metrica">
          <span className="metrica-valor">{formatearNumero(campana.alcance)}</span>
          <span className="metrica-label">Alcance</span>
        </div>
        <div className="metrica">
          <span className="metrica-valor">{formatearNumero(campana.clicks)}</span>
          <span className="metrica-label">Clicks</span>
        </div>
        <div className="metrica">
          <span className="metrica-valor">{campana.ctr.toFixed(2)}%</span>
          <span className="metrica-label">CTR</span>
        </div>
        <div className="metrica">
          <span className="metrica-valor">{formatearMoneda(campana.cpc)}</span>
          <span className="metrica-label">CPC</span>
        </div>
      </div>

      <div className="campana-presupuesto">
        <div className="presupuesto-info">
          <span>Gastado: {formatearMoneda(campana.gastado)}</span>
          <span>Diario: {formatearMoneda(campana.presupuestoDiario)}</span>
        </div>
        <div className="presupuesto-barra">
          <div
            className="presupuesto-progreso"
            style={{ width: `${Math.min((campana.gastado / (campana.presupuestoDiario * 30)) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="campana-fechas">
        <span>Inicio: {campana.fechaInicio}</span>
        <span>Fin: {campana.fechaFin || 'Sin fecha'}</span>
      </div>
    </div>
  )
}

// Componente principal
const MetaAdsView = ({ contexto }) => {
  const { volverAlChat } = useView()
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [campanaSeleccionada, setCampanaSeleccionada] = useState(null)

  // Debug: verificar que el componente se monta
  console.log('MetaAdsView renderizado', { contexto, volverAlChat })

  // Filtrar campanas
  const campanasFiltradas = campanasDemo.filter(c => {
    if (filtroEstado === 'todos') return true
    return c.estado === filtroEstado
  })

  // Calcular metricas totales
  const metricasTotales = campanasDemo.reduce((acc, c) => ({
    gastadoTotal: acc.gastadoTotal + c.gastado,
    alcanceTotal: acc.alcanceTotal + c.alcance,
    clicksTotal: acc.clicksTotal + c.clicks,
    campanasActivas: acc.campanasActivas + (c.estado === 'activa' ? 1 : 0)
  }), { gastadoTotal: 0, alcanceTotal: 0, clicksTotal: 0, campanasActivas: 0 })

  return (
    <div className="meta-ads-view" style={{
      minHeight: '100vh',
      background: '#faf8f5',
      display: 'flex',
      flexDirection: 'column',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999
    }}>
      {/* Header */}
      <header className="meta-ads-header" style={{
        background: '#fff',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            className="btn-volver"
            onClick={volverAlChat}
            style={{
              padding: '8px 16px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Volver al Chat
          </button>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1877F2' }}>◇ Meta Ads Dashboard</h1>
        </div>
        <div className="header-right">
          <button className="btn-nueva-campana" disabled style={{
            padding: '10px 20px',
            background: '#94a3b8',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'not-allowed'
          }}>
            + Nueva Campana (Proximamente)
          </button>
        </div>
      </header>

      {/* Metricas Globales */}
      <section className="metricas-globales">
        <div className="metrica-global">
          <span className="metrica-global-valor">{metricasTotales.campanasActivas}</span>
          <span className="metrica-global-label">Campanas Activas</span>
        </div>
        <div className="metrica-global">
          <span className="metrica-global-valor">{formatearMoneda(metricasTotales.gastadoTotal)}</span>
          <span className="metrica-global-label">Gastado Total</span>
        </div>
        <div className="metrica-global">
          <span className="metrica-global-valor">{formatearNumero(metricasTotales.alcanceTotal)}</span>
          <span className="metrica-global-label">Alcance Total</span>
        </div>
        <div className="metrica-global">
          <span className="metrica-global-valor">{formatearNumero(metricasTotales.clicksTotal)}</span>
          <span className="metrica-global-label">Clicks Total</span>
        </div>
      </section>

      {/* Filtros */}
      <section className="filtros-section">
        <div className="filtros-grupo">
          <button
            className={`filtro-btn ${filtroEstado === 'todos' ? 'activo' : ''}`}
            onClick={() => setFiltroEstado('todos')}
          >
            Todas ({campanasDemo.length})
          </button>
          <button
            className={`filtro-btn ${filtroEstado === 'activa' ? 'activo' : ''}`}
            onClick={() => setFiltroEstado('activa')}
          >
            Activas ({campanasDemo.filter(c => c.estado === 'activa').length})
          </button>
          <button
            className={`filtro-btn ${filtroEstado === 'pausada' ? 'activo' : ''}`}
            onClick={() => setFiltroEstado('pausada')}
          >
            Pausadas ({campanasDemo.filter(c => c.estado === 'pausada').length})
          </button>
        </div>
      </section>

      {/* Grid de Campanas */}
      <section className="campanas-grid">
        {campanasFiltradas.map(campana => (
          <CampanaCard
            key={campana.id}
            campana={campana}
            onSelect={setCampanaSeleccionada}
          />
        ))}
      </section>

      {/* Mensaje de contexto si viene del chat */}
      {contexto && (
        <div className="contexto-chat">
          <span className="contexto-label">Contexto del chat:</span>
          <span className="contexto-valor">
            {typeof contexto === 'string' ? contexto : contexto?.solicitud_original || 'Navegación desde chat'}
          </span>
        </div>
      )}

      {/* Footer con info */}
      <footer className="meta-ads-footer">
        <p>
          <strong>Nota:</strong> Este es un dashboard de demostracion con datos ficticios.
          La integracion con Meta Ads API estara disponible proximamente.
        </p>
      </footer>
    </div>
  )
}

export default MetaAdsView
