# MLI Underwrite Engine - Integration Contract (v1)

How the MLI underwrite engine plugs into Screening-Framework-v1. This is the **contract**;
the engine wiring itself is built in a later slice. Status at bottom.

The underwrite is the **downstream, finer-grained stage** of the existing pipeline. The
pipeline answers *"is this deal worth looking at and where does it rank?"* (one row per deal,
in `src/data/deals.json`). The underwrite answers *"if we run it, what does it return?"*
(one row per unit -> a populated PGIM model -> IRR / MOIC / Cash-on-Cash).

---

## 1. Where it sits in the real codebase

The framework today (see `extractor/`): `pdf_reader -> extractor.extract_inbound_uk ->
market_matcher -> profile_generator -> persistence.DealStore`, served by `extractor/server.py`
(FastAPI, port 8787), writing deal records to `src/data/deals.json`. Each record is keyed by
`deal_id` and carries `extracted_fields`, `market_ids`, and a fit score - but no returns.

The underwrite engine adds a parallel stage that, given a **tenancy schedule** + a `deal_id`,
produces returns and **stamps them onto the existing deal record** via
`DealStore.update(deal_id, {"underwrite": {...}})`. The pipeline stays untouched; the engine
is a self-contained module the framework calls.

```
            existing pipeline (one row per deal)
  PDF  ->  extract  ->  match  ->  profile  ->  deals.json[deal_id]
                                                     |
                                                     |  same deal_id
                                                     v
  tenancy schedule (one row per unit)  ->  UNDERWRITE ENGINE  ->  deals.json[deal_id].underwrite
        (Mode A: normalise + classify + flag)     |
        (Mode B: populate model + return)         +-- returns.json + populated .xlsx artifact
```

---

## 2. Engine location - vendored (decided 2026-06-09)

The engine is **vendored into this repo** under `underwrite/engine/` so the framework is
self-contained, version-controlled and deployable (not dependent on an external `C:\MLI`).

```
underwrite/
  schemas/
    tenancy_schedule.schema.json     # one row per unit (DONE)
    assumptions.schema.json          # deal-level dials (DONE)
  INTERFACE.md                       # this file
  engine/                            # VENDORED (next slice)
    base/MLI_v21_BASE.xlsx           # pinned clean base (ties out West Craig 8,203,713.29)
    inject_deal_v21.py               # header-driven injector (re-derives layout from the base)
    verify.py                        # acceptance asserts + v21 checks
    normalisers/                     # broker-layout adapters
    run_underwrite.py                # headless recalc + returns extraction
    field_dictionary.md              # broker-alias -> template-field reference
  adapter.py                         # framework-facing wrapper (next slice): run_mode_a / run_mode_b
```

**Pinned base + header-driven injector = decoupled from model churn.** The base is a deliberate
snapshot; the model can keep evolving in `C:\MLI` and we re-cut + bump the base when ready. The
injector resolves template columns *by header*, so a column move in a future base does not break
the contract. Re-cut procedure lives with the engine (cut from the latest `Newbury vNN`, strip
the deal rows, keep the West Craig anchor, verify the tie-out).

---

## 3. The call interface

A single deal:

```jsonc
// input
{
  "deal_id": "be133cc37e1816b9",          // SAME id as the deals.json row (round-trips back)
  "tenancy_schedule": "<path to xlsx/csv/pdf>",
  "assumptions": { /* per assumptions.schema.json; omitted keys use house defaults + flag */ }
}
```

### Mode A - parse + classify + flag (the v1 scope; no recalc)

```jsonc
{
  "deal_id": "be133cc37e1816b9",
  "mode": "A",
  "template_xlsx": "<path>",               // normalised TENANCY SCHEDULE (template)
  "units": 18,
  "flags": [
    { "unit": "Unit 4", "signal": "vacant@entry", "treatment": "capitalise headline rent",
      "assumption": "void 12 / RF 3", "needs_signoff": true },
    { "unit": "Unit 9", "signal": "under_offer", "treatment": "let from agreed start",
      "needs_signoff": true }
  ],
  "schema_errors": []                       // validation failures against tenancy_schedule.schema.json
}
```

**Human-in-the-loop is mandatory for v1**: Mode A surfaces the flags and pauses. The framework
must NOT auto-advance to Mode B without analyst sign-off.

### Mode B - populate + return (after sign-off)

```jsonc
{
  "deal_id": "be133cc37e1816b9",
  "mode": "B",
  "model_xlsx": "<path to populated workbook>",
  "returns": {
    "net_purchase_price": 8350000, "unlevered_irr": 0.1641, "net_investor_irr": 0.1680,
    "equity_multiple": 1.86, "cash_on_cash": 0.0671, "exit_price_gross": 0, "exit_price_net": 0
  },
  "checks": { "pass": true, "anchor_tieout_ok": true, "workbook_error_cells": 0 }
}
```

The object written onto the deal record is `deals.json[deal_id].underwrite`, holding the Mode B
`returns` + `checks` + a pointer to the `model_xlsx` and the Mode A `flags`.

---

## 4. Proposed server endpoints (extractor/server.py, next slice)

- `POST /underwrite/{deal_id}` - multipart upload of a tenancy schedule -> runs Mode A -> returns
  flags; persists `deals.json[deal_id].underwrite = {status:"flagged", flags, template_xlsx}`.
- `POST /underwrite/{deal_id}/run` - body = confirmed `assumptions` + flag resolutions -> runs
  Mode B -> persists `underwrite.returns` + `checks`; sets `underwrite.status = "underwritten"`.
- `GET /underwrite/{deal_id}` - the current underwrite block.
- React: an "Underwriting" panel on the deal detail / Pipeline tab reads `deal.underwrite`.

---

## 5. Rules the framework must honour

- **deal_id threads through** every artifact so the underwrite is traceable to its deal-list row.
- **Human-in-the-loop**: Mode A flags must be surfaced and signed off before Mode B.
- **No false precision**: if `checks.pass` is false, treat `returns` as invalid (do not display).
- **Schema-driven**: the normaliser validates the broker file against `tenancy_schedule.schema.json`;
  the runner validates `assumptions.schema.json`. Missing dials fall back to house defaults and
  are flagged.
- **Excel-safety caveat (learned)**: headless LibreOffice recalc *masks* some Excel errors
  (coerces text to 0 inside array formulas). `checks.workbook_error_cells` must be computed with
  the v21 verify logic, and a final Excel `Ctrl+Alt+F9` review is the gold standard before any
  number is shown to an investment committee.
- **Keep outputs OUTSIDE OneDrive-synced folders** (sync corrupts/dehydrates xlsx mid-write).

---

## 6. Validate against the eval set

The Mode A/B output must be checked against the four completed deals before broader use:
**West Craig** (already deal `be133cc37e1816b9` in deals.json - the natural first end-to-end
demo), **Newbury**, **Meadow**, **Cannon**. West Craig is also the frozen tie-out anchor
(GA D16 = 8,203,713.29).

---

## Status

- [x] `tenancy_schedule.schema.json` - one row per unit, 32 fields, 7 judgement-call flags.
- [x] `assumptions.schema.json` - 18 deal-level dials with house defaults + flags.
- [x] This contract, grounded in the real `extractor/` + `deals.json` code.
- [x] Vendored `underwrite/engine/` (pinned base + injector + verify + normalisers + runner).
- [x] `underwrite/adapter.py` exposing `run_mode_a` / `run_mode_b` - smoke-tested end-to-end:
      Mode A flags the vacant/break units (0 schema errors); Mode B returns NetPP 8.8