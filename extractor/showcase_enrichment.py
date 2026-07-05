"""
Showcase enrichment — LLM-based extraction of investment highlights from IMs.

Extracts: headline, KPIs, rationale bullets, business plan bullets, address, postcode.
Geocodes postcode to lat/lng via postcodes.io.
Extracts asset photos from IM PDF via PyMuPDF.
"""
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import json
from datetime import datetime

try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    import requests
except ImportError:
    requests = None


class ShowcaseError(Exception):
    pass


def _first_text_block(content) -> str:
    """Return the first text block from an Anthropic response.

    Newer Claude models can emit thinking blocks before the text block, so
    content[0] is not guaranteed to have a .text attribute.
    """
    for block in content:
        text = getattr(block, "text", None)
        if text:
            return text
    raise ValueError("No text block in model response")


SHOWCASE_SYSTEM_PROMPT = """You are a precision investment memo analyst specializing in UK real estate.

Extract showcase data from the investment memorandum. Return ONLY valid JSON.
All values must be EXPLICITLY stated in the document — never invent or infer.
All numbers must match the IM verbatim. null if not stated."""

SHOWCASE_USER_PROMPT = """Extract showcase data from this UK property investment memo.

Return JSON with these fields:
{{
  "headline": "<one-sentence investment angle, max 80 chars, if stated in IM>",
  "kpis": {{
    "tenure": "<freehold/leasehold if stated>",
    "units": "<number if stated>",
    "lettable_area_sqft": "<as number only if stated>",
    "occupancy_pct": "<as number 0-100 if stated>",
    "passing_rent_psf": "<as number if stated>",
    "capital_value_psf": "<as number if stated>",
    "niy_pct": "<as number if stated>",
    "ry_pct": "<as number if stated>",
    "purchase_price": "<as number if stated>"
  }},
  "rationale_bullets": [
    {{"label": "<bold label>", "text": "<supporting text from Investment Highlights>"}}
  ],
  "business_plan_bullets": ["<bullet from Business Plan section>"],
  "address": "<street address if stated>",
  "postcode": "<UK postcode if stated>"
}}

DOCUMENT:
{document_text}

JSON OUTPUT:"""


