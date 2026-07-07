# underwrite/engine/ - vendored MLI engine (pinned)

Self-contained copy of the proven MLI underwrite engine. Called by `underwrite/adapter.py`;
not imported by the React app. Built and validated in `C:\MLI`; vendored here so the framework
is version-controlled and deployable.

## Contents

| File | Role |
|---|---|
| `base/MLI_v21_BASE.xlsx` | **Pinned clean base (Newbury v21 layout, re-pinned 2026-07).** Carries the West Craig anchor row (register slot Q5, disabled) + a Newbury reference deal (overwritten on injection) + the **hardcode-purchase-price block** (GA `G13`/`G14` labels, `G15` mode flag, `G16` input; `D16 = IF($G$15="Hardcoded",$G$16,SUMPRODUCT(...))`). Anchor still ties out GA D16 = 8,203,713.29 when the register is flipped to West Craig only (Q5=1, Q6:Q10=0) with `G15` off "Hardcoded". Injection target. Previous West-Craig-only base kept as `base/MLI_v21_BASE.westcraig-backup.xlsx`. |
| `inject_deal_v21.py` | Header-driven injector. Resolves template columns BY HEADER, so it re-derives layout from the base (survives column moves). Writes a deal's units + wiring. |
| `verify.py` | Acceptance asserts + v21 checks (anchor tie-out, no text in array columns, ICS clean, guarantee column present). |
| `run_underwrite.py` | Headless recalc + returns extraction (legacy orchestrator). |
| `field_dictionary.md` | Broker-alias -> template-field reference (the normaliser keys off it). |
| `normalisers/` | Per-broker layout adapters (newbury_v3, cannon, meadow, generic rr) + `validate_and_write.py`. |

## Dependencies

- `openpyxl` (see repo requirements).
- **LibreOffice (`soffice`) on PATH** for Mode B recalc. The adapter forces a full
  recalc-on-load (`OOXMLRecalcMode=0`) and re-saves a faithful workbook.

## Re-cutting the pinned base (when the model evolves)

The base is a deliberate snapshot, decoupled from day-to-day model churn:

1. Take the latest signed-off `Newbury vNN.xlsx` from `C:\MLI`.
2. Do **not** hand-clear the reference deal rows: the injector overwrites Tenancy Inputs / template
   rows 48+ and clears col C/E beyond the deal, so any leftover reference rows contribute 0 to the
   totals (their include-factor `FV` resolves to 0 when col C is blank). Keep the per-unit cascade
   and the SRC row (row 60).
3. Confirm the base carries the hardcode-PP block (`G13`/`G14`/`G15`/`G16`, `D16` IF gate). The
   injector sets `G15`/`G16` per deal and defensively wraps `D16` if the gate is missing.
4. Re-pin: replace `base/MLI_v21_BASE.xlsx`, then re-run the tie-out harness — inject a small deal,
   recalc, flip the register to West Craig only (Q5=1, Q6:Q10=0) with `G15`="Yield-derived", and
   confirm GA D16 = 8,203,713.29 to the penny. `verify.py <recalc>` must PASS.
5. Bump this note.

The injector is header-driven, so a column move in the new base does **not** break the adapter
contract - but always re-run `verify.py` after a re-cut.

**Newbury v21 re-pin (2026-07) validation record:** raw base ties out to 8,203,713.29 with a full
`verify.py` PASS; injected 5-unit deal -> £5.35m yield-derived, 0 errors, no reference-row leakage;
3-asset deal -> all assets in the register with West Craig excluded; hardcode PP -> D16 = the input;
injected-model West Craig anchor -> 8,203,713.29 exact.

## Caveat (Excel-safety)

Headless LibreOffice **masks** some Excel errors (coerces text to 0 inside array formulas), so a
headless "0 errors" is necessary, not sufficient. The adapter computes `workbook_error_cells`
with the v21 verify logic; a final Excel `Ctrl+Alt+F9` review is the gold standard before any
number reaches an investment committee.
