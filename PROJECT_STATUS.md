# Screening Framework v1 — Project Status

> **Last updated:** 2026-03-15
> **Tool:** UK Industrial Market Screening Framework
> **Purpose:** Score and rank ~77 UK industrial real estate markets for LP investment pitches
> **Architecture:** Browser-only React/TypeScript app, no backend, localStorage persistence

---

## Phase History

| Phase | Description | Status | Completed |
|-------|-------------|--------|-----------|
| **Phase 1** | Core tool — React/TS/Tailwind/Recharts, 6 pillars, 60 metrics, scoring engine, rankings table, dashboard, market form | ✅ Done | March 2025 |
| **Phase 2** | 77 UK markets pre-populated with Tier A public data, region filter dropdown, Reset to defaults button | ✅ Done | March 2025 |
| **Phase 3** | Data verification document, project tracker, CSV import/export feature | ✅ Done | March 2026 |
| **Phase 4** | Excel / PDF export of rankings and market detail reports | ⬜ Planned | — |
| **Phase 5** | Auto-refresh Tier A data via public APIs (stretch goal) | ⬜ Planned | — |

---

## Current State

- **77 markets** loaded with Tier A public data (23 of 60 metrics pre-filled)
- **37 Tier B metrics** awaiting manual entry from CoStar/MSCI/agent data
- **CSV import/export** available on the Rankings page — export to Excel, fill in, import back
- Build system: webpack + Babel (no native binaries — compatible with managed Windows machines)
- Dev server: `npm run dev` → http://localhost:5173

---

## Metric Status — All 60 Metrics

