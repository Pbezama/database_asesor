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

This is a **Brand Administration Panel with AI Assistant** built with React 19 + Vite. Users can manage brand data and comments through natural language chat powered by GPT-4.

### Core Data Flow

```
User Input → Chat.jsx → openai.js (GPT-4) → supabase.js (PostgreSQL) → MensajeChat.jsx (render)
```

### Key Architectural Patterns

**Two Chat Modes:**
- **Controlador Mode**: GPT-4 interprets natural language commands and executes CRUD operations on Supabase
- **ChatIA Mode**: Direct conversation with GPT-4 without database access

**Two-Step Confirmation**: Critical operations (add/modify/delete) require user confirmation before execution via `accionPendiente` state in Chat.jsx.

**Session Management**: Each chat session has a UUID. Messages are limited to 20 per session (`mensajesCount` state).

### Services Layer (`src/services/`)

| Service | Purpose |
|---------|---------|
| `supabase.js` | All database operations: auth, CRUD for `base_cuentas`, `logs_comentarios`, `mensajes_chat` |
| `openai.js` | `procesarMensajeIA()` for Controlador mode, `chatDirectoIA()` for ChatIA mode |
| `downloadService.js` | Export data to CSV, Excel, JSON, PDF, HTML formats |
| `analysisService.js` | AI-powered analysis of brand data and comments |

### Component Responsibilities

- **Chat.jsx**: Main orchestrator - handles message flow, action confirmation, mode switching, mobile/desktop layouts
- **MensajeChat.jsx**: Renders different message types (text, table, confirmation buttons, success/error). Tables include filtering, sorting, pagination, and download capabilities
- **EditorManual.jsx**: Visual CRUD panel for direct data management without chat
- **AuthContext.jsx**: Session persistence via localStorage, Super Admin detection

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

Deployed on Vercel. The `vercel.json` configures SPA routing for React Router.
