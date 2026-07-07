from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

"""
FastAPI server for deal pipeline extraction.

Exposes:
- POST /ingest — upload single or multiple PDFs
- POST /ingest-folder — batch extract from folder
- GET /deals — list all deals
- POST /deals/{deal_id}/market-override — override matched market
- DELETE /deals/{deal_id} — remove a deal
- GET /pdf/{deal_id} — retrieve original PDF

Chains Tasks 1-4: PDF read → extract → match → profile → persist
"""


import os
import sys
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
from datetime import datetime

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from extractor.pdf_reader import read_pdf
from extractor.extractor import extract_inbound_uk
from extractor.normalizer import normalize_inbound_uk_row
from extractor.market_matcher import MarketMatcher
from extractor.profile_generator import ProfileGenerator
from extractor.persistence import DealStore, create_deal_record
from extractor.underwrite_routes import make_underwrite_router
from extractor.showcase_routes import make_showcase_router
from extractor.export_routes import make_export_router
from extractor.showcase_enrichment import extract_showcase, extract_images, geocode_postcode

# Initialize FastAPI
app = FastAPI(
    title="Deal Pipeline Extractor",
    description="Extract structured deal data from UK real estate IMs/teasers",
    version="1.0.0",
)

# CORS configuration. In production the frontend is served same-origin so CORS is
# irrelevant; for local dev the webpack server (:5173) calls across origins. Extra
# origins can be added via CORS_ORIGINS (comma-separated).
_default_origins = ["http://localhost:5173", "http://localhost:3000"]
_extra_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components — all mutable-state paths come from the central config module
# (in-repo locations in dev; under DATA_DIR when deployed).
from extractor import paths
from extractor.auth import install_auth

REPO_ROOT = paths.REPO_ROOT
MARKETS_CONFIG = paths.MARKETS_CONFIG
POSTCODE_MAP = paths.POSTCODE_MAP
STRATEGY_WEIGHTS = paths.STRATEGY_WEIGHTS
DEALS_JSON = paths.DEALS_JSON
SCORED_MARKETS = paths.SCORED_MARKETS
paths.ensure_dirs()

# Load pre-computed market scores
_scored_markets_by_id = {}
if SCORED_MARKETS.exists():
    with open(SCORED_MARKETS) as f:
        scored = json.load(f)
        _scored_markets_by_id = {m['id']: m for m in scored}

def get_pillar_scores(market_id: str) -> Dict[str, float]:
    """Retrieve pillar scores for a market from pre-computed file."""
    market = _scored_markets_by_id.get(market_id)
    return market['pillarScores'] if market else {}

matcher = MarketMatcher(str(MARKETS_CONFIG), str(POSTCODE_MAP))
generator = ProfileGenerator(str(STRATEGY_WEIGHTS))
store = DealStore(str(DEALS_JSON))

# Underwrite stage (Mode A/B) — shares the single DealStore instance.
app.include_router(make_underwrite_router(store))

# Showcase routes (CRUD for editable deal cards)
app.include_router(make_showcase_router(store))

# Export routes (PPTX deck generation)
app.include_router(make_export_router(store))

# PDF storage (for /pdf/{deal_id} endpoint) + showcase images — central paths.
PDFS_DIR = paths.PDFS_DIR
SHOWCASE_IMG_DIR = paths.SHOWCASE_IMG_DIR
from fastapi.staticfiles import StaticFiles
try:
    app.mount("/showcase-img", StaticFiles(directory=str(SHOWCASE_IMG_DIR)), name="showcase_images")
except Exception as e:
    # Don't die on a missing dir, but never fail silently — every deal photo would 404.
    print(f"WARNING: could not mount /showcase-img ({SHOWCASE_IMG_DIR}): {e}", file=sys.stderr, flush=True)

# Session auth gate (no-op unless APP_USERS is set) — install before the SPA mount.
install_auth(app)


