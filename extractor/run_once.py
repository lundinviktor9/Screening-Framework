"""
Quick manual-test script for Task 1 verification (Gate 2).

Usage:
    python extractor/run_once.py deals_inbox/your_file.pdf
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Make sure the project root (containing the `extractor/` package) is on
# sys.path, so this script works whether invoked as:
#   python extractor/run_once.py deals_inbox/foo.pdf
#   python -m extractor.run_once deals_inbox/foo.pdf
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Load .env from extractor/.env if it exists (optional convenience)
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
except ImportError:
    pass  # dotenv is optional; caller can set ANTHROPIC_API_KEY directly

from extractor.pdf_reader import read_pdf
from extractor.extractor import extract_inbound_uk
from extractor.normalizer import normalize_inbound_uk_row


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python extractor/run_once.py <path/to/deal.pdf>", file=sys.stderr)
        return 2

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"File not found: {pdf_path}", file=sys.stderr)
        return 2

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set. Put it in extractor/.env or export it.", file=sys.stderr)
        return 2

    print(f"[1/3] Reading PDF: {pdf_path}")
    text = read_pdf(str(pdf_path))
    if not text.strip():
        print("  ERROR: no text extracted (image-only PDF?)", file=sys.stderr)
        return 3
    print(f"  OK — {len(text):,} characters")

    print("[2/3] Calling Claude for extraction...")
    raw, meta = extract_inbound_uk(text)
    print(f"  OK — model={meta.get('model')}, "
          f"input_tokens={meta.get('input_tokens')}, "
          f"output_tokens={meta.get('output_tokens')}")

    print("[3/3] Normalizing row...")
    normed, norm_meta = normalize_inbound_uk_row(raw, property_map={})

    print("\n----- NORMALIZED ROW -----")
    print(json.dumps(normed, indent=2, default=str))
    print("\n----- CONFIDENCE -----")
    print(json.dumps(norm_meta, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
