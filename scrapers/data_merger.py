"""
Data merger — combines all scraper outputs into a single master_data.json.

Reads JSON outputs from:
  - nomis_data.json      (M33, M35, M36, M37, M40)
  - overpass_data.json   (M22, M23, M24, M25)
  - flood_risk_data.json (M58)

Applies:
  1. Validation bounds (flags out-of-range values as REVIEW_NEEDED)
  2. Source priority hierarchy (government API > manual > regional proxy)
  3. Deduplication (keeps highest-priority source per market+metric)

Outputs:
  - public/data/master_data.json (consumed by React app)
  - scrapers/output/merged_data.json (full audit trail)

Usage:
  python scrapers/data_merger.py
"""

import json
import sys
from pathlib import Path
from datetime import date, datetime

# ─── Config ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = SCRIPT_DIR / "output"
CONFIG_DIR = SCRIPT_DIR / "config"
PUBLIC_DATA_DIR = PROJECT_ROOT / "public" / "data"

# Input files (all optional — merger skips missing files)
INPUT_FILES = [
    OUTPUT_DIR / "nomis_data.json",
    OUTPUT_DIR / "nomis_extended_data.json",
    OUTPUT_DIR / "drivetime_data.json",
    OUTPUT_DIR / "household_data.json",
    OUTPUT_DIR / "overpass_data.json",
    OUTPUT_DIR / "flood_risk_data.json",
    OUTPUT_DIR / "sepa_flood_data.json",
    OUTPUT_DIR / "voa_data.json",
    OUTPUT_DIR / "newmark_data.json",  # Newmark Q3 2025 PDF data (Section 1)
]

# Live gilt yield cache (produced by gilt_yield_fetcher.py) — used to
# calculate newmark_yield_spread = newmark_equivalent_yield - gilt_yield_pct
GILT_CACHE_PATH = CONFIG_DIR / "gilt_yield_cache.json"
GILT_STALE_DAYS = 7  # values older than this flag yield_spread as REVIEW_NEEDED

# Metric ID string → numeric ID mapping (used by React app)
# MLI metrics M61-M64 use string aliases emitted by voa_scraper.py
METRIC_ID_MAP = {
    "M1": 1, "M2": 2, "M3": 3, "M4": 4, "M5": 5,
    "M6": 6, "M7": 7, "M8": 8, "M9": 9, "M10": 10,
    "M11": 11, "M12": 12, "M13": 13, "M14": 14, "M15": 15,
    "M16": 16, "M17": 17, "M18": 18, "M19": 19, "M20": 20,
    "M21": 21, "M22": 22, "M23": 23, "M24": 24, "M25": 25,
    "M26": 26, "M27": 27, "M28": 28, "M29": 29, "M30": 30,
    "M31": 31, "M32": 32, "M33": 33, "M34": 34, "M35": 35,
    "M36": 36, "M37": 37, "M38": 38, "M39": 39, "M40": 40,
    "M41": 41, "M42": 42, "M43": 43, "M44": 44, "M45": 45,
    "M46": 46, "M47": 47, "M48": 48, "M49": 49, "M50": 50,
    "M51": 51, "M52": 52, "M53": 53, "M54": 54, "M55": 55,
    "M56": 56, "M57": 57, "M58": 58, "M59": 59, "M60": 60,
    # VOA MLI metrics — map string aliases to numeric IDs 61-64
    "voa_mli_stock_sqft": 61,
    "voa_mli_unit_count": 62,
    "voa_mli_concentration_pct": 63,
    "voa_mli_new_supply": 64,
    # Newmark Q3 2025 metrics — map string aliases to numeric IDs 41-42, 65-72
    # (M41 = all-grades ERV, M42 = prime rent — redefined as £psf in v5)
    "newmark_all_grades_erv": 41,
    "newmark_prime_rent": 42,
    "newmark_equivalent_yield": 65,
    "newmark_yield_spread": 66,
    "newmark_rental_reversion": 67,
    "newmark_rental_growth_forecast": 68,
    "newmark_vacancy": 69,
    "newmark_retention_rate": 70,
    "newmark_default_rate": 71,
    "newmark_pipeline_months": 72,
}

