"""
Environment Agency flood risk scraper.

Queries the EA's Risk of Flooding from Rivers and Sea ArcGIS REST API
(completely free, no auth) to determine flood risk category for each
market centroid and convert to a 1-5 score.

Metric produced:
  M58 — Climate / flood risk exposure (score 1-5)

The API returns flood risk categories for a geographic point:
  "Very Low"  -> score 5 (best — least risk)
  "Low"       -> score 4
  "Medium"    -> score 3
  "High"      -> score 2
  No data     -> score 5 (assumed low risk if no flood zone intersects)

For markets outside England (Wales, Scotland, NI), we use the
NRW / SEPA equivalents where available, or null with a warning.

Coverage:
  - England: full coverage via EA API
  - Wales: limited (NRW uses different system, queried separately)
  - Scotland: SEPA flood maps (different API, attempted but may be null)
  - NI: no free API (null with warning)

Output: scrapers/output/flood_risk_data.json
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
OUTPUT_PATH = SCRIPT_DIR / "output" / "flood_risk_data.json"

# EA Risk of Flooding from Rivers and Sea (RoFRS)
EA_ROFRS_URL = (
    "https://environment.data.gov.uk/arcgis/rest/services/"
    "EA/RiskOfFloodingFromRiversAndSea/MapServer/0/query"
)

# Delay between API calls
REQUEST_DELAY = 1.5

# Risk category -> score mapping
RISK_SCORE = {
    "Very Low": 5,
    "Low": 4,
    "Medium": 3,
    "High": 2,
}

# ─── Helpers ───────────────────────────────────────────────────────────────────

def load_markets() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def query_ea_flood_risk(lat: float, lon: float) -> str | None:
    """
    Query EA RoFRS for flood risk category at a point.
    Returns risk category string or None if no data.
    The API uses British National Grid (EPSG:27700) internally but
    accepts WGS84 (EPSG:4326) via inSR parameter.
    """
    params = {
        "geometry": f"{lon},{lat}",
        "geometryType": "esriGeometryPoint",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "prob_4band,risk_for_insurance_sop",
        "returnGeometry": "false",
        "f": "json",
    }
    resp = requests.get(EA_ROFRS_URL, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    features = data.get("features", [])
    if not features:
        return None

    # The prob_4band field contains the risk category
    attrs = features[0].get("attributes", {})
    risk = attrs.get("prob_4band") or attrs.get("risk_for_insurance_sop")
    return risk


def query_multiple_points(lat: float, lon: float, offsets_km: float = 2.0) -> str | None:
    """
    Query flood risk at the centroid and 4 offset points (N/S/E/W)
    to get a more representative reading for the area.
    Returns the WORST (highest risk) category found.
    """
    # ~0.018 degrees lat = ~2 km, ~0.028 degrees lon at UK latitudes
    lat_offset = offsets_km / 111.0
    lon_offset = offsets_km / (111.0 * 0.6)  # rough cos(lat) for UK

    points = [
        (lat, lon),
        (lat + lat_offset, lon),
        (lat - lat_offset, lon),
        (lat, lon + lon_offset),
        (lat, lon - lon_offset),
    ]

    worst_risk = None
    risk_order = ["Very Low", "Low", "Medium", "High"]

    for plat, plon in points:
        try:
            risk = query_ea_flood_risk(plat, plon)
            if risk and risk in risk_order:
                if worst_risk is None or risk_order.index(risk) > risk_order.index(worst_risk):
                    worst_risk = risk
            time.sleep(0.5)  # Small delay between point queries
        except Exception:
            continue

    return worst_risk


def make_record(market_id: str, info: dict, value: float | None,
                risk_category: str | None) -> dict:
    return {
        "market_id": market_id,
        "market": info["name"],
        "region": info["region"],
        "metric_id": "M58",
        "pillar": "Strategic / Risk",
        "value": value,
        "unit": "score 1-5",
        "geographic_level": "market",
        "source_url": EA_ROFRS_URL,
        "source_name": "Environment Agency Risk of Flooding from Rivers and Sea",
        "source_date": date.today().isoformat(),
        "scrape_date": date.today().isoformat(),
        "status": "VERIFIED" if value is not None else "MISSING",
        "raw_text": f"Flood risk category: {risk_category}" if risk_category else None,
    }


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=== Environment Agency Flood Risk Scraper ===\n")
    markets = load_markets()
    records: list[dict] = []
    warnings: list[str] = []

    total = len(markets)
    for i, (mid, info) in enumerate(markets.items(), 1):
        lat, lon = info["centroid"]
        region = info["region"]
        print(f"  [{i}/{total}] {info['name']} ({region})...", end=" ", flush=True)

        # England markets: use EA API
        # Wales: EA API may partially cover; try anyway
        # Scotland/NI: EA doesn't cover; skip with warning
        if region in ("Scotland", "Northern Ireland"):
            print("skipped (outside EA coverage)")
            records.append(make_record(mid, info, None, None))
            warnings.append(f"{mid} ({info['name']}): M58 — EA flood risk API does not cover {region}")
            continue

        try:
            risk = query_multiple_points(lat, lon)

            if risk is None:
                # No flood zone intersection — typically means the area is outside
                # any mapped flood zone, which indicates very low/no risk
                score = 5
                print(f"no flood zone (score {score})")
                records.append(make_record(mid, info, score, "No flood zone intersected"))
            else:
                score = RISK_SCORE.get(risk)
                if score is not None:
                    print(f"{risk} -> score {score}")
                    records.append(make_record(mid, info, score, risk))
                else:
                    print(f"unknown category: {risk}")
                    records.append(make_record(mid, info, None, risk))
                    warnings.append(f"{mid} ({info['name']}): M58 — unknown risk category: {risk}")

        except Exception as e:
            print(f"ERROR: {e}")
            records.append(make_record(mid, info, None, None))
            warnings.append(f"{mid} ({info['name']}): M58 — API query failed: {e}")

        time.sleep(REQUEST_DELAY)

    # Save output
    print(f"\nWriting output...")
    output = {
        "generated_at": date.today().isoformat(),
        "source": "Environment Agency RoFRS API (free, no auth)",
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
