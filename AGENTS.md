# AGENTS.md

Guidance for AI agents working in this repository.

## Product overview

**freemoney** is a client-side personal finance SPA (Vite + TypeScript). There is no backend, database, or Docker. All state lives in browser `localStorage`.

## Branch note

The `main` branch may only contain a stub README. The full application lives on `cursor/freemoney-app-c4fe`. Check out that branch (or whichever branch contains `package.json`) before installing dependencies or running the app.

## Development commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite dev server (default: http://localhost:5173) |
| `npm run build` | Type-check (`tsc`) and production build to `dist/` |
| `npm run preview` | Serve the production build locally |

There is no separate lint or test script. `npm run build` is the primary static verification step (TypeScript + Vite).

## Cursor Cloud specific instructions

- **Single required service:** Vite dev server (`npm run dev`). Bind to all interfaces when testing from the VM desktop browser: `npm run dev -- --host 0.0.0.0`.
- **No env files or secrets** are required for local development.
- **Optional external API:** Exchange-rate refresh calls `https://open.er-api.com/v6/latest/USD`. The app falls back to a hardcoded rate if the network call fails; core flows work offline.
- **Persistence:** Data is stored in browser `localStorage` (`freemoney-state-v1`). A fresh browser profile starts with seeded demo transactions.
- **Hello-world smoke test:** Open the app → Spending tab → send `1500 coffee` in the WhatsApp-style form → confirm a new Food expense appears in history.
- **Package manager:** npm (`package-lock.json` is present).