# Validation bounds per metric (min, max)
# Values outside these bounds are flagged as REVIEW_NEEDED
VALIDATION_RULES: dict[str, dict] = {
    "M22": {"min": 0, "max": 100, "unit": "km"},
    "M23": {"min": 0, "max": 200, "unit": "km"},
    "M24": {"min": 0, "max": 500, "unit": "km"},
    "M25": {"min": 0, "max": 500, "unit": "km"},
    "M33": {"min": -20, "max": 50, "unit": "%"},
    "M35": {"min": 40, "max": 80, "unit": "%"},
    "M36": {"min": 0, "max": 25, "unit": "%"},
    "M37": {"min": 50, "max": 95, "unit": "%"},
    "M40": {"min": 0, "max": 60, "unit": "%"},
    "M58": {"min": 1, "max": 5, "unit": "score"},
    # Tier 1 extended metrics
    "M15": {"min": -20, "max": 20, "unit": "% YoY"},
    "M16": {"min": 0, "max": 200, "unit": "SMEs per 1,000 pop"},
    "M38": {"min": 50, "max": 200, "unit": "index"},
    "M39": {"min": 50, "max": 200, "unit": "index"},
    "M21": {"min": 0, "max": 300, "unit": "minutes"},
    "M31": {"min": 0, "max": 20_000_000, "unit": "people"},
    "M32": {"min": 0, "max": 40_000_000, "unit": "people"},
    "M34": {"min": -5, "max": 20, "unit": "% over 5 years"},
    # VOA MLI bounds (validated against 70-market actual ranges)
    "voa_mli_stock_sqft": {"min": 0, "max": 100_000_000, "unit": "sqft"},
    "voa_mli_unit_count": {"min": 0, "max": 50_000, "unit": "units"},
    "voa_mli_concentration_pct": {"min": 0, "max": 100, "unit": "%"},
    "voa_mli_new_supply": {"min": -5000, "max": 10_000, "unit": "units"},
    # Newmark bounds (mirror src/config/metricValidation.ts M41/M42 + M65-M72)
    "newmark_all_grades_erv":         {"min": 3,   "max": 30,  "unit": "£psf"},
    "newmark_prime_rent":             {"min": 4,   "max": 45,  "unit": "£psf"},
    "newmark_equivalent_yield":       {"min": 3.5, "max": 8,   "unit": "%"},
    "newmark_yield_spread":           {"min": -2,  "max": 6,   "unit": "%"},
    "newmark_rental_reversion":       {"min": 0,   "max": 40,  "unit": "%"},
    "newmark_rental_growth_forecast": {"min": -5,  "max": 10,  "unit": "% pa"},
    "newmark_vacancy":                {"min": 0,   "max": 30,  "unit": "%"},
    "newmark_retention_rate":         {"min": 30,  "max": 90,  "unit": "%"},
    "newmark_default_rate":           {"min": 0,   "max": 10,  "unit": "%"},
    "newmark_pipeline_months":        {"min": 0,   "max": 24,  "unit": "months"},
}

# Source priority (lower number = higher priority)
STATUS_PRIORITY = {
    "VERIFIED": 1,
    "ESTIMATED": 2,
    "REGIONAL_PROXY": 3,
    "REVIEW_NEEDED": 4,
    "MISSING": 5,
}


# ─── Helpers ───────────────────────────────────────────────────────────────────

def validate_record(record: dict) -> dict:
    """Check a record's value against validation bounds."""
    metric_id = record.get("metric_id", "")
    value = record.get("value")
    rule = VALIDATION_RULES.get(metric_id)

    if value is None or rule is None:
        return record

    if value < rule["min"] or value > rule["max"]:
        record = {**record}
        record["status"] = "REVIEW_NEEDED"
        record["validation_note"] = (
            f"Value {value} outside expected range [{rule['min']}, {rule['max']}] {rule['unit']}"
        )
    return record


