# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Steel Browser is an open-source browser API for AI agents and applications. It provides a managed browser automation platform using Chrome/Chromium with Puppeteer, offering session management, proxy support, extensions, and debugging tools.

## Architecture

This is a monorepo with three main workspaces:

- **api/**: Fastify-based Node.js backend that manages browser instances
- **ui/**: React frontend for session management and debugging
- **repl/**: Interactive testing environment

### Core Components

**API Structure** (`api/src/`):
- `steel-browser-plugin.ts`: Main Fastify plugin entry point
- `services/cdp/cdp.service.ts`: Chrome DevTools Protocol service - manages browser lifecycle
- `services/session.service.ts`: Session management with isolated contexts
- `plugins/`: Modular Fastify plugins for different functionalities
- `modules/`: API route handlers and schemas organized by feature

**Plugin System**:
- Base plugins in `services/cdp/plugins/core/`
- Event-driven architecture with lifecycle hooks
- Extensible for custom functionality (ad-blocking, stealth, etc.)

**Frontend Structure** (`ui/src/`):
- React with TypeScript and Vite
- Real-time session monitoring via WebSocket
- Auto-generated API client from OpenAPI specs

## Development Commands

### Root Level
```bash
# Install all dependencies
npm install

# Build all workspaces
npm run build

# Start development mode (API + UI)
npm run dev

# Prepare git hooks
npm run prepare
```

### API Workspace (`api/`)
```bash
# Start API in development mode
npm run dev -w api

# Build API
npm run build -w api

# Lint code
npm run lint -w api

# Format code
npm run pretty -w api

# Build recorder extension
npm run prepare:recorder -w api

# Generate OpenAPI documentation
npm run generate:openapi -w api
```

### UI Workspace (`ui/`)
```bash
# Start UI in development mode
npm run dev -w ui

# Build UI
npm run build -w ui

# Lint code
npm run lint -w ui

# Generate API client
npm run generate-api -w ui
```

### REPL Workspace (`repl/`)
```bash
# Start interactive REPL
npm start -w repl
```

## Docker Development

```bash
# Development with hot reload
docker compose -f docker-compose.dev.yml up --build

# Production deployment
docker compose up

# Individual services
docker compose -f docker-compose.dev.yml up api
docker compose -f docker-compose.dev.yml up ui
```

## Key Development Notes

### Browser Management
- Uses Puppeteer-core for Chrome automation
- Chrome executable path configurable via `CHROME_EXECUTABLE_PATH`
- Supports headless and headful modes
- Session isolation via browser contexts

### Plugin Development
- Extend `BasePlugin` class in `api/src/services/cdp/plugins/core/base-plugin.ts`
- Lifecycle hooks: `onBrowserLaunch`, `onPageCreated`, `onPageNavigate`, etc.
- Plugin manager handles error isolation and coordination

### API Design
- Fastify plugin architecture
- Zod schema validation for all endpoints
- OpenAPI documentation at `/documentation`
- WebSocket support for real-time features

### Testing
- Currently no test suite implemented
- API health check available at `/health`
- Use REPL workspace for manual testing

### Environment Variables
Key configuration options:
- `CHROME_EXECUTABLE_PATH`: Path to Chrome binary
- `CHROME_HEADLESS`: Run Chrome in headless mode
- `ENABLE_VERBOSE_LOGGING`: Enable detailed logging
- `HOST`/`PORT`: Server binding configuration

## File Structure Patterns

- API routes follow RESTful conventions in `modules/*/`
- Schemas defined alongside routes using Zod
- Services in `services/` directory
- Utilities in `utils/` with domain-specific subdirectories
- TypeScript types in `types/` with index exports

## Chrome Integration

The system requires Chrome/Chromium installation. Default paths checked:
- Linux: `/usr/bin/google-chrome`
- macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`

Custom paths can be set via `CHROME_EXECUTABLE_PATH` environment variable.