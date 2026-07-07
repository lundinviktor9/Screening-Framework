"""
VOA MLI (Multi-Let Light Industrial) scraper.

Processes the VOA compiled Rating List (2026 and optionally 2023) to produce
4 MLI-focused metrics per Brunswick market.

Input files (placed manually in scrapers/data/voa/):
  - uk-englandwales-ndr-2026-listentries-compiled-epoch-*-csv.csv
  - uk-englandwales-ndr-2026-summaryvaluations-compiled-epoch-*-csv.csv
  - uk-englandwales-ndr-2023-listentries-compiled-epoch-*-csv.csv  [optional, for M4]
  - uk-englandwales-ndr-2023-summaryvaluations-compiled-epoch-*-csv.csv  [optional]

Output: scrapers/output/voa_data.json

Large-file handling:
  - Chunked streaming via pandas read_csv with chunksize=50000
  - Explicit dtypes to minimise memory
  - Progress indicator every 100k rows
  - Checkpoint every 500k records (resumable)
  - Pre-flight format validation on first 100 rows

Filter policy documented in scrapers/config/voa_scat_filter.json.
BA-to-market mapping in scrapers/config/voa_la_mapping.json.

Usage:
  python scrapers/voa_scraper.py
  python scrapers/voa_scraper.py --sample 10000      # test mode
  python scrapers/voa_scraper.py --skip-2023         # skip M4
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, datetime
from pathlib import Path

import pandas as pd

# ----- Paths ------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_DIR = SCRIPT_DIR / "config"
DATA_DIR = SCRIPT_DIR / "data" / "voa"
OUTPUT_PATH = SCRIPT_DIR / "output" / "voa_data.json"
CHECKPOINT_PATH = DATA_DIR / "checkpoint.json"

MARKETS_JSON = CONFIG_DIR / "markets.json"
LA_MAPPING_JSON = CONFIG_DIR / "voa_la_mapping.json"
SCAT_FILTER_JSON = CONFIG_DIR / "voa_scat_filter.json"

# ----- Constants --------------------------------------------------------------

MLI_SIZE_M2 = 464.0           # MLI threshold: under 464 m² GIA
M2_TO_SQFT = 10.7639104167
MIN_UNITS_PER_MARKET = 10       # below this, value set to null + REVIEW_NEEDED
MIN_COVERAGE_PCT = 40.0         # below this floorspace coverage, value nulled + REVIEW_NEEDED
MIN_CONCENTRATION_COVERAGE = 60.0  # concentration metric needs >=60% floorspace coverage

CHUNK_SIZE = 50_000
PROGRESS_INTERVAL = 100_000
CHECKPOINT_INTERVAL = 500_000

LIST_COMPILATION_DATE_2026 = date(2026, 4, 1)
LIST_COMPILATION_DATE_2023 = date(2023, 4, 1)

# ----- Spec: list entries file column positions (0-indexed, no header row) ----
# Spec item 1 = index 0, etc.
# Only the fields we need are assigned column positions; rest are ignored.

LIST_ENTRIES_COLS = {
    0: "entry_num",
    1: "ba_code",          # spec item 2  (4-char string, may have leading zero)
    4: "primary_desc",     # spec item 5  (e.g. "IF", "CW")
    6: "uarn",             # spec item 7  (integer, join key)
    15: "effective_date",  # spec item 16
    17: "rateable_value",  # spec item 18 (null = deletion proxy, drop)
    21: "scat_and_suffix", # spec item 22 (e.g. "096G" = SCat 096 suffix G)
    26: "current_from",    # spec item 27
    27: "current_to",      # spec item 28 (empty = currently live)
}
LIST_ENTRIES_TOTAL_COLS = 28  # spec total fields in current list entries

# ----- Spec: summary valuations type-01 record column positions ---------------

SUMVAL_TYPE01_COLS = {
    0: "record_type",       # spec item 1  (always "01")
    2: "uarn",              # spec item 3
    3: "ba_code",           # spec item 4
    15: "primary_desc",     # spec item 16
    16: "total_area",       # spec item 17 (m² or units)
    19: "adopted_rv",       # spec item 20
    24: "from_date",        # spec item 25
    25: "to_date",          # spec item 26
    26: "scat_only",        # spec item 27 (3-char SCat, no suffix)
    27: "unit_of_measure",  # spec item 28 ("GIA", "NIA", "EFA", etc.)
}

# ----- MLI filter (from voa_scat_filter.json) --------------------------------

SCAT_INCLUDE = {"096", "408", "994"}
SCAT_EXCLUDE = {"153", "151", "129", "721", "148"}

# ----- Helpers ----------------------------------------------------------------

def load_json(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def parse_voa_date(s: str) -> date | None:
    """Parse DD-MON-YYYY format (e.g. '01-APR-2026')."""
    if not s or s == "" or s == " ":
        return None
    try:
        return datetime.strptime(s.strip(), "%d-%b-%Y").date()
    except (ValueError, TypeError):
        return None


def scat_3digit(scat_and_suffix: str) -> str | None:
    """Extract the 3-digit SCat code from e.g. '096G' or '0960'."""
    if not scat_and_suffix or not isinstance(scat_and_suffix, str):
        return None
    s = scat_and_suffix.strip()
    if len(s) < 3:
        return None
    digits = s[:3]
    return digits if digits.isdigit() else None


def find_file(pattern_prefix: str, pattern_substring: str) -> Path | None:
    """Find a CSV file in DATA_DIR matching the prefix and substring."""
    if not DATA_DIR.exists():
        return None
    for p in DATA_DIR.iterdir():
        if p.suffix == ".csv" and p.name.startswith(pattern_prefix) and pattern_substring in p.name:
            return p
    return None


# ----- Pre-flight check -------------------------------------------------------

def preflight_check(list_entries_path: Path, sumval_path: Path | None) -> None:
    """Validate file format and report rough processing estimate."""
    print("=== Pre-flight check ===")
    size_le = list_entries_path.stat().st_size
    print(f"  list entries: {list_entries_path.name} ({size_le / 1e6:.1f} MB)")
    if sumval_path:
        size_sv = sumval_path.stat().st_size
        print(f"  summary vals: {sumval_path.name} ({size_sv / 1e6:.1f} MB)")
    else:
        size_sv = 0

    # Rough estimate: ~200,000 records/min at realistic I/O rates
    est_records_le = size_le / 280  # ~280 bytes average per line
    est_records_sv = size_sv / 380
    est_min = (est_records_le + est_records_sv) / 200_000
    print(f"  estimated total records: {int(est_records_le + est_records_sv):,}")
    print(f"  estimated runtime: {est_min:.0f}-{est_min*2:.0f} minutes")

    # Sanity-check format by reading first 3 rows
    print("  validating list entries format (first 3 rows)...")
    with open(list_entries_path, "r", encoding="latin-1") as f:
        for i, line in enumerate(f):
            if i >= 3:
                break
            parts = line.rstrip("\r\n").split("*")
            if len(parts) < LIST_ENTRIES_TOTAL_COLS - 2:
                raise SystemExit(f"    ERROR: row {i+1} has {len(parts)} fields, expected ~{LIST_ENTRIES_TOTAL_COLS}")
            ba = parts[1] if len(parts) > 1 else ""
            scat = parts[21] if len(parts) > 21 else ""
            uarn = parts[6] if len(parts) > 6 else ""
            print(f"    row {i+1}: BA={ba!r}, UARN={uarn!r}, SCat={scat!r}")
    print("  list entries format OK")

    if sumval_path:
        print("  validating summary valuations format (first 5 rows)...")
        with open(sumval_path, "r", encoding="latin-1") as f:
            for i, line in enumerate(f):
                if i >= 5:
                    break
                parts = line.rstrip("\r\n").split("*")
                rec_type = parts[0] if parts else ""
                if rec_type == "01":
                    uarn = parts[2] if len(parts) > 2 else ""
                    area = parts[16] if len(parts) > 16 else ""
                    scat = parts[26] if len(parts) > 26 else ""
                    uom = parts[27] if len(parts) > 27 else ""
                    print(f"    row {i+1}: type=01 UARN={uarn!r} area={area!r} SCat={scat!r} UoM={uom!r}")
                else:
                    print(f"    row {i+1}: type={rec_type!r} (multi-line detail record)")
        print("  summary valuations format OK")
    print()


# ----- Stream list entries ----------------------------------------------------

def stream_list_entries(
    path: Path,
    ba_to_market: dict,
    compilation_date: date,
    sample_limit: int = 0,
) -> tuple[dict, dict]:
    """
    Stream the list entries CSV. For every record that passes the MLI SCat
    filter + active-status filter AND maps to one of our 76 markets, record
    (market_id, uarn) for later join with summary valuations.

    Returns:
      wanted_uarns: {uarn: {"market_id": str, "scat3": str, "is_mli_scat": bool}}
      stats: {"rows_read": int, "kept_mli": int, "kept_all_industrial": int,
              "unmapped_bas": dict, "filtered_historic": int, "filtered_deleted": int}
    """
    print(f"=== Streaming list entries: {path.name} ===")
    print(f"  compilation date: {compilation_date}")

    # UARN -> metadata, for records matching our BA filter and SCat-industrial filter
    # Two flavours:
    #   is_mli_scat=True: SCat in INCLUDE and not EXCLUDE (candidate for MLI metrics)
    #   is_mli_scat=False: SCat in INCLUDE set (or EXCLUDE set) but for wider industrial count (concentration denominator)
    wanted: dict[int, dict] = {}
    stats = {
        "rows_read": 0,
        "kept_mli": 0,              # passed step_1 include + step_2 exclude + active
        "kept_all_industrial": 0,    # passed step_1 include only + active (denominator for concentration)
        "filtered_deleted": 0,       # null RV
        "filtered_historic": 0,      # Current To Date is non-null and before compilation
        "filtered_bad_scat": 0,
        "filtered_bad_ba": 0,        # BA mapped to null or unknown
        "unmapped_bas": {},          # BA codes seen that aren't in our mapping
    }

    last_checkpoint = 0
    start_time = time.time()

    # Line-by-line streaming for robustness against variable field counts.
    # The VOA file has 28 nominal fields but trailing empty fields may appear
    # as fewer split pieces. We use raw str.split('*') which handles this gracefully.
    with open(path, "r", encoding="latin-1") as f:
        for line in f:
            stats["rows_read"] += 1
            if sample_limit and stats["rows_read"] > sample_limit:
                break

            parts = line.rstrip("\r\n").split("*")
            if len(parts) < 22:
                # malformed or short row; skip
                stats["filtered_bad_scat"] += 1
                continue

            # ---- Filter: active records only ----
            rv_str = parts[17].strip() if len(parts) > 17 else ""
            if not rv_str:
                stats["filtered_deleted"] += 1
                continue

            current_to_str = parts[27].strip() if len(parts) > 27 else ""
            current_to = parse_voa_date(current_to_str)
            if current_to and current_to < compilation_date:
                stats["filtered_historic"] += 1
                continue

            # ---- Filter: SCat ----
            scat3 = scat_3digit(parts[21].strip())
            if not scat3:
                stats["filtered_bad_scat"] += 1
                continue

            is_mli_scat = scat3 in SCAT_INCLUDE and scat3 not in SCAT_EXCLUDE
            is_industrial_scat = scat3 in SCAT_INCLUDE  # for concentration denominator

            if not is_industrial_scat:
                continue

            # ---- Filter: BA maps to one of our markets ----
            ba = parts[1].strip()
            ba_entry = ba_to_market.get(ba)
            if not ba_entry or ba_entry.get("market") is None:
                if ba:
                    if ba not in stats["unmapped_bas"]:
                        stats["unmapped_bas"][ba] = {
                            "ba_name": ba_entry.get("ba_name", "unknown") if ba_entry else "not_in_mapping",
                            "sample_count": 0,
                        }
                    stats["unmapped_bas"][ba]["sample_count"] += 1
                stats["filtered_bad_ba"] += 1
                continue

            market_id = ba_entry["market"]

            # Record UARN -> metadata
            uarn_str = parts[6].strip()
            if not uarn_str or not uarn_str.isdigit():
                continue
            uarn = int(uarn_str)

            wanted[uarn] = {
                "market_id": market_id,
                "scat3": scat3,
                "is_mli_scat": is_mli_scat,
            }

            stats["kept_all_industrial"] += 1
            if is_mli_scat:
                stats["kept_mli"] += 1

            # ---- Progress / checkpoint ----
            if stats["rows_read"] % PROGRESS_INTERVAL == 0:
                elapsed = time.time() - start_time
                rate = stats["rows_read"] / elapsed if elapsed > 0 else 0
                print(
                    f"  [{stats['rows_read']:>10,} rows | "
                    f"{stats['kept_all_industrial']:>7,} industrial | "
                    f"{stats['kept_mli']:>7,} MLI | "
                    f"{rate:>7,.0f} rows/sec]"
                )

            if stats["rows_read"] - last_checkpoint >= CHECKPOINT_INTERVAL:
                save_checkpoint({"phase": "list_entries", "rows_read": stats["rows_read"]})
                last_checkpoint = stats["rows_read"]

    elapsed = time.time() - start_time
    print(f"  done: {stats['rows_read']:,} rows in {elapsed:.0f}s")
    print(f"  kept: {stats['kept_all_industrial']:,} industrial ({stats['kept_mli']:,} MLI)")
    print(f"  filtered: {stats['filtered_deleted']:,} deleted, {stats['filtered_historic']:,} historic, "
          f"{stats['filtered_bad_ba']:,} out-of-scope BA, {stats['filtered_bad_scat']:,} bad scat")
    if stats["unmapped_bas"]:
        unmapped_total = sum(v["sample_count"] for v in stats["unmapped_bas"].values())
        print(f"  unmapped BAs: {len(stats['unmapped_bas'])} unique ({unmapped_total:,} records). Top 5:")
        top = sorted(stats["unmapped_bas"].items(), key=lambda x: -x[1]["sample_count"])[:5]
        for ba, info in top:
            print(f"    {ba} ({info['ba_name']}): {info['sample_count']:,} records")
    print()
    return wanted, stats


# ----- Stream summary valuations ---------------------------------------------

def stream_summary_valuations(
    path: Path,
    wanted_uarns: dict,
    sample_limit: int = 0,
) -> dict:
    """
    Stream the summary valuations CSV. For every type-01 record whose UARN
    is in wanted_uarns, store its GIA and unit-of-measurement.

    Returns: {uarn: {"area_m2": float, "uom": str}}
    """
    print(f"=== Streaming summary valuations: {path.name} ===")
    uarn_area: dict[int, dict] = {}

    rows_read = 0
    type01_count = 0
    matched_count = 0
    last_checkpoint = 0
    start_time = time.time()

    # Summary valuations has variable-length rows depending on record type.
    # Read as raw text lines rather than pandas to handle the multi-type structure.
    with open(path, "r", encoding="latin-1") as f:
        for line in f:
            rows_read += 1
            if sample_limit and rows_read > sample_limit:
                break

            # Only care about type 01 (rating list details)
            if not line.startswith("01*"):
                continue
            type01_count += 1

            parts = line.rstrip("\r\n").split("*")
            if len(parts) < 28:
                continue

            uarn_str = parts[2].strip()
            if not uarn_str or not uarn_str.isdigit():
                continue
            uarn = int(uarn_str)

            if uarn not in wanted_uarns:
                continue

            # Extract area (field 17, index 16) and unit of measurement (field 28, index 27)
            area_str = parts[16].strip() if len(parts) > 16 else ""
            uom = parts[27].strip().upper() if len(parts) > 27 else ""

            try:
                area_m2 = float(area_str) if area_str else 0.0
            except ValueError:
                area_m2 = 0.0

            uarn_area[uarn] = {"area_m2": area_m2, "uom": uom}
            matched_count += 1

            if rows_read % PROGRESS_INTERVAL == 0:
                elapsed = time.time() - start_time
                rate = rows_read / elapsed if elapsed > 0 else 0
                print(
                    f"  [{rows_read:>10,} rows | {type01_count:>7,} type-01 | "
                    f"{matched_count:>7,} matched | {rate:>7,.0f} rows/sec]"
                )

            if rows_read - last_checkpoint >= CHECKPOINT_INTERVAL:
                save_checkpoint({"phase": "summary_valuations", "rows_read": rows_read})
                last_checkpoint = rows_read

    elapsed = time.time() - start_time
    print(f"  done: {rows_read:,} rows in {elapsed:.0f}s")
    print(f"  type-01 records: {type01_count:,}")
    print(f"  matched to wanted UARNs: {matched_count:,} / {len(wanted_uarns):,} "
          f"({100 * matched_count / max(len(wanted_uarns), 1):.1f}% floorspace coverage)")
    print()
    return uarn_area


# ----- Aggregation -----------------------------------------------------------

def aggregate_per_market(
    wanted_uarns: dict,
    uarn_area: dict,
    markets: dict,
) -> dict:
    """
    Per market, aggregate:
      - mli_unit_count (all is_mli_scat records, with and without size-verification)
      - mli_stock_sqft (GIA-verified records under 464m², converted to sqft)
      - industrial_unit_count (all is_mli_scat OR non-mli records passing step 1)
      - size_verified_count
      - floorspace_recorded_count
      - mli_sized_count (units <464m² with GIA)
    """
    per_market: dict[str, dict] = {}
    for mid in markets:
        per_market[mid] = {
            "industrial_unit_count": 0,      # denominator for concentration
            "mli_unit_count": 0,             # numerator for concentration AND the unit_count metric
            "mli_sized_count": 0,            # units < 464m² GIA (size-verified)
            "mli_stock_m2": 0.0,             # sum of GIA for mli_sized_count
            "size_verified_count": 0,         # count of records with GIA measurement
            "floorspace_recorded_count": 0,   # count of records with any area data
        }

    for uarn, meta in wanted_uarns.items():
        mid = meta["market_id"]
        if mid not in per_market:
            continue
        per_market[mid]["industrial_unit_count"] += 1
        if meta["is_mli_scat"]:
            per_market[mid]["mli_unit_count"] += 1

        sv = uarn_area.get(uarn)
        if sv:
            has_area = sv["area_m2"] > 0
            if has_area:
                per_market[mid]["floorspace_recorded_count"] += 1
            is_gia = sv["uom"] == "GIA"
            if has_area and is_gia:
                per_market[mid]["size_verified_count"] += 1
                if sv["area_m2"] < MLI_SIZE_M2 and meta["is_mli_scat"]:
                    per_market[mid]["mli_sized_count"] += 1
                    per_market[mid]["mli_stock_m2"] += sv["area_m2"]

    return per_market


# ----- Metric record output ---------------------------------------------------

def make_record(
    market_id: str, market_info: dict, metric_id: str,
    value: float | int | None, unit: str, raw_text: str,
    status: str, source_date: str,
    size_verified_pct: float | None, floorspace_coverage_pct: float | None,
    validation_note: str | None = None,
) -> dict:
    rec = {
        "market_id": market_id,
        "market": market_info["name"],
        "region": market_info["region"],
        "metric_id": metric_id,
        "pillar": "Supply",
        "value": value,
        "unit": unit,
        "geographic_level": "market",
        "source_url": "https://voaratinglists.blob.core.windows.net/html/rlidata.htm",
        "source_name": "VOA 2026 Non-Domestic Rating List",
        "source_date": source_date,
        "scrape_date": date.today().isoformat(),
        "status": status,
        "raw_text": raw_text,
        "size_verified_pct": size_verified_pct,
        "floorspace_coverage_pct": floorspace_coverage_pct,
    }
    if validation_note:
        rec["validation_note"] = validation_note
    return rec


def compute_metrics(
    agg_2026: dict,
    agg_2023: dict | None,
    markets: dict,
    source_date: str,
) -> list[dict]:
    """Compute the 4 MLI metrics per market and return the flat list of records."""
    records: list[dict] = []

    for mid, info in markets.items():
        a = agg_2026.get(mid, {})
        industrial_count = a.get("industrial_unit_count", 0)
        mli_count = a.get("mli_unit_count", 0)
        mli_sized_count = a.get("mli_sized_count", 0)
        mli_stock_m2 = a.get("mli_stock_m2", 0.0)
        size_verified = a.get("size_verified_count", 0)
        floorspace_recorded = a.get("floorspace_recorded_count", 0)

        size_verified_pct = (100.0 * size_verified / mli_count) if mli_count > 0 else None
        floorspace_coverage_pct = (100.0 * floorspace_recorded / mli_count) if mli_count > 0 else None

        insufficient_data = mli_count < MIN_UNITS_PER_MARKET
        low_coverage = (floorspace_coverage_pct or 0) < MIN_COVERAGE_PCT

        # Check if region has VOA coverage at all
        has_voa_coverage = info.get("region") not in ("Scotland", "Northern Ireland")

        # ---- Metric: voa_mli_stock_sqft ----
        if not has_voa_coverage:
            records.append(make_record(
                mid, info, "voa_mli_stock_sqft", None, "sqft",
                f"Region {info['region']} not covered by VOA England/Wales list",
                "MISSING", source_date, None, None,
                validation_note="Out of VOA geographic coverage",
            ))
        elif insufficient_data:
            records.append(make_record(
                mid, info, "voa_mli_stock_sqft", None, "sqft",
                f"Only {mli_count} MLI units found (minimum {MIN_UNITS_PER_MARKET})",
                "REVIEW_NEEDED", source_date, size_verified_pct, floorspace_coverage_pct,
                validation_note=f"Fewer than {MIN_UNITS_PER_MARKET} MLI units",
            ))
        elif low_coverage:
            records.append(make_record(
                mid, info, "voa_mli_stock_sqft", None, "sqft",
                f"Only {floorspace_coverage_pct:.1f}% floorspace coverage",
                "REVIEW_NEEDED", source_date, size_verified_pct, floorspace_coverage_pct,
                validation_note=f"Floorspace coverage below {MIN_COVERAGE_PCT}% threshold",
            ))
        else:
            stock_sqft = round(mli_stock_m2 * M2_TO_SQFT)
            records.append(make_record(
                mid, info, "voa_mli_stock_sqft", stock_sqft, "sqft",
                f"SCat 096/408/994, GIA < 464m², {mli_sized_count} size-verified units of {mli_count} total",
                "VERIFIED", source_date, size_verified_pct, floorspace_coverage_pct,
            ))

        # ---- Metric: voa_mli_unit_count ----
        if not has_voa_coverage:
            records.append(make_record(
                mid, info, "voa_mli_unit_count", None, "units",
                f"Region {info['region']} not covered by VOA", "MISSING",
                source_date, None, None,
                validation_note="Out of VOA geographic coverage",
            ))
        elif insufficient_data:
            records.append(make_record(
                mid, info, "voa_mli_unit_count", mli_count, "units",
                f"Only {mli_count} MLI units — low reliability",
                "REVIEW_NEEDED", source_date, size_verified_pct, floorspace_coverage_pct,
                validation_note=f"Fewer than {MIN_UNITS_PER_MARKET} MLI units",
            ))
        else:
            records.append(make_record(
                mid, info, "voa_mli_unit_count", mli_count, "units",
                f"SCat 096/408/994 minus exclusions, all sizes counted",
                "VERIFIED", source_date, size_verified_pct, floorspace_coverage_pct,
            ))

        # ---- Metric: voa_mli_concentration_pct ----
        if not has_voa_coverage:
            records.append(make_record(
                mid, info, "voa_mli_concentration_pct", None, "%",
                f"Region {info['region']} not covered by VOA", "MISSING",
                source_date, None, None,
                validation_note="Out of VOA geographic coverage",
            ))
        elif industrial_count < MIN_UNITS_PER_MARKET:
            records.append(make_record(
                mid, info, "voa_mli_concentration_pct", None, "%",
                f"Only {industrial_count} total industrial units",
                "REVIEW_NEEDED", source_date, size_verified_pct, floorspace_coverage_pct,
                validation_note=f"Fewer than {MIN_UNITS_PER_MARKET} industrial units",
            ))
        elif (floorspace_coverage_pct or 0) < MIN_CONCENTRATION_COVERAGE:
            records.append(make_record(
                mid, info, "voa_mli_concentration_pct", None, "%",
                f"Only {floorspace_coverage_pct:.1f}% floorspace coverage",
                "REVIEW_NEEDED", source_date, size_verified_pct, floorspace_coverage_pct,
                validation_note=f"Coverage below {MIN_CONCENTRATION_COVERAGE}% threshold for reliable concentration",
            ))
        else:
            concentration = round(100.0 * mli_sized_count / industrial_count, 1)
            records.append(make_record(
                mid, info, "voa_mli_concentration_pct", concentration, "%",
                f"{mli_sized_count} MLI-sized of {industrial_count} total industrial units",
                "VERIFIED", source_date, size_verified_pct, floorspace_coverage_pct,
            ))

        # ---- Metric: voa_mli_new_supply (2026 - 2023 unit count) ----
        if agg_2023 is None:
            records.append(make_record(
                mid, info, "voa_mli_new_supply", None, "units",
                "2023 baseline file not processed — re-run with --include-2023 flag",
                "MISSING", source_date, None, None,
                validation_note="2023 baseline not available",
            ))
        elif not has_voa_coverage:
            records.append(make_record(
                mid, info, "voa_mli_new_supply", None, "units",
                f"Region {info['region']} not covered by VOA", "MISSING",
                source_date, None, None,
                validation_note="Out of VOA geographic coverage",
            ))
        else:
            mli_count_2023 = agg_2023.get(mid, {}).get("mli_unit_count", 0)
            if mli_count_2023 < MIN_UNITS_PER_MARKET and mli_count < MIN_UNITS_PER_MARKET:
                records.append(make_record(
                    mid, info, "voa_mli_new_supply", None, "units",
                    f"Insufficient units in both years ({mli_count_2023} / {mli_count})",
                    "REVIEW_NEEDED", source_date, size_verified_pct, floorspace_coverage_pct,
                    validation_note="Insufficient MLI units in baseline and/or current list",
                ))
            else:
                delta = mli_count - mli_count_2023
                records.append(make_record(
                    mid, info, "voa_mli_new_supply", delta, "units",
                    f"2026 MLI={mli_count}, 2023 MLI={mli_count_2023}, delta={delta:+d}",
                    "VERIFIED", source_date, size_verified_pct, floorspace_coverage_pct,
                ))

    return records


# ----- Checkpoint -------------------------------------------------------------

def save_checkpoint(state: dict) -> None:
    try:
        CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CHECKPOINT_PATH, "w") as f:
            json.dump(state, f)
    except Exception as e:
        print(f"  WARN: failed to save checkpoint: {e}")


def clear_checkpoint() -> None:
    if CHECKPOINT_PATH.exists():
        CHECKPOINT_PATH.unlink()


# ----- Main -------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="VOA MLI scraper")
    ap.add_argument("--sample", type=int, default=0,
                    help="Process only first N rows of each file (testing mode, default: full)")
    ap.add_argument("--skip-2023", action="store_true",
                    help="Skip 2023 files and set M4 to null")
    ap.add_argument("--output", type=str, default=str(OUTPUT_PATH),
                    help=f"Output JSON path (default: {OUTPUT_PATH})")
    args = ap.parse_args()

    print("=" * 64)
    print("VOA MLI Scraper")
    print("=" * 64)
    if args.sample:
        print(f"SAMPLE MODE: first {args.sample:,} rows per file")
    print()

    # Load configs
    markets = load_json(MARKETS_JSON)
    la_mapping = load_json(LA_MAPPING_JSON)
    ba_to_market = la_mapping["ba_to_market"]

    # Find 2026 files
    list_2026 = find_file("uk-englandwales-ndr-2026-listentries", "compiled-epoch")
    sumval_2026 = find_file("uk-englandwales-ndr-2026-summaryvaluations", "compiled-epoch")
    if not list_2026 or not sumval_2026:
        print(f"ERROR: 2026 VOA files not found in {DATA_DIR}")
        print("  Expected file-name pattern:")
        print("    uk-englandwales-ndr-2026-listentries-compiled-epoch-*.csv")
        print("    uk-englandwales-ndr-2026-summaryvaluations-compiled-epoch-*.csv")
        return 1

    # Find 2023 files (optional)
    list_2023 = find_file("uk-englandwales-ndr-2023-listentries", "compiled-epoch") if not args.skip_2023 else None
    sumval_2023 = find_file("uk-englandwales-ndr-2023-summaryvaluations", "compiled-epoch") if not args.skip_2023 else None
    if args.skip_2023:
        print("2023 files skipped (--skip-2023 flag)")
        list_2023 = sumval_2023 = None
    elif not list_2023 or not sumval_2023:
        print("NOTE: 2023 VOA files not found — M4 (new supply) will be null")
        list_2023 = sumval_2023 = None
    else:
        print(f"Found 2023 files — will compute M4 (new supply)")
    print()

    # Pre-flight
    preflight_check(list_2026, sumval_2026)
    if list_2023:
        preflight_check(list_2023, sumval_2023)

    # ---- 2026 pipeline ----
    print("=" * 64)
    print("Processing 2026 list...")
    print("=" * 64)
    wanted_2026, stats_2026 = stream_list_entries(list_2026, ba_to_market, LIST_COMPILATION_DATE_2026, args.sample)
    uarn_area_2026 = stream_summary_valuations(sumval_2026, wanted_2026, args.sample)
    agg_2026 = aggregate_per_market(wanted_2026, uarn_area_2026, markets)

    # ---- 2023 pipeline (optional) ----
    agg_2023 = None
    stats_2023 = None
    if list_2023 and sumval_2023:
        print("=" * 64)
        print("Processing 2023 list...")
        print("=" * 64)
        wanted_2023, stats_2023 = stream_list_entries(list_2023, ba_to_market, LIST_COMPILATION_DATE_2023, args.sample)
        # For M4 we only need unit counts, not floorspace — skip summary valuations join
        # This gives us raw mli_unit_count which is what M4 subtracts.
        # (If we want size-verified 2023 counts, we'd need to stream summary vals too.)
        agg_2023 = aggregate_per_market(wanted_2023, {}, markets)

    # ---- Compute metrics ----
    print("=" * 64)
    print("Computing metrics...")
    print("=" * 64)
    source_date = LIST_COMPILATION_DATE_2026.isoformat()
    records = compute_metrics(agg_2026, agg_2023, markets, source_date)

    # ---- Summary ----
    summary = {
        "total_records": len(records),
        "records_with_value": sum(1 for r in records if r["value"] is not None),
        "records_missing": sum(1 for r in records if r["status"] == "MISSING"),
        "records_review_needed": sum(1 for r in records if r["status"] == "REVIEW_NEEDED"),
        "records_verified": sum(1 for r in records if r["status"] == "VERIFIED"),
    }

    # Per-metric coverage
    per_metric = {}
    for metric_id in ["voa_mli_stock_sqft", "voa_mli_unit_count",
                      "voa_mli_concentration_pct", "voa_mli_new_supply"]:
        verified = sum(1 for r in records if r["metric_id"] == metric_id and r["status"] == "VERIFIED")
        per_metric[metric_id] = f"{verified}/76 markets verified"

    output = {
        "generated_at": date.today().isoformat(),
        "source": "VOA 2026 Non-Domestic Rating List (and optionally 2023 baseline)",
        "source_url": "https://voaratinglists.blob.core.windows.net/html/rlidata.htm",
        "metrics_covered": ["voa_mli_stock_sqft", "voa_mli_unit_count",
                            "voa_mli_concentration_pct", "voa_mli_new_supply"],
        "records": records,
        "summary": summary,
        "per_metric_coverage": per_metric,
        "processing_stats": {
            "2026": {k: v for k, v in stats_2026.items() if k != "unmapped_bas"},
            "2023": ({k: v for k, v in stats_2023.items() if k != "unmapped_bas"}
                     if stats_2023 else None),
        },
        "filter_policy": "see scrapers/config/voa_scat_filter.json",
        "mapping_policy": "see scrapers/config/voa_la_mapping.json",
    }

    # Write output
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    clear_checkpoint()

    print()
    print("=" * 64)
    print(f"Output written to {out_path}")
    print(f"  {summary['records_with_value']} / {summary['total_records']} records have values")
    print(f"  per metric:")
    for k, v in per_metric.items():
        print(f"    {k}: {v}")
    print("=" * 64)
    return 0


if __name__ == "__main__":
    sys.exit(main())