| ID | Metric Name | Pillar | Tier | Status | Source |
|----|-------------|--------|------|--------|--------|
| 1 | Vacancy rate | Supply | B | ⬜ Manual | CoStar / agents |
| 2 | Prime vacancy rate | Supply | B | ⬜ Manual | CoStar / agents |
| 3 | Pipeline as % of stock | Supply | B | ⬜ Manual | CoStar / agents |
| 4 | Speculative development share | Supply | B | ⬜ Manual | CoStar / agents |
| 5 | Availability of zoned industrial land | Supply | B | ⬜ Expert score | Internal judgement |
| 6 | Brownfield redevelopment potential | Supply | B | ⬜ Expert score | Internal judgement |
| 7 | Land price growth (5yr CAGR) | Supply | B | ⬜ Manual | MSCI / VOA / agents |
| 8 | Planning approval time | Supply | **A** | ✅ Pre-filled | MHCLG Planning Stats 2023/24 |
| 9 | Planning approval rate | Supply | **A** | ✅ Pre-filled | MHCLG Planning Stats 2023/24 |
| 10 | Share of Grade A stock | Supply | B | ⬜ Manual | CoStar / agents |
| 11 | Gross take-up growth (5yr CAGR) | Demand | B | ⬜ Manual | CoStar / agents |
| 12 | Net absorption as % of stock | Demand | B | ⬜ Manual | CoStar / agents |
| 13 | Take-up as % of available supply | Demand | B | ⬜ Manual | CoStar / agents |
| 14 | Pre-let rate on new developments | Demand | B | ⬜ Manual | CoStar / agents |
| 15 | Business formation growth | Demand | **A** | ✅ Pre-filled | ONS UK Business Activity 2023 |
| 16 | SME density | Demand | **A** | ✅ Pre-filled | ONS UK Business Activity 2023 |
| 17 | Large occupier presence | Demand | B | ⬜ Manual | CoStar deal database |
| 18 | Industrial / logistics clustering LQ | Demand | **A** | ✅ Pre-filled | ONS BRES 2022 |
| 19 | Tenant diversification | Demand | B | ⬜ Manual | CoStar / agent surveys |
| 20 | Lease renewal rate | Demand | B | ⬜ Manual | CoStar / agent surveys |
| 21 | Drive time to primary urban core | Connectivity | B | ⬜ Manual | Google Maps / TravelTime |
| 22 | Distance to motorway junction | Connectivity | **A** | ✅ Pre-filled | OS / static geography |
| 23 | Distance to rail freight terminal | Connectivity | **A** | ✅ Pre-filled | Network Rail SRFI list |
| 24 | Distance to major port | Connectivity | **A** | ✅ Pre-filled | British Ports Association |
| 25 | Distance to cargo airport | Connectivity | **A** | ✅ Pre-filled | CAA airport data |
| 26 | Road freight capacity / reliability | Connectivity | B | ⬜ Expert score | Internal judgement |
| 27 | Congestion index | Connectivity | B | ⬜ Manual | TomTom / Inrix data |
| 28 | Labour commute accessibility | Connectivity | B | ⬜ Manual | ONS Travel to Work Areas |
| 29 | Distance to power substation | Connectivity | B | ⬜ Manual | National Grid / DNOs |
| 30 | Available grid capacity | Connectivity | B | ⬜ Manual | National Grid / DNOs |
| 31 | Population within 30-min drive | Labour | **A** | ✅ Pre-filled | ONS Census 2021 |
| 32 | Population within 60-min drive | Labour | **A** | ✅ Pre-filled | ONS Census 2021 |
| 33 | Population growth (10yr) | Labour | **A** | ✅ Pre-filled | ONS Census 2011 vs 2021 |
| 34 | Household formation growth (5yr) | Labour | **A** | ✅ Pre-filled | ONS Household Projections 2018-based |
| 35 | Working-age share | Labour | **A** | ✅ Pre-filled | ONS Census 2021 |
| 36 | Unemployment rate | Labour | **A** | ✅ Pre-filled | ONS NOMIS APS 2024 |
| 37 | Economic activity rate | Labour | **A** | ✅ Pre-filled | ONS NOMIS APS 2024 |
| 38 | Average logistics wage index | Labour | **A** | ✅ Pre-filled | ONS ASHE 2023 |
| 39 | Labour cost index | Labour | **A** | ✅ Pre-filled | ONS ASHE 2023 |
| 40 | Logistics / manufacturing workforce share | Labour | **A** | ✅ Pre-filled | ONS BRES 2022 |
| 41 | Average market rent index | Rents & Yields | B | ⬜ Manual | CoStar / Savills / JLL |
| 42 | Prime rent index | Rents & Yields | B | ⬜ Manual | CoStar / Savills / JLL |
| 43 | Average-to-prime rent ratio | Rents & Yields | Derived | ⬜ Auto (41 ÷ 42) | Auto-calculated |
| 44 | Historic rental growth (5yr CAGR) | Rents & Yields | B | ⬜ Manual | CoStar / Savills |
| 45 | Forecast rental growth (3yr CAGR) | Rents & Yields | B | ⬜ Manual | Savills / JLL / CBRE forecasts |
| 46 | Business rates / occupancy cost burden | Rents & Yields | B | ⬜ Manual | VOA / agent data |
| 47 | Incentive level | Rents & Yields | B | ⬜ Manual | CoStar / agent surveys |
| 48 | Prime yield | Rents & Yields | B | ⬜ Manual | MSCI / agents |
| 49 | Prime yield vs prior peak | Rents & Yields | B | ⬜ Manual | MSCI historical |
| 50 | Yield spread vs government bonds | Rents & Yields | Derived | ⬜ Auto (48 + BoE rate) | Auto-calculated |
| 51 | Investment transaction volume | Strategic / Risk | B | ⬜ Manual | MSCI / RCA / CoStar |
| 52 | Investment deal count | Strategic / Risk | B | ⬜ Manual | MSCI / RCA / CoStar |
| 53 | Lot size depth | Strategic / Risk | B | ⬜ Manual | MSCI / RCA |
| 54 | Competing land-use pressure | Strategic / Risk | B | ⬜ Manual | VOA / HM Land Registry |
| 55 | Planning policy support for industrial | Strategic / Risk | B | ⬜ Expert score | Internal + LPA Local Plans |
| 56 | Proximity to housing growth | Strategic / Risk | **A** | ✅ Pre-filled | MHCLG Housing Delivery Test 2023 |
| 57 | ESG quality of stock | Strategic / Risk | B | ⬜ Manual | BREEAM register / agent data |
| 58 | Climate / flood risk exposure | Strategic / Risk | **A** | ✅ Pre-filled | Environment Agency Flood Risk 2024 |
| 59 | Digital infrastructure quality | Strategic / Risk | **A** | ✅ Pre-filled | Ofcom Connected Nations 2024 |
| 60 | EV / fleet electrification readiness | Strategic / Risk | B | ⬜ Manual | Specialist / agent surveys |

**Summary:** 23 pre-filled (Tier A) · 35 manual (Tier B) · 2 auto-derived

---

## Data Freshness

| Source | Metrics | Data Date | Next Refresh Due |
|--------|---------|-----------|-----------------|
| ONS Census 2021 | 31–35 | 2021 | 2031 (next Census) |
| ONS NOMIS APS | 36–37 | 2024 Q1 | Jan 2026 |
| ONS ASHE | 38–39 | 2023 | Nov 2025 |
| ONS BRES | 18, 40 | 2022 | Jan 2026 |
| ONS Business Activity | 15–16 | 2023 | Nov 2025 |
| MHCLG Planning Stats | 8–9 | 2023/24 | Oct 2025 |
| MHCLG Housing Delivery Test | 56 | 2023 | Jan 2026 |
| Environment Agency Flood Risk | 58 | 2024 | Jan 2026 |
| Ofcom Connected Nations | 59 | 2024 | Jan 2026 |
| OS / static geography | 22–25 | 2024 | Every 2–3 years |

