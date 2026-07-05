"""
LLM-based extraction using the Anthropic Claude API (UK-only path).

Ported from Nordic `src/extract/extractor.py` with the Swedish/Danish
(`extract_inbound`) and Transactions (`extract_transaction`) paths stripped.

Extracts structured deal data from raw PDF/teaser text and returns a dict
ready for normalization by `extractor.normalizer.normalize_inbound_uk_row`.
"""

import json
import os
from typing import Any, Dict, Optional, Tuple

try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None

from extractor.prompts import (
    INBOUND_UK_SYSTEM_PROMPT,
    INBOUND_UK_USER_PROMPT,
)


class ExtractionError(Exception):
    """Raised when extraction fails."""
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


class Extractor:
    """LLM-based extractor for UK real estate deal information."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """
        Initialize the extractor.

        Args:
            api_key: Anthropic API key. If not provided, uses ANTHROPIC_API_KEY env var.
            model: Claude model to use.
        """
        if Anthropic is None:
            raise ImportError("anthropic package not installed. Run: pip install anthropic")

        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("No API key provided. Set ANTHROPIC_API_KEY or pass api_key.")

        self.client = Anthropic(api_key=self.api_key)
        self.model = model or os.environ.get("EXTRACT_MODEL", "claude-sonnet-5")

    def extract_inbound_uk(self, document_text: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Extract UK inbound deal data from PDF/IM text.

        Args:
            document_text: Raw text from the UK PDF/teaser.

        Returns:
            Tuple of (extracted_row, metadata)
            - extracted_row: Dict with schema-aligned field names
            - metadata: Dict with extraction info (model, tokens, raw response)
        """
        prompt = INBOUND_UK_USER_PROMPT.format(document_text=document_text)

        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=INBOUND_UK_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        raw_output = _first_text_block(response.content)
        extracted = self._parse_json_response(raw_output)
        row = self._map_inbound_uk_fields(extracted)

        metadata = {
            "model": self.model,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "raw_response": raw_output,
        }

        return row, metadata

    def _parse_json_response(self, raw_output: str) -> Dict[str, Any]:
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
        except json.JSONDecodeError as e:
            raise ExtractionError(f"Failed to parse JSON response: {e}\nRaw: {raw_output}")

    def _map_inbound_uk_fields(self, extracted: Dict[str, Any]) -> Dict[str, Any]:
        """Map extracted fields to UK inbound schema field names."""
        row: Dict[str, Any] = {}

        direct_fields = [
            "Type", "Project Name", "Seller", "Country", "Location",
            "Portfolio", "Address", "Postal code", "Property designation",
            "Year Built", "Number of Tenants",
        ]
        for field in direct_fields:
            if extracted.get(field) is not None:
                row[field] = extracted[field]

        # Field name mappings (extracted name -> schema name)
        mappings = {
            "Leasable area, sq ft": "Leasable area, sq ft",
            "Base rent, psf": "Base rent incl. index, CCY/sqft",
            "NOI": "NOI, CCY",
            "WAULT": "WAULT, years",
            "Occupancy": "Economic occupancy rate, %",
            "Yield": "Yield",            # NIY
            "Deal value": "Deal value, CCY",
            "Yield2": "Yield2",          # RY (Reversionary Yield)
            "Comments": "Comment",
        }

        for src, dst in mappings.items():
            if extracted.get(src) is not None:
                row[dst] = extracted[src]

        # Always set Country to United Kingdom for UK deals
        row["Country"] = "United Kingdom"

        return row


def extract_inbound_uk(
    document_text: str, api_key: Optional[str] = None
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Convenience function: extract a single UK inbound deal from text."""
    extractor = Extractor(api_key=api_key)
    return extractor.extract_inbound_uk(document_text)
