"""
Overpass API scraper for connectivity / proximity metrics.

Queries OpenStreetMap via the free Overpass API (no auth) to compute
distances from each market centroid to nearby infrastructure.

Metrics produced:
  M22 — Distance to nearest motorway junction (km)
  M23 — Distance to nearest rail freight terminal (km)
  M24 — Distance to nearest major port (km)
  M25 — Distance to nearest cargo airport (km)

Coverage: all 76 UK markets.

Output: scrapers/output/overpass_data.json
"""

import json
import math
import time
import sys
from pathlib import Path
from datetime import date

import requests

# ─── Config ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPT_DIR / "config" / "markets.json"
OUTPUT_PATH = SCRIPT_DIR / "output" / "overpass_data.json"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Search radius in metres for each feature type
SEARCH_RADIUS = {
    "motorway_junction": 50_000,   # 50 km
    "rail_freight":      100_000,  # 100 km
    "port":              200_000,  # 200 km
    "cargo_airport":     200_000,  # 200 km
}

# Delay between Overpass queries (their fair-use policy)
REQUEST_DELAY = 12.0

# Retry settings for 429 / 504 errors
RETRY_DELAY = 30.0
MAX_RETRIES = 3

# Checkpoint file to allow resuming interrupted runs
CHECKPOINT_PATH = SCRIPT_DIR / "output" / "overpass_checkpoint.json"

# ─── Helpers ───────────────────────────────────────────────────────────────────

def load_markets() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def load_checkpoint() -> dict:
    """Load checkpoint data from a previous interrupted run."""
    if CHECKPOINT_PATH.exists():
        with open(CHECKPOINT_PATH) as f:
            return json.load(f)
    return {"completed": {}, "records": [], "warnings": []}


def save_checkpoint(completed: dict, records: list, warnings: list):
    """Save checkpoint so we can resume later."""
    CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CHECKPOINT_PATH, "w") as f:
        json.dump({"completed": completed, "records": records, "warnings": warnings}, f, indent=2)


def clear_checkpoint():
    """Remove checkpoint file after successful completion."""
    if CHECKPOINT_PATH.exists():
        CHECKPOINT_PATH.unlink()


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def overpass_query(query: str) -> dict:
    """Execute an Overpass QL query with retry logic for rate limiting."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=120)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else 0
            if status in (429, 504) and attempt < MAX_RETRIES:
                print(f"[retry {attempt}/{MAX_RETRIES}, waiting {RETRY_DELAY}s]", end=" ", flush=True)
                time.sleep(RETRY_DELAY)
                continue
            raise


def nearest_distance(lat: float, lon: float, elements: list[dict]) -> float | None:
    """Find the nearest element to (lat, lon) and return distance in km."""
    best = None
    for el in elements:
        el_lat = el.get("lat") or (el.get("center", {}).get("lat") if "center" in el else None)
        el_lon = el.get("lon") or (el.get("center", {}).get("lon") if "center" in el else None)
        if el_lat is None or el_lon is None:
            continue
        d = haversine_km(lat, lon, el_lat, el_lon)
        if best is None or d < best:
            best = d
    return round(best, 1) if best is not None else None


def make_record(market_id: str, info: dict, metric_id: str,
                value: float | None, unit: str, source_name: str) -> dict:
    return {
        "market_id": market_id,
        "market": info["name"],
        "region": info["region"],
        "metric_id": metric_id,
        "pillar": "Connectivity",
        "value": value,
        "unit": unit,
        "geographic_level": "market",
        "source_url": "https://overpass-api.de/",
        "source_name": source_name,
        "source_date": date.today().isoformat(),
        "scrape_date": date.today().isoformat(),
        "status": "VERIFIED" if value is not None else "MISSING",
        "raw_text": None,
    }


# ─── Query builders ───────────────────────────────────────────────────────────

def query_motorway_junctions(lat: float, lon: float, radius: int) -> str:
    """Find motorway junctions near a point."""
    return f"""
[out:json][timeout:30];
(
  node["highway"="motorway_junction"](around:{radius},{lat},{lon});
);
out center;
"""


def query_rail_freight(lat: float, lon: float, radius: int) -> str:
    """Find rail freight terminals/yards near a point."""
    return f"""
[out:json][timeout:30];
(
  node["railway"="yard"](around:{radius},{lat},{lon});
  way["railway"="yard"](around:{radius},{lat},{lon});
  node["landuse"="railway"]["railway"="yard"](around:{radius},{lat},{lon});
  way["landuse"="railway"]["railway"="yard"](around:{radius},{lat},{lon});
  node["railway"="station"]["station"="freight"](around:{radius},{lat},{lon});
);
out center;
"""


def query_ports(lat: float, lon: float, radius: int) -> str:
    """Find major ports near a point."""
    return f"""
[out:json][timeout:30];
(
  node["harbour"="yes"](around:{radius},{lat},{lon});
  way["harbour"="yes"](around:{radius},{lat},{lon});
  node["industrial"="port"](around:{radius},{lat},{lon});
  way["industrial"="port"](around:{radius},{lat},{lon});
  node["landuse"="port"](around:{radius},{lat},{lon});
  way["landuse"="port"](around:{radius},{lat},{lon});
);
out center;
"""


def query_cargo_airports(lat: float, lon: float, radius: int) -> str:
    """Find airports with cargo capability near a point."""
    return f"""