def load_scraper_output(path: Path) -> list[dict]:
    """Load records from a scraper output file."""
    if not path.exists():
        print(f"  Skipping (not found): {path.name}")
        return []
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    records = data.get("records", [])
    print(f"  Loaded {len(records)} records from {path.name}")
    return records


def load_gilt_yield() -> tuple[float | None, dict]:
    """Return (yield_pct, cache_info_dict). Missing cache → (None, {})."""
    if not GILT_CACHE_PATH.exists():
        return None, {}
    try:
        with open(GILT_CACHE_PATH, encoding="utf-8") as f:
            payload = json.load(f)
        y = payload.get("yield_pct")
        return (float(y) if y is not None else None), payload
    except (OSError, json.JSONDecodeError, ValueError, TypeError) as e:
        print(f"  [gilt cache] unreadable: {e}")
        return None, {}


def calculate_yield_spreads(records: list[dict]) -> tuple[list[dict], dict]:
    """
    For every newmark_equivalent_yield record, emit a matching
    newmark_yield_spread record (yield - gilt). If gilt cache is stale
    (>7 days) flag the spread records as REVIEW_NEEDED.
    Returns (new_records, gilt_info).
    """
    gilt_yield, cache_info = load_gilt_yield()
    extra: list[dict] = []
    cache_age = cache_info.get("cache_age_days", None)
    stale = (
        gilt_yield is None
        or (isinstance(cache_age, (int, float)) and cache_age > GILT_STALE_DAYS)
    )

    for r in records:
        if r.get("metric_id") != "newmark_equivalent_yield":
            continue
        ey = r.get("value")
        if ey is None or gilt_yield is None:
            continue
        spread = round(float(ey) - gilt_yield, 3)
        new = {**r}
        new["metric_id"] = "newmark_yield_spread"
        new["value"] = spread
        new["unit"] = "%"
        new["raw_text"] = f"{ey:.2f}% equivalent yield - {gilt_yield:.2f}% UK 10-yr gilt ({cache_info.get('source', 'unknown')})"
        if stale:
            new["status"] = "REVIEW_NEEDED"
            new["validation_note"] = (
                f"gilt yield cache is stale ({cache_age} days) — rerun gilt_yield_fetcher.py"
            )
        extra.append(new)

    gilt_summary = {
        "yield_pct": gilt_yield,
        "cache_age_days": cache_age,
        "source": cache_info.get("source", ""),
        "fetch_date": cache_info.get("fetch_date", ""),
        "is_stale": stale,
        "records_emitted": len(extra),
    }
    return extra, gilt_summary


