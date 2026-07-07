# Deal Pipeline Integration Plan
### Bringing the Nordic Automation PDF Extractor into the Brunswick Screening Framework

**Purpose:** Add an incoming-deal pipeline to the Brunswick Screening Framework that ingests IMs/teasers, extracts structured data, profiles each deal against the relevant microlocation in the screening matrix, and surfaces results in a Pipeline tab (table + map + market profile).

**Target stack:**
- **Frontend:** React + TypeScript + Tailwind + Recharts (existing) + Mapbox GL JS + react-map-gl (new)
- **Backend:** Local FastAPI server wrapping the Python extractor (ported from `nordics-real-estate-automation`)
- **State:** Zustand (existing pattern)

**Locked design decisions:**
1. **Map library:** Mapbox (better microlocation rendering justifies the API key overhead)
2. **Portfolio display:** One row per portfolio, with market shown as a pill-group; every column filterable from its header
3. **Ingestion UX:** In-app PDF upload via a FastAPI wrapper around the extractor — no CLI step required for day-to-day use

---

## 1. What We're Integrating

### From the Nordic automation repo — what we keep
The Nordic repo already solves the hard part. Lifted as-is:

- **`src/fetch/pdf_reader.py`** — PDF → text (pypdf)
- **`src/extract/extractor.py`** — Claude API wrapper with `extract_inbound_uk()`
- **`src/extract/prompts.py`** — `INBOUND_UK_SYSTEM_PROMPT` + `INBOUND_UK_USER_PROMPT` (extended, not replaced)
- **`src/normalize/row_normalizer.py`** — `normalize_inbound_uk_row()`
- **`config/schemas/inbound_uk.schema.json`** — 32-column schema (extended)
- **`src/pipelines/full_pipeline.py`** — `process_pdf_uk()` orchestration logic

### From the Nordic automation repo — what we drop
- Excel writing (`src/render/excel_writer.py`) — we return JSON
- Swedish/Danish/Finnish extractor paths and article scraping
- The standalone CLI (`src/cli.py`) — replaced by FastAPI endpoints

### What we add (new work)
1. **An extended schema** — 7 new fields (3 extraction, 4 derived) to match the table in your screenshot + microlocation profile output
2. **A market-matching layer** — resolves extracted `Location` + `Postal code` to a `market_id` in your screening matrix
3. **A microlocation-profile generator** — deterministic fit score + templated narrative grounded in the matched market's pillar scores
4. **A FastAPI wrapper** — local server exposing `POST /ingest` (single or multiple PDFs) and `POST /ingest-folder` (batch)
5. **A Pipeline tab** — React view with filterable table, Mapbox map, and deal profile drawer
6. **Persistence** — `src/data/deals.json` as the source of truth, read into a Zustand store

---

## 2. Target End-State Walkthrough

> This is what "done" looks like, so we can work backwards.

**Primary flow — upload from the UI:**
1. You open the screening framework, click the **Pipeline** tab, click **Upload PDFs**.
2. A file picker opens; you select one or more PDFs (or drag a folder in).
3. A progress list appears: `West_Craigs_IE_Brochure.pdf → extracting… matching… profiling… done ✓`
4. Rows appear in the table below as each PDF completes. Each row is live-filterable via column headers.
5. You click a row → right-side drawer opens with the full deal profile and the matched Edinburgh market's pillar scores.
6. The Mapbox map on the right shows pins for all deals; clicking a pin highlights the table row.

**Secondary flow — batch folder ingest (for weekly processing):**
1. Drop 15 PDFs into `screening-framework/deals_inbox/`
2. From the Pipeline tab, click **Process Inbox** (or run `npm run ingest-inbox` from terminal)
3. Same progress UI, same result

**Zero-CLI requirement:** once the FastAPI server is running (started via `npm run dev` or a background service), everything works from the browser. The CLI path exists as a fallback.

---

## 3. Architecture