def safe_filename(filename: Optional[str]) -> str:
    """Sanitise a client-supplied filename to a bare name (no path components).

    UploadFile.filename is attacker-controlled; without this, names like
    '../../x.pdf' escape the target directory.
    """
    name = Path(filename or "upload.pdf").name  # strips POSIX components
    name = name.replace("\\", "_").replace("/", "_")  # belt-and-braces for Windows separators
    name = name.strip(". ")
    return name or "upload.pdf"


class MarketOverride(BaseModel):
    """Request body for market override."""

    market_ids: List[str]


class DealPatch(BaseModel):
    """Partial update for a deal. `extracted_fields` is deep-merged (per key) onto
    the existing dict; the other top-level keys are shallow-merged when present."""

    extracted_fields: Optional[Dict[str, Any]] = None
    market_ids: Optional[List[str]] = None
    status: Optional[str] = None
    microlocation_narrative: Optional[str] = None


class ManualDealCreate(BaseModel):
    """Request body for creating a deal by hand (no IM PDF). All fields optional:
    a bare POST yields a blank editable row the analyst can fill inline."""

    name: Optional[str] = None
    extracted_fields: Optional[Dict[str, Any]] = None
    market_ids: Optional[List[str]] = None


class IngestResponse(BaseModel):
    """Response from /ingest endpoint."""

    deal_id: str
    status: str
    source_filename: str
    extracted_fields: Optional[Dict[str, Any]]
    market_ids: List[str]
    market_match_confidence: float
    microlocation_fit_score: float
    microlocation_narrative: str
    extraction_errors: List[str] = []


def process_pdf(
    pdf_path: Path, force: bool = False
) -> tuple[Dict[str, Any], List[str]]:
    """
    Process a single PDF through the full pipeline.

    Returns:
        Tuple of (deal_record, errors)
        - deal_record: Complete DealRecord dict ready for persistence
        - errors: List of error messages (empty if successful)
    """
    errors = []

    try:
        # Read PDF
        pdf_bytes = pdf_path.read_bytes()
        pdf_hash = DealStore.hash_pdf_bytes(pdf_bytes)

        # Check idempotency (unless force=True)
        if not force:
            existing = store.find_by_pdf_hash(pdf_hash)
            if existing:
                return existing, []

        # Extract text
        text = read_pdf(str(pdf_path))
        if not text.strip():
            return None, ["No text extracted (image-only PDF?)"]

        # Extract structured fields
        extracted, meta = extract_inbound_uk(text)
        if not extracted:
            return None, ["Extraction returned empty result"]

        # Normalize fields
        normalized, norm_meta = normalize_inbound_uk_row(extracted, property_map={})

        # Match location to market(s)
        market_ids, match_confidence, match_method = matcher.match(
            normalized.get("Location"), normalized.get("Postal code")
        )

        # Generate profile (fit score + narrative)
        # Use pre-computed pillar scores from scored_markets.json
        # ProfileGenerator expects: {'uk-73': {'Supply': 75, 'Demand': 33.3, ...}, ...}
        pillar_scores = {}
        if market_ids:
            for market_id in market_ids:
                scores = get_pillar_scores(market_id)
                if scores:
                    pillar_scores[market_id] = scores

        profile = generator.generate(
            market_ids if market_ids else [],
            pillar_scores,
            deal_type=None,  # Could be inferred from normalized['Use']
        )

        # Create deal record
        deal_record = create_deal_record(
            normalized,
            market_ids,
            match_confidence,
            profile,
            pdf_hash,
            pdf_path.name,
        )

        # Store PDF for later retrieval via /pdf/{deal_id}
        pdf_copy = PDFS_DIR / f"{deal_record['deal_id']}.pdf"
        pdf_copy.write_bytes(pdf_bytes)

        # Enrich showcase (investment highlights, asset photos, location)
        try:
            # Check for existing edited showcase (re-ingest protection)
            existing_deal = store.read_by_id(deal_record['deal_id'])
            existing_showcase = existing_deal.get("showcase") if existing_deal else None

            # Extract showcase from IM text
            showcase = extract_showcase(text, deal_record['deal_id'], existing_showcase)

            # Extract asset images from PDF
            images = extract_images(pdf_path, deal_record['deal_id'], SHOWCASE_IMG_DIR)
            showcase["images"] = images

            # Geocode postcode if present
            postcode = showcase.get("location", {}).get("postcode")
            if postcode:
                lat, lng = geocode_postcode(postcode)
                if showcase.get("location"):
                    showcase["location"]["lat"] = lat
                    showcase["location"]["lng"] = lng

            deal_record["showcase"] = showcase
        except Exception as e:
            # Showcase enrichment failure doesn't block pipeline
            errors.append(f"Showcase enrichment failed: {str(e)}")

        return deal_record, errors

    except Exception as e:
        errors.append(f"Pipeline error: {str(e)}")
        return None, errors


