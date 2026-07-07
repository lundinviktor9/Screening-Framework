---
name: mli-underwrite
description: >-
  Underwrite UK industrial / multi-let (MLI) real-estate deals on the pinned Brunswick MLI v21
  Excel model. Use this skill WHENEVER the user wants to underwrite, model, or analyse an
  industrial / logistics / multi-let acquisition — a new deal from a broker tenancy schedule or
  rent roll, running a schedule through the house model, adapting assumptions (hold, exit yield,
  growth, void/rent-free, hardcode vs yield-derived purchase price), including/excluding assets in
  a portfolio, or fixing the model after manual edits. Triggers: "underwrite this MLI deal",
  "industrial rent roll", "multi-let estate", "run this through the MLI model", "Chancerygate /
  West Craig / Newbury / Cannon / Meadow", tenancy schedule with NIY/exit yield/ERV per unit, or a
  broker schedule that must become the house model. Complements btr-underwrite (residential); this
  one is industrial/MLI. Even if the user only shares a tenancy schedule and a price, use this skill.
---

# MLI Underwrite (Brunswick v21 model)

Underwrite industrial / multi-let deals by injecting a normalised rent roll into the **pinned v21
base** — never build a model from scratch, and never link a broker sheet straight to the template.
The base (`underwrite/engine/base/MLI_v21_BASE.xlsx`, Newbury v21 layout) carries a battle-tested
per-unit cash-flow engine, a West Craig anchor deal for tie-out, a multi-asset register, and a
hardcode-purchase-price block. Your job is to feed it the new deal's inputs through the
normalise → inject → recalc → verify pipeline.

## The one rule that matters most

**Never fabricate a value.** If the broker schedule does not carry a field, leave it `null` and
surface it as a *missing required field* for the analyst to set in the Assumptions step. Do not
copy passing/topped-up rent into ERV; do not invent yields, voids, rates, or NEF. A blank that
reaches the model contributes nothing — a fabricated number silently corrupts the price.

## The pipeline (read this before touching anything)

```
Broker tenancy schedule (any layout)
  │  normalise_auto.normalise_auto()  [underwrite/engine/normalisers/normalise_auto.py]
  │    Stage 1 (LLM): map COLUMNS only -> which source col holds each canonical field
  │    Stage 2 (code): read the real cells, parse deterministically, derive, validate
  ▼
DealRR sheet  (field-dictionary OLD-letter layout; row 1 headers, one row per UNIT)
  │  apply_assumptions.apply_assumptions()  [three-tier deal/asset/unit merge, FILL_BLANK/OVERRIDE]
  ▼
inject_deal_v21.py  -> copies DealRR into a copy of the pinned base + wires it
  │    TEMPLATE columns resolved BY HEADER (row 17), FIELD_MAP maps RR letter -> header
  │    per-unit Asset Name (col B) -> Tenancy Inputs col C -> CFO asset register (auto-dedup)
  │    hardcode-PP block (GA G13/G14/G15/G16, D16 IF); register toggles Q5:Q10
  ▼
headless LibreOffice recalc  ->  verify.py / adapter checks  ->  returns
```

Modes: **Mode A** = parse + validate + flag (no LibreOffice). **Mode B** = inject → recalc →
verify → returns. The tie-out anchor is `Global Assumptions!D16`.

`underwrite/adapter.py` orchestrates Mode B; `extractor/underwrite_routes.py` is the FastAPI
route + the app's 4-step stepper (upload → mapping & flags → **assumptions** → run).

## Workflow

### 1. Normalise the rent roll (lossless)

Run the schedule through `normalise_auto`. It preserves the broker's **per-unit Asset column**
(multi-asset portfolios keep their real asset names — do not collapse them to the deal name), and
carries the full template-consumed column set: NEF (Q), ERV growth (R), rateable value (V),
business rates (W), service charge (X), break-taken (M), event-at-expiry (O), void/RF/capex
(Y/Z/AA). Known layouts (Newbury/Cannon/Meadow) take a deterministic fast path; unknown layouts
use the LLM column-mapper. See `underwrite/engine/field_dictionary.md` for every broker alias.

Output: `DealRR` sheet + a **per-asset missing-required-fields summary** (`missing_required`) and
the list of distinct `assets`. Judgement calls (entry/exit yield) come back as deal-level pricing
flags, not one-flag-per-unit noise.