```
screening-framework/                          (existing React app)
├── deals_inbox/                              (NEW — drop PDFs here for batch ingest)
├── extractor/                                (NEW — Python, ported from Nordic repo)
│   ├── server.py                             (NEW — FastAPI app, main entry point)
│   ├── pdf_reader.py                         (copied from Nordic)
│   ├── extractor.py                          (copied, extended prompts)
│   ├── prompts.py                            (UK prompts + new fields)
│   ├── normalizer.py                         (copied)
│   ├── market_matcher.py                     (NEW)
│   ├── profile_generator.py                  (NEW)
│   ├── schema.json                           (extended UK schema)
│   ├── postcode_area_to_market.json          (NEW — UK postcode prefix lookup)
│   ├── strategy_weights.json                 (NEW — fit-score weights per strategy)
│   ├── requirements.txt                      (fastapi, uvicorn, pypdf, anthropic, python-multipart)
│   └── start.sh                              (uvicorn server:app --port 8787)
├── src/
│   ├── data/
│   │   ├── markets.ts                        (existing — 76 markets + scores)
│   │   └── deals.json                        (NEW — output of extractor, read by frontend)
│   ├── store/
│   │   └── useDealStore.ts                   (NEW — zustand store)
│   ├── lib/
│   │   └── extractorClient.ts                (NEW — fetch wrapper for FastAPI endpoints)
│   ├── components/
│   │   ├── pipeline/
│   │   │   ├── PipelineTab.tsx               (NEW — layout + upload UI)
│   │   │   ├── DealUploadPanel.tsx           (NEW — drag-drop + progress)
│   │   │   ├── DealTable.tsx                 (NEW — filterable columns)
│   │   │   ├── DealTableFilters.tsx          (NEW — per-column filter popovers)
│   │   │   ├── DealMap.tsx                   (NEW — Mapbox GL)
│   │   │   └── DealProfileDrawer.tsx         (NEW)
│   │   └── ...
│   └── App.tsx                               (add Pipeline tab to nav)
└── scripts/
    └── ingest-inbox.sh                       (NEW — curl POST to /ingest-folder)
```

**Data flow:**
```
[Browser: upload PDF]
       ↓ POST /ingest (multipart/form-data)
[FastAPI server]
       ↓ pdf_reader → raw text
       ↓ extractor.extract_inbound_uk() → raw fields
       ↓ normalizer.normalize_inbound_uk_row() → normalized fields
       ↓ market_matcher.match() → market_ids[] + confidence
       ↓ profile_generator.generate() → narrative + fit score
       ↓ append to deals.json (atomic write with file lock)
       ↓ return DealRecord JSON
[Browser: updates zustand store]
       ↓
[Table + Map + Drawer re-render]
```

---

## 4. Extended Schema — Fields We Need

Mapping the screenshot columns to the existing schema:

| Screenshot column | Existing UK schema field | New? |
|---|---|---|
| Asset | `Project Name` | ✅ existing |
| Market | `Location` | ✅ existing (needs matching to `market_id`) |
| Age | — | **⚠ NEW: `Year Built`** |
| # Tenants | — | **⚠ NEW: `Number of Tenants`** |
| Occupancy | `Economic occupancy rate, %` | ✅ existing |
| Quoting Price | `Deal value, CCY` | ✅ existing |
| NIY | `Yield` | ✅ existing |
| RY | `Yield2` | ✅ existing |
| On/Off Market | — | **⚠ NEW: `Market Status`** |
| Comment | `Comment` | ✅ existing (prompt needs tightening — see §5) |
| Base rent psf | `Base rent incl. index, CCY/sqft` | ✅ existing |
| WAULT | `WAULT, years` | ✅ existing |
| Matched market | — | **⚠ NEW: `market_ids[]`, `market_match_confidence`** |
| Microlocation fit | — | **⚠ NEW: `microlocation_narrative`, `microlocation_fit_score`** |

**New schema fields:**

```json
{ "name": "Year Built", "type": "string", "notes": "e.g. '2025', '1990-2001', '1970s+'" },
{ "name": "Number of Tenants", "type": "integer" },
{ "name": "Market Status", "type": "string", "notes": "On-market or Off-market" },
{ "name": "market_ids", "type": "array", "notes": "Array of market_id strings (multi for portfolios)" },
{ "name": "market_match_confidence", "type": "number", "notes": "0.0–1.0" },
{ "name": "microlocation_narrative", "type": "string", "notes": "2–3 sentences, generated post-extraction" },
{ "name": "microlocation_fit_score", "type": "number", "notes": "0–100" }
```

Note `market_ids` is an array, not a single string — this supports the one-row-per-portfolio display where a portfolio can span multiple markets.

---

## 5. Prompt Changes

