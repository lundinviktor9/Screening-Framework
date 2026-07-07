"""
UK region boundary scraper — ITL1 (former NUTS1) regions for map choropleth.

Fetches England ITL1 regions + Scotland + Wales + (optionally) London borough
boundaries from the ONS Open Geography Portal, simplifies geometries, and
writes two GeoJSON FeatureCollections:

    public/data/uk_regions.geojson            — 11 UK regions (ITL1 level)
    public/data/london_boroughs.geojson       — 33 London boroughs (for
                                                Inner/Greater split)

The map page uses uk_regions.geojson to draw the Newmark regional zone layer
coloured by equivalent yield. It uses london_boroughs.geojson to carve the
Inner London subset (13 boroughs) out of Greater London.

Sources (ONS Open Geography Portal):
  - International Territorial Level 1 (ITL1) Boundaries UK — BGC (generalised, clipped)
  - Local Authority Districts (May 2024) UK BGC (for boroughs)

Run:
    pip install requests shapely
    python scrapers/region_boundaries_scraper.py
    python scrapers/region_boundaries_scraper.py --tolerance 0.01  # coarser
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent

# ITL1 UK regions (this endpoint may change year-to-year; confirm on ONS portal)
ITL1_URL = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
    "International_Territorial_Level_1_January_2021_UK_BUC_V2/FeatureServer/0/query"
)
# Fallback: NUTS1 boundaries (pre-2021 name)
NUTS1_FALLBACK_URL = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
    "NUTS_Level_1_January_2018_FCB_in_the_United_Kingdom/FeatureServer/0/query"
)

# London boroughs endpoint (LAD May 2024)
LAD_URL = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
    "LAD_MAY_2024_UK_BGC_V2/FeatureServer/0/query"
)

USER_AGENT = "Brunswick-Screening/1.0"

# Inner London borough codes (Census & ONS convention)
INNER_LONDON_LAD_CODES = {
    "E09000001",  # City of London
    "E09000007",  # Camden
    "E09000011",  # Greenwich
    "E09000012",  # Hackney
    "E09000013",  # Hammersmith & Fulham
    "E09000019",  # Islington
    "E09000020",  # Kensington & Chelsea
    "E09000022",  # Lambeth
    "E09000023",  # Lewisham
    "E09000028",  # Southwark
    "E09000030",  # Tower Hamlets
    "E09000032",  # Wandsworth
    "E09000033",  # Westminster
}

PAGE_SIZE = 500


def fetch_json(url: str, params: dict) -> dict:
    q = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(q, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_all(url: str, fields: str) -> list:
    features = []
    offset = 0
    while True:
        params = {
            "where": "1=1",
            "outFields": fields,
            "outSR": "4326",
            "f": "geojson",
            "resultOffset": offset,
            "resultRecordCount": PAGE_SIZE,
        }
        try:
            page = fetch_json(url, params)
        except urllib.error.HTTPError as e:
            print(f"    HTTP {e.code}; aborting page fetch")
            break
        except urllib.error.URLError as e:
            print(f"    URL error: {e}; aborting")
            break
        batch = page.get("features", [])
        if not batch:
            break
        features.extend(batch)
        print(f"    offset {offset}: +{len(batch)} (total {len(features)})")
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.5)
    return features


def simplify(features: list, tolerance: float) -> list:
    if tolerance <= 0:
        return features
    try:
        from shapely.geometry import shape, mapping
    except ImportError:
        print("    shapely not installed — skipping simplification")
        return features
    out = []
    for f in features:
        try:
            g = shape(f["geometry"])
            s = g.simplify(tolerance, preserve_topology=True)
            if s.is_empty:
                continue
            f["geometry"] = mapping(s)
            out.append(f)
        except Exception as e:
            print(f"    skip: {e}")
    return out


def write_geojson(features: list, out_path: Path, meta: dict):
    fc = {
        "type": "FeatureCollection",
        "metadata": {"fetched_at": time.strftime("%Y-%m-%d"), **meta},
        "features": features,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(fc, f, separators=(",", ":"))
    size_kb = os.path.getsize(out_path) / 1024
    print(f"    wrote {out_path.relative_to(PROJECT_ROOT)} ({size_kb:.0f} KB, {len(features)} features)")


def main():
    ap = argparse.ArgumentParser(description="Fetch UK region + London borough boundaries")
    ap.add_argument("--tolerance", type=float, default=0.005,
                    help="Simplification tolerance in degrees (default 0.005 ≈ 500m)")
    ap.add_argument("--skip-boroughs", action="store_true",
                    help="Skip fetching London boroughs (saves ~1 min)")
    args = ap.parse_args()

    # ── Regions ────────────────────────────────────────────────────────
    print("[1/2] Fetching ITL1 UK regions...")
    regions_path = PROJECT_ROOT / "public" / "data" / "uk_regions.geojson"

    features = fetch_all(ITL1_URL, "ITL121CD,ITL121NM")
    if not features:
        print("  ITL1 returned nothing — trying NUTS1 fallback...")
        features = fetch_all(NUTS1_FALLBACK_URL, "nuts118cd,nuts118nm")

    # Normalise property names
    for f in features:
        props = f.get("properties", {})
        code = props.get("ITL121CD") or props.get("nuts118cd")
        name = props.get("ITL121NM") or props.get("nuts118nm")
        f["properties"] = {"region_code": code, "region_name": name}

    features = simplify(features, args.tolerance)
    write_geojson(features, regions_path, {
        "source": "ONS Open Geography Portal (ITL1 / NUTS1)",
        "license": "Open Government Licence v3.0",
        "simplification_tolerance_deg": args.tolerance,
    })

    # ── London boroughs ────────────────────────────────────────────────
    if args.skip_boroughs:
        print("[2/2] Skipping boroughs per --skip-boroughs flag")
        return

    print("\n[2/2] Fetching London boroughs (for Inner/Greater London split)...")
    boroughs_path = PROJECT_ROOT / "public" / "data" / "london_boroughs.geojson"
    lads = fetch_all(LAD_URL, "LAD24CD,LAD24NM")
    print(f"  Fetched {len(lads)} total LADs; filtering to London only...")
    london = []
    for f in lads:
        p = f.get("properties", {})
        code = p.get("LAD24CD") or p.get("LAD23CD") or p.get("LAD22CD")
        name = p.get("LAD24NM") or p.get("LAD23NM") or p.get("LAD22NM")
        if not code or not code.startswith("E09"):
            continue
        f["properties"] = {
            "lad_code": code,
            "lad_name": name,
            "is_inner_london": code in INNER_LONDON_LAD_CODES,
        }
        london.append(f)
    london = simplify(london, args.tolerance)
    write_geojson(london, boroughs_path, {
        "source": "ONS Open Geography Portal (LAD May 2024)",
        "license": "Open Government Licence v3.0",
        "inner_london_codes": sorted(INNER_LONDON_LAD_CODES),
    })

    print("\nDone. Files ready for map layer.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(1)
