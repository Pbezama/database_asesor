# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm run dev      # Start development server (Vite with HMR)
npm run build    # Production build to dist/
npm run preview  # Preview production build locally
npm run lint     # Run ESLint
```

## Architecture Overview

This is a **Brand Administration Panel with AI Assistant** built with React 19 + Vite. Users can manage brand data and comments through natural language chat powered by GPT-5.1.

### Core Data Flow

```
User Input → Chat.jsx → openai.js (GPT-5.1) → supabase.js (PostgreSQL) → MensajeChat.jsx (render)
                ↓
         Mode Switch? → formatearHistorialCompartido() → Include comentariosCompletos, datos, tabla_preview
```

### Key Architectural Patterns

**Multi-Agent System with Shared History:**
- **Controlador Mode**: GPT-5.1 interprets natural language commands and executes CRUD operations on Supabase. Can suggest delegating creative tasks to ChatIA.
- **ChatIA Mode**: Creative assistant for generating ideas, drafting responses, analyzing comments. Can suggest delegating database operations to Controlador.
- **Shared Context**: When switching modes, the new agent receives full conversation history including comments, tables, and data shown previously via `formatearHistorialCompartido()`.

**Delegation System:**
- Agents can suggest delegation with `delegacion.sugerida: true`
- Visual button appears: "→ Delegar a ChatIA" or "→ Delegar a Controlador"
- `ejecutarDelegacion()` handles automatic mode switching with context

**Brand Data Context:**
- Data stored represents instructions for an AI assistant ("la voz de la marca") that responds to social media comments
- Categories: `prompt`, `promocion`, `regla`, `horario`, `info`, `precio`, `estilo_respuesta`, `observacion`

**Two-Step Confirmation**: Critical operations (add/modify/delete) require user confirmation before execution via `accionPendiente` state in Chat.jsx.

**Session Management**: Each chat session has a UUID. Messages are limited to 20 per session (`mensajesCount` state).

### Services Layer (`src/services/`)

| Service | Purpose |
|---------|---------|
| `supabase.js` | All database operations: auth, CRUD for `base_cuentas`, `logs_comentarios`, `mensajes_chat` |
| `openai.js` | `procesarMensajeIA()` for Controlador mode, `chatDirectoIA()` for ChatIA mode, `formatearHistorialCompartido()` for context sharing |
| `downloadService.js` | Export data to CSV, Excel, JSON, PDF, HTML formats |
| `analysisService.js` | AI-powered analysis of brand data and comments |

### Key Functions in openai.js

| Function | Purpose |
|----------|---------|
| `procesarMensajeIA()` | Controlador: parses intent, executes DB operations, handles delegation suggestions |
| `chatDirectoIA()` | ChatIA: creative conversations, comment analysis, response drafting |
| `formatearHistorialCompartido()` | Formats message history including `comentariosCompletos`, `datos`, `tabla_preview` for cross-agent context |
| `transcribirAudio()` | Whisper API for voice input |

### Component Responsibilities

- **Chat.jsx**: Main orchestrator - handles message flow, action confirmation, mode switching (`toggleModoChatIA()`), delegation (`ejecutarDelegacion()`), mobile/desktop layouts with bottom navigation
- **MensajeChat.jsx**: Renders different message types (text, table, confirmation, delegation suggestions, mode separators). Tables include filtering, sorting, pagination, and download. Delegation buttons trigger `onDelegacion` callback.
- **EditorManual.jsx**: Visual CRUD panel for direct data management without chat
- **AuthContext.jsx**: Session persistence via localStorage, Super Admin detection

### Message Structure

Messages in the `mensajes` state array can have:
```javascript
{
  rol: 'user' | 'assistant',
  contenido: string,
  tipo: 'texto' | 'tabla' | 'confirmacion' | 'exito' | 'error' | 'separador' | 'delegacion',
  modoOrigen: 'controlador' | 'chatia',
  datos: { columnas, filas } | array,      // For tables
  comentariosCompletos: array,              // Full comment data for sharing
  delegacion: { sugerida, agenteDestino, razon, datosParaDelegar }
}
```

### Supabase Tables

- `usuarios` - Authentication and permissions
- `base_cuentas` - Brand data (categorized: Promociones, Reglas, Horarios, Precios, etc.)
- `logs_comentarios` - Customer comments with inappropriate content detection
- `mensajes_chat` - Chat history per session
- `logs_acciones_admin` - Audit trail

## Environment Variables

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_KEY=xxx_anon_key
VITE_OPENAI_API_KEY=sk-xxx
```

## Deployment

Deployed on Vercel and Railway. The `vercel.json` configures SPA routing for React Router.

## UI/UX Design

- **Light theme**: Cream backgrounds (#faf8f5), dark text for contrast
- **Professional icons**: Minimalist symbols (◈ Controlador, ◆ ChatIA, ◯ User, ✓ Success, ✕ Error)
- **Mobile-first**: Bottom navigation with 3 buttons (Chat BD, Editor, Chat IA), full-screen panels
- **Mode separators**: Visual dividers when switching between Controlador and ChatIA
- **Delegation buttons**: Yellow/gold styled buttons for delegation suggestions

## Recent Changes Summary

1. **GPT-5.1 upgrade**: Updated from GPT-4 to GPT-5.1 model
2. **Multi-agent delegation**: Agents can suggest delegating tasks to each other
3. **Shared history**: Full conversation context including tables and comments shared between modes
4. **Brand voice context**: Prompts clarify that data is for an AI that acts as "la voz de la marca" on social media
5. **Comment sharing fix**: `comentariosCompletos` field ensures ChatIA sees comments consulted by Controlador