**5a. Add the three new extraction fields.** Append to the JSON template:
```
"Year Built": "<construction year or age range, e.g. '2025', '1987-2007', '1970s+', null if not stated>",
"Number of Tenants": "<integer if stated, null otherwise>",
"Market Status": "<'On-market' if being openly marketed, 'Off-market' if explicitly described as off-market or private treaty, null if unclear>",
```

**5b. Tighten the `Comment` field.** Replace the existing prompt line with:

> "Comment": "<ONE short sentence (max 20 words) capturing the investment angle. Examples: 'Newly delivered, well-located product in target markets, AM lease up strategy'; 'Highly reversionary with diverse tenant base, strong microlocation in growing residential area'. Focus on WHY this deal is attractive. Only use information EXPLICITLY stated in the document.>"

The "only use information explicitly stated" clause matters — consistent with how you handled NewRiver and Willows, no inferred claims.

---

## 6. The Market Matcher

The extractor returns e.g. `Location: "Edinburgh"` and `Postal code: "EH12 0BD"`. Your screening matrix has `market_id: "edinburgh"`. We bridge them with three tiers:

1. **Primary match:** case-insensitive exact match of `Location` against `markets[].name` and `markets[].aliases[]`
2. **Postcode fallback:** map postcode area (first 1–2 letters) to a `market_id`. `EH` → Edinburgh, `G` → Glasgow, `M` → Manchester, etc. Build `postcode_area_to_market.json` covering only the postcode areas your 76 markets span.
3. **Fuzzy match:** Levenshtein or token-overlap against market names. "Greater London" → a Greater London market via token overlap. Returns a confidence score.

**Portfolio handling:** if `Portfolio: Yes` AND `Location` contains semicolons or commas (e.g. `"Tolworth; Edinburgh; Peterborough"`), split and match each segment independently. `market_ids` becomes an array. The table shows one row with a pill group: `[Tolworth] [Edinburgh] [Peterborough]`.

**Confidence thresholds:**
- ≥ 0.9 → auto-match, show market pill(s) in table
- 0.5–0.9 → show as "match uncertain" with a ⚠ icon; drawer lets user confirm/override
- < 0.5 → show as "unmatched"; drawer has a market picker

---

## 7. The Microlocation Profile Generator

Deterministic — keeping this for auditability and cost (no extra Claude calls per deal).

**Fit score** is weighted by deal type. For an MLI deal like West Craigs:
```
fit_score = 0.35 * rents_yields_score
          + 0.30 * demand_score
          + 0.15 * supply_score
          + 0.10 * connectivity_score
          + 0.05 * labour_score
          + 0.05 * strategic_score
```

Weights should be configurable per strategy — Big Box, MLI, Net Lease, and Office each lean on different pillars. Store weights in `extractor/strategy_weights.json` so you can tune without code changes.

**Narrative template:** identify the two highest-scoring pillars for the matched market, plug their key metrics into a sentence template. Example output for West Craigs → Edinburgh:

> "Edinburgh ranks in the top quartile on Rents & Yields (6.1% YoY rental growth, 3.7% vacancy rate) and Demand (low unemployment, expanding labour catchment). The subject sits in the core West Edinburgh submarket where residential infill is actively displacing industrial supply, supporting the reversionary thesis."

Portfolio deals: generate a narrative per matched market and concatenate with the market name as a lede. Store as structured JSON: `{ "edinburgh": "…", "tolworth": "…" }`.

---

## 8. FastAPI Server — Endpoints

**`extractor/server.py` exposes:**

```
POST /ingest              — multipart upload, single or multiple PDFs
                            returns: [DealRecord, ...] after extraction
POST /ingest-folder       — body: { "folder_path": "deals_inbox" }
                            returns: [DealRecord, ...] for all PDFs in folder
GET  /deals               — returns current deals.json contents
POST /deals/{deal_id}/market-override  — body: { "market_ids": ["glasgow"] }
                                         for fixing low-confidence matches
DELETE /deals/{deal_id}   — remove a deal (mistakes happen)
GET  /pdf/{deal_id}       — returns original PDF for "Open PDF" button
```

**Server lifecycle:**
- `uvicorn server:app --port 8787 --reload` in dev
- Frontend `extractorClient.ts` points at `http://localhost:8787`
- CORS allow-origin set to `http://localhost:5173` (or whatever your Vite dev server uses)
- Document the two-command startup in `CLAUDE.md`: `npm run dev` + `npm run extractor`

