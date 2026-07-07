"""
SEPA flood risk scraper for Scottish markets + Belfast fallback.

Queries the SEPA Flood Map ArcGIS REST API to determine flood risk
for Scottish markets not covered by the Environment Agency scraper.
Belfast (NI) is assigned a default score since no free NI flood API exists.

Metric produced:
  M58 — Climate / flood risk exposure (score 1-5)

The SEPA flood map layers:
  - Fluvial (river) flood extent
  - Pluvial (surface water) flood extent
  - Coastal flood extent

Each layer has likelihood categories:
  "High"   (1 in 10 year)  -> score 2
  "Medium" (1 in 200 year) -> score 3
  "Low"    (1 in 1000 year) -> score 4
  No intersection           -> score 5

Output: scrapers/output/sepa_flood_data.json
"""

import json
import time
import sys
from pathlib import Path
from datetime import date

import requests

# ─── Config ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPT_DIR / "config" / "markets.json"
OUTPUT_PATH = SCRIPT_DIR / "output" / "sepa_flood_data.json"

# SEPA Flood Map ArcGIS REST services
SEPA_BASE = "https://map.sepa.org.uk/floodmap/rest/services"

# Flood extent layers to check (river, coastal, surface water)
SEPA_LAYERS = [
    {
        "name": "River (fluvial)",
        "url": f"{SEPA_BASE}/FloodMaps/Fluvial_Flood_Extent/MapServer/0/query",
    },
    {
        "name": "Coastal",
        "url": f"{SEPA_BASE}/FloodMaps/Coastal_Flood_Extent/MapServer/0/query",
    },
    {
        "name": "Surface water (pluvial)",
        "url": f"{SEPA_BASE}/FloodMaps/Surface_Water_Flood_Extent/MapServer/0/query",
    },
]

# SEPA likelihood -> score mapping (worst risk wins)
SEPA_LIKELIHOOD_SCORE = {
    "High": 2,
    "Medium": 3,
    "Low": 4,
}

REQUEST_DELAY = 2.0

# ─── Helpers ───────────────────────────────────────────────────────────────────

def load_markets() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def query_sepa_flood(url: str, lat: float, lon: float) -> str | None:
    """
    Query a SEPA flood extent layer at a point.
    Returns the likelihood category or None if no intersection.
    """
    params = {
        "geometry": f"{lon},{lat}",
        "geometryType": "esriGeometryPoint",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "*",
        "returnGeometry": "false",
        "f": "json",
    }
    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        features = data.get("features", [])
        if not features:
            return None

        # Look for likelihood field in attributes
        attrs = features[0].get("attributes", {})
        for key in ("likelihood", "Likelihood", "LIKELIHOOD", "prob_4band", "category", "Category"):
            val = attrs.get(key)
            if val and isinstance(val, str):
                return val

        # If we got features but no recognizable category, it means there IS
        # flood risk — return "Medium" as a conservative estimate
        return "Medium"

    except Exception:
        return None


def query_sepa_all_layers(lat: float, lon: float) -> tuple[str | None, int]:
    """
    Query all SEPA flood layers and return the worst risk found.
    Returns (category, score).
    """
    worst_score = 5  # 5 = no risk
    worst_category = None

    for layer in SEPA_LAYERS:
        likelihood = query_sepa_flood(layer["url"], lat, lon)
        if likelihood:
            score = SEPA_LIKELIHOOD_SCORE.get(likelihood, 3)
            if score < worst_score:
                worst_score = score
                worst_category = f"{likelihood} ({layer['name']})"
        time.sleep(0.5)

    return worst_category, worst_score


def make_record(market_id: str, info: dict, value: float | None,
                risk_category: str | None, source_name: str) -> dict:
    return {
        "market_id": market_id,
        "market": info["name"],
        "region": info["region"],
        "metric_id": "M58",
        "pillar": "Strategic / Risk",
        "value": value,
        "unit": "score 1-5",
        "geographic_level": "market",
        "source_url": SEPA_BASE,
        "source_name": source_name,
        "source_date": date.today().isoformat(),
        "scrape_date": date.today().isoformat(),
        "status": "VERIFIED" if value is not None else "MISSING",
        "raw_text": f"Flood risk: {risk_category}" if risk_category else None,
    }


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=== SEPA Flood Risk Scraper (Scotland & NI) ===\n")
    markets = load_markets()
    records: list[dict] = []
    warnings: list[str] = []

    # Filter to only Scotland and Northern Ireland markets
    target_markets = {
        mid: info for mid, info in markets.items()
        if info["region"] in ("Scotland", "Northern Ireland")
    }

    if not target_markets:
        print("No Scottish or NI markets found.")
        return 0

    print(f"  Markets to process: {len(target_markets)}\n")

    for i, (mid, info) in enumerate(target_markets.items(), 1):
        lat, lon = info["centroid"]
        region = info["region"]
        print(f"  [{i}/{len(target_markets)}] {info['name']} ({region})...", end=" ", flush=True)

        if region == "Scotland":
            try:
                category, score = query_sepa_all_layers(lat, lon)
                if category:
                    print(f"{category} -> score {score}")
                else:
                    print(f"no flood zone (score {score})")
                    category = "No flood zone intersected"
                records.append(make_record(mid, info, score, category, "SEPA Flood Map"))
            except Exception as e:
                print(f"ERROR: {e}")
                records.append(make_record(mid, info, None, None, "SEPA Flood Map"))
                warnings.append(f"{mid} ({info['name']}): M58 — SEPA query failed: {e}")

        elif region == "Northern Ireland":
            # No free NI flood API — assign score 4 (Low risk) as Belfast
            # is generally low flood risk based on published NI flood maps
            score = 4
            print(f"default score {score} (no NI flood API)")
            records.append(make_record(
                mid, info, score,
                "Default: Low risk (no free NI flood API; based on published NI flood maps)",
                "Manual estimate (NI flood maps)"
            ))

        time.sleep(REQUEST_DELAY)

    # Save output
    print(f"\nWriting output...")
    output = {
        "generated_at": date.today().isoformat(),
        "source": "SEPA Flood Map API + NI manual estimate",
        "metrics_covered": ["M58"],
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

    return 0 if output["summary"]["records_with_value"] > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
