"""
NOMIS Extended Scraper — Tier 1 metrics (2025 data).

Adds these metrics to the pipeline using free NOMIS datasets:

  M15 — Business formation growth (YoY %)     via NM_142_1 UK Business Counts (2024 vs 2025)
  M16 — SME density (per 1,000 population)    via NM_142_1 UK Business Counts / NM_2002_1 pop
  M37 — Economic activity rate (%)             via NM_17_1 APS (Jan-Dec 2025)
  M38 — Logistics wage index (national=100)    via NM_30_1 ASHE Table 7 median gross weekly
  M39 — Labour cost index (national=100)       via NM_30_1 ASHE Table 7 median gross weekly

Notes:
- M38 uses all-industry median as a proxy for logistics wages — LA-level ASHE by
  industry is suppressed for confidentiality. The index is flagged to indicate
  this limitation.
- M37 is computed as (economically active 16-64) / (all 16-64) × 100 from NM_17_1.
  Uses cells 402721025 and 402720769.
- M16 SME = sum of micro (10) + small (20) + medium (30) sizebands; excludes
  large (40). Uses legal_status=0 (Total) to avoid double-counting.

Output: scrapers/output/nomis_extended_data.json
"""

from __future__ import annotations

import json
import sys
import time
from datetime import date
from pathlib import Path

import requests

# ----- Paths ------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPT_DIR / "config" / "markets.json"
OUTPUT_PATH = SCRIPT_DIR / "output" / "nomis_extended_data.json"

NOMIS_BASE = "https://www.nomisweb.co.uk/api/v01/dataset"
BATCH_SIZE = 50
REQUEST_DELAY = 1.2

# ----- Helpers ----------------------------------------------------------------

def load_markets() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def collect_all_la_codes(markets: dict) -> list[str]:
    codes: set[str] = set()
    for info in markets.values():
        codes.update(info["la_codes"])
    return sorted(codes)


def nomis_batched(dataset: str, la_codes: list[str], extra_params: dict) -> list[dict]:
    """Query NOMIS in batches of GSS codes, return all observations concatenated."""
    all_obs: list[dict] = []
    for i in range(0, len(la_codes), BATCH_SIZE):
        batch = la_codes[i : i + BATCH_SIZE]
        params = {"geography": ",".join(batch), **extra_params, "measures": "20100"}
        r = requests.get(f"{NOMIS_BASE}/{dataset}.data.json", params=params, timeout=120)
        r.raise_for_status()
        data = r.json()
        all_obs.extend(data.get("obs", []))
        if i + BATCH_SIZE < len(la_codes):
            time.sleep(REQUEST_DELAY)
    return all_obs


def safe_float(val) -> float | None:
    if val is None or val == "":
        return None
    try:
        f = float(val)
        # NaN check
        return f if f == f else None
    except (ValueError, TypeError):
        return None


def aggregate_sum(la_data: dict[str, float | None], la_codes: list[str]) -> float | None:
    total = 0.0
    found = False
    for c in la_codes:
        v = la_data.get(c)
        if v is not None:
            total += v
            found = True
    return total if found else None


def aggregate_mean(la_data: dict[str, float | None], la_codes: list[str]) -> float | None:
    vals = [la_data[c] for c in la_codes if c in la_data and la_data[c] is not None]
    return sum(vals) / len(vals) if vals else None


def make_record(
    market_id: str, info: dict, metric_id: str, pillar: str,
    value: float | None, unit: str, source_url: str, source_name: str,
    source_date: str,
) -> dict:
    return {
        "market_id": market_id,
        "market": info["name"],
        "region": info["region"],
        "metric_id": metric_id,
        "pillar": pillar,
        "value": value,
        "unit": unit,
        "geographic_level": "market",
        "source_url": source_url,
        "source_name": source_name,
        "source_date": source_date,
        "scrape_date": date.today().isoformat(),
        "status": "VERIFIED" if value is not None else "MISSING",
        "raw_text": None,
    }


# ----- Fetchers --------------------------------------------------------------

