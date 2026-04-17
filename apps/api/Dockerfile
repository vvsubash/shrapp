FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy only the api package
COPY apps/api/ apps/api/

RUN pnpm install --filter @shrapp/api --frozen-lockfile

WORKDIR /app/apps/api
RUN pnpm build

EXPOSE 8080
CMD ["node", "dist/index.js"]
