# OpenAI Function Calling / Tool Calling - Guía Completa

## Documento de Referencia para database_asesor

Este documento explica cómo funciona el Function Calling de OpenAI y cómo podemos implementarlo en nuestro sistema para reemplazar el método actual de parsing JSON manual.

---

## 1. Problema Actual

### Cómo funciona ahora (src/services/openai.js)

```javascript
// MÉTODO ACTUAL: Pedimos JSON en el prompt y parseamos manualmente
const response = await openai.chat.completions.create({
  model: 'gpt-5.1',
  messages,
  temperature: 0.7
})

const respuestaRaw = response.choices[0].message.content  // String de texto
// Luego ~100 líneas de código para:
// 1. Limpiar markdown (```json ... ```)
// 2. Buscar { y } para extraer JSON
// 3. JSON.parse() con try/catch
// 4. Manejar cuando falla el parseo
```

### Problemas de este enfoque:
- **No garantiza JSON válido**: El modelo puede devolver texto mezclado con JSON
- **Parsing frágil**: Regex y substring para extraer JSON embebido
- **~100 líneas de código defensivo**: Múltiples try/catch y fallbacks
- **El modelo puede "olvidar" el formato**: A veces responde en texto plano

---

## 2. Solución: Function Calling (Tool Calling)

### Qué es Function Calling

Function Calling permite definir **funciones/herramientas** que el modelo puede "llamar". En lugar de pedir JSON en el prompt, defines un **schema** y el modelo **garantiza** devolver argumentos válidos.

### Ventajas:
- **JSON garantizado**: El modelo SIEMPRE devuelve JSON válido si llama una función
- **Schema enforcement**: Con `strict: true`, el JSON coincide EXACTAMENTE con tu schema
- **Sin parsing manual**: Los argumentos vienen pre-parseados
- **Menos tokens en prompt**: No necesitas explicar el formato JSON

---

## 3. Cómo Funciona - Estructura de la API

### Parámetro `tools`

```javascript
const tools = [
  {
    type: "function",
    function: {
      name: "responder_usuario",           // Nombre de la función
      description: "Responde al usuario",  // Cuándo usarla
      strict: true,                        // IMPORTANTE: Garantiza schema
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["texto", "tabla", "confirmacion", "exito", "error"],
            description: "Tipo de respuesta"
          },
          mensaje: {
            type: "string",
            description: "Mensaje para el usuario"
          },
          datos: {
            type: ["object", "null"],
            description: "Datos opcionales (tabla, etc.)"
          }
        },
        required: ["tipo", "mensaje"],      // Campos obligatorios
        additionalProperties: false          // REQUERIDO para strict mode
      }
    }
  }
]
```

### Parámetro `tool_choice`

```javascript
// Opciones:
tool_choice: "auto"              // Modelo decide si llamar función (default)
tool_choice: "required"          // DEBE llamar alguna función
tool_choice: "none"              // No puede llamar funciones
tool_choice: { type: "function", function: { name: "responder_usuario" } }  // Forzar función específica
```

### Llamada a la API

```javascript
const response = await openai.chat.completions.create({
  model: 'gpt-4o',  // o gpt-4o-mini, gpt-5.1
  messages: [...],
  tools: tools,
  tool_choice: "required"  // Forzar que use la función
})
```

### Estructura de la Respuesta

```javascript
// Cuando el modelo llama una función:
{
  choices: [{
    message: {
      role: "assistant",
      content: null,  // NULL cuando hay tool_calls
      tool_calls: [{
        id: "call_abc123",
        type: "function",
        function: {
          name: "responder_usuario",
          arguments: '{"tipo":"texto","mensaje":"Hola, ¿cómo te puedo ayudar?"}'
        }
      }]
    },
    finish_reason: "tool_calls"  // Indica que llamó funciones
  }]
}
```

### Acceder a los argumentos

```javascript
const toolCall = response.choices[0].message.tool_calls[0]
const args = JSON.parse(toolCall.function.arguments)
// args = { tipo: "texto", mensaje: "Hola..." }
```

---

## 4. Strict Mode - Garantía de Schema

### Qué es Strict Mode

Con `strict: true`, OpenAI **garantiza** que los argumentos coincidan EXACTAMENTE con tu JSON Schema. Sin strict mode, es "best effort".

### Requisitos para Strict Mode

```javascript
{
  strict: true,
  parameters: {
    type: "object",
    properties: { ... },
    required: ["campo1", "campo2"],     // TODOS los campos en required
    additionalProperties: false          // OBLIGATORIO
  }
}
```

### Campos Opcionales en Strict Mode

