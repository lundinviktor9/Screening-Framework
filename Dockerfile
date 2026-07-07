# syntax=docker/dockerfile:1
#
# Single-container build for the Brunswick Screening Framework.
#   Stage 1 (node)   — webpack production build of the React frontend.
#   Stage 2 (python) — FastAPI + LibreOffice; serves the API AND the built
#                      frontend (same-origin) from /app/static.
#
# All mutable state lives under DATA_DIR (/data) — mount a persistent volume there.

# ---- Stage 1: build the frontend -------------------------------------------------
FROM node:20-slim AS frontend
WORKDIR /app

# Mapbox token is baked into the bundle at build time (webpack DefinePlugin).
# API_BASE defaults to '' (same-origin) for a production build, so it is optional.
# On Railway these are supplied automatically from the service variables.
ARG MAPBOX_TOKEN=""
ARG API_BASE=""
ENV MAPBOX_TOKEN=$MAPBOX_TOKEN \
    API_BASE=$API_BASE

COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build      # -> /app/dist (bundle.<hash>.js + index.html)

# ---- Stage 2: python runtime -----------------------------------------------------
FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DATA_DIR=/data \
    HOME=/tmp \
    PORT=8787

# LibreOffice Calc: headless recalc of the underwrite model (soffice). Required.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libreoffice-calc \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps first (layer cache).
COPY extractor/requirements.txt ./extractor/requirements.txt
RUN pip install --no-cache-dir -r extractor/requirements.txt

# Application code + read-only data.
COPY extractor/ ./extractor/
COPY underwrite/ ./underwrite/
COPY scrapers/config/ ./scrapers/config/
COPY public/ ./public/
COPY src/data/ ./src/data/

# Built frontend -> static/. Bundle+index from the build stage's dist; the JSON/
# geojson data files from public/ (webpack does not copy public/ into dist).
COPY --from=frontend /app/dist/ ./static/
COPY --from=frontend /app/public/ ./static/

EXPOSE 8787

# Seed deals.json into the (empty on first deploy) volume, then start the server
# bound to Railway's $PORT. Inlined to avoid a separate script (CRLF/exec-bit safe).
CMD ["sh", "-c", "mkdir -p \"$DATA_DIR\"; if [ ! -f \"$DATA_DIR/deals.json\" ] && [ -f /app/src/data/deals.json ]; then cp /app/src/data/deals.json \"$DATA_DIR/deals.json\"; fi; exec uvicorn extractor.server:app --host 0.0.0.0 --port ${PORT:-8787}"]