def extract_showcase(
    pdf_text: str,
    deal_id: str,
    existing_showcase: Optional[Dict[str, Any]] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Extract showcase data via LLM call to Claude.

    Args:
        pdf_text: Raw text from IM PDF.
        deal_id: Deal ID for traceability.
        existing_showcase: Existing showcase block (for merge protection).
        api_key: Anthropic API key (defaults to env var).
        model: Claude model to use.

    Returns:
        Showcase dict with headline, kpis, bullets, location, provenance.
        If re-ingesting a deal with edited_by_analyst=true, merges preserving edits.
    """
    if Anthropic is None:
        raise ShowcaseError("anthropic package not installed")

    api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ShowcaseError("No API key provided. Set ANTHROPIC_API_KEY or pass api_key.")

    client = Anthropic(api_key=api_key)
    model = model or os.environ.get("EXTRACT_MODEL", "claude-sonnet-5")

    # Call Claude for showcase extraction
    prompt = SHOWCASE_USER_PROMPT.format(document_text=pdf_text)
    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=SHOWCASE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw_text = _first_text_block(response.content)
    extracted = _parse_json_response(raw_text)

    # Clean up null values in kpis
    if extracted.get("kpis"):
        extracted["kpis"] = {
            k: v for k, v in extracted["kpis"].items() if v is not None
        }

    # Build showcase block
    now = datetime.utcnow().isoformat() + "Z"
    showcase = {
        "headline": extracted.get("headline"),
        "kpis": extracted.get("kpis"),
        "rationale_bullets": extracted.get("rationale_bullets") or [],
        "business_plan_bullets": extracted.get("business_plan_bullets") or [],
        "images": [],  # Populated by extract_images
        "location": {
            "address": extracted.get("address"),
            "postcode": extracted.get("postcode"),
            "lat": None,  # Will be populated by geocode_postcode
            "lng": None,
        },
        "provenance": {
            "generated_from": "im",
            "generated_at": now,
            "edited_by_analyst": False,
        },
    }

    # If re-ingesting and previous version was edited by analyst, preserve edits
    if existing_showcase and existing_showcase.get("provenance", {}).get("edited_by_analyst"):
        showcase = _merge_preserve_edits(existing_showcase, showcase)

    return showcase


def extract_images(pdf_path: Path, deal_id: str, img_dir: Path) -> List[Dict[str, str]]:
    """
    Extract asset images from IM PDF using PyMuPDF.

    Args:
        pdf_path: Path to IM PDF.
        deal_id: Deal ID for file naming.
        img_dir: Directory to save images to (respects OneDrive exclusion).

    Returns:
        List of {file, selected} dicts.
    """
    if fitz is None:
        raise ShowcaseError("pymupdf package not installed")

    img_dir.mkdir(parents=True, exist_ok=True)
    images: List[Tuple[str, int]] = []  # (filename, pixel_area)

    try:
        doc = fitz.open(str(pdf_path))
    except Exception as e:
        raise ShowcaseError(f"Failed to open PDF: {e}")

    img_count = 0
    for page_num in range(len(doc)):
        try:
            page = doc[page_num]
            img_list = page.get_images(full=True)

            for img_idx, img_ref in enumerate(img_list):
                xref = img_ref[0]
                try:
                    base_image = doc.extract_image(xref)
                    if not base_image:
                        continue

                    # Filter by size: skip < 150×150, skip aspect ratios <0.3 or >3.5
                    w, h = base_image.get("width", 0), base_image.get("height", 0)
                    if w < 150 or h < 150:
                        continue
                    aspect = w / h if h > 0 else 1.0
                    if aspect < 0.3 or aspect > 3.5:
                        continue  # Skip logos/maps

                    # Save image
                    img_data = base_image["image"]
                    filename = f"{deal_id}_{img_count}.png"
                    filepath = img_dir / filename
                    with open(filepath, "wb") as f:
                        f.write(img_data)

                    pixel_area = w * h
                    images.append((filename, pixel_area))
                    img_count += 1

                except Exception:
                    continue
        except Exception:
            continue

    doc.close()

    # Keep top 3 largest images
    images = sorted(images, key=lambda x: x[1], reverse=True)[:3]

    # Build return list (first image selected)
    result = [
        {"file": f"showcase_img/{fname}", "selected": (i == 0)}
        for i, (fname, _) in enumerate(images)
    ]

    return result


def geocode_postcode(postcode: str) -> Tuple[Optional[float], Optional[float]]:
    """
    Geocode UK postcode via postcodes.io API.

    Args:
        postcode: UK postcode (e.g., "EH12 0BD").

    Returns:
        (lat, lng) or (None, None) if lookup fails.
    """
    if requests is None:
        return None, None

    if not postcode:
        return None, None

    try:
        # Remove spaces for API call
        pc_clean = postcode.replace(" ", "")
        url = f"https://api.postcodes.io/postcodes/{pc_clean}"
        response = requests.get(url, timeout=5)

        if response.ok:
            data = response.json()
            if data.get("result"):
                return (
                    data["result"].get("latitude"),
                    data["result"].get("longitude"),
                )
    except Exception:
        pass

    return None, None


def _parse_json_response(raw_output: str) -> Dict[str, Any]:
    """Parse JSON from LLM response, handling markdown code blocks."""
    text = raw_output.strip()

    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


def _merge_preserve_edits(
    existing: Dict[str, Any], new: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Merge new showcase into existing, preserving analyst edits.

    Only overwrites null fields in existing; preserves all non-null existing values.
    """
    result = {}

    # For top-level strings
    for key in ["headline"]:
        existing_val = existing.get(key)
        new_val = new.get(key)
        result[key] = existing_val if existing_val is not None else new_val

    # For KPIs dict
    existing_kpis = existing.get("kpis") or {}
    new_kpis = new.get("kpis") or {}
    merged_kpis = {**new_kpis}
    for k, v in existing_kpis.items():
        if v is not None:
            merged_kpis[k] = v
    result["kpis"] = merged_kpis or None

    # For bullet lists, take existing if non-empty
    result["rationale_bullets"] = (
        existing.get("rationale_bullets")
        if existing.get("rationale_bullets")
        else new.get("rationale_bullets")
    )
    result["business_plan_bullets"] = (
        existing.get("business_plan_bullets")
        if existing.get("business_plan_bullets")
        else new.get("business_plan_bullets")
    )

    # Preserve images list if it exists
    result["images"] = existing.get("images") or new.get("images") or []

    # For location, merge preserving existing non-null values
    existing_loc = existing.get("location") or {}
    new_loc = new.get("location") or {}
    merged_loc = {**new_loc}
    for k, v in existing_loc.items():
        if v is not None:
            merged_loc[k] = v
    result["location"] = merged_loc or None

    # Preserve provenance but keep edited_by_analyst=true if set
    result["provenance"] = existing.get("provenance") or new.get("provenance") or {}
    if existing.get("provenance", {}).get("edited_by_analyst"):
        result["provenance"]["edited_by_analyst"] = True

    return result
