"""
FastAPI routes for showcase CRUD — editable deal cards.

Factory pattern: make_showcase_router(store) -> APIRouter
Routes: GET /deals/{deal_id}/showcase
        PATCH /deals/{deal_id}/showcase
        POST /deals/{deal_id}/showcase/image
        POST /deals/{deal_id}/showcase/regenerate
"""
import os
from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
import json
from datetime import datetime

from extractor.persistence import DealStore
from extractor.showcase_enrichment import (
    extract_showcase,
    extract_images,
    geocode_postcode,
)


# Resolved centrally: SHOWCASE_IMG_DIR override > DATA_DIR/showcase_img > in-repo.
from extractor.paths import SHOWCASE_IMG_DIR


class ShowcasePatch(BaseModel):
    headline: Optional[str] = None
    kpis: Optional[Dict[str, Any]] = None
    rationale_bullets: Optional[list] = None
    business_plan_bullets: Optional[list] = None
    location: Optional[Dict[str, Any]] = None
    images: Optional[list] = None


def make_showcase_router(store: DealStore) -> APIRouter:
    router = APIRouter()

    @router.get("/deals/{deal_id}/showcase")
    async def get_showcase(deal_id: str):
        """Retrieve showcase block for a deal."""
        deal = store.read_by_id(deal_id)
        if not deal:
            raise HTTPException(status_code=404, detail="Deal not found")

        showcase = deal.get("showcase")
        if not showcase:
            raise HTTPException(status_code=404, detail="Showcase not found")

        return showcase

    @router.patch("/deals/{deal_id}/showcase")
    async def patch_showcase(deal_id: str, body: ShowcasePatch):
        """Update showcase block (partial merge). Sets edited_by_analyst=true."""
        deal = store.read_by_id(deal_id)
        if not deal:
            raise HTTPException(status_code=404, detail="Deal not found")

        existing = deal.get("showcase") or {}
        updates = body.model_dump(exclude_unset=True)

        # Deep merge into existing showcase
        merged = {**existing}
        for key, val in updates.items():
            if key == "kpis" and val is not None:
                # Merge KPI dict
                merged_kpis = merged.get("kpis") or {}
                merged_kpis.update(val)
                merged[key] = merged_kpis
            elif key == "location" and val is not None:
                # Merge location dict
                merged_loc = merged.get("location") or {}
                merged_loc.update(val)
                merged[key] = merged_loc
            elif val is not None:
                # Simple assignment for other fields
                merged[key] = val

        # Mark as edited by analyst
        if "provenance" not in merged:
            merged["provenance"] = {}
        merged["provenance"]["edited_by_analyst"] = True

        # Update deal
        store.update(deal_id, {"showcase": merged})

        return merged

    @router.post("/deals/{deal_id}/showcase/image")
    async def upload_showcase_image(deal_id: str, file: UploadFile = File(...)):
        """Upload a replacement asset photo. Appends to images list."""
        deal = store.read_by_id(deal_id)
        if not deal:
            raise HTTPException(status_code=404, detail="Deal not found")

        existing = deal.get("showcase") or {}
        images = existing.get("images") or []

        # Save file
        SHOWCASE_IMG_DIR.mkdir(parents=True, exist_ok=True)
        next_idx = len(images)
        filename = f"{deal_id}_{next_idx}.png"
        filepath = SHOWCASE_IMG_DIR / filename

        try:
            content = await file.read()
            with open(filepath, "wb") as f:
                f.write(content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to save image: {e}")

        # Append to images list
        images.append({"file": f"showcase_img/{filename}", "selected": len(images) == 0})

        # Update showcase
        if "provenance" not in existing:
            existing["provenance"] = {}
        existing["provenance"]["edited_by_analyst"] = True
        existing["images"] = images

        store.update(deal_id, {"showcase": existing})

        return {"images": images}

    @router.patch("/deals/{deal_id}/showcase/image")
    async def toggle_image_selected(deal_id: str, file: str, selected: bool = Query(True)):
        """Toggle selected flag on an image."""
        deal = store.read_by_id(deal_id)
        if not deal:
            raise HTTPException(status_code=404, detail="Deal not found")

        existing = deal.get("showcase") or {}
        images = existing.get("images") or []

        # Find image by file and toggle
        found = False
        for img in images:
            if img["file"] == file:
                img["selected"] = selected
                found = True
            else:
                img["selected"] = False  # Only one image selected at a time

        if not found:
            raise HTTPException(status_code=404, detail="Image not found")

        # Update showcase
        if "provenance" not in existing:
            existing["provenance"] = {}
        existing["provenance"]["edited_by_analyst"] = True
        existing["images"] = images

        store.update(deal_id, {"showcase": existing})

        return {"images": images}

    @router.post("/deals/{deal_id}/showcase/regenerate")
    async def regenerate_showcase(deal_id: str):
        """
        Re-run showcase enrichment from stored IM PDF.
        Explicit analyst action; always overwrites (ignores edited_by_analyst protection).
        """
        deal = store.read_by_id(deal_id)
        if not deal:
            raise HTTPException(status_code=404, detail="Deal not found")

        # Find the original PDF. server.py stores ingested PDFs as <deal_id>.pdf under
        # the central PDFS_DIR; fall back to the source filename for legacy layouts.
        from extractor.paths import PDFS_DIR
        pdf_path = PDFS_DIR / f"{deal_id}.pdf"
        if not pdf_path.exists():
            pdf_path = PDFS_DIR / deal.get("source_filename", "")
        if not pdf_path.exists():
            raise HTTPException(
                status_code=400, detail=f"Original PDF not found: {pdf_path}"
            )

        try:
            # Read PDF and extract showcase (without merge protection)
            pdf_text = _extract_pdf_text(pdf_path)
            if not pdf_text.strip():
                raise HTTPException(
                    status_code=422,
                    detail="No text could be extracted from the stored PDF — "
                           "refusing to regenerate (would overwrite the showcase with nulls).",
                )

            # Call showcase extraction without passing existing
            showcase = extract_showcase(pdf_text, deal_id)

            # Extract images
            images = extract_images(pdf_path, deal_id, SHOWCASE_IMG_DIR)
            showcase["images"] = images

            # Geocode postcode
            postcode = showcase.get("location", {}).get("postcode")
            if postcode:
                lat, lng = geocode_postcode(postcode)
                if showcase.get("location"):
                    showcase["location"]["lat"] = lat
                    showcase["location"]["lng"] = lng

            # Update deal (always overwrites, this is explicit analyst action)
            store.update(deal_id, {"showcase": showcase})

            return showcase

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Regeneration failed: {e}")

    return router


def _extract_pdf_text(pdf_path: Path) -> str:
    """Extract raw text from PDF.

    Raises on failure instead of returning "" — a silent empty string used to
    flow into extract_showcase and overwrite the showcase with all-null fields.
    """
    import pypdf

    reader = pypdf.PdfReader(str(pdf_path))
    text = ""
    for page in reader.pages:
        text += (page.extract_text() or "") + "\n"
    return text
