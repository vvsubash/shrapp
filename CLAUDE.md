# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

pnpm workspace monorepo under the `@shrapp` scope. Currently a scaffold — no application packages yet.

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

- `pnpm-workspace.yaml` defines `apps/*` as the active workspace glob.
- All packages are scoped under `@shrapp/`.
- Use `workspace:*` for inter-package dependencies.
- pnpm only — do not use npm or yarn.
