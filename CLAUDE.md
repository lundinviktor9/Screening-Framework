# Brunswick Industrial Real Estate Screening Framework
## Claude Code Persistent Context — Updated April 2026

the repo lives at C:\Screening Framework and the old Dokument path is dead 

> **Deal pipeline work:** For any work on the deal pipeline (incoming-deal ingestion, PDF extraction, Pipeline tab, deal profiling), read [DEAL_PIPELINE_INTEGRATION_PLAN.md](DEAL_PIPELINE_INTEGRATION_PLAN.md) first. That document defines the 7-task build order, data model, and UX.

---

## WHAT THIS PROJECT IS

A market screening and ranking tool for UK industrial/logistics real 
estate investment. Covers **75 markets** across the UK (Belfast removed 
in v4), scored across **6 pillars and 72 metrics** (60 original + 
4 VOA MLI supplementary M61-M64 + 8 Newmark M65-M72; M41/M42 redefined 
to £psf in v5) to produce a composite score out of 100. Used by 
investment professionals to identify target acquisition markets.

This is a React + TypeScript + Recharts + Tailwind CSS application. 
No backend. No database server. Runs entirely in the browser, reading 
from local JSON files produced by separate Python scraping scripts.

---

## SESSION END PROTOCOL

At the end of every meaningful work session — before the user closes Claude Code — proactively offer to update TASKS.md with a handover note.

The handover update should capture:
- What was completed this session (reference specific commits)
- Any gotchas, bugs, or design decisions worth remembering for next time
- The natural next task with relevant constraints
- Updated "Last Updated" date

Always show the diff before applying. After approval, commit with a clear message and offer to push.

If the user closes the session without asking for a handover, that is fine — they may not be at a natural stopping point.

If the user opens a session and TASKS.md "Last Updated" is more than 2 weeks old, gently note that the handover doc may be stale.

---

## TECH STACK — DO NOT DEVIATE FROM THIS

Frontend: React, TypeScript, Recharts, Tailwind CSS
Scraping: Python 3.10+, requests, pdfplumber, crawl4ai (open source, 
free), transformers (NuExtract via HuggingFace free tier)
Proximity data: Overpass API (OpenStreetMap, free, no auth)
Labour/economic data: NOMIS API (free, no auth for basic datasets)
No paid subscriptions, no cloud services, no backend server

---

## PROJECT STRUCTURE

/src                    → React app (frontend)
/scrapers               → Python scripts (run locally, not part of build)
/scrapers/output        → JSON files produced by scrapers
/scrapers/pdfs          → Broker PDF reports placed here manually
/public/data            → master_data.json read by React app

---

## CRITICAL GOTCHAS (READ BEFORE TOUCHING ENV VARS OR MAP)

### Build tool: this is Webpack, not Vite
- Env vars use `process.env.X` (not `import.meta.env.X`)
- Env file is `.env` (not `.env.local`)
- Env vars must be injected via DefinePlugin in `webpack.config.js`
- dotenv is loaded at the top of webpack.config.js via `require('dotenv').config()`

### Killing the dev server on Windows
- `Ctrl+C` alone doesn't reliably stop webpack-dev-server
- Use `taskkill //F //IM node.exe` if port 5173 is stuck

### Mapbox token
- Stored in `.env` as `MAPBOX_TOKEN` (no VITE_ prefix)
- Injected to bundle via DefinePlugin
- Free tier (50k loads/month) is far more than this project needs

### FastAPI server env loading
- `extractor/server.py` loads `extractor/.env` via python-dotenv at the very top of the file (BEFORE the docstring — keep it that way)
- Run with `python -m uvicorn extractor.server:app --port 8787` — avoid `--reload` for env var consistency

### localStorage gotcha
- Markets are cached under key `sf_markets_v2`
- Stale localStorage was the root cause of the (NaN, NaN) map bug — when changing market data shape, clear via `localStorage.removeItem('sf_markets_v2')` in browser console
- `dataMerger.mergeMasterData` must preserve lat, lng, aliases, region, name, id when merging, or markers fail to render

### Latent scoring bug (to be fixed during sensitivity work)
- Per-metric `weight` defined in `metrics.ts` is NOT currently applied in `scoreMarket()` — pillar scores use simple mean
- Will be fixed when metric-level sensitivity is built
- Rankings will shift slightly when the fix lands; that's correct behaviour

---