**Idempotency:** before extraction, hash the PDF bytes. If a deal with that hash already exists in `deals.json`, skip extraction and return the existing record. Prevents double-ingesting the same file.

**Force re-extract:** `POST /ingest?force=true` bypasses the hash cache — useful when you tweak the prompt and want to re-process everything.

**Error handling:** if Claude API fails, return the partial record with `extraction_errors: [...]` and a `status: "failed"` field. Table shows these rows with a ⚠ badge and a "Retry" button.

---

## 9. Pipeline Tab UI Spec

**Layout:** split view, table left (60%), map right (40%), drawer slides in from right edge (covers map when open).

**Top bar:**
- **Upload PDFs** button (opens file picker, accepts multiple)
- **Process Inbox** button (triggers batch ingest of `deals_inbox/`)
- Progress strip below buttons — shows ongoing/recent extraction status
- Global search box (searches across Asset, Seller, Comment)

**Table columns (all filterable):**
```
Asset | Market [pill group] | Age | # Tenants | Occupancy | Quoting Price | NIY | RY | On/Off | Rent psf | WAULT | Fit Score | ⋯
```

**Per-column filters:** each column header has a filter icon that opens a popover appropriate to the column type:
- Text columns (Asset, Comment): search box
- Market pill: multi-select checkbox list of all markets currently in the data
- Numeric columns (NIY, RY, Rent psf, WAULT, Fit Score): min/max sliders
- Categorical (On/Off, Age bucket): multi-select checkboxes
- Date (Date Received): range picker

Active filters show as removable chips above the table. "Clear all filters" button resets.

**Sort:** click column header to sort; shift-click for secondary sort.

**Row interaction:** click opens drawer + centres map on matched market's coords + highlights pin.

**Map (Mapbox):**
- UK-centred default view
- One pin per deal location (portfolios get multiple pins visually grouped with a thin connector line)
- Pin colour by fit score: red (0–40) → amber (40–70) → green (70–100)
- Pin size by deal size (quoting price)
- Hover → popover with Asset name + NIY + fit score
- Click → same as clicking the table row
- Style: Mapbox "Light" works better behind coloured pins than "Streets"

**Drawer sections:**
1. **Header:** project name, seller, broker, date received, Status pill (On/Off-market)
2. **Headlines grid:** all extracted financial fields in a clean 2-column key/value layout
3. **Matched Market(s):** for portfolios, one card per market. Each card shows the six pillar scores as a small Recharts bar. Uses the same pillar colour scheme as the rest of the screening framework for consistency.
4. **Deal vs Market benchmark table:**
   | Metric | This deal | Market benchmark | Delta |
   | NIY | 7.00% | 6.45% | +55 bps |
   | Rent psf | £9.88 | £11.50 | −£1.62 |
   | WAULT | 4.8 yrs | 5.2 yrs | −0.4 yrs |
   (benchmarks pulled from the screening matrix; red/green-coded based on whether the delta is favourable to a buyer)
5. **Microlocation narrative:** the generated paragraph(s)
6. **Source:** filename + "Open PDF" button (opens the original PDF in a new tab via `GET /pdf/{deal_id}`)
7. **Actions:** Override Market, Delete Deal, Re-run Extraction

---

## 10. Build Order

Seven tasks, ~5–6 days total. Each independently testable.

### Task 1 — Port the extractor (½ day)
- Copy `src/extract/`, `src/fetch/pdf_reader.py`, `src/normalize/row_normalizer.py` from Nordic repo into `screening-framework/extractor/`
- Strip all non-UK code paths
- Drop Excel writer, drop CLI
- **Test:** manual run on West Craigs PDF returns expected fields

### Task 2 — Extend schema + prompts (2 hours)
- Add 3 new extraction fields and tightened Comment prompt
- Add 7 new fields to schema.json
- **Test:** re-run on West Craigs. Expected: `Year Built: "1990-2001"`, `Number of Tenants: 18` (or close), `Market Status: "On-market"`, crisp one-line Comment

### Task 3 — Market matcher (½ day)
- Build three-tier matcher
- Create `postcode_area_to_market.json` — only covers the postcode areas spanning your 76 markets
- Handle multi-market portfolios (array output)
- **Test:** West Craigs → `["edinburgh"]` confidence 1.0; fake portfolio "Tolworth; Edinburgh; Peterborough" → three matches with confidences

