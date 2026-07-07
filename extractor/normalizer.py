"""
Row normalization for UK inbound deal rows.

Ported from Nordic `src/normalize/row_normalizer.py`. Swedish/Danish
inbound (`normalize_inbound_row`) and transactions paths have been
stripped; only `normalize_inbound_uk_row` and its UK-specific field
lists remain.

Each field normalizer returns (normalized_value, confidence) where
confidence is:
- "high":   successfully parsed/matched
- "medium": partial match or ambiguous
- "low":    could not parse, returned empty or fallback
"""

from typing import Any, Dict, Tuple

from extractor.normalizers.property_type import normalize_property_type
from extractor.normalizers.number_normalizer import normalize_price, normalize_yield
from extractor.normalizers.city_normalizer import normalize_city


# UK inbound field definitions (sq ft instead of sqm)
INBOUND_UK_NUMBER_FIELDS = [
    "Leasable area, sq ft",
    "Base rent incl. index, CCY/sqft",
    "NOI, CCY",
    "NOI, CCY/sqft",
    "WAULT, years",
    "Deal value, CCY",
    "Deal value, CCY/sqft",
    "Price, CCY",
    "Price, CCY/sqft",
]
INBOUND_UK_YIELD_FIELDS = ["Yield", "Yield2"]


def normalize_inbound_uk_row(
    row: Dict[str, Any], property_map: Dict[str, Any]
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Normalize a UK inbound deal row.

    Uses sq ft (not sqm) and treats "Country" as a pass-through
    (always "United Kingdom" for this path).

    Returns:
        (normalized_row, metadata) where metadata contains
        per-field confidence scores.
    """
    out = dict(row)
    meta: Dict[str, Any] = {}

    # Country field — UK pass-through, no normalization needed
    if "Country" in out and out["Country"]:
        meta["Country_confidence"] = "high"

    # Location field (city name normalization)
    if "Location" in out and out["Location"]:
        canon, conf = normalize_city(out["Location"])
        if canon:
            out["Location"] = canon
        meta["Location_confidence"] = conf

    # Number fields (prices, areas in sq ft, etc.)
    for field in INBOUND_UK_NUMBER_FIELDS:
        if field in out and out[field]:
            canon, conf = normalize_price(out[field])
            if canon != "":
                out[field] = canon
            meta[f"{field}_confidence"] = conf

    # Yield fields
    for field in INBOUND_UK_YIELD_FIELDS:
        if field in out and out[field]:
            canon, conf = normalize_yield(out[field])
            if canon != "":
                out[field] = canon
            meta[f"{field}_confidence"] = conf

    # Occupancy — normalize but keep as percentage string for UK
    if "Economic occupancy rate, %" in out and out["Economic occupancy rate, %"]:
        val = out["Economic occupancy rate, %"]
        if isinstance(val, (int, float)):
            out["Economic occupancy rate, %"] = f"{int(val)}%"
            meta["Economic occupancy rate, %_confidence"] = "high"
        elif isinstance(val, str):
            canon, conf = normalize_yield(val)
            if canon != "":
                out["Economic occupancy rate, %"] = f"{int(canon)}%"
            meta["Economic occupancy rate, %_confidence"] = conf

    return out, meta
