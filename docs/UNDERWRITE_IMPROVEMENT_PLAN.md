# Underwrite Improvement Plan — Richer Normalisation, Multi-Asset, Assumptions Layer & Hardcode Price

_Draft for review. Target implementer: Fable 5. Grounded in the Chancerygate underwrite workbook, the Newbury v21 model, and the current `underwrite/` + `extractor/` code._

---

## 1. How the pipeline works today (grounded)

```
Broker rent roll (any layout)
   │   e.g. "Tenancy Schedule CG" — 45 units across 3 assets, rich columns
   ▼
normalise_auto.normalise_auto()               [underwrite/engine/normalisers/normalise_auto.py]
   │   LLM maps columns → apply_mapping() extracts deterministically
   ▼
DealRR sheet  (~20 canonical fields, "field-dictionary" OLD-letter scheme)
   │
   ▼
inject_deal_v21.py  → copies DealRR into a copy of the pinned base MLI_v21_BASE.xlsx
   │   TENANCY SCHEDULE (template) rows 43+ are per-column formulas  =DealRR!<col><row>
   │   FIELD_MAP maps RR letter → template header (row 17), resolved by header not letter
   ▼
TENANCY SCHEDULE (template)  ── col B (Asset Name) ──► Tenancy Inputs col C
   │                                                        │
   │                                                        ▼
   │                              Cash Flow Output P5:P10 "ASSET REGISTER"
   │                              auto-dedups distinct asset names (INDEX/MATCH array),
   │                              Q5:Q10 = include toggle (1/0)
   ▼
Global Assumptions (NIY, Net Purchase Price D16, growth D4…) → Project Cashflow → returns
```

Modes: **Mode A** = parse + validate + flag (no LibreOffice). **Mode B** = inject → headless LibreOffice recalc → verify → returns. Tie-out anchor is `Global Assumptions!D16`.

**Key structural fact:** the template and the injector already support the *rich* column set (Rent Review NEF, ERV Growth, ERV £pa/£psf, Rateable Value, Business Rates, Service Charge, Void, Rent Free, Capex, Entry/Exit Yield, Break Taken, rent steps). The multi-asset asset register is already in the base. **The information is lost upstream, in `DealRR`.**

---

## 2. Root-cause diagnosis (per your complaints)

| # | Symptom (Chancerygate) | Root cause | Where |
|---|---|---|---|
| 1 | 3 assets collapsed into one "Chancerygate" | `normalise_auto` writes `Asset Name = <deal name>` for every row; ignores the broker's per-unit **Asset** column (E = Bourges View / Capital Park / Red Lion Road) | `apply_mapping()` sets `row["Asset Name"] = asset` (deal-level) |
| 2 | ERV wrong (used topped-up / passing rent) | When no ERV column exists, `apply_mapping` derives `ERV pa = ERV psf × area` and otherwise carries passing; here it fell back to passing/topped-up | `apply_mapping` ERV derivation |
| 3 | Break / vacate-at-expiry not reflected | Broker "Break Taken" (col O) and "Stay/Vacate" (col AR) not mapped; `Event @ Expiry` defaults to `Y` (renew) | field mapping + `Event @ Expiry` default |
| 4 | NEF, ERV growth, Void, Rent Free, Capex, Rateable Value, Business Rates, Service Charge, Entry/Exit Yield all blank | Not in `RR_COLS`; broker RR often doesn't carry them, and there is no clean way to add them | `RR_COLS` / no assumptions layer |
| 5 | "Deal RR is too reductionist" → template incomplete | DealRR is a lossy middle layer; template columns with no `DealRR` source stay empty | architecture |
| 6 | Per-unit flags clumsy | `apply_mapping` emits one flag per unit for analyst sign-off, but no structured entry mechanism | flags design |
| 7 | Purchase price always rent/yield-derived | `Global Assumptions!D16` is a `SUMPRODUCT` yield formula; no hardcode toggle | base model |

**On "link the broker rent roll directly to the template":** not recommended. Broker layouts vary wildly (every agent formats differently), so a normalised intermediate is architecturally necessary — it's what lets one template consume any broker sheet. The "(2)" template that links some columns straight to `Tenancy Schedule CG` is brittle and will break on the next deal. **The right fix is to make the intermediate lossless, not to bypass it.**

---

## 3. Proposed architecture

### A. Fuller, faithful `DealRR` (keep the intermediate; make it complete)
- **Preserve per-unit asset & region.** Map the broker's per-row Asset column → `DealRR` col B; derive region per asset. This alone fixes the multi-asset register (the CFO auto-dedups from Tenancy Inputs col C).
- **Carry every template-consumed column** when the broker provides it: NEF, ERV growth, real ERV (£pa/£psf), Rateable Value, Business Rates, Service Charge, Void, Rent Free, Capex, Entry/Exit Yield, Break Taken, Vacate-at-expiry.
- **Never fabricate ERV.** If the broker has no ERV, leave it `null` and mark it as a required assumption — do **not** copy passing/topped-up rent into ERV.
- Convert per-unit flags into a single **"missing required fields"** summary per deal/asset (what still needs analyst input), not a flag per unit.

### B. Deal Assumptions layer (the generalised replacement for per-unit flags)
A small, structured set the analyst fills **once** in the app; applied deterministically into DealRR/template. Three tiers, most-specific wins:

1. **Deal / portfolio default** — NEF, ERV growth %, assumed Void (mths), Rent Free (mths), Re-letting Capex (£psf), Entry Yield, Exit Yield.
2. **Per-asset override** — for each asset (Bourges View, Capital Park, Red Lion Road): entry/exit yield, Rateable Value / Business Rates / Service Charge where known.
3. **Per-unit override** — only the genuinely unit-specific calls, entered as a simple pick-list, e.g. "these units **break** at break date" and "these units **vacate** at lease end", rather than a flag on every row.