@app.post("/ingest", response_model=List[IngestResponse])
async def ingest_pdfs(
    files: List[UploadFile] = File(...), force: bool = Query(False)
) -> List[IngestResponse]:
    """
    Upload and extract one or more PDFs.

    Args:
        files: PDF files to upload
        force: If True, re-extract even if PDF hash exists

    Returns:
        List of DealRecord responses with extraction results
    """
    results = []

    for file in files:
        try:
            # Write temp file (sanitised — client filenames must not carry path segments)
            temp_path = PDFS_DIR / f"temp_{safe_filename(file.filename)}"
            content = await file.read()
            temp_path.write_bytes(content)

            # Process
            deal_record, errors = process_pdf(temp_path, force=force)

            if deal_record:
                # Persist. process_pdf returns the EXISTING record on an idempotent
                # re-upload (and a fresh one under ?force=true with the same deal_id),
                # so update-in-place when the id is already in the store — a blind
                # add() here used to append a duplicate deal on every re-upload/retry.
                if store.read_by_id(deal_record["deal_id"]):
                    saved_deal = store.update(deal_record["deal_id"], deal_record) or deal_record
                else:
                    saved_deal = store.add(deal_record)

                response = IngestResponse(
                    deal_id=saved_deal["deal_id"],
                    status=saved_deal["status"],
                    source_filename=saved_deal["source_filename"],
                    extracted_fields=saved_deal.get("extracted_fields"),
                    market_ids=saved_deal.get("market_ids", []),
                    market_match_confidence=saved_deal.get(
                        "market_match_confidence", 0.0
                    ),
                    microlocation_fit_score=saved_deal.get(
                        "microlocation_fit_score", 0
                    ),
                    microlocation_narrative=saved_deal.get(
                        "microlocation_narrative", ""
                    ),
                    extraction_errors=errors,
                )
            else:
                # Failed extraction
                response = IngestResponse(
                    deal_id="",
                    status="failed",
                    source_filename=file.filename,
                    extracted_fields=None,
                    market_ids=[],
                    market_match_confidence=0.0,
                    microlocation_fit_score=0,
                    microlocation_narrative="",
                    extraction_errors=errors,
                )

            results.append(response)

            # Clean up temp
            temp_path.unlink(missing_ok=True)

        except Exception as e:
            results.append(
                IngestResponse(
                    deal_id="",
                    status="failed",
                    source_filename=file.filename,
                    extracted_fields=None,
                    market_ids=[],
                    market_match_confidence=0.0,
                    microlocation_fit_score=0,
                    microlocation_narrative="",
                    extraction_errors=[str(e)],
                )
            )

    return results


