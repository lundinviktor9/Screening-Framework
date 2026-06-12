# App Platform & Whole-App UI Overhaul — Build Spec (Handoff #2, 2026-06-11)

Target repo: `lundinviktor9/Screening-Framework` (renamed from -v1; local: `C:\Screening Framework`).
Prerequisite: Handoff #1 (`deal-showcase-build/HANDOFF.md`) tasks verified landed — see Phase 0.
Execute one task per session. Show actual outputs against acceptance criteria, never claims.
Update TASKS.md at session end.

## Goal

1. Whole-app redesign on a professional component system (shadcn/ui + Tremor + TanStack Table)
   — every tab, one design language, no empty/unstyled states.
2. Ship the app off localhost: single Docker container (FastAPI serves the built frontend +
   LibreOffice for recalc) deployed to Railway with login for a small team.

## Confirmed decisions (Viktor, 2026-06-11)

- Audience: Viktor + a few colleagues. Simple cloud host (Railway), not Azure/IT — revisit if
  confidentiality posture changes (same Dockerfile ports to Azure unchanged).
- UI scope: ALL tabs (Home, Rankings, Sensitivity, Pipeline, Underwrite, Deal Profile,
  Dashboard, Map, Data Entry, Data Sources, Add Market), not just deal-flow pages.
- Foundation: shadcn/ui (Radix + Tailwind). Tremor for KPI/metric cards and charts
  (Tremor wraps Recharts — already a dependency). TanStack Table v8 for data tables.
  lucide-react icons. Inter font. 21st.dev usable as a source of shadcn-compatible blocks.

---

## Phase 0 — Verify Handoff #1 actually landed (BLOCKING)

Observed 2026-06-11: running app (browser at localhost:5173) still shows the OLD Underwrite
assumptions form (no gap-overrides section) and the OLD pipeline table (no selection checkboxes
/ export button). Before any new work:

1. `git log --oneline -20` — identify commits for Handoff #1 Tasks 1–8. List which tasks have
   NO corresponding commit.
2. Probe, with output pasted: `src/pages/DealProfilePage.tsx` exists; `/pipeline/{deal_id}`
   route renders; `GET /underwrite/{deal_id}` latest run contains `returns.cfo`;
   `POST /export/deck` returns a pptx; UnderwritingPanel contains the gap-overrides section.
