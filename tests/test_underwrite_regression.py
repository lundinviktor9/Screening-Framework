#!/usr/bin/env python3
"""
Golden-regression harness for the MLI underwrite engine.

Locks in the numbers that matter so any future change to the engine, injector, or normalisers
that moves a result fails loudly:
  - West Craig ANCHOR tie-out: GA D16 == 8,203,713.29 (the frozen invariant).
  - Newbury / Cannon / Meadow Mode B returns == stored snapshots (within tolerance), with
    checks.pass, anchor_tieout_ok, and 0 workbook error cells.

The deals run from committed canonical-RR fixtures in tests/fixtures/, so this is fully
self-contained (no dependency on C:\\MLI). Each run also re-verifies the anchor internally.

Usage:
    python tests/test_underwrite_regression.py            # check against stored snapshots
    python tests/test_underwrite_regression.py --update   # (re)capture snapshots after an
                                                           # INTENTIONAL engine change
Requires LibreOffice (soffice) on PATH. Run locally; there is no time limit there.
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
from underwrite import adapter as uw  # noqa: E402

FIX = REPO / "tests" / "fixtures"
SNAP = REPO / "tests" / "underwrite_snapshots.json"
ANCHOR = 8203713.29
RET_TOL = 5e-4          # absolute tolerance on IRR/EM/CoC ratios
PRICE_TOL = 1.0         # GBP tolerance on net_purchase_price / exit price

ASSUMPTIONS = {"hold_years": 5, "exit_yield": 0.0625, "rental_growth": 0.045,
               "ltv": 0.0, "entry_date": "2026-06-30"}

DEALS = {
    "newbury": {"fixture": "newbury_canonical_rr.xlsx",
                "asset": "River Park Industrial Estate, Newbury", "region": "Newbury"},
    "cannon":  {"fixture": "cannon_canonical_rr.xlsx",
                "asset": "Cannon Industrial Estate, Milton Keynes", "region": "Milton Keynes"},
    "meadow":  {"fixture": "meadow_canonical_rr.xlsx",
                "asset": "Meadow Portfolio", "region": "South East"},
}

PRICE_KEYS = {"net_purchase_price", "net_exit_price"}


def _run(deal: str) -> dict:
    d = DEALS[deal]
    return uw.run_mode_b(deal, str(FIX / d["fixture"]), "RR", d["asset"], d["region"],
                         ASSUMPTIONS["entry_date"], assumptions=ASSUMPTIONS)


def update() -> int:
    snaps = {"assumptions": ASSUMPTIONS, "anchor": ANCHOR, "deals": {}}
    for deal in DEALS:
        r = _run(deal)
        if not r["checks"]["pass"]:
            print(f"  ! {deal}: checks did NOT pass; not snapshotting a bad run: {r['checks']}")
            return 1
        snaps["deals"][deal] = {"returns": r["returns"], "checks": r["checks"]}
        print(f"  captured {deal}: unlev={r['returns']['unlevered_irr']:.4f} checks={r['checks']}")
    SNAP.write_text(json.dumps(snaps, indent=2, default=str))
    print(f"\nWrote {SNAP}")
    return 0


def _close(a, b, tol):
    try:
        return abs(float(a) - float(b)) <= tol
    except (TypeError, ValueError):
        return a == b


def check() -> int:
    if not SNAP.exists():
        print("No snapshots yet. Run with --update first (after confirming the numbers).")
        return 2
    snaps = json.loads(SNAP.read_text())
    failures = []
    for deal, d in DEALS.items():
        r = _run(deal)
        exp = snaps["deals"].get(deal, {})
        ck = r["checks"]
        if not ck["pass"]:
            failures.append(f"{deal}: checks.pass is False ({ck})")
        if not ck["anchor_tieout_ok"]:
            failures.append(f"{deal}: anchor tie-out FAILED")
        if ck["workbook_error_cells"] != 0:
            failures.append(f"{deal}: {ck['workbook_error_cells']} workbook error cells")
        for k, ev in (exp.get("returns") or {}).items():
            tol = PRICE_TOL if k in PRICE_KEYS else RET_TOL
            if not _close(r["returns"].get(k), ev, tol):
                failures.append(f"{deal}.{k}: got {r['returns'].get(k)} expected {ev} (tol {tol})")
        print(f"  {deal}: unlev={r['returns']['unlevered_irr']:.4f} "
              f"EM={r['returns']['equity_multiple']:.3f} checks_pass={ck['pass']}")
    if failures:
        print("\nFAIL:")
        for f in failures:
            print("  -", f)
        return 1
    print("\nALL REGRESSION CHECKS PASS")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--update", action="store_true", help="(re)capture snapshots after an intentional change")
    a = ap.parse_args()
    sys.exit(update() if a.update else check())