### Task 4 — Profile generator + persistence (½ day)
- Deterministic fit score with strategy-dependent weights in `strategy_weights.json`
- Narrative template using top-2 pillars
- Atomic write to `deals.json` with file lock
- PDF hash → idempotency
- **Test:** West Craigs generates fit score, narrative mentions Edinburgh's actual pillar metrics

### Task 5 — FastAPI server (½ day)
- Wrap Tasks 1–4 behind `/ingest`, `/ingest-folder`, `/deals`, `/deals/{id}/market-override`, `DELETE /deals/{id}`, `GET /pdf/{deal_id}`
- CORS config
- `start.sh` + update `package.json` with an `extractor` script
- **Test:** curl `POST /ingest` with West Craigs PDF returns a complete DealRecord

### Task 6 — Pipeline tab UI — table + map (2 days)
- Install `mapbox-gl` and `react-map-gl`, set up `VITE_MAPBOX_TOKEN` env var
- Add Pipeline tab to nav
- Zustand store `useDealStore` reading from FastAPI `GET /deals`
- `DealUploadPanel` with drag-drop and per-file progress
- `DealTable` with per-column filters
- `DealMap` with coloured pins, hover popovers, click sync
- **Test:** upload West Craigs from UI, see it appear in table and as a green pin on Edinburgh

### Task 7 — Drawer + polish (1 day)
- `DealProfileDrawer` with all six sections
- Deal-vs-market benchmark table with colour-coded deltas
- Market override flow for low-confidence matches
- Update `CLAUDE.md` with the new architecture; add `TASKS.md` entries for the pipeline
- **Test:** full end-to-end — upload PDF, see row, click row, drawer opens, pillar chart renders, override market, delta table updates

---

## 11. Things Worth Thinking About

**Mapbox token:** free tier is 50k map loads/month — you won't sniff this at 20 deals/week. Store the token in `.env.local` (gitignored) and as `VITE_MAPBOX_TOKEN` for Vite to expose to the frontend. Note: Vite `VITE_*` env vars ARE visible in the built bundle — fine for Mapbox which expects client-side tokens, but worth knowing. Restrict the token to your domains in the Mapbox dashboard.

**Anthropic API key:** stays server-side (FastAPI reads `ANTHROPIC_API_KEY` from env), never exposed to the browser. Same pattern as the Nordic repo.

**Corporate IT friction:** you've hit Windows Defender blocking `node_modules` before. Mapbox CDN and PyPI are standard and unlikely to be blocked, but if FastAPI's port 8787 gets blocked, fall back to ports in the 3000–3999 range. Document the fallback in `CLAUDE.md`.

**API costs:** each extraction = one Claude API call, ~20–40k input tokens. At Sonnet pricing that's pennies per deal. 20 deals/week = well under £20/month.

**MLLI data gap:** orthogonal to this work, but the pipeline feeds it indirectly. After 30–50 ingested deals you'll have a home-grown rents/yields/WAULT comparables set biased toward your markets. Consider adding a "Export as Comparables" button later that writes selected deals back into a format the screening matrix can consume as reference benchmarks.

**IM verifiability discipline:** same rule you applied to NewRiver and Willows. The prompt already enforces "null if not explicitly stated" — keep that. No inferring NIY from price ÷ NOI if the IM doesn't state it. No assuming WAULT from the tenancy table. Every non-null field in the output must be traceable to the source PDF.

---

## 12. Pre-Start Checklist

Before Claude Code begins Task 1, confirm:

1. **`markets.ts` structure** — does each market already have an `aliases: string[]`? If not, add it now; will save a Task 3 detour. Minimum viable: 2–3 aliases per market covering obvious variants.
2. **Market coordinate data** — does `markets.ts` include `lat` / `lng` for each market? Mapbox needs them. If not, add — easy to source, needed only once.
3. **Mapbox account** — create one (free), generate a public token, add to `.env.local` as `VITE_MAPBOX_TOKEN`, and restrict the token to your dev domain in the Mapbox dashboard.
4. **FastAPI port** — confirm 8787 is free in your dev environment. If corporate IT blocks non-standard ports, pick one in 3000–3999.
