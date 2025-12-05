import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════

export const loginUsuario = async (usuario, contrasena) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('usuario', usuario)
      .eq('contrasena', contrasena)
      .eq('activo', true)
      .single()

    if (error || !data) {
      return { success: false, error: 'Usuario o contraseña incorrectos' }
    }

    // Actualizar último login
    await supabase
      .from('usuarios')
      .update({ ultimo_login: new Date().toISOString() })
      .eq('id', data.id)

    return { success: true, usuario: data }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE DATOS DE MARCA
// ═══════════════════════════════════════════════════════════════

export const obtenerDatosMarca = async (idMarca) => {
  try {
    const { data, error } = await supabase
      .from('base_cuentas')
      .select('*')
      .eq('ID marca', idMarca)
      .eq('Estado', true)
      .order('prioridad', { ascending: true })

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error obteniendo datos:', err)
    return []
  }
}

export const obtenerTodasLasMarcas = async () => {
  try {
    const { data, error } = await supabase
      .from('base_cuentas')
      .select('*')
      .eq('Estado', true)
      .order('prioridad', { ascending: true })

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error obteniendo todas las marcas:', err)
    return []
  }
}

export const agregarDato = async (dato) => {
  try {
    // Normalizar nombres de campos según la estructura real de la tabla
    const datoNormalizado = {
      'ID marca': dato['ID marca'] || dato.id_marca,
      'Nombre marca': dato['Nombre marca'] || dato.nombre_marca,
      categoria: dato.categoria,
      clave: dato.clave,
      valor: dato.valor,
      prioridad: dato.prioridad || 3,
      Estado: true,
      creado_en: new Date().toISOString()
    }

    // Manejar fechas
    if (dato.fecha_inicio) {
      datoNormalizado.fecha_inicio = dato.fecha_inicio
    }
    if (dato.fecha_caducidad || dato.fecha_fin || dato.fecha_expiracion) {
      datoNormalizado.fecha_caducidad = dato.fecha_caducidad || dato.fecha_fin || dato.fecha_expiracion
    }

    console.log('📝 Agregando dato:', datoNormalizado)

    const { data, error } = await supabase
      .from('base_cuentas')
      .insert([datoNormalizado])
      .select()

    if (error) throw error
    
    console.log('✅ Dato agregado:', data[0])
    return { success: true, data: data[0] }
  } catch (err) {
    console.error('❌ Error agregando dato:', err)
    return { success: false, error: err.message }
  }
}

export const modificarDato = async (id, updates) => {
  try {
    console.log('🔧 Modificando registro ID:', id)
    console.log('📝 Updates:', updates)

    // Primero obtener el registro actual
    const { data: registroActual, error: errorSelect } = await supabase
      .from('base_cuentas')
      .select('*')
      .eq('id', id)
      .single()

    if (errorSelect) throw errorSelect

    // Preparar actualización (no incluir id_fila en updates)
    const { id_fila, ...updatesLimpios } = updates

    console.log('🔄 Actualizando con:', updatesLimpios)

    // Actualizar el registro
    const { data, error } = await supabase
      .from('base_cuentas')
      .update(updatesLimpios)
      .eq('id', id)
      .select()

    if (error) throw error

    console.log('✅ Registro actualizado:', data[0])

    return {
      success: true,
      data: data[0],
      registroAnterior: registroActual
    }
  } catch (err) {
    console.error('❌ Error modificando:', err)
    return { success: false, error: err.message }
  }
}

export const desactivarDato = async (id) => {
  try {
    console.log('🛑 Desactivando registro ID:', id)

    // Primero obtener el registro actual
    const { data: registroActual, error: errorSelect } = await supabase
      .from('base_cuentas')
      .select('*')
      .eq('id', id)
      .single()

    if (errorSelect) {
      console.error('❌ Error obteniendo registro:', errorSelect)
      throw errorSelect
    }

    console.log('📋 Registro encontrado:', registroActual)

    // Preparar actualización - solo Estado y fecha_caducidad
    const fechaActual = new Date().toISOString()
    const actualizacion = {
      Estado: false,
      fecha_caducidad: fechaActual
    }

    console.log('🔄 Desactivando con:', actualizacion)

    // Actualizar el registro
    const { data, error } = await supabase
      .from('base_cuentas')
      .update(actualizacion)
      .eq('id', id)
      .select()

    if (error) {
      console.error('❌ Error desactivando:', error)
      throw error
    }

    console.log('✅ Registro desactivado:', data[0])

    return {
      success: true,
      data: data[0],
      registroAnterior: registroActual
    }
  } catch (err) {
    console.error('❌ Error en desactivarDato:', err)
    return { success: false, error: err.message }
  }
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE LOGS
// ═══════════════════════════════════════════════════════════════

export const obtenerLogsComentarios = async (idMarca, limite = 50) => {
  try {
    let query = supabase
      .from('logs_comentarios')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(limite)

    if (idMarca) {
      query = query.eq('id_marca', idMarca)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error obteniendo logs:', err)
    return []
  }
}

export const guardarLogAccion = async (log) => {
  try {
    const logCompleto = {
      ...log,
      creado_en: new Date().toISOString()
    }
    await supabase.from('logs_acciones_admin').insert([logCompleto])
  } catch (err) {
    console.error('Error guardando log:', err)
  }
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE CHAT
// ═══════════════════════════════════════════════════════════════

export const guardarMensajeChat = async (mensaje) => {
  try {
    const mensajeCompleto = {
      ...mensaje,
      creado_en: new Date().toISOString()
    }
    await supabase.from('mensajes_chat').insert([mensajeCompleto])
  } catch (err) {
    console.error('Error guardando mensaje:', err)
  }
}

export const obtenerHistorialChat = async (sesionId, limite = 20) => {
  try {
    const { data, error } = await supabase
      .from('mensajes_chat')
      .select('rol, contenido')
      .eq('sesion_id', sesionId)
      .order('creado_en', { ascending: true })
      .limit(limite)

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error obteniendo historial:', err)
    return []
  }
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE USUARIOS (Super Admin)
// ═══════════════════════════════════════════════════════════════

export const obtenerTodosLosUsuarios = async () => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('creado_en', { ascending: false })

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error obteniendo usuarios:', err)
    return []
  }
}

export const crearUsuario = async (usuario) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .insert([{
        ...usuario,
        activo: true,
        creado_en: new Date().toISOString()
      }])
      .select()

    if (error) throw error
    return { success: true, data: data[0] }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE ESTADÍSTICAS
// ═══════════════════════════════════════════════════════════════

export const obtenerEstadisticasComentarios = async (idMarca, dias = 7) => {
  try {
    const fechaInicio = new Date()
    fechaInicio.setDate(fechaInicio.getDate() - dias)

    let query = supabase
      .from('logs_comentarios')
      .select('creado_en, es_inapropiado')
      .gte('creado_en', fechaInicio.toISOString())

    if (idMarca) {
      query = query.eq('id_marca', idMarca)
    }

    const { data, error } = await query
    if (error) throw error

    // Agrupar por día
    const porDia = {}
    data?.forEach(log => {
      const fecha = log.creado_en.split('T')[0]
      if (!porDia[fecha]) {
        porDia[fecha] = { total: 0, inapropiados: 0 }
      }
      porDia[fecha].total++
      if (log.es_inapropiado) {
        porDia[fecha].inapropiados++
      }
    })

    return porDia
  } catch (err) {
    console.error('Error obteniendo estadísticas:', err)
    return {}
  }
}