Para campos opcionales, usa union con null:

```javascript
properties: {
  datos: {
    type: ["object", "null"],  // Puede ser object O null
    description: "Datos opcionales"
  }
}
```

---

## 5. Aplicación a Nuestro Sistema

### Funciones que Necesitamos Definir

Basado en los tipos de respuesta actuales del sistema:

```javascript
const tools = [
  // 1. Respuesta de texto simple
  {
    type: "function",
    function: {
      name: "responder_texto",
      description: "Responder con texto al usuario",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          mensaje: { type: "string" }
        },
        required: ["mensaje"],
        additionalProperties: false
      }
    }
  },

  // 2. Mostrar datos en tabla
  {
    type: "function",
    function: {
      name: "mostrar_tabla",
      description: "Mostrar datos de marca en formato tabla",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          columnas: { type: "array", items: { type: "string" } },
          filas: { type: "array", items: { type: "array", items: { type: "string" } } }
        },
        required: ["mensaje", "columnas", "filas"],
        additionalProperties: false
      }
    }
  },

  // 3. Pedir confirmación antes de ejecutar
  {
    type: "function",
    function: {
      name: "pedir_confirmacion",
      description: "Pedir confirmación al usuario antes de agregar/modificar/eliminar",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          accion: { type: "string", enum: ["agregar", "modificar", "desactivar"] },
          parametros: {
            type: "object",
            properties: {
              categoria: { type: ["string", "null"] },
              clave: { type: ["string", "null"] },
              valor: { type: ["string", "null"] },
              prioridad: { type: ["number", "null"] },
              id_fila: { type: ["number", "null"] },
              fecha_inicio: { type: ["string", "null"] },
              fecha_caducidad: { type: ["string", "null"] }
            },
            required: ["categoria", "clave", "valor", "prioridad", "id_fila", "fecha_inicio", "fecha_caducidad"],
            additionalProperties: false
          }
        },
        required: ["mensaje", "accion", "parametros"],
        additionalProperties: false
      }
    }
  },

  // 4. Ejecutar acción confirmada
  {
    type: "function",
    function: {
      name: "ejecutar_accion",
      description: "Ejecutar una acción que el usuario ya confirmó",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          accion: { type: "string", enum: ["agregar", "modificar", "desactivar"] },
          parametros: {
            type: "object",
            properties: {
              categoria: { type: ["string", "null"] },
              clave: { type: ["string", "null"] },
              valor: { type: ["string", "null"] },
              prioridad: { type: ["number", "null"] },
              id_fila: { type: ["number", "null"] },
              fecha_inicio: { type: ["string", "null"] },
              fecha_caducidad: { type: ["string", "null"] }
            },
            required: ["categoria", "clave", "valor", "prioridad", "id_fila", "fecha_inicio", "fecha_caducidad"],
            additionalProperties: false
          }
        },
        required: ["mensaje", "accion", "parametros"],
        additionalProperties: false
      }
    }
  },

  // 5. Consultar comentarios
  {
    type: "function",
    function: {
      name: "consultar_comentarios",
      description: "Buscar y filtrar comentarios de la marca",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          filtros: {
            type: "object",
            properties: {
              soloInapropiados: { type: ["boolean", "null"] },
              busqueda: { type: ["string", "null"] },
              limite: { type: ["number", "null"] },
              fechaDesde: { type: ["string", "null"] },
              fechaHasta: { type: ["string", "null"] }
            },
            required: ["soloInapropiados", "busqueda", "limite", "fechaDesde", "fechaHasta"],
            additionalProperties: false
          }
        },
        required: ["mensaje", "filtros"],
        additionalProperties: false
      }
    }
  },

  // 6. Sugerir delegación
  {
    type: "function",
    function: {
      name: "sugerir_delegacion",
      description: "Sugerir que otro agente maneje la tarea",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          mensaje: { type: "string" },
          agente_destino: { type: "string", enum: ["chatia", "controlador"] },
          razon: { type: "string" },
          contexto: { type: "string" }
        },
        required: ["mensaje", "agente_destino", "razon", "contexto"],
        additionalProperties: false
      }
    }
  }
]
```

---

## 6. Código de Implementación Propuesto

### Nueva versión de procesarMensajeIA

```javascript
export const procesarMensajeIA = async (mensajeUsuario, contexto) => {
  const { nombreMarca, datosMarca, historial, accionPendienteActual } = contexto

  const systemPrompt = `Eres un asistente para administrar datos de la marca "${nombreMarca}".