def merge_records(all_records: list[dict]) -> dict[str, dict]:
    """
    Deduplicate records by (market_id, metric_id), keeping the
    highest-priority source for each combination.
    Returns {f"{market_id}|{metric_id}": record}.
    """
    merged: dict[str, dict] = {}
    for record in all_records:
        key = f"{record['market_id']}|{record['metric_id']}"
        status = record.get("status", "MISSING")
        priority = STATUS_PRIORITY.get(status, 5)

        if key not in merged:
            merged[key] = record
        else:
            existing_status = merged[key].get("status", "MISSING")
            existing_priority = STATUS_PRIORITY.get(existing_status, 5)
            # Keep higher-priority (lower number) source
            if priority < existing_priority:
                merged[key] = record
            # If same priority, keep the one with a non-null value
            elif priority == existing_priority and record.get("value") is not None and merged[key].get("value") is None:
                merged[key] = record

    return merged


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=== Data Merger ===\n")

    # Load all scraper outputs
    print("Loading scraper outputs:")
    all_records: list[dict] = []
    for path in INPUT_FILES:
        records = load_scraper_output(path)
        all_records.extend(records)

    if not all_records:
        print("\nNo records found. Run the scrapers first.")
        return 1

    # v5: Belfast (uk-76) removed from matrix — drop any records from older
    # scraper outputs that still reference it.
    before = len(all_records)
    all_records = [r for r in all_records if r.get("market_id") != "uk-76"]
    dropped = before - len(all_records)
    if dropped:
        print(f"  Dropped {dropped} records for removed market uk-76 (Belfast)")

    # Filter out records with no value and MISSING status
    records_with_data = [r for r in all_records if r.get("value") is not None]
    print(f"\nTotal records loaded: {len(all_records)}")
    print(f"Records with values: {len(records_with_data)}")

    # Calculate newmark_yield_spread from newmark_equivalent_yield + gilt cache
    print("\nCalculating newmark_yield_spread (equivalent yield - UK 10-yr gilt)...")
    yield_spread_records, gilt_info = calculate_yield_spreads(all_records)
    if gilt_info["yield_pct"] is not None:
        print(f"  Gilt yield: {gilt_info['yield_pct']:.3f}% from {gilt_info['source']} "
              f"(fetched {gilt_info['fetch_date']}, {gilt_info['cache_age_days']}d ago)"
              f"{' — STALE (>7d)' if gilt_info['is_stale'] else ''}")
        print(f"  Spread records emitted: {gilt_info['records_emitted']}")
        all_records.extend(yield_spread_records)
    else:
        print(f"  No gilt yield cache available — newmark_yield_spread omitted.")
        print(f"  Run `python scrapers/gilt_yield_fetcher.py` to populate cache.")

    # Validate
    print("\nValidating records...")
    validated = [validate_record(r) for r in all_records]
    review_count = sum(1 for r in validated if r.get("status") == "REVIEW_NEEDED" and r.get("validation_note"))
    print(f"  Flagged as REVIEW_NEEDED: {review_count}")

    # Merge (deduplicate by market+metric)
    print("\nMerging (deduplicating by market+metric)...")
    merged = merge_records(validated)
    print(f"  Unique market+metric pairs: {len(merged)}")

    # Build output structures
    # 1. Full audit trail for scrapers/output/
    merged_records = list(merged.values())
    merged_records.sort(key=lambda r: (r["market_id"], r["metric_id"]))

    # 2. Master data for React app (public/data/master_data.json)
    # Format: { markets: { market_id: { metrics: { numeric_id: { value, source, status } } } } }
    master: dict = {
        "generated_at": date.today().isoformat(),
        "version": 1,
        "metrics": {},
        "markets": {},
    }

    # Build metrics coverage summary
    metrics_seen: set[str] = set()
    for record in merged_records:
        mid = record["market_id"]
        metric_str = record["metric_id"]
        metric_num = METRIC_ID_MAP.get(metric_str)
        if metric_num is None:
            continue

        metrics_seen.add(metric_str)

        if mid not in master["markets"]:
            master["markets"][mid] = {
                "name": record["market"],
                "region": record["region"],
                "metrics": {},
            }

        if record.get("value") is not None:
            master["markets"][mid]["metrics"][str(metric_num)] = {
                "value": record["value"],
                "source_name": record.get("source_name", ""),
                "source_url": record.get("source_url", ""),
                "source_date": record.get("source_date", ""),
                "status": record.get("status", "VERIFIED"),
                "geographic_level": record.get("geographic_level", "market"),
            }

    master["metrics"] = sorted(list(metrics_seen))

    # Summary
    total_values = sum(
        len(m["metrics"]) for m in master["markets"].values()
    )
    markets_with_data = sum(
        1 for m in master["markets"].values() if len(m["metrics"]) > 0
    )

    summary = {
        "total_records": len(merged_records),
        "records_with_value": sum(1 for r in merged_records if r["value"] is not None),
        "records_missing": sum(1 for r in merged_records if r["value"] is None),
        "review_needed": sum(1 for r in merged_records if r.get("status") == "REVIEW_NEEDED"),
        "metrics_covered": sorted(list(metrics_seen)),
        "markets_with_data": markets_with_data,
        "total_metric_values": total_values,
    }

    # Write full audit trail
    audit_output = {
        "generated_at": date.today().isoformat(),
        "summary": summary,
        "records": merged_records,
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    audit_path = OUTPUT_DIR / "merged_data.json"
    with open(audit_path, "w") as f:
        json.dump(audit_output, f, indent=2)
    print(f"\nAudit trail: {audit_path}")

    # Write master_data.json for React app
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    master_path = PUBLIC_DATA_DIR / "master_data.json"
    with open(master_path, "w") as f:
        json.dump(master, f, indent=2)
    print(f"Master data: {master_path}")

    # Copy gilt_yield_cache.json to public/data/ so the Data Sources page can fetch it
    if GILT_CACHE_PATH.exists():
        dest = PUBLIC_DATA_DIR / "gilt_yield_cache.json"
        with open(GILT_CACHE_PATH, encoding="utf-8") as src_f:
            dest.write_text(src_f.read(), encoding="utf-8")
        print(f"Gilt cache:  {dest}")

    # Per-metric coverage — how many markets have each metric populated
    per_metric_coverage: dict[int, int] = {}
    for m in master["markets"].values():
        for mid in m["metrics"].keys():
            per_metric_coverage[int(mid)] = per_metric_coverage.get(int(mid), 0) + 1

    # Per-pillar coverage (rough mapping of metric-id ranges → pillars)
    def pillar_for_id(mid: int) -> str:
        if 1 <= mid <= 10 or mid in (61, 62, 63, 64, 69): return "Supply"
        if 11 <= mid <= 20 or mid in (70, 71):           return "Demand"
        if 21 <= mid <= 30:                              return "Connectivity"
        if 31 <= mid <= 40:                              return "Labour"
        if 41 <= mid <= 50 or mid in (65, 66, 67, 68):   return "Rents & Yields"
        if 51 <= mid <= 60 or mid == 72:                 return "Strategic / Risk"
        return "?"

    pillar_counts: dict[str, list[int]] = {}
    for mid, n in per_metric_coverage.items():
        pillar_counts.setdefault(pillar_for_id(mid), []).append(mid)

    # Print summary
    total_markets = len(master["markets"])
    print(f"\n{'='*60}")
    print(f"=== COVERAGE REPORT ===")
    print(f"{'='*60}")
    print(f"  Metrics covered:      {len(summary['metrics_covered'])}")
    print(f"  Markets with data:    {summary['markets_with_data']}/{total_markets}")
    print(f"  Total metric values:  {summary['total_metric_values']}")
    print(f"  Review needed:        {summary['review_needed']}")

    print(f"\nBy pillar (metric-id -> #markets populated):")
    for pillar in ["Supply", "Demand", "Connectivity", "Labour", "Rents & Yields", "Strategic / Risk"]:
        ids = sorted(pillar_counts.get(pillar, []))
        if not ids:
            print(f"  {pillar:22s} (no data)")
            continue
        entries = [f"M{i}={per_metric_coverage[i]}" for i in ids]
        print(f"  {pillar:22s} {', '.join(entries)}")

    print(f"\nNewmark metrics specifically (Rents & Yields improvement):")
    newmark_ids = [41, 42, 65, 66, 67, 68, 70, 71, 72]
    for nid in newmark_ids:
        cov = per_metric_coverage.get(nid, 0)
        print(f"  M{nid:<3d} {'X' if cov > 0 else '-'} {cov}/{total_markets} markets")

    if gilt_info.get("yield_pct") is not None:
        print(f"\nGilt yield: {gilt_info['yield_pct']:.3f}%"
              f" (source: {gilt_info['source']}, age: {gilt_info['cache_age_days']}d)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
