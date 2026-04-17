# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

pnpm workspace monorepo under the `@shrapp` scope. Contains three apps: `usersapp` (React SPA), `auth` (Cloudflare Workers), and `api` (GCP Cloud Run).

## Commands

```bash
# Install all dependencies
pnpm install

# Build / dev / test / lint all workspace packages
pnpm build
pnpm dev        # runs all dev servers in parallel
pnpm test
pnpm lint

# Target a specific package
pnpm --filter @shrapp/<name> dev
pnpm --filter @shrapp/<name> add <dep>
pnpm --filter @shrapp/<name> add -D <dep>
```

## Workspace structure

- `pnpm-workspace.yaml` defines `apps/*` as the active workspace glob (`libs/*` and `tools/*` are commented out placeholders).
- All packages are scoped under `@shrapp/`.
- Use `workspace:*` for inter-package dependencies.
- pnpm only — do not use npm or yarn.

## Apps

### usersapp

React 19 + TypeScript SPA built with Vite (using `rolldown-vite` as a drop-in replacement via pnpm override). Uses React Router v7 with `BrowserRouter` for client-side routing.

**Key architecture:**
- `main.tsx` — entry point; wraps `<App />` in `BrowserRouter` + `StrictMode`
- `App.tsx` — renders `<Routes>` from the route config
- `router.tsx` — central route definitions as `RouteObject[]`; all routes nest under `RootLayout`
- `layouts/RootLayout.tsx` — shared layout with nav and `<Outlet />`
- `pages/` — route page components (some use folder convention like `Home/Home.tsx`, others are flat files)
- `components/` — shared UI components (e.g. `Button/Button.tsx`)
- CSS uses [Open Props](https://open-props.style/) design tokens

**Dev commands:**
```bash
pnpm --filter usersapp dev      # Vite dev server
pnpm --filter usersapp build    # tsc -b && vite build
pnpm --filter usersapp lint     # eslint
pnpm --filter usersapp preview  # preview production build
```

Note: the package name in `package.json` is `usersapp` (not `@shrapp/usersapp`), so filter by `usersapp`.

### auth

Hono + better-auth microservice deployed to **Cloudflare Workers**. Uses D1 (SQLite) as primary database and Cloudflare KV as secondary storage (sessions/rate-limiting). Authentication is username/password via better-auth's `username` plugin.

**Key architecture:**
- `src/index.ts` — Hono app entry; mounts better-auth handler on `/api/auth/**`
- `src/auth.ts` — `createAuth(env)` factory; configures better-auth with D1 + KV secondary storage + username plugin
- `src/types.ts` — `Env` bindings interface (D1, KV, secrets)
- `wrangler.jsonc` — Cloudflare config (D1 + KV bindings, placeholder IDs to replace)

**Setup (one-time):**
```bash
cd apps/auth
wrangler d1 create shrapp-auth-db    # then put database_id in wrangler.jsonc
wrangler kv namespace create AUTH_KV  # then put id in wrangler.jsonc
wrangler secret put BETTER_AUTH_SECRET
```

**Dev commands:**
```bash
pnpm --filter @shrapp/auth dev       # wrangler dev (local Workers runtime)
pnpm --filter @shrapp/auth deploy    # wrangler deploy
```

**Note:** Cloudflare KV has a 60-second minimum TTL. The secondary storage adapter clamps TTLs accordingly.

### api

Hono microservice deployed to **GCP Cloud Run** via Docker. Uses `@hono/node-server` for Node.js runtime.

**Key architecture:**
- `src/index.ts` — Hono app entry; `serve()` on `PORT` env var (default 8080)
- `Dockerfile` — multi-stage build from workspace root context

**Dev commands:**
```bash
pnpm --filter @shrapp/api dev        # tsx watch (hot-reload)
pnpm --filter @shrapp/api build      # tsc -b
pnpm --filter @shrapp/api start      # node dist/index.js
pnpm --filter @shrapp/api deploy     # gcloud run deploy
```