Usa las funciones disponibles para responder al usuario.
...`  // Prompt simplificado, sin explicar formato JSON

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formatearHistorialCompartido(historial, 'controlador'),
    { role: 'user', content: mensajeUsuario }
  ]

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    tools: toolsControlador,
    tool_choice: 'required',  // DEBE usar una función
    temperature: 0.7
  })

  const message = response.choices[0].message

  // Verificar si llamó una función
  if (message.tool_calls && message.tool_calls.length > 0) {
    const toolCall = message.tool_calls[0]
    const functionName = toolCall.function.name
    const args = JSON.parse(toolCall.function.arguments)  // Siempre JSON válido

    // Mapear función a tipo de respuesta
    switch (functionName) {
      case 'responder_texto':
        return { tipo: 'texto', contenido: args.mensaje }

      case 'mostrar_tabla':
        return {
          tipo: 'tabla',
          contenido: args.mensaje,
          datos: { columnas: args.columnas, filas: args.filas }
        }

      case 'pedir_confirmacion':
        return {
          tipo: 'confirmacion',
          contenido: args.mensaje,
          accionPendiente: { accion: args.accion, parametros: args.parametros }
        }

      case 'ejecutar_accion':
        return {
          tipo: 'accion_confirmada',
          contenido: args.mensaje,
          ejecutar: { accion: args.accion, parametros: args.parametros }
        }

      case 'consultar_comentarios':
        return {
          tipo: 'consultar_comentarios',
          contenido: args.mensaje,
          filtros: args.filtros
        }

      case 'sugerir_delegacion':
        return {
          tipo: 'texto',
          contenido: args.mensaje,
          delegacion: {
            sugerida: true,
            agenteDestino: args.agente_destino,
            razon: args.razon,
            datosParaDelegar: { contexto: args.contexto }
          }
        }
    }
  }

  // Fallback si no llamó función (no debería pasar con tool_choice: required)
  return {
    tipo: 'texto',
    contenido: message.content || 'No pude procesar tu solicitud.'
  }
}
```

---

## 7. Comparación: Antes vs Después

| Aspecto | Método Actual | Con Function Calling |
|---------|---------------|----------------------|
| Garantía de JSON | No (best effort) | Sí (con strict: true) |
| Parsing manual | ~100 líneas de código | ~5 líneas |
| Formato en prompt | 200+ líneas explicando formato | 0 líneas |
| Manejo de errores | Múltiples try/catch | Mínimo |
| Tipos de respuesta | String que parseamos | Función específica |
| Schema validation | Manual | Automático |

---

## 8. Consideraciones de Migración

### Pasos para implementar:

1. **Definir tools array** con todas las funciones necesarias
2. **Simplificar system prompt** - remover instrucciones de formato JSON
3. **Cambiar llamada a API** - agregar `tools` y `tool_choice`
4. **Actualizar procesamiento de respuesta** - usar `tool_calls` en lugar de `content`
5. **Mantener compatibilidad** - Chat.jsx no necesita cambios si la estructura de retorno es igual

### Archivo a modificar:
- `src/services/openai.js` - Funciones `procesarMensajeIA` y `chatDirectoIA`

### Archivos que NO cambian:
- `src/pages/Chat.jsx` - Solo consume la respuesta normalizada
- `src/components/MensajeChat.jsx` - Solo renderiza según `tipo`

---

## 9. Fuentes

- [Function calling | OpenAI API](https://platform.openai.com/docs/guides/function-calling)
- [Structured model outputs | OpenAI API](https://platform.openai.com/docs/guides/structured-outputs)
- [Introduction to Structured Outputs | OpenAI Cookbook](https://cookbook.openai.com/examples/structured_outputs_intro)
- [OpenAI JSON Mode vs Functions | Towards AI](https://towardsai.net/p/l/openai-json-mode-vs-functions)
- [Getting Started: Tool calling with JS and OpenAI | Medium](https://medium.com/@kenzic/getting-started-tool-calling-with-js-and-openai-dc8e1d3580fe)
- [Handling Function Calls | OpenAI Cookbook](https://cookbook.openai.com/examples/reasoning_function_calls)

---

## 10. Recomendación

**Se recomienda migrar a Function Calling con strict mode** porque:

1. **Elimina bugs de parsing**: No más "el modelo devolvió texto en lugar de JSON"
2. **Código más limpio**: ~100 líneas menos de parsing defensivo
3. **Mejor mantenibilidad**: Schema centralizado en lugar de instrucciones en prompt
4. **Preparado para el futuro**: Es el estándar de OpenAI hacia adelante

La migración es de riesgo bajo porque la estructura de respuesta que retornamos a Chat.jsx puede mantenerse igual.
