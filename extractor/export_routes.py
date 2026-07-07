"""
FastAPI routes for PPTX export — programmatic deck generation from deals.

Factory pattern: make_export_router(store) -> APIRouter
Routes: POST /export/deck
"""
import os
from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from extractor.persistence import DealStore
from extractor.pptx_builder import build_deck


class ExportRequest(BaseModel):
    deal_ids: List[str]
    include_pipeline_summary: bool = False


def make_export_router(store: DealStore) -> APIRouter:
    router = APIRouter()

    @router.post("/export/deck")
    async def export_pptx(body: ExportRequest):
        """
        Build and download a PPTX deck from selected deals.

        Args:
            body.deal_ids: List of deal IDs to include
            body.include_pipeline_summary: Add a summary table slide

        Returns:
            PPTX file download
        """
        # Retrieve deals
        all_deals = store.read_all()
        selected_deals = [d for d in all_deals if d.get("deal_id") in body.deal_ids]

        if not selected_deals:
            raise HTTPException(status_code=400, detail="No deals selected")

        # Get Mapbox token from env
        mapbox_token = os.environ.get("MAPBOX_TOKEN")

        # Build deck (build_deck returns the .pptx as raw bytes)
        try:
            deck_bytes = build_deck(
                selected_deals,
                include_pipeline_summary=body.include_pipeline_summary,
                mapbox_token=mapbox_token,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Deck build failed: {e}")

        # Generate filename with date
        now = datetime.utcnow()
        filename = f"Brunswick_Pipeline_{now.strftime('%Y%m%d_%H%M%S')}.pptx"

        return Response(
            content=deck_bytes,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    return router
