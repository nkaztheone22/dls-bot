# DLS WhatsApp Bot + Dashboard

## Overview

A full-stack WhatsApp group moderation bot with a web control panel. The bot runs as part of the API server and connects to WhatsApp via Baileys (multi-device protocol). The dashboard provides real-time monitoring and configuration.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **WhatsApp**: @whiskeysockets/baileys (multi-device)
- **Frontend**: React + Vite + Tailwind CSS

## Artifacts

- **`artifacts/api-server`** — Express API server + WhatsApp bot logic (port 8080, path `/api`)
- **`artifacts/dashboard`** — React Vite web dashboard (path `/`)

## Bot Features

- **Anti-link**: Deletes messages containing URLs or WhatsApp invite links
- **Anti-word**: Warns users who use banned words; kicks after reaching warn limit
- **Warning system**: Persistent per-user warning counts with auto-expiry (24h)
- **Admin commands**: `!antilink`, `!antiword`, `!warnlimit`, `!warnings`, `!delwarn`, `!addword`, `!removeword`, `!listwords`, `!help`

## Dashboard Pages

- `/` — Status dashboard: bot connection state, QR code display, live stats, activity log
- `/settings` — Toggle antilink/antiword/welcome, set warn limit, manage banned words
- `/warnings` — View and clear active user warnings

## Bot Files

- `artifacts/api-server/src/bot/state.ts` — Shared mutable state, file persistence (data/ dir)
- `artifacts/api-server/src/bot/bot.ts` — Baileys connection logic, message handlers
- `artifacts/api-server/src/routes/bot.ts` — GET /bot/status, POST /bot/restart, POST /bot/logout
- `artifacts/api-server/src/routes/settings.ts` — Settings CRUD
- `artifacts/api-server/src/routes/warnings.ts` — Warnings CRUD
- `artifacts/api-server/src/routes/activity.ts` — Activity log + stats

## Data Persistence

Settings and warnings are stored in `data/settings.json` and `data/warnings.json` in the project root. Auth session is stored in `auth_info/`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/api-server run build` — rebuild API server

## First-time Setup

On first run, the bot will generate a QR code visible on the dashboard's home page. Scan it with WhatsApp to authenticate the bot. The session is saved to `auth_info/` and persists across restarts.

## Build Notes

- `@whiskeysockets/baileys`, `@hapi/boom`, and `qrcode` are externalized in `build.mjs` (not bundled by esbuild — loaded from node_modules at runtime)
- The bot starts automatically when the API server starts
