# Greenhouse — single image: backend API + MQTT broker, also serves the web app.
# Built for Dokploy (Docker Compose deployment).

# ---------- 1. build the web app ----------
FROM node:22-slim AS web
WORKDIR /web
COPY app/package.json app/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY app/ ./
RUN npm run build            # outputs /web/dist

# ---------- 2. build the backend (TypeScript -> dist) ----------
FROM node:22-slim AS api-build
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --no-audit --no-fund     # native better-sqlite3 builds here
COPY backend/ ./
RUN npm run build            # outputs /srv/dist

# ---------- 3. runtime ----------
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /srv
# node_modules (with the already-compiled native module) + compiled backend
COPY --from=api-build /srv/node_modules ./node_modules
COPY --from=api-build /srv/dist ./dist
COPY --from=api-build /srv/package.json ./package.json
# the built web app, served at / by the backend
COPY --from=web /web/dist ./public
# persistent data lives here (mounted as a volume)
RUN mkdir -p /data/uploads
EXPOSE 8080 1883
CMD ["node", "dist/index.js"]