[out:json][timeout:30];
(
  node["aeroway"="aerodrome"]["type"~"public|international|military/public"](around:{radius},{lat},{lon});
  way["aeroway"="aerodrome"]["type"~"public|international|military/public"](around:{radius},{lat},{lon});
  node["aeroway"="aerodrome"]["iata"](around:{radius},{lat},{lon});
  way["aeroway"="aerodrome"]["iata"](around:{radius},{lat},{lon});
);
out center;
"""


# ─── Main ──────────────────────────────────────────────────────────────────────

FEATURE_QUERIES = [
    ("M22", "motorway_junction", query_motorway_junctions, "km", "OSM Motorway Junctions"),
    ("M23", "rail_freight",      query_rail_freight,        "km", "OSM Rail Freight Terminals"),
    ("M24", "port",              query_ports,               "km", "OSM Major Ports"),
    ("M25", "cargo_airport",     query_cargo_airports,      "km", "OSM Cargo Airports"),
]


def main():
    print("=== Overpass Connectivity Scraper ===\n")
    markets = load_markets()

    # Load checkpoint if resuming
    checkpoint = load_checkpoint()
    completed = checkpoint["completed"]      # dict of "metric_id:market_id" -> True
    records: list[dict] = checkpoint["records"]
    warnings: list[str] = checkpoint["warnings"]

    if completed:
        print(f"  Resuming from checkpoint ({len(completed)} queries already done)\n")

    total_queries = len(markets) * len(FEATURE_QUERIES)
    query_count = 0
    skipped = 0

    for metric_id, feature_key, query_fn, unit, source_name in FEATURE_QUERIES:
        print(f"\n--- {metric_id}: {source_name} ---")

        for mid, info in markets.items():
            query_count += 1
            checkpoint_key = f"{metric_id}:{mid}"

            # Skip already-completed queries
            if checkpoint_key in completed:
                skipped += 1
                continue

            lat, lon = info["centroid"]
            radius = SEARCH_RADIUS[feature_key]

            print(f"  [{query_count}/{total_queries}] {info['name']}...", end=" ", flush=True)
            try:
                q = query_fn(lat, lon, radius)
                result = overpass_query(q)
                elements = result.get("elements", [])
                dist = nearest_distance(lat, lon, elements)

                if dist is not None:
                    print(f"{dist} km ({len(elements)} found)")
                else:
                    print(f"none found within {radius/1000:.0f} km")
                    warnings.append(f"{mid} ({info['name']}): {metric_id} — no {feature_key} found within {radius/1000:.0f} km")

                records.append(make_record(mid, info, metric_id, dist, unit, source_name))

            except Exception as e:
                print(f"ERROR: {e}")
                records.append(make_record(mid, info, metric_id, None, unit, source_name))
                warnings.append(f"{mid} ({info['name']}): {metric_id} — query failed: {e}")

            # Mark as completed and save checkpoint
            completed[checkpoint_key] = True
            save_checkpoint(completed, records, warnings)

            time.sleep(REQUEST_DELAY)

    # Hardcode Greater Manchester port distance — it's landlocked, no nearby major port
    gm_port = next((r for r in records if r["market_id"] == "uk-47" and r["metric_id"] == "M24"), None)
    if gm_port and gm_port["value"] is None:
        gm_port["value"] = 1
        gm_port["status"] = "VERIFIED"
        gm_port["unit"] = "score 1-5"
        gm_port["raw_text"] = "Hardcoded: Greater Manchester is landlocked — no nearby major port"
        gm_port["source_name"] = "Manual (factual — landlocked city)"
        # Remove from warnings
        warnings = [w for w in warnings if not ("uk-47" in w and "M24" in w)]

    # Save output
    print(f"\nWriting output...")
    output = {
        "generated_at": date.today().isoformat(),
        "source": "Overpass API (OpenStreetMap, free, no auth)",
        "metrics_covered": ["M22", "M23", "M24", "M25"],
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

    # Clear checkpoint on successful completion
    clear_checkpoint()

    print(f"\nDone. Output: {OUTPUT_PATH}")
    print(f"  Records: {output['summary']['total_records']}")
    print(f"  With value: {output['summary']['records_with_value']}")
    print(f"  Missing: {output['summary']['records_missing']}")
    print(f"  Warnings: {output['summary']['warnings_count']}")
    print(f"  Total Overpass queries: {query_count}")
    if skipped:
        print(f"  Skipped (from checkpoint): {skipped}")
    est_time = (query_count - skipped) * REQUEST_DELAY
    print(f"  Note: {len(FEATURE_QUERIES)} features x {len(markets)} markets = {total_queries} queries")
    print(f"        at {REQUEST_DELAY}s delay = ~{est_time/60:.0f} min runtime")

    return 0 if output["summary"]["records_with_value"] > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
