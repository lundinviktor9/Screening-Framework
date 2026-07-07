"""
POI scraper — UK motorway network geometry.

Fetches motorway ways from OpenStreetMap via Overpass API, simplifies the
geometry, and writes a GeoJSON FeatureCollection to:
    public/data/motorway_network.geojson

The frontend map page reads this file to render motorway corridors as
polylines. If the file is missing, the motorway toggle in the UI is hidden.

Run:
    python scrapers/poi_scraper.py            # downloads fresh data
    python scrapers/poi_scraper.py --tolerance 0.005   # coarser simplification

Dependencies: requests, shapely (optional for simplification)
    pip install requests
    pip install shapely   # optional — if missing, no simplification happens

Overpass is free, no auth. Respect fair use: ~1 request per minute.
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Query: all motorways (highway=motorway) + motorway links in UK bounding box.
# We drop links from the main output to keep the visualization clean.
OVERPASS_QUERY = """
[out:json][timeout:180];
(
  way["highway"="motorway"](49.5,-8.7,61.0,2.2);
);
out geom;
"""

def fetch_overpass(retries: int = 3, backoff: int = 30):
    data = OVERPASS_QUERY.encode("utf-8")
    req = urllib.request.Request(
        OVERPASS_URL,
        data=data,
        headers={"User-Agent": "Brunswick-Screening-Framework/1.0"},
    )
    for attempt in range(retries):
        try:
            print(f"→ Overpass request (attempt {attempt + 1}/{retries})…")
            with urllib.request.urlopen(req, timeout=200) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            print(f"✓ Received {len(payload.get('elements', []))} elements")
            return payload
        except (urllib.error.HTTPError, urllib.error.URLError) as e:
            print(f"  Error: {e}")
            if attempt < retries - 1:
                print(f"  Retrying in {backoff}s…")
                time.sleep(backoff)
    raise RuntimeError("Overpass API failed after retries")


def ways_to_features(elements):
    features = []
    for el in elements:
        if el.get("type") != "way":
            continue
        geom = el.get("geometry", [])
        if not geom or len(geom) < 2:
            continue
        # GeoJSON uses [lon, lat] order
        coords = [[p["lon"], p["lat"]] for p in geom]
        tags = el.get("tags", {})
        features.append({
            "type": "Feature",
            "properties": {
                "ref": tags.get("ref", ""),
                "name": tags.get("name", ""),
                "osm_way_id": el.get("id"),
            },
            "geometry": {"type": "LineString", "coordinates": coords},
        })
    return features


def simplify_features(features, tolerance: float):
    """Optional geometry simplification via Shapely (Douglas-Peucker)."""
    try:
        from shapely.geometry import LineString, mapping
    except ImportError:
        print("  shapely not installed — skipping simplification")
        return features

    simplified = []
    for f in features:
        coords = f["geometry"]["coordinates"]
        line = LineString(coords)
        simple = line.simplify(tolerance, preserve_topology=False)
        if simple.is_empty or len(list(simple.coords)) < 2:
            continue
        f["geometry"] = mapping(simple)
        simplified.append(f)
    return simplified


def main():
    ap = argparse.ArgumentParser(description="Fetch UK motorway network from Overpass")
    ap.add_argument("--tolerance", type=float, default=0.002,
                    help="Simplification tolerance in degrees (default: 0.002, ~200m). Set to 0 to disable.")
    ap.add_argument("--output", default="public/data/motorway_network.geojson",
                    help="Output GeoJSON path (default: public/data/motorway_network.geojson)")
    args = ap.parse_args()

    # Resolve output path relative to project root (assume script is in scrapers/)
    here = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(here)
    output_path = os.path.join(project_root, args.output)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    print(f"POI scraper — UK motorways")
    print(f"  Output: {output_path}")
    print(f"  Simplification tolerance: {args.tolerance}° (~{args.tolerance * 111_000:.0f}m)")

    payload = fetch_overpass()
    elements = payload.get("elements", [])
    features = ways_to_features(elements)
    print(f"  Raw features: {len(features)}")

    if args.tolerance > 0:
        features = simplify_features(features, args.tolerance)
        print(f"  After simplification: {len(features)}")

    total_points = sum(len(f["geometry"]["coordinates"]) for f in features)
    print(f"  Total coordinate points: {total_points}")

    fc = {
        "type": "FeatureCollection",
        "metadata": {
            "source": "OpenStreetMap via Overpass API",
            "license": "ODbL",
            "fetched_at": time.strftime("%Y-%m-%d"),
            "simplification_tolerance_deg": args.tolerance,
            "feature_count": len(features),
            "total_points": total_points,
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
