"""
LAD boundary scraper — Local Authority District polygons for choropleth.

Fetches UK LAD boundaries from the ONS Open Geography Portal ArcGIS service,
simplifies the geometry, and writes a GeoJSON FeatureCollection to:
    public/data/uk_lads.geojson

The frontend map uses this to render a choropleth — each market's LAD(s)
are filled with a red-to-green gradient based on its total score.

Source (ONS Open Geography Portal):
    https://geoportal.statistics.gov.uk/
    Dataset: Local Authority Districts (May 2024) Boundaries UK BGC
    Generalised (20m), clipped to coastline — ~5MB raw, simplify further.

Run:
    python scrapers/lad_boundaries_scraper.py
    python scrapers/lad_boundaries_scraper.py --tolerance 0.005  # coarser

Dependencies: requests, shapely (optional for simplification)
    pip install requests
    pip install shapely
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
import urllib.parse

# ONS ArcGIS REST endpoint — LAD May 2024 boundaries, UK, BGC (generalised, clipped)
# If this changes, search the Open Geography Portal for "Local Authority Districts
# (May 2024) Boundaries UK BGC" and copy the FeatureServer URL.
FEATURE_SERVICE_URL = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
    "LAD_MAY_2024_UK_BGC_V2/FeatureServer/0/query"
)

PAGE_SIZE = 500  # ArcGIS default max


def fetch_page(offset: int) -> dict:
    params = {
        "where": "1=1",
        "outFields": "LAD24CD,LAD24NM",
        "outSR": "4326",             # WGS84 lat/lng
        "f": "geojson",
        "resultOffset": offset,
        "resultRecordCount": PAGE_SIZE,
    }
    url = FEATURE_SERVICE_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Brunswick-Screening/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_all_features() -> list:
    features = []
    offset = 0
    while True:
        print(f"  → offset {offset}…")
        try:
            page = fetch_page(offset)
        except (urllib.error.HTTPError, urllib.error.URLError) as e:
            print(f"    error: {e}")
            raise
        batch = page.get("features", [])
        if not batch:
            break
        features.extend(batch)
        print(f"    got {len(batch)} features (total {len(features)})")
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.5)
    return features


def simplify_features(features: list, tolerance: float) -> list:
    try:
        from shapely.geometry import shape, mapping
    except ImportError:
        print("  shapely not installed — skipping simplification")
        return features

    simplified = []
    for f in features:
        try:
            geom = shape(f["geometry"])
            simple = geom.simplify(tolerance, preserve_topology=True)
            if simple.is_empty:
                continue
            f["geometry"] = mapping(simple)
            simplified.append(f)
        except Exception as e:
            print(f"    skip {f.get('properties', {}).get('LAD24CD', '?')}: {e}")
    return simplified


def normalise_properties(features: list) -> list:
    """Ensure consistent property names regardless of ONS year suffix."""
    for f in features:
        props = f.get("properties", {})
        # Normalise: LAD24CD/LAD23CD/LAD22CD/etc → lad_code
        code = None
        name = None
        for k, v in list(props.items()):
            if k.upper().startswith("LAD") and k.upper().endswith("CD"):
                code = v
            if k.upper().startswith("LAD") and k.upper().endswith("NM"):
                name = v
        f["properties"] = {
            "lad_code": code,
            "lad_name": name,
        }
    return features


def main():
    ap = argparse.ArgumentParser(description="Fetch UK LAD boundaries from ONS for map choropleth")
    ap.add_argument("--tolerance", type=float, default=0.003,
                    help="Simplification tolerance in degrees (default 0.003 ≈ 300m).")
    ap.add_argument("--output", default="public/data/uk_lads.geojson",
                    help="Output path (default: public/data/uk_lads.geojson)")
    args = ap.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(here)
    output_path = os.path.join(project_root, args.output)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    print("LAD boundary scraper — ONS Open Geography Portal")
    print(f"  Output: {output_path}")
    print(f"  Simplification tolerance: {args.tolerance}°")

    print("Fetching paginated features…")
    features = fetch_all_features()
    print(f"✓ Raw features: {len(features)}")

    features = normalise_properties(features)

    if args.tolerance > 0:
        features = simplify_features(features, args.tolerance)
        print(f"  After simplification: {len(features)}")

    fc = {
        "type": "FeatureCollection",
        "metadata": {
            "source": "ONS Open Geography Portal",
            "license": "Open Government Licence v3.0",
            "fetched_at": time.strftime("%Y-%m-%d"),
            "simplification_tolerance_deg": args.tolerance,
            "feature_count": len(features),
        },
        "features": features,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(fc, f, separators=(",", ":"))

    size_kb = os.path.getsize(output_path) / 1024
    print(f"✓ Wrote {output_path} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(1)