### 2. Fill the Assumptions layer (the analyst sets these ONCE)

The three-tier `underwrite_assumptions` block (schema:
`underwrite/schemas/underwrite_assumptions.schema.json`) is applied deterministically into DealRR
by `apply_assumptions.py` before injection. Precedence is **unit > asset > deal**.

- **Deal defaults**: NEF, ERV growth %, void (mths), rent-free (mths), re-letting capex (£psf),
  entry/exit yield, term certain. `erv_growth` also wires to `Global Assumptions!D49` (universal
  growth) so it cascades centrally.
- **Per-asset overrides**: entry/exit yield, rateable value / business rates / service charge for
  each asset (Bourges View, Capital Park, …).
- **Per-unit overrides** (pick-list, not a flag per row): `break_taken` → DealRR M=1 + event=X;
  `vacate_at_expiry` → event=X.

Write modes: **OVERRIDE** (entry/exit yield — a deliberate pricing call, written to every unit in
scope) vs **FILL_BLANK** (everything else — only populates cells the broker left empty; never
overwrites broker data). See `references/model-map.md` §Assumptions for the field → column map.

### 3. Purchase price — yield-derived or hardcoded

`Global Assumptions!D16 = IF($G$15="Hardcoded", $G$16, SUMPRODUCT(...))`.
- **Yield-derived** (default): `G15="Yield-derived"`; D16 = net cap of passing rent at NIY.
- **Hardcoded**: `G15="Hardcoded"`, `G16=<price>`; the injector writes both from `--pp-mode
  hardcoded --pp-value N` (or `pp_mode`/`pp_value` in the run request).

The injector defensively ensures the D16 IF gate exists on any base.

### 4. Multi-asset register (P5:Q10)

The CFO asset register (`P5:P10`) auto-dedups distinct asset names from Tenancy Inputs col C, in
first-appearance order: **West Craig (benchmark) → slot 5, then the deal's assets → 6+**. The
injector sets `Q5=0` (exclude West Craig) and `Q6..Q(5+k)=1` for the k deal assets; `--exclude-assets`
drops named assets from totals. Give the analyst an asset checklist mapping to these toggles.

### 5. Inject → recalc → verify

`adapter.run_mode_b(...)` copies DealRR into the base, applies entry-yield + three-tier
assumptions, injects, recalcs headless (LibreOffice), and runs the checks. Or run the injector
directly (`inject_deal_v21.py --base … --rr-sheet DealRR --asset … --entry YYYY-MM-DD --out …`).

### 6. Tie-out checks (non-negotiable — the number is worthless without them)

- **West Craig anchor**: flip the register to West Craig only (`Q5=1, Q6:Q10=0`) with
  `G15="Yield-derived"`, recalc, and confirm **`Global Assumptions!D16 = 8,203,713.29`** to the
  penny. `adapter._anchor_tieout_ok` does exactly this (and forces G15 off hardcode so a hardcoded
  deal still ties out).
- **Error-free**: no `#REF!/#VALUE!/#NAME?/#DIV/0!/#NUM!` cells (LibreOffice masks some Excel
  errors — a final Excel `Ctrl+Alt+F9` review is the gold standard before any number reaches an IC).
- **Full harness**: `python underwrite/engine/verify.py <recalc.xlsx>` must print `RESULT: PASS`.

If the anchor does not tie out after a base re-pin, STOP — a regression has been introduced.

## Files

- `underwrite/engine/base/MLI_v21_BASE.xlsx` — pinned base (Newbury v21 + hardcode-PP block).
- `underwrite/engine/normalisers/normalise_auto.py` — layout-agnostic normaliser (lossless DealRR).
- `underwrite/engine/apply_assumptions.py` — three-tier assumptions applier.
- `underwrite/engine/inject_deal_v21.py` — header-driven injector (PP + register toggles).
- `underwrite/engine/verify.py` — acceptance + v21 checks.
- `underwrite/engine/field_dictionary.md` — broker-alias → template-field reference.
- `underwrite/schemas/` — `tenancy_schedule.schema.json`, `assumptions.schema.json`,
  `underwrite_assumptions.schema.json`.
- `references/model-map.md` — the sheet-by-sheet, cell-by-cell map (read it before wiring).
