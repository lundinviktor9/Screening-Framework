# Data Refresh Script

Standalone Node.js script that pulls three free public UK datasets and produces a JSON file
of updated metric values for review. It does **not** modify `ukMarkets.ts` directly.

## What it updates

| Metric | Description | Source |
|--------|-------------|--------|
| **M7** | Land price growth (5yr CAGR, %) | HM Land Registry Price Paid Data |
| **M28** | Labour commute accessibility (%) | NOMIS NM_568_1 — Census 2021 |
| **M46** | Business rates burden (index, nat=100) | VOA Non-Domestic Rating Compiled List |
| **M54** | Competing land-use pressure (index) | VOA Non-Domestic Rating Compiled List |

## Prerequisites

- **Node.js 18+** (for native `fetch`)
- Run `npm install` from the project root (adds `tsx`)

## Running

From the **project root**:

```bash
# Full run (all three sources — takes 10–20 min, VOA file is 3–5 GB)
npx tsx data-refresh/fetchFreeData.ts

# Skip the large VOA download (faster for testing NOMIS + Land Registry)
npx tsx data-refresh/fetchFreeData.ts --skip-voa

# Skip Land Registry only
npx tsx data-refresh/fetchFreeData.ts --skip-lr

# NOMIS only (fastest, ~30 seconds)
npx tsx data-refresh/fetchFreeData.ts --skip-voa --skip-lr
```

Output is written to `data-refresh/output/refreshed-values-YYYY-MM-DD.json`.

## Output format

```json
{
  "generatedAt": "2026-03-16T10:00:00Z",
  "sources": { ... },
  "markets": {
    "uk-02": { "marketName": "Crawley", "m28": 78.4, "m46": 95.2, "m54": 1.3, "m7": null },
    "uk-27": { "marketName": "Birmingham/Solihull", "m28": 82.1, "m46": 98.7, "m54": 2.1, "m7": 4.2 }
  },
  "warnings": ["uk-71 (Greater Glasgow): M28 skipped — NM_568_1 covers England/Wales only"],
  "summary": { "m7Updated": 60, "m28Updated": 71, "m46Updated": 63, "m54Updated": 63, "totalWarnings": 12 }
}
```

## Applying the results

1. Review the output JSON — check values look plausible before applying.
2. To apply to all 77 markets at once:
   - Export the current data via **Export CSV** on the Rankings page.
   - Open in Excel, copy the refreshed values into the relevant columns (M7, M28, M46, M54).
   - Import back via **Import CSV**.
3. Alternatively, update `src/data/ukMarkets.ts` directly for the pre-filled dataset.

## Coverage notes

| Source | Coverage | Excluded markets |
|--------|----------|------------------|
| NOMIS NM_568_1 | England + Wales | uk-71 to uk-76 (Scotland, NI) |
| VOA Compiled List | England only | uk-68 to uk-76 (Wales, Scotland, NI) |
| Land Registry PPD | England + Wales | uk-71 to uk-76 (Scotland, NI) |

For Scottish markets, equivalent data is available from:
- M28: Scotland's Census 2022 (separate API via NRS: https://www.scotlandscensus.gov.uk)
- M46/M54: Scottish Assessors Portal (no free bulk download available)

## Data caveats

### M7 (Land price growth)
- Uses Land Registry "Other" (property type `O`) transactions as a proxy for commercial/industrial.
- This includes retail, office, and industrial — not industrial-only.
- Many commercial transactions are not registered with HMLR. Coverage is better in cities.
- Markets with fewer than 5 transactions in either the base or end year are returned as `null`.

### M28 (Commute accessibility)
- Derived from Census 2021 "distance to work" bands, using workers commuting ≤40 km as a
  proxy for "reachable in 45 minutes".
- This measures where *existing* workers commute from — a reasonable proxy for labour catchment,
  but not an isochrone analysis.
- Not available for Scotland (Census 2022 has a separate API) or Northern Ireland.

### M46 (Business rates burden)
- Derived from VOA rateable value per m² for industrial/warehouse premises, indexed to national
  median. This is a supply-side indicator of relative rates burden, not a direct % of occupancy
  cost (which would require combining with rent data).

### M54 (Competing land-use pressure)
- Ratio of retail+office rateable value density to industrial rateable value density.
  Higher = more competing demand for land from non-industrial uses.
- VOA billing authority codes (used internally) are mapped to ONS GSS codes via a lookup table
  in `sources/voa.ts`. If a market shows null after a successful VOA download, extend the
  `VOA_BA_TO_GSS` table with the missing billing authority code.

## VOA URL

The VOA bulk download URL may change between releases. If the download fails with 404:
1. Visit https://voaratinglists.blob.core.windows.net/html/rli2023.html
2. Find the current "Compiled List" bulk file link
3. Update `VOA_BULK_URL` in `data-refresh/sources/voa.ts`
