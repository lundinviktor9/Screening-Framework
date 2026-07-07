# Scrapers — Brunswick Screening Framework

Python scripts that pull verified data from free public APIs for all 76 UK markets.
These run independently of the React app and produce JSON files that the app reads.

## Prerequisites

- Python 3.10+
- `pip install -r scrapers/requirements.txt`

## Scripts (run in order)

### 1. NOMIS Labour Metrics
```bash
python scrapers/nomis_scraper.py
```
**Metrics:** M33 (population growth), M35 (working-age share), M36 (unemployment rate), M37 (economic activity rate), M40 (logistics/manufacturing workforce share)
**Source:** NOMIS API (free, no auth)
**Coverage:** All UK (some metrics England/Wales/Scotland only)
**Runtime:** ~1 minute
**Output:** `scrapers/output/nomis_data.json`

### 2. Overpass Connectivity
```bash
python scrapers/overpass_scraper.py
```
**Metrics:** M22 (motorway junction distance), M23 (rail freight terminal distance), M24 (port distance), M25 (cargo airport distance)
**Source:** Overpass API / OpenStreetMap (free, no auth)
**Coverage:** All 76 markets
**Runtime:** ~30 minutes (304 queries at 6s delay for fair-use)
**Output:** `scrapers/output/overpass_data.json`

### 3. Environment Agency Flood Risk
```bash
python scrapers/environment_agency_scraper.py
```
**Metrics:** M58 (flood risk score 1-5)
**Source:** EA Risk of Flooding from Rivers and Sea API (free, no auth)
**Coverage:** England + Wales (Scotland/NI = null)
**Runtime:** ~5 minutes
**Output:** `scrapers/output/flood_risk_data.json`

### 4. Data Merger
```bash
python scrapers/data_merger.py
```
Combines all scraper outputs, validates values, resolves conflicts, and produces:
- `scrapers/output/merged_data.json` — full audit trail
- `public/data/master_data.json` — consumed by the React app

## Output Schema

Every scraped record follows this structure:
```json
{
  "market_id": "uk-53",
  "market": "Warrington",
  "region": "North West",
  "metric_id": "M36",
  "pillar": "Labour",
  "value": 4.2,
  "unit": "%",
  "geographic_level": "market",
  "source_url": "https://www.nomisweb.co.uk/...",
  "source_name": "NOMIS Claimant Count",
  "source_date": "2026-01-01",
  "scrape_date": "2026-04-02",
  "status": "VERIFIED",
  "raw_text": null
}
```

## Status Flags
- **VERIFIED** — Government API source, value within expected bounds
- **ESTIMATED** — Manual entry or PDF scrape with source cited
- **REGIONAL_PROXY** — Regional figure cascaded to market level
- **REVIEW_NEEDED** — Value outside expected bounds, excluded from scoring
- **MISSING** — No data available

## Validation
The data merger applies min/max bounds to every value. Out-of-range values
are automatically flagged as REVIEW_NEEDED and excluded from the app's
scoring until manually reviewed.

## Notes
- All APIs are free and require no authentication
- Overpass API has a fair-use policy — the 6-second delay between queries respects this
- Scotland and Northern Ireland markets may have null values for some metrics (EA flood risk, some NOMIS datasets)
- The React app reads `public/data/master_data.json` on startup and merges it with localStorage data