**NEF and ERV growth wire to model assumptions** (Global Assumptions), then cascade to template cols Q/R — matching how Newbury drives growth centrally.

Stored on the deal record as a new `underwrite_assumptions` block; injected before Mode B.

### C. Hardcode purchase price
Port Newbury's mechanism into the base:
- `Global Assumptions!G13` "Purchase Price Mode", `G14/G16` hardcoded input, `G15` mode flag ("Hardcoded" / "Yield-derived").
- `D16 = IF($G$15="Hardcoded", $G$16, <existing SUMPRODUCT yield formula>)`.
- Expose a **toggle + input** in the app's Assumptions step; injector writes the mode + value.

### D. Adopt Newbury v21 as the go-forward base
- Re-pin `underwrite/engine/base/MLI_v21_BASE.xlsx` to the Newbury v21 layout. The template's row-17 headers are unchanged, so `inject_deal_v21`'s header-resolved mapping keeps working; the only material addition is the hardcode-PP block, which the injector doesn't touch.
- Re-run the tie-out validation harness (GA D16 anchor + ICS error-free + consistency) after re-pinning.
- Strip the **West Craig** benchmark from live deals (it's a separate deal) — keep it only as a disabled asset-register row or remove it.

### E. Multi-asset toggles (P3:Q10)
Because the register auto-dedups from Tenancy Inputs col C, once DealRR carries the real asset names the 3 Chancerygate assets appear automatically with `Include = 1`. Give the analyst an **asset checklist** in the app that maps to `Q5:Q10` so they can include/exclude assets per scenario.

### F. Skill: `mli-underwrite`
A skill that encodes deep model knowledge and is applied when creating a new underwrite. Contents:
- Full model map (sheet-by-sheet, key cells and their meaning).
- The RR → DealRR → template → Tenancy Inputs → CFO chain and the field dictionary.
- The assumptions that must be filled, and exactly where each one wires.
- Hardcode-PP, multi-asset register, growth wiring.
- Tie-out checks (GA D16 anchor, ICS error-free) and the **"never fabricate a value"** rule.
- Complements the existing `btr-underwrite` skill (residential); this one is industrial/MLI.

---

## 4. Workstreams for implementation (file-level)

1. **`normalise_auto.py`** — per-unit asset/region; expand `RR_COLS` + mapping to the full template column set; remove ERV fabrication; map Break Taken + Stay/Vacate; carry NEF/growth/void/RF/capex/rates when present; replace per-unit flags with a missing-fields summary.
2. **New `underwrite_assumptions` schema + applier** — deal/asset/unit tiers; deterministic merge into DealRR (and GA growth cells) before inject.
3. **`extractor/underwrite_routes.py` + frontend "Assumptions" step** — UI for the three-tier assumptions, PP hardcode toggle+input, and asset-inclusion checklist.
4. **`inject_deal_v21.py`** — write GA hardcode-PP cells and asset-register toggles; confirm `FIELD_MAP` covers the newly-populated columns (most are already listed).
5. **Re-pin base to Newbury v21** + run the adapter verify/tie-out harness.
6. **New skill** `mli-underwrite` under the skills directory.

Suggested order: 1 → 2 → 4 → 5 (validate tie-out) → 3 (UI) → 6 (skill).

---

## 5. Confirmed decisions (locked)

1. **Assumptions granularity — full three-tier.** Deal-level defaults **+ per-asset overrides + per-unit overrides** (which units break / vacate at expiry). Build the most extensive version; NEF and ERV growth wire to Global Assumptions.
2. **Re-pin base to Newbury v21 now.** Swap `MLI_v21_BASE.xlsx` to the Newbury v21 layout (adds hardcode purchase price), then re-run the tie-out validation harness. Template row-17 headers are unchanged, so the header-resolved injector continues to work.
3. **Skill built after the pipeline changes land**, so `mli-underwrite` documents the final design accurately.

---

## 6. Implementation brief for Fable 5 (execution order)

1. **`normalise_auto.py`** — per-unit Asset Name + Region (fixes multi-asset flattening); expand `RR_COLS`/mapping to the full template column set; **remove ERV fabrication** (leave `null` when broker has no ERV); map Break Taken + Stay/Vacate; carry NEF/ERV-growth/Void/Rent-Free/Capex/Rateable/Rates/Service-Charge/Entry-Exit-Yield when present; replace per-unit flags with a per-deal/asset **missing-required-fields** summary.
2. **`underwrite_assumptions` schema + deterministic applier** — three tiers (deal → asset → unit, most-specific wins); merge into DealRR and write NEF/ERV-growth to Global Assumptions before Mode B.
3. **`inject_deal_v21.py`** — write GA hardcode-PP cells (`G13/G14/G15/G16`, `D16` IF) and asset-register toggles (`Q5:Q10`); confirm `FIELD_MAP` covers the newly-populated columns.
4. **Re-pin base to Newbury v21** — replace `underwrite/engine/base/MLI_v21_BASE.xlsx`; strip the West Craig benchmark; run the adapter verify/tie-out harness (anchor `Global Assumptions!D16`, ICS error-free, consistency).
5. **`extractor/underwrite_routes.py` + frontend Assumptions step** — UI for the three-tier assumptions, PP hardcode toggle+input, and asset-inclusion checklist.
6. **`mli-underwrite` skill** — encode the full model map, the RR→DealRR→template→TI→CFO chain, the field dictionary, where each assumption wires, tie-out checks, and the **never-fabricate** rule.

**Non-negotiables:** never invent a metric value (leave `null` + flag missing); keep the normalised intermediate (do not link broker sheet directly to the template); preserve the header-resolved injector; re-validate the tie-out anchor after re-pinning.
