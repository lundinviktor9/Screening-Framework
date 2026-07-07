"""
UK 10-year gilt yield fetcher.

Fetches the current UK 10-year gilt yield from public sources, with three-tier
fall-back, caches the result, and never crashes:

  1. Bank of England — IUDBELLS series (daily 10-yr nominal par yield)
     https://www.bankofengland.co.uk/boeapps/database/fromshowcolumns.asp?...
  2. UK Debt Management Office — gilt prices & yields page
     https://www.dmo.gov.uk/data/gilt-market/gilt-prices-and-yields/
  3. Cached value from previous run (scrapers/config/gilt_yield_cache.json)

Output cache file:
  scrapers/config/gilt_yield_cache.json
    {
      "yield_pct": 4.35,
      "fetch_date": "2026-04-21",
      "source": "Bank of England",
      "tenor": "10-year",
      "cache_age_days": 0,
      "is_cached_fallback": false
    }

data_merger.py reads this cache to compute newmark_yield_spread =
(newmark_equivalent_yield - gilt_yield_pct). If the cache is older than 7 days
it flags newmark_yield_spread as REVIEW_NEEDED.

Run:
    python scrapers/gilt_yield_fetcher.py
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
CACHE_PATH = PROJECT_ROOT / "scrapers" / "config" / "gilt_yield_cache.json"

USER_AGENT = "Brunswick-Screening-Framework/1.0 (gilt-yield-fetcher)"


def fetch_boe() -> Optional[tuple[float, str]]:
    """Bank of England IUDBELLS series — last 30 days, take most recent."""
    today = date.today()
    start = today - timedelta(days=30)
    params = {
        "Travel": "NIxIRx",
        "FromSeries": "1",
        "ToSeries": "50",
        "DAT": "RNG",
        "FD": str(start.day),
        "FM": start.strftime("%b"),
        "FY": str(start.year),
        "TD": str(today.day),
        "TM": today.strftime("%b"),
        "TY": str(today.year),
        "VFD": "Y",
        "C": "IUDBELLS",
        "Filter": "N",
    }
    from urllib.parse import urlencode
    url = f"https://www.bankofengland.co.uk/boeapps/database/fromshowcolumns.asp?{urlencode(params)}"

    try:
        req = Request(url, headers={"User-Agent": USER_AGENT})
        with urlopen(req, timeout=20) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError) as e:
        print(f"  [BoE] fetch failed: {e}")
        return None

    # BoE table rows include cells like
    #   <td class="series-data">4.35</td>  (or just the number)
    # We scan for all numeric cells in table rows and take the last one, which
    # corresponds to the most recent business day in the range.
    # Rows appear in chronological order (oldest first).
    values = re.findall(r"<td[^>]*>\s*([0-9]{1,2}\.[0-9]{1,4})\s*</td>", html)
    if not values:
        # Sometimes the layout uses class="value" or direct numeric spans
        values = re.findall(r'class="value"[^>]*>\s*([0-9]{1,2}\.[0-9]{1,4})\s*<', html)
    if not values:
        print("  [BoE] HTML received but no numeric values parsed (layout change?)")
        return None

    # Filter to plausible 10-year yields (0-15%)
    numeric = [float(v) for v in values if 0 < float(v) < 15]
    if not numeric:
        return None
    latest = numeric[-1]
    return latest, "Bank of England (IUDBELLS daily series)"


def fetch_dmo() -> Optional[tuple[float, str]]:
    """UK DMO gilt prices page — scrape 10-year benchmark gilt yield."""
    url = "https://www.dmo.gov.uk/data/gilt-market/gilt-prices-and-yields/"
    try:
        req = Request(url, headers={"User-Agent": USER_AGENT})
        with urlopen(req, timeout=20) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError) as e:
        print(f"  [DMO] fetch failed: {e}")
        return None

    # The DMO page is JS-rendered. A simple static fetch often returns
    # the shell without data; in that case we bail out.
    # If numeric yields are inlined, look for the benchmark table row.
    # Heuristic: find the phrase "10" near a yield pattern.
    m = re.search(r"10[- ]?year[^0-9]{0,40}([0-9]{1,2}\.[0-9]{2,3})\s*%", html, re.IGNORECASE)
    if m:
        return float(m.group(1)), "UK DMO (gilt-prices-and-yields page)"
    print("  [DMO] page fetched but no 10-year yield pattern matched")
    return None


def read_cache() -> Optional[dict]:
    if not CACHE_PATH.exists():
        return None
    try:
        with open(CACHE_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"  [cache] read failed: {e}")
        return None


def write_cache(payload: dict) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def main() -> int:
    print("UK 10-year gilt yield fetcher")
    print(f"  Cache: {CACHE_PATH}")

    today = date.today().isoformat()
    value: Optional[float] = None
    source: str = ""
    is_cached_fallback = False

    # Try sources in order
    for name, fn in [("Bank of England", fetch_boe), ("DMO", fetch_dmo)]:
        print(f"\n  Trying {name}...")
        res = fn()
        if res is not None:
            value, source = res
            print(f"  [OK] {name}: {value:.3f}%")
            break

    cache_age_days = 0
    if value is None:
        # Fall back to existing cache
        cached = read_cache()
        if cached and "yield_pct" in cached:
            value = float(cached["yield_pct"])
            source = cached.get("source", "cached fallback")
            is_cached_fallback = True
            try:
                prev_date = datetime.fromisoformat(cached.get("fetch_date", today)).date()
                cache_age_days = (date.today() - prev_date).days
            except Exception:
                cache_age_days = -1
            print(f"\n  [WARN] all live sources failed. Falling back to cached value {value:.3f}% "
                  f"(source: {source}, age: {cache_age_days}d)")
        else:
            print("\n  [ERROR] all live sources failed and no cache available.")
            print("  Writing a minimal cache with is_cached_fallback=true so downstream")
            print("  scripts can continue, but you should investigate the network.")
            payload = {
                "yield_pct": None,
                "fetch_date": today,
                "source": "no-source-available",
                "tenor": "10-year",
                "cache_age_days": -1,
                "is_cached_fallback": True,
                "error": "All live sources failed and no prior cache existed.",
            }
            write_cache(payload)
            return 2

    # Only overwrite cache if we got a fresh value (don't overwrite fresh cache with stale)
    if not is_cached_fallback:
        payload = {
            "yield_pct": round(value, 3),
            "fetch_date": today,
            "source": source,
            "tenor": "10-year",
            "cache_age_days": 0,
            "is_cached_fallback": False,
        }
        write_cache(payload)
        print(f"\n  [OK] wrote fresh cache: {value:.3f}% ({source}) on {today}")
    else:
        # Update the cache's cache_age_days in-place for visibility
        cached = read_cache() or {}
        cached["cache_age_days"] = cache_age_days
        cached["is_cached_fallback"] = True
        write_cache(cached)
        print(f"\n  Fresh fetch failed; cache unchanged at {cache_age_days}d age.")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(1)
