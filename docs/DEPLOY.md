# Deploying the Brunswick Screening Framework (Railway)

Phase 3 packages the whole app — FastAPI API **and** the built React frontend — into a
single Docker container with LibreOffice for the underwrite recalc, fronted by a session
login. This doc is the runbook.

## What the container is

- **One image, two build stages** (`Dockerfile`):
  - `node:20` → `npm ci && npm run build` (webpack production build → `dist/`).
  - `python:3.11-slim` → `libreoffice-calc` + `pip install -r extractor/requirements.txt`,
    copies the app code + `public/data` + the built bundle into `static/`.
- **FastAPI serves everything same-origin**: API routes first, then a SPA static mount at
  `/` that falls back to `index.html` for client routes (e.g. `/pipeline/<id>`). The frontend
  calls the API with a relative base (`API_BASE=''` in production), so there is no CORS and no
  hardcoded `localhost:8787` in the bundle.
- **All mutable state lives under `DATA_DIR`** (`/data`): `deals.json`, `underwrite_runs/`,
  `showcase_img/`, `pdfs_ingested/`. Mount a **persistent volume** there or data is lost on
  every redeploy (the container filesystem is ephemeral).

## One-time setup

### 1. Generate login credentials
For each user, hash their password (locally, with deps installed):
```bash
python -m extractor.auth hash 'their-password'
# -> $2b$12$....   (the bcrypt hash)
```
Build the `APP_USERS` value as comma-separated `user:hash` pairs:
```
APP_USERS=viktor:$2b$12$aaa...,colleague:$2b$12$bbb...
```
Generate a session secret:
```bash
openssl rand -hex 32     # -> SESSION_SECRET
```

### 2. Create the Railway project
1. New Project → **Deploy from GitHub repo** → select this repo. Railway detects `railway.json`
   and builds with the `Dockerfile`.
2. **Attach a volume** (CRITICAL): service → Volumes → New Volume, mount path **`/data`**.
3. Set service **Variables** (these double as Docker build ARGs where needed):

   | Variable | Required | Notes |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | yes | Claude extraction + showcase enrichment |
   | `MAPBOX_TOKEN` | yes | **Baked into the bundle at build time** — must be set before the build. Restrict it to the Railway domain in the Mapbox dashboard. |
   | `APP_USERS` | yes | `user:bcrypthash,...` (turns login ON) |
   | `SESSION_SECRET` | yes | signs the session cookie |
   | `DATA_DIR` | recommended | `/data` (matches the volume mount; the image defaults to `/data`) |
   | `UNDERWRITE_MAP_MODEL` | optional | defaults to `claude-sonnet-5` |

   `PORT` is provided by Railway automatically; the container binds it.
4. Deploy. First boot seeds `/data/deals.json` from the bundled fixture if the volume is empty.

### 3. Health & image size
- Healthcheck path is `/healthz` (checks `deals.json` readable + `soffice` present). Configured
  in `railway.json` with a 300s timeout for first start.
- Image is ~1.5–2 GB (LibreOffice). Expected and fine.

## Smoke test on the deployed URL

From a colleague's machine, with their own login:

1. Open the Railway URL → redirected to `/login` → sign in.
2. **Pipeline**: upload an eval IM PDF → deal extracts, matches a market, shows a fit score.
3. **Underwrite**: open the deal → upload the rent roll → Mode A mapping → sign off mapping +
   flags → run Mode B → returns appear (incl. `cfo` IRR) with the green checks banner.
4. **Export**: select the deal in Pipeline → "Export deck (.pptx)" downloads a valid file.
5. Download the editable model `.xlsx` from the underwrite run history.
6. **Redeploy** the service → confirm all deals/runs survive (volume works).

## Local dev is unchanged

None of this affects the local workflow. With `APP_USERS` unset, auth is OFF; with `DATA_DIR`
unset, all state stays in its in-repo locations. Run as before:
```bash
npm run app          # webpack :5173 + extractor :8787
```
In a dev build `API_BASE` defaults to `http://localhost:8787`; in a production build it is `''`.

## Build/run the image locally (optional)

```bash
docker build --build-arg MAPBOX_TOKEN=pk.xxx -t screening-fw .
docker run -p 8787:8787 \
  -e ANTHROPIC_API_KEY=sk-ant-xxx \
  -e APP_USERS="viktor:$2b$12$..." \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e COOKIE_SECURE=0 \
  -v screening_data:/data \
  screening-fw
# open http://localhost:8787  (COOKIE_SECURE=0 lets the cookie work over plain HTTP)
```

## Porting to Azure later

The same `Dockerfile` runs unchanged on Azure Container Apps / App Service for Containers — swap
the volume for an Azure Files mount at `DATA_DIR` and set the same env vars. Revisit if the
confidentiality posture requires Entra ID/SSO (currently out of scope).
