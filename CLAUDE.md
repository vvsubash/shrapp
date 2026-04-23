# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

pnpm workspace monorepo under the `@shrapp` scope. Attendance extraction app for construction sites — a site manager photographs a paper register, AI extracts names + work locations, the system matches against an employee roster, and commits confirmed attendance records.

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

- `pnpm-workspace.yaml` defines `apps/*` and `libs/*` as active workspace globs.
- All packages are scoped under `@shrapp/`.
- Use `workspace:*` for inter-package dependencies.
- pnpm only — do not use npm or yarn.

## Architecture

Everything on Cloudflare. Two apps + one shared library:
- `apps/api` — Hono on Workers (D1, R2, Workers AI bindings)
- `apps/web` — Vite + React 19 + Tailwind v4 + TanStack Query on Pages
- `libs/shared` — Zod schemas, TypeScript types, constants (raw TS source exports, no build)

Auth: Cloudflare Access (email OTP, no in-app auth code).

## Apps

### api

Hono microservice deployed to **Cloudflare Workers**. Uses D1 (SQLite) with Drizzle ORM, R2 for image storage, and Workers AI for attendance register extraction.

**Key architecture:**
- `src/index.ts` — Hono app entry; mounts route groups under `/api`
- `src/env.ts` — `Env` bindings interface (D1, R2, AI, ALLOWED_ORIGIN)
- `src/db/schema.ts` — Drizzle table definitions (employees, work_locations, extractions, extraction_rows, attendance)
- `src/db/index.ts` — `createDb(d1)` factory
- `src/routes/` — employees, locations, extract, commit route handlers
- `src/lib/` — trigram matching, AI prompt builder, name normalization
- `migrations/` — Drizzle-generated D1 migration SQL files

**API routes:**
- `GET /api/health` — health check
- `GET /api/employees` — active roster
- `POST /api/employees` — create employee
- `DELETE /api/employees/:id` — soft-delete (archive)
- `GET /api/locations` — all locations
- `POST /api/locations` — create location
- `POST /api/extract` — upload image, run AI extraction + trigram matching
- `GET /api/extractions/:id` — fetch extraction with rows
- `POST /api/commit` — commit reviewed rows to attendance (transactional)

**Dev commands:**
```bash
pnpm --filter @shrapp/api dev            # wrangler dev (port 8787)
pnpm --filter @shrapp/api deploy          # wrangler deploy
pnpm --filter @shrapp/api generate        # drizzle-kit generate (new migration)
pnpm --filter @shrapp/api migrate:local   # apply migrations locally
pnpm --filter @shrapp/api migrate:remote  # apply migrations to production D1
```

### web

React 19 + TypeScript SPA built with Vite + Tailwind v4. Uses TanStack Query for server state.

**Key architecture:**
- `src/main.tsx` — entry point
- `src/App.tsx` — BrowserRouter + QueryClientProvider + routes
- `src/components/Layout.tsx` — shared layout with nav and `<Outlet />`
- `src/pages/` — UploadPage, ReviewPage, EmployeesPage
- `src/lib/api.ts` — typed fetch wrapper for all API calls
- `src/lib/queries.ts` — TanStack Query hooks
- `src/lib/image-utils.ts` — client-side image preprocessing (downscale + JPEG)
- `src/app.css` — Tailwind v4 theme with CSS variables

**Dev commands:**
```bash
pnpm --filter @shrapp/web dev      # Vite dev server (port 5173, proxies /api to 8787)
pnpm --filter @shrapp/web build    # tsc -b && vite build
pnpm --filter @shrapp/web preview  # preview production build
pnpm --filter @shrapp/web deploy   # wrangler deploy (Cloudflare Pages)
```

### shared (libs/shared)

Shared TypeScript library with Zod schemas, types, and constants. No build step — raw `.ts` source exports consumed by Vite and wrangler bundlers.

## Database

D1 (SQLite) with Drizzle ORM. Schema in `apps/api/src/db/schema.ts`, migrations in `apps/api/migrations/`.

**Tables:** employees, work_locations, extractions, extraction_rows, attendance.

**Key constraints:**
- `UNIQUE(employee_id, work_date)` on attendance — one record per person per day
- Employees use soft-delete via `archived_at` column
- `extractions.r2_key` is UNIQUE (SHA-256 of image bytes for idempotent re-upload)

## Cloudflare Setup (one-time)

```bash
wrangler d1 create shrapp-db          # capture database_id for wrangler.jsonc
wrangler r2 bucket create shrapp-uploads
# Cloudflare Access: configure via dashboard
```
