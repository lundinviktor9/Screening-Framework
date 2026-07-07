# VOA MLI Scraper

Extracts Multi-Let Light Industrial (MLI) property metrics from the VOA
compiled Rating List for all 76 Brunswick markets.

## What it produces

Four metrics per market, written to `scrapers/output/voa_data.json`:

| Metric ID | Name | Unit | Description |
|---|---|---|---|
| `voa_mli_stock_sqft` | MLI stock | sqft | Total GIA of MLI-filtered hereditaments |
| `voa_mli_unit_count` | MLI unit count | units | Number of MLI hereditaments |
| `voa_mli_concentration_pct` | MLI concentration | % | % of industrial units that are <464 m² |
| `voa_mli_new_supply` | Net MLI supply change | units | 2026 minus 2023 unit count |

These also map to the Supply pillar scoring framework (M61-M64) —
see `src/data/metrics.ts`.

## Source files

VOA compiled rating list files must be downloaded **manually** from the
[VOA rating list portal](https://voaratinglists.blob.core.windows.net/html/rlidata.htm).
You will need to accept the VOA restricted-use licence terms before
download links become accessible.

Download these four files and place them in `scrapers/data/voa/`:

1. `uk-englandwales-ndr-2026-listentries-compiled-epoch-NNNN-baseline-csv.zip`
2. `uk-englandwales-ndr-2026-summaryvaluations-compiled-epoch-NNNN-baseline-csv.zip`
3. `uk-englandwales-ndr-2023-listentries-compiled-epoch-NNNN-baseline-csv.zip` *(for M4 new supply)*
4. `uk-englandwales-ndr-2023-summaryvaluations-compiled-epoch-NNNN-baseline-csv.zip` *(for M4 new supply)*

Extract each `.zip` to a `.csv` in the same directory. The scraper looks
for the `.csv` files directly, not the zipped versions.

File sizes (uncompressed):
- 2026 list entries: ~480 MB
- 2026 summary valuations: ~690 MB
- 2023 list entries: ~540 MB
- 2023 summary valuations: ~800 MB

If only the 2026 files are present, M4 (new supply) will be `null` with
a warning and the other 3 metrics will still be computed.

## Running

```bash
pip install -r scrapers/requirements.txt
python scrapers/voa_scraper.py                    # full run
python scrapers/voa_scraper.py --sample 10000     # test on first 10k list-entry rows
python scrapers/voa_scraper.py --skip-2023        # only compute M1-M3 from 2026 files
```

Expected runtime: **30-60 minutes** on a typical machine. The scraper
uses chunked streaming (pandas `chunksize=50_000`) and never loads the
full file into memory.

## Output interpretation

### status flags
- `VERIFIED` — VOA is a government source; all successfully computed values get this
- `REVIEW_NEEDED` — value outside validation bounds (e.g. negative sqft) or below coverage threshold
- `MISSING` — no data (market outside England/Wales, or no MLI hereditaments found)

### per-record extra fields
Every record includes two coverage-transparency fields:
- `size_verified_pct`: % of counted units where GIA was available and confirmed under 464m²
- `floorspace_coverage_pct`: % of units where any floorspace data was recorded

If `floorspace_coverage_pct` is below 60% for a market, `voa_mli_concentration_pct`
is set to `null` with `REVIEW_NEEDED` status (insufficient data to compute reliably).

### coverage notes
- England + Wales only. Markets uk-71 to uk-76 (Scotland + NI) have no VOA data.
- `voa_la_mapping.json` maps ~317 VOA Billing Authority codes to the 76 markets.
  70 BAs are in-scope; the rest are out-of-scope rural or unrelated districts.

## Resuming an interrupted run

The scraper writes a checkpoint to `scrapers/data/voa/checkpoint.json`
every 500,000 records. If interrupted (Ctrl+C, crash), re-run and it
will resume from the last checkpoint. Delete `checkpoint.json` to force
a fresh start.

## Integration with data_merger

After a successful run, include the VOA output in the master data pipeline:

```bash
python scrapers/data_merger.py
```

This will fold `voa_data.json` into `public/data/master_data.json`
which the React app reads on startup.

## Caveats

- **Pre-2020 UA codes still present**: The VOA spec retains old district-level
  BA codes even for areas that have merged into unitary authorities
  (Buckinghamshire UA 2020, BCP UA 2019, West Northamptonshire UA 2021).
  Our mapping handles both cases. The pre-flight check reports any BA codes
  that appear in the data but aren't in `voa_la_mapping.json`.
- **Whole-UA counts**: For markets like uk-09 High Wycombe, the entire
  Buckinghamshire UA's industrial stock counts toward the market. See
  ambiguity notes in `voa_la_mapping.json`.
- **Size filter caveat**: Only GIA-measured records are confidently size-filtered.
  NIA/GEA/EFA/RCA records are marked `size_unverified=true` but still counted
  for unit_count metric.