def fetch_economic_activity(la_codes: list[str]):
    """
    M37: Economic activity rate (%) aged 16-64.
    NM_17_1 APS. cell 402721025 (econ active 16-64 all people) / cell 402720769 (all 16-64)
    """
    print("  Fetching Economic Activity Rate (NM_17_1)...")
    obs = nomis_batched("NM_17_1", la_codes, {
        "date": "latest",
        "cell": "402721025,402720769",
    })
    print(f"    Raw obs: {len(obs)}")

    # Collect per-LA: econ active 16-64 and total 16-64
    active_16_64: dict[str, float] = {}
    all_16_64: dict[str, float] = {}
    date_label = ""
    for o in obs:
        cell_val = o.get("cell", {}).get("value")
        code = o.get("geography", {}).get("geogcode", "")
        val = safe_float(o.get("obs_value", {}).get("value"))
        if not code:
            continue
        if cell_val == 402721025 and val is not None:
            active_16_64[code] = val
        elif cell_val == 402720769 and val is not None:
            all_16_64[code] = val
        if not date_label:
            date_label = str(o.get("time", {}).get("description", ""))

    # Compute rate per LA
    rates: dict[str, float | None] = {}
    for code in all_16_64:
        if all_16_64[code] > 0 and code in active_16_64:
            rates[code] = round(100.0 * active_16_64[code] / all_16_64[code], 1)

    source_url = f"{NOMIS_BASE}/NM_17_1.data.json?cells=402721025,402720769"
    print(f"    Got {len(rates)} LA rates, period: {date_label}")
    return rates, source_url, date_label


def fetch_ashe_median_pay(la_codes: list[str]):
    """
    M38/M39: ASHE Table 7 median gross weekly pay, all full-time workers.
    NM_30_1. Returns {code: weekly_pay_gbp} and the national median for indexing.

    Filter codes (confirmed by introspection):
      sex=8: Full Time Workers (all genders)
      item=2: Median
      pay=1: Weekly pay - gross
    """
    print("  Fetching ASHE Median Weekly Pay (NM_30_1)...")
    obs = nomis_batched("NM_30_1", la_codes, {
        "date": "latest",
        "sex": "8",
        "item": "2",
        "pay": "1",
    })
    print(f"    Raw obs: {len(obs)}")

    pay: dict[str, float] = {}
    date_label = ""
    for o in obs:
        code = o.get("geography", {}).get("geogcode", "")
        val = safe_float(o.get("obs_value", {}).get("value"))
        if code and val is not None and val > 0:
            pay[code] = val
        if not date_label:
            date_label = str(o.get("time", {}).get("description", ""))

    # Fetch national England median for indexing
    time.sleep(REQUEST_DELAY)
    r = requests.get(f"{NOMIS_BASE}/NM_30_1.data.json",
        params={"geography": "E92000001", "date": "latest",
                "sex": "8", "item": "2", "pay": "1", "measures": "20100"}, timeout=60)
    national_median: float | None = None
    for o in r.json().get("obs", []):
        national_median = safe_float(o.get("obs_value", {}).get("value"))
        if national_median:
            break

    if not national_median:
        # Fall back to UK (geography 2013265921 = United Kingdom)
        time.sleep(REQUEST_DELAY)
        r = requests.get(f"{NOMIS_BASE}/NM_30_1.data.json",
            params={"geography": "2013265921", "date": "latest",
                    "sex": "8", "item": "2", "pay": "1", "measures": "20100"}, timeout=60)
        for o in r.json().get("obs", []):
            national_median = safe_float(o.get("obs_value", {}).get("value"))
            if national_median:
                break

    print(f"    Got {len(pay)} LA median wages, period: {date_label}, national median: {national_median}")
    source_url = f"{NOMIS_BASE}/NM_30_1.data.json?sex=8&item=2&pay=1"
    return pay, national_median, source_url, date_label


def fetch_business_counts(la_codes: list[str], year: str):
    """
    Fetch UK Business Counts (NM_142_1) for a specific year.
    Returns: {code: {"total": int, "sme": int}} where SME = micro+small+medium.

    Year should be a 4-digit year like '2024' or '2025' (or 'latest').
    Do NOT use 'latest-1' — NOMIS interprets that based on time index position,
    not calendar year.
    """
    print(f"  Fetching UK Business Counts NM_142_1 (date={year})...")
    obs = nomis_batched("NM_142_1", la_codes, {
        "date": year,
        "industry": "37748736",      # Total / All industries
        "legal_status": "0",           # Total (all legal statuses)
    })
    print(f"    Raw obs: {len(obs)}")

    # Aggregate per LA: total count (sizeband=0) and SME count (sum of 10,20,30)
    per_la: dict[str, dict] = {}
    date_label = ""
    for o in obs:
        code = o.get("geography", {}).get("geogcode", "")
        es = o.get("employment_sizeband", {})
        es_val = es.get("value")
        val = safe_float(o.get("obs_value", {}).get("value"))
        if not code or val is None:
            continue

        # Use only Total industry records to avoid double-counting
        ind_val = o.get("industry", {}).get("value")
        if ind_val != 37748736:
            continue

        if code not in per_la:
            per_la[code] = {"total": 0.0, "sme": 0.0}

        # sizeband 0 = Total; 10,20,30 = micro/small/medium
        if es_val == 0:
            per_la[code]["total"] = val
        elif es_val in (10, 20, 30):
            per_la[code]["sme"] += val

        if not date_label:
            date_label = str(o.get("time", {}).get("description", ""))

    print(f"    Got {len(per_la)} LA business counts, period: {date_label}")
    return per_la, date_label


