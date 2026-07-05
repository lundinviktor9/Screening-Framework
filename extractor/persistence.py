"""
Deal persistence layer (audit-hardened 2026-07-05).

Handles:
- Atomic writes to deals.json with file locking
- PDF hash-based idempotency (prevent double-ingestion)
- CRUD operations on deal records
"""

import json
import hashlib
import tempfile
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime


class DealStoreCorrupt(Exception):
    """deals.json exists but is not valid JSON — refuse to operate rather than wipe it."""


class DealStore:
    """Atomic persistence for deal records."""

    # Process-wide lock: FastAPI sync endpoints run in a threadpool, so
    # concurrent read-modify-write cycles would otherwise lose updates.
    _lock = threading.Lock()

    def __init__(self, deals_json_path: str):
        """
        Initialize deal store.

        Args:
            deals_json_path: Path to src/data/deals.json
        """
        self.deals_path = Path(deals_json_path)
        self._ensure_file()

    def _ensure_file(self):
        """Create deals.json if it doesn't exist."""
        if not self.deals_path.exists():
            self.deals_path.parent.mkdir(parents=True, exist_ok=True)
            self._write_atomic([])

    def read_all(self) -> List[Dict[str, Any]]:
        """Read all deals.

        A missing file means an empty store. A file that exists but fails to
        parse must NOT be treated as empty: the next add() would atomically
        overwrite it with a one-deal file and destroy every existing deal.
        """
        try:
            with open(self.deals_path, encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return []
        except json.JSONDecodeError as e:
            raise DealStoreCorrupt(
                f"{self.deals_path} is corrupted ({e}). Refusing to proceed — "
                f"repair or restore the file (a valid empty store is '[]')."
            ) from e

    def read_by_id(self, deal_id: str) -> Optional[Dict[str, Any]]:
        """Read a single deal by ID."""
        deals = self.read_all()
        for deal in deals:
            if deal.get("deal_id") == deal_id:
                return deal
        return None

    def add(self, deal_record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add a new deal record.

        Atomically appends to deals.json.

        Args:
            deal_record: Deal record dict (must have deal_id)

        Returns:
            The added deal record (with timestamps)
        """
        if "deal_id" not in deal_record:
            raise ValueError("deal_record must have 'deal_id'")

        with self._lock:
            deals = self.read_all()
            deal_record["created_at"] = datetime.utcnow().isoformat() + "Z"
            deal_record["updated_at"] = deal_record["created_at"]

            deals.append(deal_record)
            self._write_atomic(deals)

        return deal_record

    def update(self, deal_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update a deal record.

        Args:
            deal_id: Deal ID to update
            updates: Fields to update

        Returns:
            Updated deal record, or None if not found
        """
        with self._lock:
            deals = self.read_all()

            for deal in deals:
                if deal.get("deal_id") == deal_id:
                    deal.update(updates)
                    deal["updated_at"] = datetime.utcnow().isoformat() + "Z"
                    self._write_atomic(deals)
                    return deal

        return None

    def delete(self, deal_id: str) -> bool:
        """
        Delete a deal record.

        Args:
            deal_id: Deal ID to delete

        Returns:
            True if deleted, False if not found
        """
        with self._lock:
            deals = self.read_all()
            original_len = len(deals)

            deals = [d for d in deals if d.get("deal_id") != deal_id]

            if len(deals) < original_len:
                self._write_atomic(deals)
                return True

        return False

    def _write_atomic(self, deals: List[Dict[str, Any]]):
        """
        Atomically write deals to file.

        Uses temp file + rename to ensure no partial writes.
        """
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".json",
            dir=self.deals_path.parent,
            delete=False,
            encoding="utf-8",
        ) as tmp:
            json.dump(deals, tmp, indent=2, default=str)
            tmp_path = tmp.name

        # Atomic rename
        tmp_path_obj = Path(tmp_path)
        tmp_path_obj.replace(self.deals_path)

    @staticmethod
    def hash_pdf_bytes(pdf_bytes: bytes) -> str:
        """
        Hash PDF bytes for idempotency detection.

        Args:
            pdf_bytes: Raw PDF file bytes

        Returns:
            SHA256 hex digest
        """
        return hashlib.sha256(pdf_bytes).hexdigest()

    def find_by_pdf_hash(self, pdf_hash: str) -> Optional[Dict[str, Any]]:
        """
        Find deal by PDF hash (for idempotency).

        Args:
            pdf_hash: SHA256 hash of PDF bytes

        Returns:
            Deal record if found (already extracted), None otherwise
        """
        deals = self.read_all()
        for deal in deals:
            if deal.get("pdf_hash") == pdf_hash:
                return deal
        return None


def create_deal_record(
    extracted_row: Dict[str, Any],
    market_ids: List[str],
    market_match_confidence: float,
    profile: Dict[str, Any],
    pdf_hash: str,
    source_filename: str,
) -> Dict[str, Any]:
    """
    Create a deal record from extraction + profiling results.

    Args:
        extracted_row: From extractor.extract_inbound_uk()
        market_ids: From market_matcher.match()
        market_match_confidence: Match confidence score
        profile: From profile_generator.generate()
        pdf_hash: SHA256 of PDF bytes
        source_filename: Original filename

    Returns:
        Complete DealRecord dict ready for persistence
    """
    # Generate deal ID from hash (first 16 chars)
    deal_id = pdf_hash[:16]

    record = {
        "deal_id": deal_id,
        "status": "extracted",  # extracted, reviewed, matched, unmatched
        "pdf_hash": pdf_hash,
        "source_filename": source_filename,
        # Extraction results
        "extracted_fields": extracted_row,
        # Market matching
        "market_ids": market_ids,
        "market_match_confidence": market_match_confidence,
        # Profile / fit score
        "microlocation_fit_score": profile.get("microlocation_fit_score", 0),
        "microlocation_narrative": profile.get("microlocation_narrative", ""),
        "narrative_detail": profile.get("narrative_detail", {}),
        # Showcase (editable deal card data) — populated at ingestion
        "showcase": None,
    }

    return record