@app.post("/ingest-folder", response_model=List[IngestResponse])
async def ingest_folder(folder_path: str = Query("deals_inbox")) -> List[IngestResponse]:
    """
    Batch extract all PDFs from a folder.

    Args:
        folder_path: Path to folder (relative to repo root)

    Returns:
        List of DealRecord responses
    """
    # Contain the folder inside the repo: absolute paths and '..' would otherwise
    # let a caller glob and ingest PDFs from anywhere on the host.
    folder = (PROJECT_ROOT / folder_path).resolve()
    root = PROJECT_ROOT.resolve()
    if root != folder and root not in folder.parents:
        raise HTTPException(status_code=400, detail="folder_path must be inside the project")
    if not folder.exists():
        raise HTTPException(status_code=404, detail=f"Folder not found: {folder_path}")

    results = []
    pdf_files = list(folder.glob("*.pdf"))

    for pdf_file in pdf_files:
        deal_record, errors = process_pdf(pdf_file, force=False)

        if deal_record:
            # Same duplicate guard as /ingest (idempotent re-runs must not append).
            if store.read_by_id(deal_record["deal_id"]):
                saved_deal = store.update(deal_record["deal_id"], deal_record) or deal_record
            else:
                saved_deal = store.add(deal_record)
            response = IngestResponse(
                deal_id=saved_deal["deal_id"],
                status=saved_deal["status"],
                source_filename=saved_deal["source_filename"],
                extracted_fields=saved_deal.get("extracted_fields"),
                market_ids=saved_deal.get("market_ids", []),
                market_match_confidence=saved_deal.get("market_match_confidence", 0.0),
                microlocation_fit_score=saved_deal.get("microlocation_fit_score", 0),
                microlocation_narrative=saved_deal.get("microlocation_narrative", ""),
                extraction_errors=errors,
            )
        else:
            response = IngestResponse(
                deal_id="",
                status="failed",
                source_filename=pdf_file.name,
                extracted_fields=None,
                market_ids=[],
                market_match_confidence=0.0,
                microlocation_fit_score=0,
                microlocation_narrative="",
                extraction_errors=errors,
            )

        results.append(response)

    return results


@app.get("/deals")
def list_deals() -> List[Dict[str, Any]]:
    """
    Get all deals.

    Returns:
        List of DealRecord dicts
    """
    return store.read_all()


