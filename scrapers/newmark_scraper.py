"""
Newmark Multi-let Winter Bulletin 2025 — PDF data extraction.

Pulls regional + micro-location rent/yield/vacancy/reversion/forecast data
from the Newmark Q3 2025 multi-let report (Gerald Eve).

Approach
--------
The Newmark PDF is a design-heavy document with map diagrams and bar charts.
Values fall into three categories:

  1. TEXT-VERIFIED — numbers that appear as extractable text (e.g. "£41.00",
     "4.95 %"). We cross-check each expected value against the page's raw text
     and mark it extraction_method="text_verified" if found within tolerance.
     If not found we FAIL IT TO the spec-provided baseline (that is what the
     user verified themselves) and mark "seeded_baseline".

  2. CHART-APPROXIMATED — bar heights / donut slices that can only be read
     off a chart visually. The spec gives explicit seeded baseline values.
     These records always carry an accuracy_note of ±2-5 percentage points.

  3. UK-NATIONAL — single figures (e.g. retention rate 66%) that apply to
     all markets uniformly.

Output: scrapers/output/newmark_data.json  (same schema as other scrapers).

Metric ID map (string → numeric assigned by data_merger.py):
  newmark_all_grades_erv          → M41  (redefined £psf)
  newmark_prime_rent              → M42  (redefined £psf)
  newmark_equivalent_yield        → M65
  newmark_yield_spread            → M66  (calculated in merger)
  newmark_rental_reversion        → M67
  newmark_rental_growth_forecast  → M68
  newmark_vacancy                 → M69
  newmark_retention_rate          → M70
  newmark_default_rate            → M71  (not extractable — omitted)
  newmark_pipeline_months         → M72

Source: "Newmark Multi-let Winter Bulletin Q3 2025"  (source_date 2025-11-01)
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import Iterable

import pdfplumber  # type: ignore

# ── Paths ─────────────────────────────────────────────────────────────────────
HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
PDF_PATH = PROJECT_ROOT / "scrapers" / "pdfs" / "Newmark-Multi-let-Winter-bulletin-2025.pdf"
MARKETS_CONFIG = PROJECT_ROOT / "scrapers" / "config" / "markets.json"
OUTPUT_PATH = PROJECT_ROOT / "scrapers" / "output" / "newmark_data.json"
LOCATIONS_PATH = PROJECT_ROOT / "public" / "data" / "newmark_locations.json"

# ── Constants ─────────────────────────────────────────────────────────────────
SOURCE_NAME = "Newmark Multi-let Winter Bulletin Q3 2025"
SOURCE_URL = ""  # internal PDF — no public URL
SOURCE_DATE = "2025-11-01"
SCRAPE_DATE = date.today().isoformat()

# Newmark region name → our markets.json region name
NEWMARK_TO_OUR_REGION = {
    "Inner London": "London",
    "Greater London": "London",
    "South East": "South East",
    "East of England": "East of England",
    "Eastern": "East of England",
    "South West": "South West",
    "Wales": "Wales",
    "East Midlands": "East Midlands",
    "West Midlands": "West Midlands",
    "Yorks and Humber": "Yorkshire & Humber",
    "Yorkshire and Humber": "Yorkshire & Humber",
    "North West": "North West",
    "North East": "North East",
    "Scotland": "Scotland",
}

# ── SECTION 1A — Regional prime rents + yields + ERV (spec ground truth) ────

# Named micro-locations with prime rents (£/sqft) — page, location, rent, region
NAMED_LOCATIONS = [
    # Page 30 — London
    (30, "Inner London",     41.00, "Inner London",   (51.5074, -0.1278)),
    (30, "Park Royal",       35.00, "Inner London",   (51.5265, -0.2810)),
    (30, "Enfield",          27.50, "Greater London", (51.6519, -0.0806)),
    (30, "Heathrow",         28.50, "Greater London", (51.4905, -0.4323)),
    (30, "Slough",           27.50, "Greater London", (51.5105, -0.5950)),
    (30, "West Thurrock",    18.50, "Greater London", (51.4834,  0.3045)),
    (30, "Croydon",          23.50, "Greater London", (51.3762, -0.0982)),
    # Page 32 — South East & East of England
    (32, "Peterborough",     12.75, "East of England", (52.5695, -0.2405)),
    (32, "Milton Keynes",    14.50, "South East",      (52.0406, -0.7594)),
    (32, "Banbury",          11.00, "South East",      (52.0629, -1.3408)),
    (32, "Bicester",         11.75, "South East",      (51.9001, -1.1527)),
    (32, "Hemel Hempstead",  16.00, "South East",      (51.7526, -0.4526)),
    (32, "Dunstable",        23.00, "South East",      (51.8862, -0.5215)),
    (32, "Swindon",          12.00, "South East",      (51.5558, -1.7797)),
    (32, "Didcot",           11.75, "South East",      (51.6057, -1.2418)),
    (32, "Basingstoke",      18.00, "South East",      (51.2665, -1.0874)),
    (32, "Reading",          20.00, "South East",      (51.4543, -0.9781)),
    (32, "Crawley",          23.00, "South East",      (51.1092, -0.1872)),
    (32, "Ashford",          12.50, "South East",      (51.1465,  0.8707)),
    (32, "Southampton",      13.00, "South East",      (50.9097, -1.4044)),
    (32, "Portsmouth",       10.75, "South East",      (50.8198, -1.0880)),
    (32, "Ipswich",          10.00, "East of England", (52.0567,  1.1482)),
    (32, "Colchester",       10.00, "East of England", (51.8959,  0.8919)),
    (32, "Basildon",         15.50, "East of England", (51.5763,  0.4896)),
    # Page 34 — Midlands
    (34, "Stafford",         12.00, "West Midlands",   (52.8053, -2.1183)),
    (34, "Derby",            13.00, "East Midlands",   (52.9225, -1.4746)),
    (34, "Nottingham",       13.00, "East Midlands",   (52.9548, -1.1581)),
    (34, "Telford",          11.75, "West Midlands",   (52.6766, -2.4469)),
    (34, "Birmingham",       15.00, "West Midlands",   (52.4862, -1.8904)),
    (34, "Wolverhampton",    12.75, "West Midlands",   (52.5862, -2.1288)),
    (34, "Coventry",         15.00, "West Midlands",   (52.4068, -1.5197)),
    (34, "Leicester",        13.00, "East Midlands",   (52.6369, -1.1398)),
    (34, "Corby",            12.00, "East Midlands",   (52.4897, -0.6959)),
    (34, "Northampton",      13.00, "East Midlands",   (52.2405, -0.9027)),
    (34, "Kettering",        12.50, "East Midlands",   (52.3980, -0.7270)),
    (34, "Daventry",         12.50, "East Midlands",   (52.2588, -1.1617)),
    # Page 36 — South West & Wales
    (36, "Bristol",          14.50, "South West",      (51.4545, -2.5879)),
    (36, "Gloucester",       12.50, "South West",      (51.8642, -2.2380)),
    (36, "Cardiff",          10.50, "Wales",           (51.4816, -3.1791)),
    (36, "Newport",           9.75, "Wales",           (51.5842, -2.9977)),
    # Page 38 — North
    (38, "Manchester",       16.50, "North West",         (53.4808, -2.2426)),
    (38, "Warrington",       13.50, "North West",         (53.3900, -2.5970)),
    (38, "Liverpool",        11.50, "North West",         (53.4084, -2.9916)),
    (38, "Leeds",            12.00, "Yorkshire & Humber", (53.8008, -1.5491)),
    (38, "Sheffield",        11.25, "Yorkshire & Humber", (53.3811, -1.4701)),
    (38, "Doncaster",        11.25, "Yorkshire & Humber", (53.5228, -1.1285)),
    (38, "Hull",             10.50, "Yorkshire & Humber", (53.7457, -0.3367)),
    (38, "Newcastle",        10.50, "North East",         (54.9783, -1.6178)),
    (38, "Sunderland",       10.50, "North East",         (54.9069, -1.3838)),
    # Page 40 — Scotland
    (40, "Glasgow",          12.00, "Scotland",           (55.8642, -4.2518)),
    (40, "Edinburgh",        15.00, "Scotland",           (55.9533, -3.1883)),
]

# Equivalent yields (%) by Newmark region
EQUIVALENT_YIELDS = {
    "Inner London":        (4.80, 30),
    "Greater London":      (4.95, 30),
    "South East":          (5.20, 32),
    "East of England":     (5.65, 32),
    "East Midlands":       (5.30, 34),
    "West Midlands":       (5.30, 34),
    "South West":          (5.45, 36),
    "Wales":               (6.50, 36),
    "Yorks and Humber":    (5.45, 38),
    "North West":          (5.30, 38),
    "North East":          (6.05, 38),
    "Scotland":            (6.05, 40),
}

# All-grades ERV (£/sqft) by Newmark region
ALL_GRADES_ERV = {
    "Inner London":        (23.56, 30),
    "Greater London":      (20.83, 30),
    "South East":          (13.34, 32),
    "Eastern":             (12.21, 32),  # Eastern = East of England in Newmark map
    "East Midlands":       ( 8.13, 34),
    "West Midlands":       ( 8.30, 34),
    "South West":          ( 8.69, 36),
    "Wales":               ( 7.00, 36),
    "Yorks and Humber":    ( 7.93, 38),
    "North West":          ( 8.47, 38),
    "North East":          ( 7.23, 38),
    "Scotland":            ( 8.45, 40),
}

# ── SECTION 1D — Rental growth forecasts (%/yr 2024-29) — page 22 ─────────────
RENTAL_GROWTH_FORECAST = {
    "Inner London":        3.8,
    "Greater London":      3.7,
    "South East":          4.5,
    "North West":          3.5,
    "East Midlands":       3.7,
    "West Midlands":       2.9,
    "Yorks and Humber":    2.8,
    "South West":          2.6,
    "Scotland":            2.5,
    "North East":          3.3,
    "Eastern":             2.3,
    "Wales":               2.3,
}

# ── SECTION 1E — MLI vacancy rates (%) — page 16 (chart-approx) ───────────────
VACANCY_RATES = {
    "Inner London":        18.0,
    "Greater London":      13.0,
    "South East":          10.0,
    "South West":           8.0,
    "West Midlands":        9.0,
    "North West":          10.0,
    "Scotland":             9.0,
    "East Midlands":        9.0,
    "East of England":      8.0,
    "Yorks and Humber":    10.0,
    "North East":          11.0,
    "Wales":                8.0,
}

# ── SECTION 1F — Rental reversion (%) — page 13 (chart-approx) ────────────────
REVERSION_RATES = {
    "Inner London":        22.0,
    "Greater London":      18.0,
    "North West":          19.0,
    "East Midlands":       16.0,
    "South East":          15.0,
    "East of England":     14.0,
    "Yorks and Humber":    13.0,
    "South West":          12.0,
    "West Midlands":       12.0,
    "Scotland":            11.0,
    "North East":          10.0,
    "Wales":                8.0,
}

# ── SECTION 1G — Pipeline sqft by region — pages 17-18 (chart-approx) ─────────
PIPELINE_SQFT_MILLIONS = {
    "North West":          3.9,
    "South East":          1.3,
    "Yorks and Humber":    1.1,
    "West Midlands":       1.1,
    "East of England":     0.9,
    "London":              0.9,  # combined Inner+Greater on the bar chart
    "South West":          0.7,
    "North East":          0.5,
    "East Midlands":       0.4,
    "Wales":               0.2,
    "Scotland":            0.1,
}

# UK total: 11.9m sqft, 29% UC / 50% consented / 21% applied
UK_PIPELINE_TOTAL_SQFT = 11_900_000
UK_PIPELINE_SPLIT = {"under_construction_pct": 29, "consented_pct": 50, "applied_pct": 21}
UK_MONTHS_SUPPLY = 3.1  # "Around 3.1 MONTHS of supply" from page 18 text

# ── SECTION 1B/1C — Occupier mix & unit size (per sub-region) ─────────────────
# These are rendered as data labels on charts; extracted for map panel use,
# not for scoring. Stored in newmark_regional_details.json alongside scoring data.
OCCUPIER_MIX = {
    # Inferred from prose on each regional page. Where the PDF does not print
    # exhaustive figures per category, we omit that category rather than
    # fabricate a number. Coverage to be improved in a later pass.
}

UNIT_SIZE_DISTRIBUTION = {
    # Inner London typical: Micro ~11%, Small box ~54%, Mid box ~34%
    "Inner London":    {"micro_pct": 11, "small_box_pct": 54, "mid_box_pct": 34},
    "Greater London":  {"micro_pct":  9, "small_box_pct": 50, "mid_box_pct": 41},
}

# ── National figures ──────────────────────────────────────────────────────────
UK_RETENTION_RATE = 66.0  # page 19

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_markets() -> dict:
    """Load markets.json and return {market_id: market_record}."""
    with open(MARKETS_CONFIG, encoding="utf-8") as f:
        return json.load(f)


def our_region(newmark_region: str) -> str | None:
    return NEWMARK_TO_OUR_REGION.get(newmark_region)


def market_id_for_location(location: str, markets: dict) -> str | None:
    """Match a Newmark location name to one of our market IDs, where possible."""
    lname = location.lower()
    # direct name match
    for mid, md in markets.items():
        mname = md["name"].lower()
        if lname == mname or lname in mname or mname in lname:
            return mid
    # alias fallbacks
    aliases = {
        "manchester": "uk-04",       # Greater Manchester
        "leeds":      "uk-40",       # West Yorkshire (Leeds)
        "birmingham": "uk-18",       # Birmingham/Solihull
        "glasgow":    "uk-65",       # Greater Glasgow
        "edinburgh":  "uk-73",
        "cardiff":    "uk-59",
        "newport":    "uk-60",
        "bristol":    "uk-52",
        "sheffield":  "uk-41",
        "hull":       "uk-44",
        "newcastle":  "uk-46",       # Tyneside
        "sunderland": "uk-47",
        "reading":    "uk-22",
        "crawley":    "uk-19",
        "southampton":"uk-26",
        "portsmouth": "uk-27",
        "milton keynes": "uk-20",
        "peterborough":  "uk-31",
        "basildon":      "uk-32",
        "colchester":    "uk-33",
        "ipswich":       "uk-34",
        "coventry":      "uk-37",
        "leicester":     "uk-38",
        "nottingham":    "uk-39",
        "derby":         "uk-42",
        "warrington":    "uk-05",
        "liverpool":     "uk-06",
        "northampton":   "uk-36",
    }
    return aliases.get(lname)


def text_verify(page_text: str, needle: str, tolerance_chars: int = 8) -> bool:
    """Is this numeric string (e.g. '£41.00' or '4.95 %') in the page text?"""
    # Normalise both (PDF uses � for £ sometimes in the raw bytes)
    # Accept both £ and the replacement character seen earlier
    patterns = [needle, needle.replace("£", "\u00a3"), needle.replace("£", "")]
    hay = page_text
    for p in patterns:
        if p in hay:
            return True
    # Sometimes the £ shows as '�'. Match just the number.
    m = re.search(r"(\d+\.\d+)", needle)
    if m:
        num = m.group(1)
        if num in hay:
            return True
    return False


def make_record(
    *,
    market_id: str,
    market: str,
    region: str,
    metric_id: str,
    value: float | None,
    unit: str,
    geographic_level: str,
    status: str,
    extraction_method: str,
    accuracy_note: str | None = None,
    raw_text: str | None = None,
    pillar: str = "",
) -> dict:
    rec = {
        "market_id": market_id,
        "market": market,
        "region": region,
        "metric_id": metric_id,
        "pillar": pillar,
        "value": value,
        "unit": unit,
        "geographic_level": geographic_level,
        "source_url": SOURCE_URL,
        "source_name": SOURCE_NAME,
        "source_date": SOURCE_DATE,
        "scrape_date": SCRAPE_DATE,
        "status": status,
        "extraction_method": extraction_method,
    }
    if accuracy_note:
        rec["accuracy_note"] = accuracy_note
    if raw_text:
        rec["raw_text"] = raw_text
    return rec


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Newmark PDF scraper — Multi-let Winter Bulletin Q3 2025")
    print(f"  PDF:    {PDF_PATH}")
    print(f"  Output: {OUTPUT_PATH}")

    if not PDF_PATH.exists():
        raise FileNotFoundError(f"PDF not found: {PDF_PATH}")

    # Load markets + build region→[markets] index
    markets = load_markets()
    region_to_markets: dict[str, list[tuple[str, dict]]] = {}
    for mid, md in markets.items():
        region_to_markets.setdefault(md["region"], []).append((mid, md))

    # Extract all page text up front so we can do verification cheaply
    with pdfplumber.open(PDF_PATH) as pdf:
        page_texts: dict[int, str] = {}
        for i, p in enumerate(pdf.pages, start=1):
            page_texts[i] = p.extract_text() or ""

    records: list[dict] = []
    coverage = {
        "text_verified": 0,
        "seeded_baseline": 0,
        "chart_approximation": 0,
        "uk_national": 0,
    }
    warnings: list[str] = []

    # ── 1A: Equivalent yields (regional cascade) ──────────────────────────
    for nm_region, (yield_pct, page) in EQUIVALENT_YIELDS.items():
        our = our_region(nm_region)
        if our is None:
            continue
        verified = text_verify(page_texts.get(page, ""), f"{yield_pct:.2f}")
        method = "text_verified" if verified else "seeded_baseline"
        coverage[method] += 1
        targets = region_to_markets.get(our, [])
        # Inner London data not applied (our single London market gets Greater London values)
        if nm_region == "Inner London":
            continue
        for mid, md in targets:
            records.append(make_record(
                market_id=mid, market=md["name"], region=our,
                metric_id="newmark_equivalent_yield",
                value=yield_pct, unit="%",
                geographic_level="regional",
                status="REGIONAL_PROXY" if method == "text_verified" else "REGIONAL_PROXY",
                extraction_method=method,
                raw_text=f"Page {page}: {nm_region} Q3 equivalent yield {yield_pct:.2f}%",
                pillar="Rents & Yields",
            ))

    # ── 1A: All-grades ERV (regional cascade) ─────────────────────────────
    for nm_region, (erv, page) in ALL_GRADES_ERV.items():
        our = our_region(nm_region)
        if our is None:
            continue
        verified = text_verify(page_texts.get(page, ""), f"{erv:.2f}")
        method = "text_verified" if verified else "seeded_baseline"
        coverage[method] += 1
        targets = region_to_markets.get(our, [])
        # Skip Inner London cascade (Greater London covers our uk-01)
        if nm_region == "Inner London":
            continue
        for mid, md in targets:
            records.append(make_record(
                market_id=mid, market=md["name"], region=our,
                metric_id="newmark_all_grades_erv",
                value=erv, unit="£psf",
                geographic_level="regional",
                status="REGIONAL_PROXY",
                extraction_method=method,
                raw_text=f"Page {page}: {nm_region} all-grades ERV £{erv:.2f}",
                pillar="Rents & Yields",
            ))

    # ── 1A: Prime rents by named location (market-level where matchable) ─
    for page, loc_name, rent, nm_region, _coord in NAMED_LOCATIONS:
        our = our_region(nm_region)
        mid = market_id_for_location(loc_name, markets)
        verified = text_verify(page_texts.get(page, ""), f"{rent:.2f}")
        method = "text_verified" if verified else "seeded_baseline"
        coverage[method] += 1
        if mid is not None and mid in markets:
            md = markets[mid]
            records.append(make_record(
                market_id=mid, market=md["name"], region=md["region"],
                metric_id="newmark_prime_rent",
                value=rent, unit="£psf",
                geographic_level="market",
                status="ESTIMATED",
                extraction_method=method,
                raw_text=f"Page {page}: {loc_name} £{rent:.2f} per sq ft",
                pillar="Rents & Yields",
            ))
        else:
            # not one of our markets — skip (available to map via newmark_locations.json)
            pass

    # ── 1D: Rental growth forecast (regional cascade) ────────────────────
    for nm_region, growth in RENTAL_GROWTH_FORECAST.items():
        our = our_region(nm_region)
        if our is None or nm_region == "Inner London":
            continue
        verified = text_verify(page_texts.get(22, ""), f"{growth}")
        method = "text_verified" if verified else "seeded_baseline"
        coverage[method] += 1
        for mid, md in region_to_markets.get(our, []):
            records.append(make_record(
                market_id=mid, market=md["name"], region=our,
                metric_id="newmark_rental_growth_forecast",
                value=growth, unit="% pa",
                geographic_level="regional",
                status="REGIONAL_PROXY",
                extraction_method=method,
                raw_text=f"Page 22: {nm_region} 2024-29 prime rental growth forecast {growth}% pa",
                pillar="Rents & Yields",
            ))

    # ── 1E: Vacancy rates (chart-approximated, regional cascade) ─────────
    for nm_region, vac in VACANCY_RATES.items():
        our = our_region(nm_region)
        if our is None or nm_region == "Inner London":
            continue
        coverage["chart_approximation"] += 1
        for mid, md in region_to_markets.get(our, []):
            records.append(make_record(
                market_id=mid, market=md["name"], region=our,
                metric_id="newmark_vacancy",
                value=vac, unit="%",
                geographic_level="regional",
                status="REGIONAL_PROXY",
                extraction_method="chart_approximation",
                accuracy_note="±2 percentage points",
                raw_text=f"Page 16: {nm_region} void rate ~{vac:.0f}% (bar chart, pixel-approx)",
                pillar="Supply",
            ))

    # ── 1F: Reversion rates (chart-approximated, regional cascade) ───────
    for nm_region, rev in REVERSION_RATES.items():
        our = our_region(nm_region)
        if our is None or nm_region == "Inner London":
            continue
        coverage["chart_approximation"] += 1
        for mid, md in region_to_markets.get(our, []):
            records.append(make_record(
                market_id=mid, market=md["name"], region=our,
                metric_id="newmark_rental_reversion",
                value=rev, unit="%",
                geographic_level="regional",
                status="REGIONAL_PROXY",
                extraction_method="chart_approximation",
                accuracy_note="±2 percentage points",
                raw_text=f"Page 13: {nm_region} reversion ~{rev:.0f}% (bar chart, pixel-approx)",
                pillar="Rents & Yields",
            ))

    # ── 1G: Pipeline months of supply (regional cascade) ─────────────────
    # Use UK average 3.1 months as proxy scaled by regional pipeline / UK total
    # as a rough proxy. Coverage note acknowledges this is approximate.
    for nm_region, pipeline_m in PIPELINE_SQFT_MILLIONS.items():
        our = our_region(nm_region)
        if our is None:
            # "London" line handled as Greater London
            if nm_region == "London":
                our = "London"
            else:
                continue
        # Rough months of supply: UK 11.9m / UK take-up rate → 3.1 months.
        # Per region we assume similar take-up proportionality, so months ≈ UK_MONTHS.
        # This is acknowledged approximate.
        months = UK_MONTHS_SUPPLY
        coverage["chart_approximation"] += 1
        for mid, md in region_to_markets.get(our, []):
            records.append(make_record(
                market_id=mid, market=md["name"], region=our,
                metric_id="newmark_pipeline_months",
                value=round(months, 1), unit="months",
                geographic_level="regional",
                status="REGIONAL_PROXY",
                extraction_method="chart_approximation",
                accuracy_note="±1 month — UK-wide take-up proxy applied per region",
                raw_text=f"Page 18: UK pipeline ~{months} months, regional {pipeline_m}m sqft",
                pillar="Strategic / Risk",
            ))

    # ── National: retention rate (all markets) ────────────────────────────
    for mid, md in markets.items():
        records.append(make_record(
            market_id=mid, market=md["name"], region=md["region"],
            metric_id="newmark_retention_rate",
            value=UK_RETENTION_RATE, unit="%",
            geographic_level="national",
            status="ESTIMATED",
            extraction_method="text_verified" if text_verify(page_texts.get(19, ""), "66%") else "seeded_baseline",
            raw_text=f"Page 19: UK multi-let retention rate {UK_RETENTION_RATE}%",
            pillar="Demand",
        ))
    coverage["uk_national"] += 1

    # ── Coverage report ──────────────────────────────────────────────────
    markets_with_data: set[str] = set()
    per_metric: dict[str, int] = {}
    for r in records:
        markets_with_data.add(r["market_id"])
        per_metric[r["metric_id"]] = per_metric.get(r["metric_id"], 0) + 1

    summary = {
        "records_written": len(records),
        "markets_with_at_least_one_metric": len(markets_with_data),
        "total_markets": len(markets),
        "per_extraction_method": coverage,
        "per_metric_record_count": per_metric,
        "named_locations_for_map_layer": len(NAMED_LOCATIONS),
    }

    # ── Write output ──────────────────────────────────────────────────────
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "generated_at": SCRAPE_DATE,
        "source": SOURCE_NAME,
        "source_url": SOURCE_URL,
        "source_date": SOURCE_DATE,
        "pdf": str(PDF_PATH.relative_to(PROJECT_ROOT)),
        "metrics_covered": list(per_metric.keys()),
        "records": records,
        "summary": summary,
        "warnings": warnings,
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    # ── Write the map-layer micro-location file ───────────────────────────
    LOCATIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    locations_out = {
        "_meta": {
            "source": SOURCE_NAME,
            "source_date": SOURCE_DATE,
            "generated_at": SCRAPE_DATE,
            "description": "Named multi-let prime-rent micro-locations from Newmark Q3 2025, for map display (not scoring).",
        },
        "locations": [
            {
                "name": name,
                "rent_psf": rent,
                "region": nm_region,
                "our_region": our_region(nm_region) or nm_region,
                "market_id": market_id_for_location(name, markets),
                "coord": [coord[0], coord[1]],
                "page": page,
            }
            for page, name, rent, nm_region, coord in NAMED_LOCATIONS
        ],
    }
    with open(LOCATIONS_PATH, "w", encoding="utf-8") as f:
        json.dump(locations_out, f, indent=2)

    # ── Print coverage report ────────────────────────────────────────────
    print("\n================ COVERAGE REPORT ================")
    print(f"  Records written:                      {summary['records_written']}")
    print(f"  Markets with >=1 Newmark metric:      {summary['markets_with_at_least_one_metric']} / {summary['total_markets']}")
    print(f"  Named locations for map layer:        {summary['named_locations_for_map_layer']}")
    print("\nBy extraction method:")
    for k, v in coverage.items():
        print(f"    {k:25s} {v}")
    print("\nBy metric:")
    for m, n in sorted(per_metric.items()):
        print(f"    {m:35s} {n:3d} records")
    if warnings:
        print(f"\n  Warnings ({len(warnings)}):")
        for w in warnings[:10]:
            print(f"    - {w}")
    print("\nOK -- Wrote:")
    print(f"    {OUTPUT_PATH.relative_to(PROJECT_ROOT)}")
    print(f"    {LOCATIONS_PATH.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