def fetch_population_for_sme_density(la_codes: list[str]) -> dict[str, int]:
    """Get latest total population per LA for SME density denominator."""
    print("  Fetching latest population estimates (NM_2002_1)...")
    obs = nomis_batched("NM_2002_1", la_codes, {"date": "latest"})
    pop: dict[str, int] = {}
    for o in obs:
        if (o.get("gender", {}).get("value") == 0
                and o.get("c_age", {}).get("value") == 200):
            code = o.get("geography", {}).get("geogcode", "")
            val = safe_float(o.get("obs_value", {}).get("value"))
            if code and val is not None:
                pop[code] = int(val)
    print(f"    Got population for {len(pop)} LAs")
    return pop


# ----- Main -------------------------------------------------------------------

def main():
    print("=" * 64)
    print("NOMIS Extended Scraper — Tier 1 Metrics")
    print("=" * 64)

    markets = load_markets()
    all_codes = collect_all_la_codes(markets)
    print(f"Markets: {len(markets)}, unique LA codes: {len(all_codes)}")
    print()

    records: list[dict] = []
    warnings: list[str] = []

    # ---------- M37: Economic activity rate ----------
    print("[1/4] M37 Economic Activity Rate")
    try:
        ea_data, ea_url, ea_date = fetch_economic_activity(all_codes)
        time.sleep(REQUEST_DELAY)
        for mid, info in markets.items():
            val = aggregate_mean(ea_data, info["la_codes"])
            v = round(val, 1) if val is not None else None
            records.append(make_record(mid, info, "M37", "Labour", v, "%",
                ea_url, "NOMIS Annual Population Survey", ea_date))
            if val is None:
                warnings.append(f"{mid} ({info['name']}): M37 — no APS data")
    except Exception as e:
        warnings.append(f"M37 failed: {e}")
        print(f"  ERROR: {e}")

    # ---------- M38/M39: ASHE wage index ----------
    print("\n[2/4] M38 / M39 ASHE Median Weekly Pay")
    try:
        pay_data, national_median, pay_url, pay_date = fetch_ashe_median_pay(all_codes)
        time.sleep(REQUEST_DELAY)
        if national_median:
            for mid, info in markets.items():
                la_pay = aggregate_mean(pay_data, info["la_codes"])
                if la_pay is not None and national_median > 0:
                    index = round(100.0 * la_pay / national_median, 1)
                    # M38 logistics wage index — using all-industry median as proxy
                    raw_text_m38 = (f"LA median £{la_pay:.0f}/wk, national median £{national_median:.0f}/wk. "
                                    f"PROXY: LA-level ASHE industry breakdown unavailable due to "
                                    f"confidentiality suppression. Using all-industry median.")
                    rec = make_record(mid, info, "M38", "Labour", index, "index (national=100)",
                        pay_url, "NOMIS ASHE Table 7 (Workplace)", pay_date)
                    rec["raw_text"] = raw_text_m38
                    records.append(rec)
                    # M39 labour cost index
                    records.append(make_record(mid, info, "M39", "Labour", index, "index (national=100)",
                        pay_url, "NOMIS ASHE Table 7 (Workplace)", pay_date))
                else:
                    records.append(make_record(mid, info, "M38", "Labour", None, "index (national=100)",
                        pay_url, "NOMIS ASHE Table 7 (Workplace)", pay_date))
                    records.append(make_record(mid, info, "M39", "Labour", None, "index (national=100)",
                        pay_url, "NOMIS ASHE Table 7 (Workplace)", pay_date))
                    warnings.append(f"{mid} ({info['name']}): M38/M39 — no ASHE data")
        else:
            warnings.append("M38/M39: national median not obtained — cannot compute indices")
    except Exception as e:
        warnings.append(f"M38/M39 failed: {e}")
        print(f"  ERROR: {e}")

    # ---------- M16: SME density ----------
    print("\n[3/4] M16 SME Density (per 1,000 population)")
    try:
        bc_latest, bc_latest_date = fetch_business_counts(all_codes, "latest")
        time.sleep(REQUEST_DELAY)
        pop = fetch_population_for_sme_density(all_codes)
        time.sleep(REQUEST_DELAY)
        bc_url = f"{NOMIS_BASE}/NM_142_1.data.json?industry=total&legal_status=0"
        for mid, info in markets.items():
            sme_total = 0.0
            pop_total = 0
            for code in info["la_codes"]:
                la = bc_latest.get(code)
                if la:
                    sme_total += la.get("sme", 0)
                pop_total += pop.get(code, 0)
            if pop_total > 0 and sme_total > 0:
                density = round(sme_total * 1000.0 / pop_total, 1)
                records.append(make_record(mid, info, "M16", "Demand", density, "SMEs per 1,000 pop.",
                    bc_url, "NOMIS UK Business Counts", bc_latest_date))
            else:
                records.append(make_record(mid, info, "M16", "Demand", None, "SMEs per 1,000 pop.",
                    bc_url, "NOMIS UK Business Counts", bc_latest_date))
                warnings.append(f"{mid} ({info['name']}): M16 — insufficient data")
    except Exception as e:
        warnings.append(f"M16 failed: {e}")
        print(f"  ERROR: {e}")

    # ---------- M15: Business formation growth (YoY) ----------
    print("\n[4/4] M15 Business Formation Growth (YoY %)")
    try:
        # Compute YoY from 2024 vs 2025 using matched-pairs only:
        # For each market, only include LAs that have data in BOTH years. This
        # avoids spurious drops when one LA is missing from one year.
        bc_prev, bc_prev_date = fetch_business_counts(all_codes, "2024")
        bc_url = f"{NOMIS_BASE}/NM_142_1.data.json?industry=total&legal_status=0"
        for mid, info in markets.items():
            cur_total = 0.0
            prev_total = 0.0
            matched_las: list[str] = []
            dropped_las: list[str] = []
            for code in info["la_codes"]:
                cur = bc_latest.get(code, {}).get("total", 0)
                prev = bc_prev.get(code, {}).get("total", 0)
                if cur > 0 and prev > 0:
                    cur_total += cur
                    prev_total += prev
                    matched_las.append(code)
                else:
                    dropped_las.append(code)
            if prev_total > 0 and cur_total > 0 and matched_las:
                growth = round(100.0 * (cur_total - prev_total) / prev_total, 1)
                rec = make_record(mid, info, "M15", "Demand", growth, "% YoY",
                    bc_url, "NOMIS UK Business Counts (YoY change)",
                    f"{bc_prev_date} to {bc_latest_date}")
                note = f"Business count {prev_total:.0f} -> {cur_total:.0f} across {len(matched_las)}/{len(info['la_codes'])} LAs"
                if dropped_las:
                    note += f" ({len(dropped_las)} LAs dropped: missing data in one year)"
                rec["raw_text"] = note
                records.append(rec)
            else:
                records.append(make_record(mid, info, "M15", "Demand", None, "% YoY",
                    bc_url, "NOMIS UK Business Counts (YoY change)",
                    f"{bc_prev_date} to {bc_latest_date}"))
                warnings.append(f"{mid} ({info['name']}): M15 — no LAs with matched 2024+2025 data")
    except Exception as e:
        warnings.append(f"M15 failed: {e}")
        print(f"  ERROR: {e}")

    # ---------- Output ----------
    output = {
        "generated_at": date.today().isoformat(),
        "source": "NOMIS API (free, no auth)",
        "metrics_covered": ["M15", "M16", "M37", "M38", "M39"],
        "records": records,
        "warnings": warnings,
        "summary": {
            "total_records": len(records),
            "records_with_value": sum(1 for r in records if r["value"] is not None),
            "records_missing": sum(1 for r in records if r["value"] is None),
        },
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n{'='*64}")
    print(f"Done: {OUTPUT_PATH}")
    print(f"  Records: {output['summary']['total_records']}")
    print(f"  With value: {output['summary']['records_with_value']}")
    print(f"  Missing: {output['summary']['records_missing']}")
    print(f"  Warnings: {len(warnings)}")

    # per-metric coverage
    for mid_str in ["M15", "M16", "M37", "M38", "M39"]:
        verified = sum(1 for r in records if r["metric_id"] == mid_str and r["value"] is not None)
        print(f"    {mid_str}: {verified}/76 markets")

    return 0 if output["summary"]["records_with_value"] > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