@app.get("/deals/{deal_id}")
def get_deal(deal_id: str) -> Dict[str, Any]:
    """
    Get a single deal by ID.

    Returns:
        DealRecord dict
    """
    deal = store.read_by_id(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal not found: {deal_id}")
    return deal


@app.post("/deals/{deal_id}/market-override")
def override_market(deal_id: str, request: MarketOverride) -> Dict[str, Any]:
    """
    Override the matched market(s) for a deal.

    Args:
        deal_id: Deal ID
        request.market_ids: New market IDs to set

    Returns:
        Updated DealRecord
    """
    updated = store.update(deal_id, {"market_ids": request.market_ids})
    if not updated:
        raise HTTPException(status_code=404, detail=f"Deal not found: {deal_id}")
    return updated


@app.patch("/deals/{deal_id}")
def patch_deal(deal_id: str, patch: DealPatch) -> Dict[str, Any]:
    """Persist an inline edit to a deal.

    Without this, edits made in the pipeline table only lived in the browser's
    in-memory store and were lost on refresh (the page re-fetches from the server).
    `extracted_fields` is deep-merged so editing one cell never drops the others.
    """
    existing = store.read_by_id(deal_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Deal not found: {deal_id}")

    updates: Dict[str, Any] = {}
    if patch.extracted_fields is not None:
        merged = {**(existing.get("extracted_fields") or {}), **patch.extracted_fields}
        updates["extracted_fields"] = merged
    if patch.market_ids is not None:
        updates["market_ids"] = patch.market_ids
    if patch.status is not None:
        updates["status"] = patch.status
    if patch.microlocation_narrative is not None:
        updates["microlocation_narrative"] = patch.microlocation_narrative

    if not updates:
        return existing

    updated = store.update(deal_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Deal not found: {deal_id}")
    return updated


@app.post("/deals")
def create_manual_deal(payload: ManualDealCreate) -> Dict[str, Any]:
    """Create a deal by hand (no IM PDF) — e.g. a deal you were pitched directly.

    Returns a fully-formed, blank-but-editable DealRecord so the frontend can add
    it straight to the table; the analyst then fills cells inline (persisted via
    PATCH). market matching / scoring are left empty and can be set by hand.
    """
    import uuid

    deal_id = "manual-" + uuid.uuid4().hex[:12]
    fields: Dict[str, Any] = dict(payload.extracted_fields or {})
    if payload.name and not fields.get("Project Name"):
        fields["Project Name"] = payload.name

    record = {
        "deal_id": deal_id,
        "status": "extracted",
        "pdf_hash": "",
        "source_filename": payload.name or "Manual entry",
        "extracted_fields": fields,
        "market_ids": payload.market_ids or [],
        "market_match_confidence": 0.0,
        "microlocation_fit_score": 0,
        "microlocation_narrative": "",
        "narrative_detail": {},
        "manual": True,
        "showcase": None,
    }
    return store.add(record)


@app.delete("/deals/{deal_id}")
def delete_deal(deal_id: str) -> Dict[str, str]:
    """
    Delete a deal record.

    Args:
        deal_id: Deal ID to delete

    Returns:
        Confirmation message
    """
    deleted = store.delete(deal_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Deal not found: {deal_id}")

    # Also delete stored PDF
    pdf_file = PDFS_DIR / f"{deal_id}.pdf"
    pdf_file.unlink(missing_ok=True)

    return {"status": "deleted", "deal_id": deal_id}


@app.get("/pdf/{deal_id}")
def get_pdf(deal_id: str):
    """
    Retrieve the original PDF for a deal.

    Args:
        deal_id: Deal ID

    Returns:
        PDF file (for "Open PDF" button in UI)
    """
    deal = store.read_by_id(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal not found: {deal_id}")

    pdf_file = PDFS_DIR / f"{deal_id}.pdf"
    if not pdf_file.exists():
        raise HTTPException(status_code=404, detail=f"PDF not found for deal: {deal_id}")

    return FileResponse(
        pdf_file,
        filename=deal.get("source_filename", f"{deal_id}.pdf"),
        media_type="application/pdf",
    )


@app.get("/health")
def health_check() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "service": "deal-pipeline-extractor"}


@app.get("/healthz")
def healthz():
    """
    Deep health check for the platform (Railway). Verifies the deal store is
    readable and the LibreOffice binary (required for underwrite recalc) is present.
    Returns 200 only if both pass.
    """
    import shutil

    deals_ok = DEALS_JSON.exists()
    try:
        store.read_all()
    except Exception:
        deals_ok = False
    soffice_ok = bool(shutil.which("soffice") or shutil.which("libreoffice"))

    status = "ok" if (deals_ok and soffice_ok) else "degraded"
    body = {"status": status, "deals_readable": deals_ok, "soffice": soffice_ok}
    if status != "ok":
        raise HTTPException(status_code=503, detail=body)
    return body


# --- Serve the built frontend (production single-container) -------------------
# Mounted LAST so every API route above is matched first. Falls back to index.html
# for client-side router paths (e.g. /pipeline/<deal_id>). Skipped in dev when no
# build exists (webpack-dev-server serves the frontend on :5173 instead).
from starlette.responses import FileResponse as _FileResponse
from starlette.exceptions import HTTPException as _StarletteHTTPException


class _SPAStaticFiles(StaticFiles):
    """StaticFiles that returns index.html for unknown paths (SPA deep links).

    Starlette's StaticFiles *raises* HTTPException(404) for a missing path rather
    than returning a 404 response, so we catch it and fall back to index.html.
    """

    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except _StarletteHTTPException as exc:
            if exc.status_code == 404:
                index = Path(self.directory) / "index.html"
                if index.exists():
                    return _FileResponse(str(index))
            raise


if paths.STATIC_DIR.exists() and (paths.STATIC_DIR / "index.html").exists():
    app.mount("/", _SPAStaticFiles(directory=str(paths.STATIC_DIR), html=True), name="spa")
    print(f"[server] Serving built frontend from {paths.STATIC_DIR}")
else:
    print(f"[server] No frontend build at {paths.STATIC_DIR} — API only (dev mode).")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8787, reload=True)
