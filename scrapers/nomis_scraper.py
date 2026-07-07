"""
NOMIS API scraper for labour market metrics.

Pulls verified government data for all 76 UK markets from free NOMIS datasets.
No authentication required.

Metrics produced:
  M33 -- Population growth (10yr %)       via Mid-year Population Estimates
  M35 -- Working-age share (%)            via Mid-year Population Estimates
  M36 -- Unemployment rate (%)            via Claimant Count (proportion of 16-64)
  M37 -- Economic activity rate (%)       via Annual Population Survey (model-based)
  M40 -- Logistics/manufacturing share(%) via BRES (employment by SIC code)

Output: scrapers/output/nomis_data.json
"""

import json
import time
import sys
from pathlib import Path
from datetime import date
from math import isnan

import requests

# ---- Config ---------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPT_DIR / "config" / "markets.json"
OUTPUT_PATH = SCRIPT_DIR / "output" / "nomis_data.json"

NOMIS_BASE = "https://www.nomisweb.co.uk/api/v01/dataset"

# Geography types (post-2021 LA boundaries)
GEO_LA_2023 = "TYPE424"  # local authorities: district/unitary as of April 2023
GEO_LA_2021 = "TYPE432"  # local authorities: district/unitary as of April 2021

REQUEST_DELAY = 1.5

# Max GSS codes per NOMIS API request (URL length limit)
BATCH_SIZE = 50


# ---- Helpers --------------------------------------------------------------

def load_markets() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def collect_all_la_codes(markets: dict) -> list[str]:
    """Get deduplicated list of all LA GSS codes across all markets."""
    codes = set()
    for info in markets.values():
        codes.update(info["la_codes"])
    return sorted(codes)