---
## THE SIX PILLARS AND THEIR WEIGHTS (DEFAULT — equally-weighted)

Supply          17%
Demand          17%
Connectivity    17%
Labour          17%
Rents & Yields  16%
Strategic/Risk  16%

Default is **equal weighting** (approx 16.67% each, integer-rounded to
17/17/17/17/16/16 so they sum to 100). Weights are adjustable via the 
Sensitivity page sliders. Do not hardcode weights anywhere — always 
read from state.

---

## PAGES ALREADY BUILT — DO NOT RESTRUCTURE THESE

Rankings     → Table of all 75 markets with pillar scores and RAG status
Map          → Geographic overlay (Leaflet) of all 75 markets
Sensitivity  → Pillar weight sliders that reorder markets in real time
Dashboard    → Top market cards, radar chart, pillar bars, 72-metric heatmap
Data Entry   → Manual data entry panel for commercial data (Bucket 4)
Pipeline     → Deal extraction pipeline (PDFs → Claude API → matched markets → fit scores)
Compare      → Side-by-side comparison of selected markets
Data Sources → Live gilt yield card, Newmark attribution, source provenance

Sidebar navigation, Export CSV, Import CSV, Add Market, 
Reset to Defaults all exist and must be preserved.

---

## TIER CLASSIFICATION — DO NOT CHANGE THESE THRESHOLDS

Tier 1 — Core targets:     score >= 80  (green)
Tier 2 — Value-add:        score 60–79  (amber)
Tier 3 — Monitor:          score < 60   (red)

---

## THE DATA ARCHITECTURE — THIS IS THE MOST IMPORTANT SECTION

### The core problem
All current metric values in the app are placeholder/hallucinated data 
generated by a previous Claude Code session. They have no source 
verification and must not be used for investment decisions. 
The entire data layer is being rebuilt.

### NEVER do this
- Never estimate or hallucinate a metric value
- Never populate a metric with a made-up number
- If a value cannot be sourced, set it to null and flag as MISSING
- Never accept a scraped value without storing its source URL

### The 5 data source buckets

BUCKET 1 — Government APIs (automated, VERIFIED status)
Sources: NOMIS, ONS, VOA, Environment Agency, HM Land Registry
Method: Python API calls, clean JSON/CSV responses
Metrics: Labour (unemployment, wages, population, skills), 
         flood risk, industrial stock estimates

BUCKET 2 — HTML scraping of public pages (ESTIMATED status)
Sources: MHCLG gov.uk tables, Invest in Great Britain, 
         DLUHC, Ofcom
Method: Crawl4AI open source → markdown → NuExtract extraction
Tool: pip install crawl4ai (free, self-hosted)

BUCKET 3 — PDF broker reports (ESTIMATED status)
Sources: CBRE, Savills, JLL, Knight Frank quarterly reports
Method: pdfplumber → text extraction → NuExtract
PDFs placed manually in /scrapers/pdfs by the team

BUCKET 4 — Commercial data, manual entry (ESTIMATED status)
Sources: CoStar, MSCI, EG Radius
Method: Entered via the Data Entry panel in the React app
Metrics: Prime rents, NIY, yield shift, vacancy rates, take-up

BUCKET 5 — Overpass API / OpenStreetMap (VERIFIED status)
Sources: overpass-api.de (free, no auth)
Metrics: Motorway junction distance, port distance, 
         rail freight terminal distance, airport proximity

BUCKET 6 — Newmark Multi-let Winter Bulletin (ESTIMATED status)
Source: scrapers/pdfs/Newmark-Multi-let-Winter-bulletin-2025.pdf
Method: scrapers/newmark_scraper.py (pdfplumber text extraction
         + spec-provided ground-truth; chart values flagged as
         chart_approximation with accuracy_note)
Metrics: M41, M42, M65-M72 (rents, yields, reversion, vacancy,
         rental growth forecast, retention, pipeline months)

BUCKET 7 — Live UK 10-year gilt yield (calculated)
Source: scrapers/gilt_yield_fetcher.py (BoE → DMO → cached fallback)
Cache: scrapers/config/gilt_yield_cache.json
Used: newmark_yield_spread = newmark_equivalent_yield - gilt_yield
Stale: values older than 7 days auto-flag the spread as REVIEW_NEEDED

---

## THE MASTER DATA SCHEMA

Every metric value — whether scraped or manually entered — 
must conform to this exact schema:

{
  "market": "Warrington",
  "region": "North West",
  "metric_id": "unemployment_rate_pct",
  "pillar": "Labour",
  "value": 4.2,
  "unit": "%",
  "geographic_level": "market" | "regional",
  "source_url": "https://www.nomisweb.co.uk/...",
  "source_name": "NOMIS Claimant Count",
  "source_date": "2026-01-01",
  "scrape_date": "2026-04-02",
  "status": "VERIFIED" | "ESTIMATED" | "REGIONAL_PROXY" | "REVIEW_NEEDED",
  "raw_text": "exact text the value was extracted from"
}

The React app reads from /public/data/master_data.json
This file is produced by /scrapers/data_merger.py

---

## STATUS FLAGS — APPLY TO EVERY METRIC VALUE

VERIFIED        → Government API source, value within expected range
                  Shown with green indicator
ESTIMATED       → Manual entry or PDF/HTML scrape, source cited
                  Shown with amber indicator  
REGIONAL_PROXY  → Regional figure cascaded to market level
                  Shown with grey "R" badge
REVIEW_NEEDED   → Value outside expected range OR source unclear
                  Shown with red flag, EXCLUDED from scoring

---

## VALIDATION RULES

Every metric has defined min/max bounds. Values outside bounds 
are auto-flagged as REVIEW_NEEDED and blocked from scoring.

Key bounds:
vacancy_rate_pct:         min 0,      max 25,       unit %
prime_rent_psf:           min 3,      max 25,       unit £psf
net_initial_yield_pct:    min 3,      max 10,       unit %
unemployment_rate_pct:    min 0,      max 15,       unit %
working_age_population:   min 10000,  max 2000000,  unit persons
take_up_sqft_annual:      min 0,      max 50000000, unit sqft
flood_risk_score:         min 0,      max 5,        unit score

Full validation config lives in /src/config/metricValidation.ts

---

## SOURCE PRIORITY HIERARCHY

When multiple sources provide the same metric for the same market,
use the highest priority available:

1. Government API (NOMIS, ONS, VOA, EA)      → VERIFIED
2. Manual entry with primary source cited     → ESTIMATED
3. PDF or HTML scrape with source URL stored  → ESTIMATED
4. Regional proxy cascaded from region entry  → REGIONAL_PROXY
5. Missing                                    → null, excluded from score

---

## REGIONAL VS MARKET-SPECIFIC DATA

Some metrics are only available at regional level (e.g. regional 
take-up, regional rental growth from broker reports).

When a value is entered or scraped as "regional":
- It cascades automatically to all markets in that region
- It displays with a grey "R" badge in all views
- It is flagged as REGIONAL_PROXY status
- It contributes to scoring at reduced confidence weight

Region definitions must match the existing region field in market data.
The 9 regions are: North West, North East, Yorkshire & Humber, 
East Midlands, West Midlands, East of England, South East, 
South West, Scotland.

---

## THE DATA ENTRY PANEL (KEY NEW FEATURE)

A new page accessible from the sidebar called "Data Entry".
Allows manual entry of commercial data (Bucket 4).

Each entry form captures:
- Market name (dropdown of all 76 markets)
- Metric (dropdown organised by pillar)
- Value (numeric input)
- Unit (auto-populated from metric config)
- Source (free text — URL or report name)
- Date of data (date picker)
- Geographic level (Market-specific / Regional proxy)
- Confidence (Primary source / Estimated)

Regional proxy entries cascade to all markets in the same region.

Filter options:
- All metrics for one market
- All markets for one metric  
- Only missing metrics
- Only REVIEW_NEEDED metrics

All entries write to the same central store as scraped data,
using the master data schema above.

---

## PYTHON SCRAPING SCRIPTS — BUILD ORDER

All scripts live in /scrapers/ and run independently of React.
Output goes to /scrapers/output/ as individual JSON files.
data_merger.py combines all outputs into master_data.json.

Build order:
1. nomis_scraper.py               (labour metrics, all 75 markets)
2. environment_agency_scraper.py  (flood risk scores)
3. overpass_scraper.py            (connectivity/proximity metrics)
4. voa_scraper.py                 (M61-M64 MLI stock/unit/concentration)
5. newmark_scraper.py             (M41, M42, M65-M72 from Q3 2025 PDF)
6. gilt_yield_fetcher.py          (live UK 10-yr gilt for spread calc)
7. region_boundaries_scraper.py   (UK region polygons for map layer)
8. lad_boundaries_scraper.py      (LAD choropleth — optional)
9. poi_scraper.py                 (motorway network lines — optional)
10. pdf_scraper.py                (reusable broker PDF extraction — future)
11. data_merger.py                (combines all outputs, applies validation,
                                   calculates newmark_yield_spread)

