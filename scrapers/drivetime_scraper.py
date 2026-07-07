"""
Drive-time scraper — Tier 1 metrics M21, M31, M32.

Produces three metrics per market using free public services:

  M21 — Drive time to primary urban core (minutes)       via OSRM + UK major city list
  M31 — Population within 30-minute drive (people)        via OSRM + ONS LA centroids + NOMIS population
  M32 — Population within 60-minute drive (people)        via OSRM + ONS LA centroids + NOMIS population

Data sources (all free, no auth):
  - OSRM public server (router.project-osrm.org) for routing
  - ONS Open Geography Portal (arcgis) for LA centroids
  - NOMIS NM_2002_1 for LA populations (latest ~2024 mid-year estimates)

Approach:
  1. Fetch LA centroids for all LAs in our 144 needed codes
  2. Fetch LA populations (latest mid-year estimates)
  3. For each market: use OSRM /table to get drive times
     - Market centroid -> 15 UK major city centres: min = M21
     - Market centroid -> all 143 LA centroids: filter <=30/60 min, sum pops = M31/M32

Output: scrapers/output/drivetime_data.json
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
OUTPUT_PATH = SCRIPT_DIR / "output" / "drivetime_data.json"

# ----- Services ---------------------------------------------------------------

OSRM_BASE = "http://router.project-osrm.org"
ONS_LAD_ENDPOINT = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
    "Local_Authority_Districts_May_2024_Boundaries_UK_BFE/FeatureServer/0/query"
)
NOMIS_BASE = "https://www.nomisweb.co.uk/api/v01/dataset"

# Delay between OSRM requests (be polite to public server)
REQUEST_DELAY = 1.0

# ----- Major UK city centres for M21 ------------------------------------------
# Drive-time to these is the "primary urban core" reference.
# Chosen: ~15 largest commercial/retail conurbations covering all regions.

UK_MAJOR_CITIES: list[dict] = [
    {"name": "London",     "lat": 51.5074, "lng": -0.1278},
    {"name": "Birmingham", "lat": 52.4862, "lng": -1.8904},
    {"name": "Manchester", "lat": 53.4808, "lng": -2.2426},
    {"name": "Leeds",      "lat": 53.7997, "lng": -1.5492},
    {"name": "Liverpool",  "lat": 53.4084, "lng": -2.9916},
    {"name": "Newcastle",  "lat": 54.9783, "lng": -1.6178},
    {"name": "Sheffield",  "lat": 53.3811, "lng": -1.4701},
    {"name": "Glasgow",    "lat": 55.8642, "lng": -4.2518},
    {"name": "Edinburgh",  "lat": 55.9533, "lng": -3.1883},
    {"name": "Cardiff",    "lat": 51.4816, "lng": -3.1791},
    {"name": "Bristol",    "lat": 51.4545, "lng": -2.5879},
    {"name": "Belfast",    "lat": 54.5973, "lng": -5.9301},
    {"name": "Nottingham", "lat": 52.9548, "lng": -1.1581},
    {"name": "Leicester",  "lat": 52.6369, "lng": -1.1398},
    {"name": "Southampton","lat": 50.9097, "lng": -1.4044},
]

# LAs the ONS 2024 boundary file is missing — hardcoded from ONS pre-2024 data
# S12000044 = North Lanarkshire (centroid approx)
HARDCODED_LA_CENTROIDS = {
    "S12000044": {"name": "North Lanarkshire", "lat": 55.80, "lng": -3.88},
}

# ----- Helpers ----------------------------------------------------------------

def load_markets() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def collect_la_codes(markets: dict) -> set[str]:
    codes: set[str] = set()
    for info in markets.values():
        codes.update(info["la_codes"])
    return codes


def fetch_all_uk_la_centroids() -> dict[str, dict]:
    """Fetch centroids for ALL UK LAs (~370). Needed for accurate drive-time
    catchment population — we must consider LAs that aren't in our 76-market
    list but are within drive range."""
    print("  Fetching ALL UK LA centroids from ONS Open Geography Portal...")
    r = requests.get(ONS_LAD_ENDPOINT, params={
        "where": "1=1",
        "outFields": "LAD24CD,LAD24NM,LAT,LONG",
        "returnGeometry": "false",
        "resultRecordCount": 400,
        "f": "json",
    }, timeout=60)
    r.raise_for_status()
    data = r.json()

    centroids: dict[str, dict] = {}
    for feat in data.get("features", []):
        a = feat.get("attributes", {})
        code = a.get("LAD24CD")
        if code and a.get("LAT") is not None and a.get("LONG") is not None:
            centroids[code] = {
                "name": a.get("LAD24NM", ""),
                "lat": a.get("LAT"),
                "lng": a.get("LONG"),
            }
    print(f"    Got {len(centroids)} LA centroids")

    # Add hardcoded fallbacks
    for code, data in HARDCODED_LA_CENTROIDS.items():
        if code not in centroids:
            centroids[code] = data
            print(f"    Added hardcoded centroid for {code}")
    return centroids


def fetch_all_uk_la_populations(la_codes: list[str]) -> dict[str, int]:
    """Fetch latest mid-year population estimates for ALL UK LAs from NOMIS."""
    print(f"  Fetching populations for {len(la_codes)} LAs (NOMIS NM_2002_1)...")
    all_obs = []
    BATCH = 50
    for i in range(0, len(la_codes), BATCH):
        batch = la_codes[i : i + BATCH]
        r = requests.get(f"{NOMIS_BASE}/NM_2002_1.data.json", params={
            "geography": ",".join(batch),
            "date": "latest",
            "measures": "20100",
        }, timeout=120)
        r.raise_for_status()
        all_obs.extend(r.json().get("obs", []))
        if i + BATCH < len(la_codes):
            time.sleep(0.5)

    pop: dict[str, int] = {}
    date_label = ""
    for o in all_obs:
        if (o.get("gender", {}).get("value") == 0
                and o.get("c_age", {}).get("value") == 200):
            code = o.get("geography", {}).get("geogcode", "")
            val = o.get("obs_value", {}).get("value")
            if code and val is not None and val != "":
                try:
                    pop[code] = int(float(val))
                except (ValueError, TypeError):
                    pass
        if not date_label:
            date_label = str(o.get("time", {}).get("description", ""))

    print(f"    Got population for {len(pop)} LAs, period: {date_label}")
    return pop


def osrm_table(source: tuple[float, float], destinations: list[tuple[float, float]],
               batch_size: int = 100) -> list[float | None]:
    """
    Query OSRM /table with one source and N destinations. Batches to avoid
    hitting the public server's coordinate cap (~100).
    Returns list of durations in seconds (None for unreachable).
    """
    all_durations: list[float | None] = []
    for i in range(0, len(destinations), batch_size):
        batch = destinations[i : i + batch_size]
        all_coords = [source] + batch
        coord_str = ";".join(f"{lng},{lat}" for lat, lng in all_coords)
        url = f"{OSRM_BASE}/table/v1/driving/{coord_str}"
        try:
            r = requests.get(url, params={"sources": "0", "annotations": "duration"}, timeout=120)
            r.raise_for_status()
            data = r.json()
            if data.get("code") != "Ok":
                all_durations.extend([None] * len(batch))
                continue
            durations = data.get("durations", [[]])[0]
            # First element is source->source (~0). We want the rest.
            batch_durs = durations[1:] if len(durations) > 1 else [None] * len(batch)
            all_durations.extend(batch_durs)
        except Exception:
            all_durations.extend([None] * len(batch))
        # Small delay between batches
        if i + batch_size < len(destinations):
            time.sleep(0.5)
    return all_durations


def make_record(market_id: str, info: dict, metric_id: str, pillar: str,
                value: float | None, unit: str, source_url: str, source_name: str,
                source_date: str, raw_text: str | None = None) -> dict:
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
        "raw_text": raw_text,
    }


# ----- Main -------------------------------------------------------------------

def main():
    print("=" * 64)
    print("Drive-time Scraper — M21, M31, M32")
    print("=" * 64)

    markets = load_markets()
    print(f"Markets: {len(markets)}")
    print()

    # ---- Prepare reference data ----
    print("[1/4] Fetching reference data for ALL UK LAs")
    la_centroids = fetch_all_uk_la_centroids()
    time.sleep(REQUEST_DELAY)
    la_pop = fetch_all_uk_la_populations(sorted(la_centroids.keys()))
    time.sleep(REQUEST_DELAY)

    # Build ordered list of (code, lat, lng, pop) for LAs with full data
    la_points: list[tuple[str, float, float, int]] = []
    for code in sorted(la_centroids.keys()):
        c = la_centroids[code]
        p = la_pop.get(code, 0)
        if c.get("lat") is not None and c.get("lng") is not None:
            la_points.append((code, float(c["lat"]), float(c["lng"]), p))
    print(f"    {len(la_points)} LAs have centroid data ({sum(1 for _,_,_,p in la_points if p>0)} with pop)")
    print()

    # ---- Process each market ----
    records: list[dict] = []
    warnings: list[str] = []

    osrm_source_url = OSRM_BASE + "/table/v1/driving"
    osrm_source_name = "OSRM public server (OpenStreetMap Routing)"

    for i, (mid, info) in enumerate(markets.items(), 1):
        market_lat, market_lng = info["centroid"]
        market_point = (market_lat, market_lng)

        print(f"  [{i}/{len(markets)}] {info['name']}...", end=" ", flush=True)

        # ---- M21: min drive time to any major UK city ----
        try:
            city_points = [(c["lat"], c["lng"]) for c in UK_MAJOR_CITIES]
            city_durations = osrm_table(market_point, city_points)

            # Find nearest city. Include 0-duration: if the market IS a major urban core,
            # drive time to urban core is genuinely ~0 (best possible score).
            best_min = None
            best_city = None
            for city, dur_sec in zip(UK_MAJOR_CITIES, city_durations):
                if dur_sec is None:
                    continue
                dur_min = dur_sec / 60.0
                if best_min is None or dur_min < best_min:
                    best_min = dur_min
                    best_city = city["name"]

            if best_min is None:
                # Every OSRM duration failed — unreachable
                best_min = None
                best_city = "unreachable"

            records.append(make_record(
                mid, info, "M21", "Connectivity", round(best_min, 1), "minutes",
                osrm_source_url, osrm_source_name, date.today().isoformat(),
                raw_text=f"Nearest major urban core: {best_city} ({best_min:.1f} min)",
            ))
        except Exception as e:
            records.append(make_record(mid, info, "M21", "Connectivity", None, "minutes",
                osrm_source_url, osrm_source_name, date.today().isoformat(),
                raw_text=f"OSRM query failed: {e}"))
            warnings.append(f"{mid} ({info['name']}): M21 — {e}")

        time.sleep(REQUEST_DELAY)

        # ---- M31/M32: population within 30/60 min ----
        try:
            la_point_coords = [(lat, lng) for _, lat, lng, _ in la_points]
            la_durations = osrm_table(market_point, la_point_coords)

            pop_30 = 0
            pop_60 = 0
            count_30 = 0
            count_60 = 0
            for (la_code, _, _, la_pop_val), dur_sec in zip(la_points, la_durations):
                if dur_sec is None:
                    continue
                dur_min = dur_sec / 60.0
                if dur_min <= 30.0:
                    pop_30 += la_pop_val
                    count_30 += 1
                if dur_min <= 60.0:
                    pop_60 += la_pop_val
                    count_60 += 1

            records.append(make_record(
                mid, info, "M31", "Labour", pop_30, "people",
                osrm_source_url, osrm_source_name, date.today().isoformat(),
                raw_text=f"{count_30} LAs within 30-min drive",
            ))
            records.append(make_record(
                mid, info, "M32", "Labour", pop_60, "people",
                osrm_source_url, osrm_source_name, date.today().isoformat(),
                raw_text=f"{count_60} LAs within 60-min drive",
            ))
            print(f"M21={best_min:.0f}min, 30min-pop={pop_30:,} ({count_30} LAs), 60min-pop={pop_60:,} ({count_60} LAs)")
        except Exception as e:
            records.append(make_record(mid, info, "M31", "Labour", None, "people",
                osrm_source_url, osrm_source_name, date.today().isoformat(),
                raw_text=f"OSRM query failed: {e}"))
            records.append(make_record(mid, info, "M32", "Labour", None, "people",
                osrm_source_url, osrm_source_name, date.today().isoformat(),
                raw_text=f"OSRM query failed: {e}"))
            warnings.append(f"{mid} ({info['name']}): M31/M32 — {e}")
            print(f"ERROR: {e}")

        time.sleep(REQUEST_DELAY)

    # ---- Save ----
    output = {
        "generated_at": date.today().isoformat(),
        "source": "OSRM public server + ONS Open Geography Portal + NOMIS population",
        "metrics_covered": ["M21", "M31", "M32"],
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

    print()
    print("=" * 64)
    print(f"Done: {OUTPUT_PATH}")
    print(f"  Records: {output['summary']['total_records']}")
    print(f"  With value: {output['summary']['records_with_value']}")
    print(f"  Warnings: {len(warnings)}")
    for mid_str in ["M21", "M31", "M32"]:
        v = sum(1 for r in records if r["metric_id"] == mid_str and r["value"] is not None)
        print(f"    {mid_str}: {v}/76 markets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
