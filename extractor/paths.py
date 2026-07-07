"""
Central path configuration for the deal-pipeline server.

ONE place that decides where mutable state lives. Two modes:

  * Local dev (DATA_DIR unset): every path keeps its historical in-repo location,
    so the existing `npm run app` workflow is byte-for-byte unchanged.
  * Deployed (DATA_DIR set, e.g. a Railway persistent volume): deals.json,
    underwrite runs, showcase images and ingested PDFs all live under DATA_DIR,
    so a redeploy of the ephemeral container filesystem never loses data.

Per-key env overrides (DEALS_JSON_PATH, UNDERWRITE_OUT_DIR, SHOWCASE_IMG_DIR,
PDFS_DIR) still win over DATA_DIR for anyone who needs to split state.

CRITICAL (carry-over): xlsx/image writes must never land inside a OneDrive-synced
path locally — that corrupts files mid-write. The in-repo defaults below are safe;
DATA_DIR on a deploy volume is safe. Do not point these at OneDrive.
"""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
EXTRACTOR_DIR = Path(__file__).resolve().parent

# When set, this is the single root for all mutable state (a mounted volume in prod).
_DATA_DIR_ENV = os.environ.get("DATA_DIR")
DATA_DIR = Path(_DATA_DIR_ENV) if _DATA_DIR_ENV else None


def _resolve(env_key: str, data_subpath: str, dev_default: Path) -> Path:
    """Pick a path: explicit per-key env > DATA_DIR/<subpath> > in-repo dev default."""
    override = os.environ.get(env_key)
    if override:
        return Path(override)
    if DATA_DIR is not None:
        return DATA_DIR / data_subpath
    return dev_default


# --- mutable state (relocated under DATA_DIR when deployed) -------------------
DEALS_JSON = _resolve(
    "DEALS_JSON_PATH", "deals.json", REPO_ROOT / "src" / "data" / "deals.json"
)
UNDERWRITE_DIR = _resolve(
    "UNDERWRITE_OUT_DIR", "underwrite_runs", EXTRACTOR_DIR / "underwrite_runs"
)
SHOWCASE_IMG_DIR = _resolve(
    "SHOWCASE_IMG_DIR", "showcase_img", EXTRACTOR_DIR / "showcase_img"
)
PDFS_DIR = _resolve(
    "PDFS_DIR", "pdfs_ingested", EXTRACTOR_DIR / "pdfs_ingested"
)

# --- read-only config & build artefacts (always in-repo / image) -------------
MARKETS_CONFIG = REPO_ROOT / "scrapers" / "config" / "markets.json"
POSTCODE_MAP = EXTRACTOR_DIR / "postcode_area_to_market.json"
STRATEGY_WEIGHTS = EXTRACTOR_DIR / "strategy_weights.json"
SCORED_MARKETS = REPO_ROOT / "public" / "data" / "scored_markets.json"

# Built frontend (webpack dist + public/data) served by FastAPI in production.
STATIC_DIR = Path(os.environ.get("STATIC_DIR", str(REPO_ROOT / "static")))


def ensure_dirs() -> None:
    """Create the mutable-state directories (and DEALS_JSON's parent) if missing."""
    for d in (UNDERWRITE_DIR, SHOWCASE_IMG_DIR, PDFS_DIR, DEALS_JSON.parent):
        d.mkdir(parents=True, exist_ok=True)