def nomis_get(dataset: str, params: dict) -> list[dict]:
    """Query NOMIS API, return list of observation dicts."""
    url = f"{NOMIS_BASE}/{dataset}.data.json"
    resp = requests.get(url, params=params, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    return data.get("obs", [])


def nomis_get_batched(dataset: str, all_codes: list[str], extra_params: dict) -> list[dict]:
    """Query NOMIS in batches of GSS codes to avoid URL length limits."""
    all_obs = []
    for i in range(0, len(all_codes), BATCH_SIZE):
        batch = all_codes[i:i + BATCH_SIZE]
        params = {"geography": ",".join(batch), **extra_params, "measures": "20100"}
        obs = nomis_get(dataset, params)
        all_obs.extend(obs)
        if i + BATCH_SIZE < len(all_codes):
            time.sleep(REQUEST_DELAY)
    return all_obs


def safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
        return None if isnan(f) else f
    except (ValueError, TypeError):
        return None


def extract_obs(obs_list: list[dict], filter_fn=None) -> dict[str, float | None]:
    """
    Extract {geogcode: obs_value} from NOMIS observation list.
    filter_fn: optional callable(obs_dict) -> bool to filter records.
    """
    result: dict[str, float | None] = {}
    for o in obs_list:
        if filter_fn and not filter_fn(o):
            continue
        code = o.get("geography", {}).get("geogcode", "")
        val = safe_float(o.get("obs_value", {}).get("value"))
        if code:
            result[code] = val
    return result


def get_date_label(obs_list: list[dict]) -> str:
    if obs_list:
        return str(obs_list[0].get("time", {}).get("description", ""))
    return ""


def aggregate(la_data: dict[str, float | None], la_codes: list[str]) -> float | None:
    """Mean across constituent LAs."""
    vals = [la_data[c] for c in la_codes if c in la_data and la_data[c] is not None]
    if not vals:
        return None
    return round(sum(vals) / len(vals), 2)


def aggregate_sum(la_data: dict[str, float | None], la_codes: list[str]) -> float | None:
    """Sum across constituent LAs."""
    total = 0.0
    found = False
    for c in la_codes:
        v = la_data.get(c)
        if v is not None:
            total += v
            found = True
    return total if found else None


def make_record(market_id, info, metric_id, pillar, value, unit, source_url, source_name, source_date):
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


# ---- Dataset fetchers -----------------------------------------------------

def fetch_claimant_count(all_codes: list[str]):
    """
    Claimant count as proportion of residents aged 16-64 (%) by LA.
    Dataset NM_162_1. measure=2 is the 16-64 rate.
    Uses direct GSS code queries for full coverage.
    """
    print("  Fetching Claimant Count rate (NM_162_1)...")
    obs = nomis_get_batched("NM_162_1", all_codes, {"date": "latest"})
    print(f"    Raw obs: {len(obs)}")

    # Filter: gender=Total (0), age=All (0), measure=2 (rate as % of 16-64)
    data = extract_obs(obs, lambda o: (
        o.get("gender", {}).get("value") == 0
        and o.get("age", {}).get("value") == 0
        and o.get("measure", {}).get("value") == 2
    ))
    date_label = get_date_label(obs)
    source_url = f"{NOMIS_BASE}/NM_162_1.data.json?date=latest"
    print(f"    Filtered to {len(data)} LA rates, period: {date_label}")
    return data, source_url, date_label


def fetch_population_latest(all_codes: list[str]):
    """
    Mid-year population estimates (NM_2002_1).
    Returns {code: total_pop} and {code: working_age_pop}.
    """
    print("  Fetching Population Estimates (NM_2002_1) - latest...")
    obs = nomis_get_batched("NM_2002_1", all_codes, {"date": "latest"})
    print(f"    Raw obs: {len(obs)}")

    if not obs:
        return {}, {}, ""

    # All Ages = c_age value 200, Working age 16-64 = c_age value 203
    totals = extract_obs(obs, lambda o: (
        o.get("gender", {}).get("value") == 0
        and o.get("c_age", {}).get("value") == 200
    ))
    wa = extract_obs(obs, lambda o: (
        o.get("gender", {}).get("value") == 0
        and o.get("c_age", {}).get("value") == 203
    ))

    date_label = get_date_label(obs)
    print(f"    Total pop: {len(totals)} LAs, Working age (16-64): {len(wa)} LAs, period: {date_label}")
    return totals, wa, date_label


def fetch_population_historical(all_codes: list[str]):
    """Population estimates from ~10 years ago for growth calculation."""
    print("  Fetching Population Estimates (10yr ago)...")
    # Use specific year rather than 'latest-10' to avoid issues
    # Try 2014 (approx 10yr before 2024)
    obs = nomis_get_batched("NM_2002_1", all_codes, {"date": "2014"})
    if not obs:
        # Fall back to trying other years
        for year in ["2013", "2015"]:
            obs = nomis_get_batched("NM_2002_1", all_codes, {"date": year})
            if obs:
                break

    print(f"    Raw obs: {len(obs)}")
    if not obs:
        return {}, ""

    totals = extract_obs(obs, lambda o: (
        o.get("gender", {}).get("value") == 0
        and o.get("c_age", {}).get("value") == 200
    ))
    date_label = get_date_label(obs)
    print(f"    Historical pop: {len(totals)} LAs, period: {date_label}")
    return totals, date_label


def fetch_economic_activity(all_codes: list[str]):
    """
    Economic activity rate (%).

    Strategy:
      1. Try NM_17_5 (model-based estimates) via geography types
      2. Try NM_17_5 with direct GSS codes
      3. Fall back to Annual Population Survey (NM_17_1) with direct GSS codes
         using variable 45 (economic activity rate, aged 16-64)
    """
    # Attempt 1: NM_17_5 via TYPE424
    print("  Fetching Economic Activity Rate (NM_17_5 via TYPE424)...")
    obs = nomis_get("NM_17_5", {
        "geography": GEO_LA_2023,
        "date": "latest",
        "variable": "45",
        "measures": "20100",
    })
    print(f"    Raw obs: {len(obs)}")

    if not obs:
        obs = nomis_get("NM_17_5", {
            "geography": "TYPE464",
            "date": "latest",
            "variable": "45",
            "measures": "20100",
        })
        print(f"    Fallback TYPE464 obs: {len(obs)}")

    if not obs:
        # Attempt 2: NM_17_5 with direct GSS codes
        print("    Trying NM_17_5 with direct GSS codes...")
        obs = nomis_get_batched("NM_17_5", all_codes, {
            "date": "latest",
            "variable": "45",
        })
        print(f"    Direct GSS obs: {len(obs)}")

    if not obs:
        # Attempt 3: Annual Population Survey (NM_17_1) — economic activity rate
        print("    Trying APS (NM_17_1) with direct GSS codes...")
        obs = nomis_get_batched("NM_17_1", all_codes, {
            "date": "latest",
            "variable": "45",
        })
        print(f"    APS NM_17_1 obs: {len(obs)}")

    if not obs:
        # Attempt 4: APS (NM_17_1) via geography types
        print("    Trying APS (NM_17_1) via TYPE424...")
        obs = nomis_get("NM_17_1", {
            "geography": GEO_LA_2023,
            "date": "latest",
            "variable": "45",
            "measures": "20100",
        })
        print(f"    APS TYPE424 obs: {len(obs)}")

    if not obs:
        # Attempt 5: Try broader APS variables for economic activity
        print("    Trying APS (NM_17_1) via TYPE424, variable 18 (all aged 16+)...")
        obs = nomis_get("NM_17_1", {
            "geography": GEO_LA_2023,
            "date": "latest",
            "variable": "18",
            "measures": "20100",
        })
        print(f"    APS variable 18 obs: {len(obs)}")

    data = extract_obs(obs)
    date_label = get_date_label(obs)
    source_url = f"{NOMIS_BASE}/NM_17_1.data.json?date=latest&variable=45"
    print(f"    Got {len(data)} LA values, period: {date_label}")
    return data, source_url, date_label


# BRES NOMIS industry codes (SIC 2-digit level)
BRES_TOTAL = 37748736
# Manufacturing: SIC 10-33 (codes 146800650..146800673)
BRES_MFG_CODES = [146800650 + i for i in range(24)]  # 10..33
# Transport & Storage: SIC 49-53 (codes 146800689..146800693)
BRES_TRANSPORT_CODES = [146800689, 146800690, 146800691, 146800692, 146800693]


def fetch_bres_employment(all_codes: list[str]):
    """
    BRES employment by industry (NM_189_1).
    Queries only the Total, Manufacturing (10-33), and Transport (49-53) codes
    to keep response sizes manageable.
    """
    print("  Fetching BRES Employment (NM_189_1)...")

    # Build comma-separated industry filter
    target_industries = [BRES_TOTAL] + BRES_MFG_CODES + BRES_TRANSPORT_CODES
    industry_str = ",".join(str(c) for c in target_industries)

    obs = nomis_get_batched("NM_189_1", all_codes, {
        "date": "latest",
        "employment_status": "1",
        "industry": industry_str,
    })
    print(f"    Raw obs: {len(obs)}")

    if not obs:
        return {}, "", ""

    # Filter to measure=1 (Count) only — measure=2 is industry percentage
    count_obs = [o for o in obs if o.get("measure", {}).get("value") == 1]
    print(f"    Count-only obs: {len(count_obs)}")

    # Extract totals
    totals = extract_obs(count_obs, lambda o: o.get("industry", {}).get("value") == BRES_TOTAL)

    # Sum manufacturing SIC 10-33
    mfg_set = set(BRES_MFG_CODES)
    mfg_by_la: dict[str, float] = {}
    for o in count_obs:
        if o.get("industry", {}).get("value") in mfg_set:
            code = o.get("geography", {}).get("geogcode", "")
            val = safe_float(o.get("obs_value", {}).get("value"))
            if code and val is not None:
                mfg_by_la[code] = mfg_by_la.get(code, 0) + val

    # Sum transport SIC 49-53
    trans_set = set(BRES_TRANSPORT_CODES)
    trans_by_la: dict[str, float] = {}
    for o in count_obs:
        if o.get("industry", {}).get("value") in trans_set:
            code = o.get("geography", {}).get("geogcode", "")
            val = safe_float(o.get("obs_value", {}).get("value"))
            if code and val is not None:
                trans_by_la[code] = trans_by_la.get(code, 0) + val

    result: dict[str, dict] = {}
    for code in totals:
        total = totals[code] or 0
        m = mfg_by_la.get(code, 0)
        t = trans_by_la.get(code, 0)
        result[code] = {"total": total, "logistics_mfg": m + t}

    date_label = get_date_label(obs)
    source_url = f"{NOMIS_BASE}/NM_189_1.data.json?date=latest"
    print(f"    Got {len(result)} LA employment records, period: {date_label}")
    return result, source_url, date_label


# ---- Main -----------------------------------------------------------------

def main():
    print("=== NOMIS Labour Market Scraper ===\n")
    markets = load_markets()
    all_codes = collect_all_la_codes(markets)
    print(f"Markets: {len(markets)}, unique LA codes: {len(all_codes)}")
    records: list[dict] = []
    warnings: list[str] = []

    # 1. Claimant Count -> M36
    print("\n[1/5] Claimant Count -> M36 (Unemployment rate proxy)")
    try:
        cc_data, cc_url, cc_date = fetch_claimant_count(all_codes)
        time.sleep(REQUEST_DELAY)
        for mid, info in markets.items():
            val = aggregate(cc_data, info["la_codes"])
            records.append(make_record(mid, info, "M36", "Labour", val, "%", cc_url, "NOMIS Claimant Count", cc_date))
            if val is None:
                warnings.append(f"{mid} ({info['name']}): M36 -- no data")
    except Exception as e:
        warnings.append(f"M36 fetch failed: {e}")
        print(f"  ERROR: {e}")

    # 2. Population -> M33, M35
    print("\n[2/5] Population -> M33 (growth), M35 (working-age share)")
    try:
        pop_total, pop_wa, pop_date = fetch_population_latest(all_codes)
        time.sleep(REQUEST_DELAY)
        pop_hist, hist_date = fetch_population_historical(all_codes)
        time.sleep(REQUEST_DELAY)

        pop_url = f"{NOMIS_BASE}/NM_2002_1.data.json"
        for mid, info in markets.items():
            # M35: working-age share
            total_sum = aggregate_sum(pop_total, info["la_codes"])
            wa_sum = aggregate_sum(pop_wa, info["la_codes"])
            if total_sum and total_sum > 0 and wa_sum is not None:
                wa_share = round((wa_sum / total_sum) * 100, 1)
                records.append(make_record(mid, info, "M35", "Labour", wa_share, "% of population", pop_url, "ONS Mid-year Population Estimates", pop_date))
            else:
                records.append(make_record(mid, info, "M35", "Labour", None, "% of population", pop_url, "ONS Mid-year Population Estimates", pop_date))
                warnings.append(f"{mid} ({info['name']}): M35 -- no population data")

            # M33: 10yr growth
            hist_sum = aggregate_sum(pop_hist, info["la_codes"])
            if total_sum and total_sum > 0 and hist_sum and hist_sum > 0:
                growth = round(((total_sum - hist_sum) / hist_sum) * 100, 1)
                records.append(make_record(mid, info, "M33", "Labour", growth, "% over 10 years", pop_url, "ONS Mid-year Population Estimates", f"{hist_date} to {pop_date}"))
            else:
                records.append(make_record(mid, info, "M33", "Labour", None, "% over 10 years", pop_url, "ONS Mid-year Population Estimates", pop_date))
                warnings.append(f"{mid} ({info['name']}): M33 -- insufficient data for growth calc")
    except Exception as e:
        warnings.append(f"M33/M35 fetch failed: {e}")
        print(f"  ERROR: {e}")

    # 3. Economic Activity -> M37
    print("\n[3/5] Economic Activity -> M37")
    try:
        ea_data, ea_url, ea_date = fetch_economic_activity(all_codes)
        time.sleep(REQUEST_DELAY)
        for mid, info in markets.items():
            val = aggregate(ea_data, info["la_codes"])
            records.append(make_record(mid, info, "M37", "Labour", val, "%", ea_url, "NOMIS APS Model-based Estimates", ea_date))
            if val is None:
                warnings.append(f"{mid} ({info['name']}): M37 -- no data")
    except Exception as e:
        warnings.append(f"M37 fetch failed: {e}")
        print(f"  ERROR: {e}")

    # 4. BRES -> M40
    print("\n[4/5] BRES -> M40 (Logistics/manufacturing workforce share)")
    try:
        bres_data, bres_url, bres_date = fetch_bres_employment(all_codes)
        time.sleep(REQUEST_DELAY)
        for mid, info in markets.items():
            total_emp = sum(bres_data.get(c, {}).get("total", 0) for c in info["la_codes"])
            total_lm = sum(bres_data.get(c, {}).get("logistics_mfg", 0) for c in info["la_codes"])
            if total_emp > 0:
                share = round((total_lm / total_emp) * 100, 1)
                records.append(make_record(mid, info, "M40", "Labour", share, "% of employment", bres_url, "ONS BRES", bres_date))
            else:
                records.append(make_record(mid, info, "M40", "Labour", None, "% of employment", bres_url, "ONS BRES", bres_date))
                warnings.append(f"{mid} ({info['name']}): M40 -- no BRES data")
    except Exception as e:
        warnings.append(f"M40 fetch failed: {e}")
        print(f"  ERROR: {e}")

    # 5. Save
    print(f"\n[5/5] Writing output...")
    output = {
        "generated_at": date.today().isoformat(),
        "source": "NOMIS API (free, no auth)",
        "metrics_covered": ["M33", "M35", "M36", "M37", "M40"],
        "records": records,
        "warnings": warnings,
        "summary": {
            "total_records": len(records),
            "records_with_value": sum(1 for r in records if r["value"] is not None),
            "records_missing": sum(1 for r in records if r["value"] is None),
            "warnings_count": len(warnings),
        },
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nDone. Output: {OUTPUT_PATH}")
    print(f"  Records: {output['summary']['total_records']}")
    print(f"  With value: {output['summary']['records_with_value']}")
    print(f"  Missing: {output['summary']['records_missing']}")
    print(f"  Warnings: {output['summary']['warnings_count']}")

    if warnings:
        print(f"\nFirst 10 warnings:")
        for w in warnings[:10]:
            print(f"  - {w}")
        if len(warnings) > 10:
            print(f"  ... and {len(warnings) - 10} more")

    return 0 if output["summary"]["records_with_value"] > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
