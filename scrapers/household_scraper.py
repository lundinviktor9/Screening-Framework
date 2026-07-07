"""
Household projections scraper — M34.

Produces M34 "Household formation growth (5yr %)" for all 76 markets, using the
ONS 2022-based Household Projections for England (migration category variant).

Computes M34 = (2031 projection / 2026 projection - 1) × 100
  - Forward-looking 5-year household growth, reflecting investment outlook
  - 2026-2031 window (app is dated April 2026)
  - Thresholds in metrics.ts expect % (t5: 8, t4: 6, t3: 4, t2: 2)

Coverage:
  - England: Full (130/130 of our English LAs present in ONS Table 406)
  - Wales, Scotland, Northern Ireland: flagged MISSING
    - Wales source: StatsWales household projections (separate format)
    - Scotland source: NRS household projections (separate format)
    - NI source: NISRA household projections
    These can be added as separate scraper functions in future iterations.

Source: ONS 2022-based Household Projections for England (migration category variant)
https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationprojections/datasets/householdprojectionsforengland

Output: scrapers/output/household_data.json
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import requests
import openpyxl

# ----- Paths ------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPT_DIR / "config" / "markets.json"
DATA_DIR = SCRIPT_DIR / "data"
CACHED_XLSX = DATA_DIR / "ons_household_projections_2022based.xlsx"
OUTPUT_PATH = SCRIPT_DIR / "output" / "household_data.json"

# Source URL (2022-based migration category variant is the default principal projection)
ONS_XLSX_URL = (
    "https://www.ons.gov.uk/file?uri="
    "/peoplepopulationandcommunity/populationandmigration/populationprojections/"
    "datasets/householdprojectionsforengland/"
    "2022basedmigrationcategoryvariantprojection/"
    "2022basedhhpsmigrationcategoryvariant.xlsx"
)

# 5-year projection window: base year -> target year
BASE_YEAR = 2026
TARGET_YEAR = 2031

# ----- Helpers ----------------------------------------------------------------

def load_markets() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def download_projections_xlsx() -> Path:
    """Download the ONS projections xlsx, or use cached copy if already present."""
    if CACHED_XLSX.exists() and CACHED_XLSX.stat().st_size > 100_000:
        print(f"  Using cached copy: {CACHED_XLSX.name} ({CACHED_XLSX.stat().st_size:,} bytes)")
        return CACHED_XLSX
    print(f"  Downloading ONS household projections...")
    r = requests.get(ONS_XLSX_URL, timeout=120)
    r.raise_for_status()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHED_XLSX.write_bytes(r.content)
    print(f"  Saved {len(r.content):,} bytes to {CACHED_XLSX.name}")
    return CACHED_XLSX


def parse_table_406(xlsx_path: Path) -> dict[str, dict[int, int]]:
    """
    Parse ONS Table 406 (Household projections by LA by year).
    Returns {la_code: {year: households_count}}.
    """
    print(f"  Parsing Table 406...")
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = wb["Table 406"]

    rows = list(ws.iter_rows(min_row=4, values_only=True))
    header = rows[0]
    # Find year columns
    year_cols: dict[int, int] = {}
    for i, cell in enumerate(header):
        if isinstance(cell, int) and 2020 <= cell <= 2050:
            year_cols[cell] = i

    print(f"    Year columns found: {sorted(year_cols.keys())[:5]}...{sorted(year_cols.keys())[-3:]}")

    result: dict[str, dict[int, int]] = {}
    for row in rows[1:]:
        if not row or not row[0]:
            continue
        code = str(row[0]).strip()
        if not code.startswith("E"):  # England only in this file
            continue
        result[code] = {}
        for year, col_idx in year_cols.items():
            try:
                val = row[col_idx]
                if val is not None:
                    result[code][year] = int(val)
            except (ValueError, TypeError):
                pass
    print(f"    Parsed {len(result)} English LAs with projections")
    return result


def make_record(market_id: str, info: dict, value: float | None,
                raw_text: str | None, status: str,
                validation_note: str | None = None) -> dict:
    rec = {
        "market_id": market_id,
        "market": info["name"],
        "region": info["region"],
        "metric_id": "M34",
        "pillar": "Labour",
        "value": value,
        "unit": "% over 5 years",
        "geographic_level": "market",
        "source_url": "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationprojections/datasets/householdprojectionsforengland",
        "source_name": "ONS 2022-based Household Projections (migration category variant)",
        "source_date": f"{BASE_YEAR}-{TARGET_YEAR} projection",
        "scrape_date": date.today().isoformat(),
        "status": status,
        "raw_text": raw_text,
    }
    if validation_note:
        rec["validation_note"] = validation_note
    return rec


# ----- Main -------------------------------------------------------------------

def main():
    print("=" * 64)
    print("Household Projections Scraper — M34")
    print(f"5-year window: {BASE_YEAR} -> {TARGET_YEAR}")
    print("=" * 64)

    markets = load_markets()
    print(f"Markets: {len(markets)}\n")

    # ---- Fetch & parse ----
    print("[1/3] Fetching ONS projections xlsx")
    xlsx = download_projections_xlsx()
    la_projections = parse_table_406(xlsx)
    print()

    # ---- Compute per market ----
    print("[2/3] Computing M34 per market")
    records: list[dict] = []
    warnings: list[str] = []

    for mid, info in markets.items():
        region = info["region"]

        # Non-England markets: flag MISSING with reason
        if region in ("Wales", "Scotland", "Northern Ireland"):
            records.append(make_record(
                mid, info, None,
                f"ONS household projections cover England only. {region} requires separate source (StatsWales/NRS/NISRA).",
                "MISSING",
                validation_note=f"Outside ONS England coverage ({region})",
            ))
            continue

        # Aggregate across constituent English LAs
        base_total = 0
        target_total = 0
        matched_las: list[str] = []
        for code in info["la_codes"]:
            proj = la_projections.get(code)
            if proj and BASE_YEAR in proj and TARGET_YEAR in proj:
                base_total += proj[BASE_YEAR]
                target_total += proj[TARGET_YEAR]
                matched_las.append(code)

        if not matched_las:
            records.append(make_record(
                mid, info, None,
                f"No LA projection data found for any of {info['la_codes']}",
                "MISSING",
                validation_note="No English LAs matched in projections file",
            ))
            warnings.append(f"{mid} ({info['name']}): M34 — no matching LAs")
            continue

        if base_total == 0:
            records.append(make_record(
                mid, info, None,
                f"Zero base-year households across {len(matched_las)} LAs",
                "MISSING",
            ))
            warnings.append(f"{mid} ({info['name']}): M34 — zero base")
            continue

        growth = round(100.0 * (target_total - base_total) / base_total, 1)
        note = (f"Households {BASE_YEAR}={base_total:,} -> {TARGET_YEAR}={target_total:,} "
                f"across {len(matched_las)}/{len(info['la_codes'])} LAs")
        records.append(make_record(
            mid, info, growth, note, "VERIFIED",
        ))

    # ---- Save ----
    print("\n[3/3] Writing output")
    output = {
        "generated_at": date.today().isoformat(),
        "source": "ONS 2022-based Household Projections for England",
        "source_url": ONS_XLSX_URL,
        "metric": "M34",
        "window": f"{BASE_YEAR}-{TARGET_YEAR}",
        "records": records,
        "warnings": warnings,
        "summary": {
            "total_records": len(records),
            "records_with_value": sum(1 for r in records if r["value"] is not None),
            "records_missing": sum(1 for r in records if r["value"] is None),
            "coverage_note": "England: 67 markets. Wales/Scotland/NI: 9 markets flagged MISSING (different data sources needed).",
        },
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nDone: {OUTPUT_PATH}")
    verified = sum(1 for r in records if r["value"] is not None)
    missing = len(records) - verified
    print(f"  M34 verified: {verified}/76 markets")
    print(f"  M34 missing: {missing}/76 (Wales+Scotland+NI)")

    # Print range of values for sanity check
    vals = [r["value"] for r in records if r["value"] is not None]
    if vals:
        print(f"  Range: {min(vals)}% to {max(vals)}%")
        print(f"  Mean: {sum(vals)/len(vals):.1f}%")

    return 0


if __name__ == "__main__":
    sys.exit(main())