3. **Port audit:** browser shows :5173 (Vite's default) — this is a Webpack project. Identify
   what serves 5173, what port the repo's dev server actually uses, and whether a zombie node
   process is serving a stale bundle (`taskkill //F //IM node.exe`, restart, hard refresh).
4. Any Handoff #1 task without a verifiable landing: re-execute it (one per session) before
   Phase 1.

**Accept:** a written checklist mapping each Handoff #1 task → commit hash + passing probe.

---

## Phase 1 — Design system foundation

**Task 1.1 — Tooling.** Install/configure: Tailwind path aliases (`@/*`) in tsconfig +
webpack resolve; `npx shadcn@latest init` (style: default, CSS variables ON); Tremor
(`npm i @tremor/react`); TanStack Table; `lucide-react`; `@fontsource/inter`;
`tailwindcss-animate`. NOTE: shadcn's CLI assumes Vite/Next defaults — verify generated
components compile under **Webpack** (no `next/*` imports; fix the import alias paths). Add
shadcn components as needed per page (they vendor into `src/components/ui/` — commit them).

**Task 1.2 — Theme.** Single source of truth `src/theme/brand.ts` + CSS variables in
`globals.css`, mirrored in `extractor/brand.json` (PPTX export reads the same values —
Handoff #1 Task 4 contract):

- `--brand`: #7D5A7D (purple — sidebar, primary buttons, section bands, active states)
- `--brand-light`: #E6DCE6 (table header fills, selected rows)
- surfaces: white cards on #F7F6F8 page background; `--ink`: #1F1F1F; muted: #6B6B76
- semantic: green #1B8A5A (pass/on-market/tier-1), amber #B7791F (flags/review),
  red #C53030 (fail/off/delete)
- Typography: Inter; page title 24/semibold; section 13/semibold/uppercase/tracking-wide;
  body 14; table 13; KPI value 22/bold purple, KPI label 11/uppercase/muted
- Density: 8px spacing grid, `rounded-lg` cards, `shadow-sm` only (no heavy shadows)

**Task 1.3 — App shell.** Replace the current sidebar with the shadcn Sidebar pattern
(collapsible to icons, grouped nav: SCREENING — Home/Rankings/Sensitivity/Dashboard/Map;
DEALS — Pipeline/Underwrite; ADMIN — Data Entry/Data Sources/Add Market), brand header with
Brunswick wordmark, breadcrumb top bar, `sonner` Toaster mounted globally (replace all
`alert()`/`confirm()` with toasts + shadcn AlertDialog).

**Accept:** app boots with new shell, all routes reachable, zero `alert()`/`confirm()` left.

## Phase 2 — Page redesigns (one task per page; all use Phase 1 primitives)

Shared rules: every page gets a proper empty state (icon + one-line explanation + primary
action), Skeleton loaders for async data, and consistent page header
(title + description + actions right-aligned).

**2.1 Pipeline.** TanStack DataTable: sortable/filterable columns (Asset, Market, Age,
#Tenants, Occupancy, Quoting Price, NIY, RY, On/Off, Comment), **row-selection checkboxes**
driving an "Export deck (.pptx)" toolbar button (Handoff #1 Task 5), status Badges, inline
edit via Popover (replaces always-on input cells — current table renders raw inputs
everywhere, a major source of the unfinished look), row click → Deal Profile. Upload zone:
card-style dropzone with per-file progress + toast on extraction complete. Map panel: keep
60/40 split, pins colored by status, popup cards. Empty state when no deals.

**2.2 Underwrite.** Replace deal-cards-plus-right-rail with master/detail: left = deal list
(compact cards: name, status Badge, latest IRR); right = workflow **Stepper**
(1 Upload rent roll → 2 Review mapping & flags → 3 Assumptions → 4 Run & results):

- Step 2: mapping table (editable per Handoff #1 Task 6) + flags as Alert items with
  severity icon, "Why" text, resolution Input; sign-off Checkboxes gate Step 4 (HIL gates
  untouched).
- Step 3: gap-overrides section first (with per-field gap counts, disabled when schedule
  complete — Handoff #1 Task 8), "Model dials" in an Accordion below.
- Step 4: returns as Tremor metric Cards (Net PP, Unlevered IRR, Net investor IRR, EM, CoC)
  + checks state (green banner / red "returns withheld"); run history as Tremor Tracker
  (pass/fail squares) + Accordion rows with vs-baseline diffs and per-version model download.

**2.3 Deal Profile.** Per Handoff #1 Task 4 (two views mirroring the slide layouts), restyled
with Phase 1 tokens. Add a sticky action bar: Edit toggle, "Export this deal (.pptx)",
"Open IM PDF".

**2.4 Home.** Hero stat row as 4 Tremor metric cards (Markets screened, Tier 1 count,
Verified data points, Metrics tracked); pillar cards in a 6-up grid with weight badges and
per-pillar accent colors (current rainbow gradients → restrained brand accents); CTA row.

**2.5 Rankings.** TanStack DataTable with sticky header, tier Badges (T1/T2/T3 colored),
composite score as inline CategoryBar, expandable row → per-pillar score breakdown
(Tremor BarList); CSV export button.

**2.6 Sensitivity.** shadcn Slider per metric inside per-pillar Accordions, live-sum
indicator (must equal 100%), scenario save/load as Select + Dialog; Biggest Movers as Tremor
BarList with delta arrows.

**2.7 Dashboard.** Tremor grid: pipeline composition DonutChart (status), NIY/RY by deal
BarChart, deals-by-market map mini, tier distribution, recent runs list.

**2.8 Map.** Full-bleed Mapbox, floating legend Card, market pins colored by tier with
hover Card (score, tier, key metrics), deal pins distinct shape.

**2.9 Data Entry / Data Sources / Add Market.** shadcn Form (react-hook-form + zod
validation), proper field errors, Save with toast confirmation; sources list as DataTable
with freshness badges.

**2.10 Results & Deal Profile content fidelity (added 2026-06-11 after first deployed test).**
Viktor's reference layouts are the two slide images on file (River Park overview; Key
Assumptions + Financial Returns two-table view). Requirements:

- **Financial Overview = two purple-banded tables side by side.** Left, "Key Assumptions"
  with three sub-banded groups — Entry (Acquisition date, Purchase Price (before costs),
  Yield (after costs)), Exit (Exit date / "{n} year hold", Exit yield, Exit price (before
  costs)), Financing (LTV, All-in interest rate, Arrangement fee). Right, "Financial
  Returns" with two sub-banded groups — Unlevered Returns and Levered Returns, Post Fees,
  each showing IRR, EM, CoC, Profit, Equity (from `returns.cfo` unlevered/levered blocks).
- **Net Investor IRR is the baseline headline metric.** Everywhere returns are summarised
  (metric cards, deal list, run history rows, PPTX) it renders first and visually dominant;
  other metrics are secondary.
- **Deal Profile populates from the IM showcase block** (Handoff #1 Tasks 2–4). Verify on
  the DEPLOYED instance with a fresh IM upload: headline, KPI strip, rationale bullets,
  business-plan bullets, map pin, asset photo all populated. Add a "Regenerate from IM"
  button calling the regenerate endpoint. Deals seeded from the pre-showcase `deals.json`
  show an explicit "No showcase yet — re-ingest the IM" state, not silent emptiness.
- **PPTX export mirrors both layouts** exactly (same data, same hierarchy, Net Investor IRR
  headline on the financial slide).

**Accept (2.10):** fresh IM upload on the deployed app → profile matches the River Park
reference; financial view matches the two-table reference with Net Investor IRR prominent;
exported PPTX shows the same two slides.

**Accept per page:** screenshot side-by-side with old version; no unstyled native controls;
empty + loading + error states all present; zero Tailwind-default-blue remnants (all actions
use brand tokens).

## Phase 3 — Package & deploy (Railway)

**Task 3.1 — Single-container build.**

- Multi-stage `Dockerfile`: stage 1 `node:20` → `npm ci && npm run build` (webpack production
  build); stage 2 `python:3.11-slim` → `apt-get install -y libreoffice-calc --no-install-recommends`
  (required: headless recalc via `soffice`), copy extractor + `underwrite/`, copy built
  frontend to `static/`, `pip install -r requirements.txt`.
- FastAPI mounts the build: `app.mount("/", StaticFiles(directory="static", html=True))`
  AFTER api routers; SPA fallback to `index.html` for client routes. Frontend API base
  becomes same-origin (`/api/...` or relative) — remove hardcoded `http://localhost:8787`
  (make it an env-driven constant with localhost fallback for dev).
- All state under one data root env `DATA_DIR` (deals.json, underwrite_runs/, showcase_img/,
  uploaded IM pdfs) — currently scattered; consolidate paths through a single config module.

**Task 3.2 — Auth.** Small-team session login: FastAPI middleware, users as
`APP_USERS="viktor:bcrypt$...,colleague:bcrypt$..."` env var, signed session cookie
(`itsdangerous`), login page styled with Phase 1 components, all `/api` + static routes
behind it except `/login` + `/healthz`. Rate-limit login attempts. HTTPS comes from the
platform.

**Task 3.3 — Railway deploy.**

- Railway project from the GitHub repo, Dockerfile build; attach a **persistent volume**
  mounted at `DATA_DIR` (CRITICAL: container filesystem is ephemeral — without the volume all
  deals vanish on redeploy).
- Secrets as Railway env vars: `ANTHROPIC_API_KEY`, `MAPBOX_TOKEN` (restrict token to the
  Railway domain in Mapbox dashboard), `APP_USERS`, `SESSION_SECRET`, `UNDERWRITE_MAP_MODEL`.
- `/healthz` endpoint (checks: deals.json readable, soffice binary present) for Railway
  healthcheck. Document image size expectation (~1.5–2 GB with LibreOffice — fine).
- Smoke test ON the deployed instance: upload an eval IM → extract → upload rent roll →
  Mode A → sign-off → Mode B → cfo returns → export PPTX → download model xlsx.

**Accept:** full deal flow passes on the Railway URL from a colleague's machine with their
own login; redeploy preserves all data; localhost dev flow still works unchanged.

---

## Constraints (carry over from Handoff #1 + project principles)

1. **Webpack, not Vite** — verify every generated/copied component compiles under Webpack;
   no `next/*` imports from copied blocks.
2. HIL gates in `underwrite_routes.py` untouched; redesign may not weaken sign-off flow.
3. Engine self-contained; UI talks to `adapter.py` outputs via the API only.
4. Traceability: no fabricated values anywhere, "TBC"/withheld states preserved in new UI.
5. xlsx/image writes never inside OneDrive paths (local dev) — and inside `DATA_DIR` (deployed).
6. Commit `src/components/ui/` (vendored shadcn) — no generation step at build time.

## Out of scope

Entra ID/SSO (revisit if firm-wide), mobile layout (desktop-first; don't break tablet),
multi-tenancy, background job queue (sync underwrite runs are acceptable at team scale),
21st.dev Magic MCP automation (manual block copying is fine).
