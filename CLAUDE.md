# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---
description: Bun + React + Tailwind + shadcn/ui template with full-stack capabilities
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

## Project Overview

This is a modern full-stack web application template built with:
- **Bun** as the runtime and bundler (replaces Node.js/npm/vite)
- **React 19** for the frontend
- **TypeScript** with strict type checking
- **Tailwind CSS 4** for styling
- **shadcn/ui** components (New York style)
- **Lucide React** for icons

## Development Commands

```bash
# Install dependencies
bun install

# Start development server with hot reload
bun dev
# Equivalent: bun --hot src/index.tsx

# Build for production
bun run build

# Start production server
bun start
# Equivalent: NODE_ENV=production bun src/index.tsx

# Run tests
bun test
```

## Architecture

### Server Architecture (`src/index.tsx`)
- Uses `Bun.serve()` with route-based API design
- Serves the React app via HTML imports (no separate bundler needed)
- Hot module replacement (HMR) enabled in development
- API routes under `/api/*` namespace

### Frontend Architecture
- **Entry Point**: `src/index.html` imports `src/frontend.tsx`
- **Main App**: `src/App.tsx` - main React component
- **Components**: `src/components/ui/` - shadcn/ui components
- **Utils**: `src/lib/utils.ts` - utility functions (includes `cn` helper)
- **Styling**: Uses Tailwind CSS with component variants

### File Structure
```
src/
├── index.tsx          # Bun server with API routes
├── index.html         # HTML entry point
├── frontend.tsx       # React app initialization
├── App.tsx           # Main React component
├── APITester.tsx     # Demo API testing component
├── components/ui/    # shadcn/ui components
└── lib/utils.ts      # Utility functions
```

## Bun-Specific Guidelines

**Use Bun instead of Node.js tooling:**
- `bun <file>` instead of `node <file>` or `ts-node <file>`
- `bun test` instead of `jest` or `vitest`
- `bun run build` instead of `webpack` or `vite`
- `bun install` instead of `npm install`

**Bun APIs:**
- `Bun.serve()` for HTTP server (don't use Express)
- `bun:sqlite` for SQLite (don't use better-sqlite3)
- `WebSocket` is built-in (don't use ws)
- `Bun.file` preferred over `node:fs`
- Bun automatically loads .env files

## Frontend Development

### Component Development
- Follow shadcn/ui patterns in `src/components/ui/`
- Use the `cn()` utility from `src/lib/utils.ts` for conditional classes
- Import paths use `@/` alias (maps to `src/`)

### Styling
- Tailwind CSS 4 with CSS variables for theming
- Component variants using `class-variance-authority`
- Use `clsx` and `tailwind-merge` for conditional styling

### State Management
- Use React 19 built-in state management
- No external state library currently configured

## API Development

### Route Structure
Define routes in `src/index.tsx` using the Bun.serve routes object:

```ts
routes: {
  "/*": index,                    // Serve React app for unmatched routes
  "/api/hello": {                 // REST endpoint with multiple methods
    GET: async (req) => { ... },
    PUT: async (req) => { ... }
  },
  "/api/hello/:name": async (req) => {  // Parameterized route
    const name = req.params.name;
    return Response.json({ message: `Hello, ${name}!` });
  }
}
```

### Response Patterns
- Use `Response.json()` for JSON responses
- Access route parameters via `req.params`
- Form data via `new FormData(req)`

## Build System

### Custom Build Script (`build.ts`)
- Handles HTML entry points automatically
- Built-in Tailwind CSS processing via `bun-plugin-tailwind`
- Minification and sourcemaps enabled by default
- Supports CLI arguments for build customization

### TypeScript Configuration
- Strict mode enabled with additional checks
- Path aliases: `@/*` maps to `src/*`
- React JSX transform
- Bundle-friendly module resolution

## Testing

Use Bun's built-in test runner:

```ts
import { test, expect } from "bun:test";

test("example test", () => {
  expect(1 + 1).toBe(2);
});
```

No test files exist yet - create them as needed with `.test.ts` or `.test.tsx` extensions.