---

## DATA COMPLETENESS REQUIREMENTS

Each market must show a completeness score (X/60 metrics populated).
Markets below 40% completeness show a warning in the Rankings table.
Completeness is calculated only from VERIFIED, ESTIMATED, 
and REGIONAL_PROXY status values — REVIEW_NEEDED counts as missing.

---

## CURRENT BUILD PRIORITIES (April 22, 2026)

1. Metric-level sensitivity drill-down on /sensitivity page
2. Fix microlocation_fit_score (profile_generator returns 50 fallback — needs to read scored_markets.json)
3. Replace remaining placeholder metric data (M1-7, M10-14, M43-55, M57, M60) via Data Entry
4. Run live gilt yield fetcher from a networked machine

---

## WHAT NEVER TO CHANGE

- Pillar scoring logic
- Sensitivity slider functionality
- Map visualisation
- Radar chart
- Dashboard layout
- The 75 market list and their regional classifications
- Tier thresholds (80/60)
- Do not hallucinate metric values under any circumstances

---

## TASKS.MD

Keep TASKS.md updated after every session with:
- What was completed this session
- What is in progress
- What is next
- Any blockers or decisions needed from the user

---

## DEAL PIPELINE SERVER (Task 5 — Live as of April 22, 2026)

The deal extraction pipeline (Tasks 1-4) is now wrapped in a FastAPI server at port 8787.

### Two-Command Startup

**Terminal 1: React frontend**
```bash
npm run dev
# Runs webpack at http://localhost:5173
```

**Terminal 2: Deal pipeline server**
```bash
npm run extractor
# OR
python -m uvicorn extractor.server:app --port 8787 --reload
```

Server is ready when you see: `Uvicorn running on http://0.0.0.0:8787`

### API Endpoints

All endpoints accept/return JSON. CORS configured for localhost:5173.

**Upload & Extract:**
- `POST /ingest` — multipart upload, single or multiple PDFs
  - Returns: `[{ deal_id, status, extracted_fields, market_ids, fit_score, narrative, ... }]`
  - Query param: `?force=true` to re-extract (bypasses idempotency cache)

- `POST /ingest-folder?folder_path=deals_inbox` — batch extract from folder
  - Returns: array of DealRecords

**Deal Management:**
- `GET /deals` — list all extracted deals
- `GET /deals/{deal_id}` — single deal detail
- `POST /deals/{deal_id}/market-override` — override matched market
  - Body: `{ "market_ids": ["glasgow"] }`
- `DELETE /deals/{deal_id}` — remove a deal

**Utilities:**
- `GET /pdf/{deal_id}` — retrieve original PDF (for "Open PDF" button in UI)
- `GET /health` — health check
- `GET /docs` — interactive API docs (Swagger)

### Batch Ingest Workflow

1. Drop PDFs into `deals_inbox/` folder
2. From Pipeline tab in UI, click "Process Inbox" OR run:
   ```bash
   npm run ingest-inbox
   ```
3. Server processes all PDFs, updates `src/data/deals.json`
4. React Pipeline tab auto-refreshes with new deals

### Environment Variables

**Required:**
- `ANTHROPIC_API_KEY` — set in `.env` or export to shell

**Optional:**
- `DEALS_INBOX_PATH` — path to deals folder (default: `deals_inbox`)

### Deal Status Lifecycle

- `extracted` — initial state, location has been matched and fit score calculated
- `reviewed` — user has confirmed the match (or overridden market)
- `failed` — extraction error (Claude API timeout, unparseable PDF, etc.)
  - "Retry" button in UI re-runs with `?force=true`

### Idempotency

Before extraction, the server hashes PDF bytes (SHA256). If a deal with that hash
already exists in `deals.json`, extraction is skipped and the existing record returned.

This prevents duplicate ingestion if the same PDF is uploaded twice.

**Force re-extraction** (e.g., after updating prompts):
```bash
curl -X POST "http://localhost:8787/ingest?force=true" -F "file=@West_Craigs.pdf"
```

---