---

## Tier B Data Entry — What's Needed

To fully score all 77 markets, the following commercial data needs to be entered.
Use **Export CSV** from the Rankings page to get a template, fill in Excel, then **Import CSV**.

### CoStar / Agents (supply & demand metrics)
Enter for each market from CoStar or agent market reports:
- M1: Vacancy rate (% of total stock)
- M2: Prime vacancy rate (% of prime stock)
- M3: Pipeline as % of existing stock
- M4: Speculative development share (% of pipeline)
- M7: Land price growth 5yr CAGR (%)
- M10: Share of Grade A stock (%)
- M11: Gross take-up growth 5yr CAGR (%)
- M12: Net absorption as % of stock
- M13: Take-up as % of available supply
- M14: Pre-let rate on new developments (%)
- M17: Large occupier deals per year
- M19: Tenant diversification (count of sectors >10% take-up)
- M20: Lease renewal rate (%)
- M21: Drive time to primary urban core (minutes)
- M27: Congestion index (peak/off-peak ratio)
- M28: Labour commute accessibility (% working-age reachable in 45 min)

### MSCI / RCA / Investment Markets
- M44: Historic rental growth 5yr CAGR (%)
- M45: Forecast rental growth 3yr CAGR (%)
- M46: Business rates / occupancy cost burden (% of occupancy cost)
- M47: Incentive level (months free on 10yr lease)
- M48: Prime yield (%)
- M49: Prime yield vs prior peak (bps)
- M51: Investment transaction volume (GBPm, 12 months)
- M52: Investment deal count (deals/year)
- M53: Lot size depth (count of active bands)
- M54: Competing land-use pressure (residential/industrial land value multiple)

### Rent Indices (CoStar / Savills / JLL)
These should be indexed to the national average = 100:
- M41: Average market rent index
- M42: Prime rent index
- *Note: M43 (avg/prime ratio) and M50 (yield spread vs gilts) are auto-calculated once M41, M42, M48 are entered*

### Expert Scores (Internal — Direct 1–5 rating)
- M5: Availability of zoned industrial land (5 = highly constrained, 1 = abundant)
- M6: Brownfield redevelopment potential (5 = strong optionality, 1 = limited)
- M26: Road freight capacity / reliability (5 = excellent, 1 = constrained)
- M55: Planning policy support for industrial (5 = very supportive, 1 = hostile)

### Specialist Data
- M29: Distance to power substation (km) — National Grid / DNO connection data
- M30: Available grid capacity (MW) — National Grid / DNO
- M57: ESG quality of stock (% of stock certified) — BREEAM register
- M60: EV / fleet electrification readiness (% of stock EV-ready) — specialist surveys

---

## Known Issues & Open Questions

- [ ] **Stoke-on-Trent region:** Listed under East Midlands. Stoke is geographically in the West
  Midlands/Cheshire border area. Consider moving to "West Midlands" region for filter accuracy.
- [ ] **Metric 43 (avg/prime ratio) and Metric 50 (yield spread):** Currently require manual entry.
  Auto-calculation from metrics 41/42 and 48 would be a useful enhancement.
- [ ] **ASHE data granularity:** Metrics 38 and 39 use regional-level data (not LA-level) as
  LA-level occupational wage data is not published. Consider using CoStar labour analytics if available.
- [ ] **Phase 4 (Excel/PDF export):** Not yet implemented. Priority depends on LP pitch timeline.

---

## How to Run the Tool

```bash
# Start dev server (runs at http://localhost:5173)
npm run dev

# Build for production (outputs to /dist)
npm run build
```

## Key Files

| File | Purpose |
|------|---------|
| `src/data/ukMarkets.ts` | 77 UK markets + all pre-filled Tier A values |
| `src/data/metrics.ts` | 60 metric definitions, thresholds, weights |
| `src/utils/scoring.ts` | Scoring engine (scoreMetric, scoreMarket, rankMarkets) |
| `src/utils/storage.ts` | localStorage read/write functions |
| `src/utils/csvImportExport.ts` | CSV export and import functions |
| `src/pages/RankingsPage.tsx` | Main rankings view with region filter + CSV buttons |
| `src/pages/DashboardPage.tsx` | Radar/bar/heatmap comparison dashboard |
| `src/components/market/MarketForm.tsx` | 60-metric data entry form |
| `DATA_SOURCES.md` | Full source documentation for all Tier A metrics |
