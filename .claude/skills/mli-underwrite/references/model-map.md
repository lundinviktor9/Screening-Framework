# MLI v21 model map

The cell-by-cell reference for `underwrite/engine/base/MLI_v21_BASE.xlsx` (Newbury v21 layout).
Read this before wiring anything. All row ranges are the pinned-base convention; the injector is
header-driven, so template **columns** may shift without breaking the contract — **rows** are fixed.

## §1 Sheets

| Sheet | Role |
|---|---|
| `Cash Flow Output` (CFO) | Headline returns, asset register (P5:Q10), dial cells (Q26/Q27/Q28/Q35/Q37). |
| `Global Assumptions` (GA) | Entry date, hold, net purchase price (D16), growth, hardcode-PP block. |
| `Tenancy Inputs` (TI) | The per-unit engine. One row per unit; reads the template. Array range 29:181. |
| `TENANCY SCHEDULE (template)` (TPL) | Normalisation target. Header row 17; deal rows 43+. Feeds TI. |
| `Income & Cost Schedule` (ICS) | Per-period income/cost build. Checked for the legacy guarantee term. |
| `Project Cashflow` (PCF) | Purchase-date wiring (H8/H9/J8). |
| `Next Buyer CF`, `BRE Economics`, `Summary Sheet` | Exit / promote / summary. |
| `<deal>` RR tabs, `West Craig`, `Cannon`, `Meadow`, … | Source rent-roll tabs (reference only). |

## §2 Row geometry (fixed)

- **TPL**: header **row 17**; worked examples 18–20; live deal input rows **43+** (`TPL_FIRST=43`).
- **TI**: header **row 28**; **West Craig anchor rows 29–47**; deal rows **48+** (`TI_FIRST=48`).
  Template row `r` feeds TI row `r+5` (`OFF=5`). Cascade source row **60** (`CASCADE_SRC_DEFAULT`)
  carries the live per-unit formulas the injector copies to every deal row.
- **Array range 29:181** (SUMPRODUCTs sum over this). Total rows are **184+**; Portfolio Totals **225**.
- Injecting a deal overwrites rows 48..(47+n) and clears col C/E for rows beyond the deal — a blank
  col C makes the include-factor `FV` resolve to 0, so leftover reference rows contribute nothing.

## §3 The RR field-dictionary OLD-letter scheme (DealRR + FIELD_MAP)

`DealRR` uses these column letters (row 1 = headers). `inject_deal_v21.FIELD_MAP` maps each RR
letter to the TPL **header** (resolved to a column via row 17). Do not renumber these — they are the
contract shared by the normaliser (`RR_COLS`), the injector (`FIELD_MAP`), the route (`GAP_FIELDS`)
and the assumptions applier (`FIELD_COL`).

| RR col | Field | | RR col | Field |
|---|---|---|---|---|
| B | Asset Name | | S | Passing Rent (£ pa) |
| C | Region | | T | ERV (£ pa) |
| D | Sector | | U | ERV (£ psf) |
| E | Unit Number | | V | Rateable Value |
| F | Tenant Name | | W | Business Rates (pa) |
| G | Area GIA (sq ft) | | X | Service Charge (pa) |
| H | Entry Yield (NIY) | | Y | Assumed Void (mths) |
| I | Exit Yield | | Z | Assumed Rent Free (mths) |
| J | Lease Start | | AA | Re-letting Capex (£ psf) |
| K | Lease Expiry | | AY | 1954 Act (Y/N) |
| L | Break Date | | AZ | EPC Rating |
| M | Break Taken (1/0) | | BB | Rent Review (Y/N) |
| N | Rent Review / MTM Date | | BC | Term Certain (mths) |
| O | Event @ Expiry (Y/X) | | BF | Guarantee Rent (£ pa) |
| P | Vacant @ Entry (Y/N) | | BG | Guarantee Period (mths) |
| Q | Rent Review NEF | | | |
| R | ERV Growth to Lease Start (% pa) | | | |

Exit Yield (I) is injected as `=RR!I{row}+'Cash Flow Output'!$Q$27` (schedule exit + shift).
Guarantee Rent is written as a numeric vacant-only column: `=IF($<vac>="Y",RR!BF{row},0)`.

## §4 Global Assumptions — the tie-out cells

| Cell | Meaning |
|---|---|
| `D5` | Acquisition / cashflow start date (injector sets from `--entry`). |
| `D8` | Hold length (months) = `Cash Flow Output!Q28`. |
| `D9` | Exit date = `EOMONTH(D5, D8-1)`. |
| **`D16`** | **Net purchase price (the tie-out anchor).** `=IF($G$15="Hardcoded",$G$16,SUMPRODUCT('Tenancy Inputs'!$AC$29:$AC$181,'Tenancy Inputs'!$FV$29:$FV$181)/(1+E19))`. |
| `D49` | Rental Growth (universal). Deal-level `erv_growth` wires here. |
| `E19` | Purchaser's costs (grosses the net cap). |
| `G13` | label "Purchase Price Mode". |
| `G14` | label "Hardcoded PP input (£)". |
| **`G15`** | **PP mode flag** — `"Hardcoded"` or `"Yield-derived"`. |
| **`G16`** | Hardcoded purchase price value (used only when `G15="Hardcoded"`). |

## §5 Cash Flow Output — register + dials + returns

- **Asset register**: `P5:P10` = distinct asset names (array INDEX/MATCH, auto-dedup from TI col C,
  West Craig first). `Q5:Q10` = include toggles (1/0). Injector: `Q5=0` (West Craig), `Q6..=1` per
  deal asset. `P11` is a note row.
- **Dials**: `Q26` hold (yrs), `Q27` exit-yield shift, `Q28` hold (mths, drives GA D8), `Q35`
  scenario (1–4), `Q37` LTV.
- **Returns**: `L17` unlevered IRR, `K18` net investor IRR, `J18` levered IRR, `J19` equity
  multiple, `L20` cash-on-cash, `E5` net exit price.

## §6 Tenancy Inputs — global params & the per-unit engine

Global params (top of sheet): `C10` model start (=GA D5), `C11` RR uplift % of ERV (≈0.95),
`C12` lease renewal % of ERV, `C13` lease vacate % of ERV, `C14` default void (mths), `C15`
incentive (mths). Per-unit columns of note (set by the injector per row `r`): `C` asset name,
`E` region, `AB` cap basis, `AC` net-cap contribution (→ D16 SUMPRODUCT), `AD` rent-free top-up,
`FV` include factor (0 when col C blank), `EU` exit value, `BF` guarantee, `DU` renewal flag.

## §7 Assumptions field → DealRR column (three-tier applier)

`apply_assumptions.FIELD_COL`:

| Assumption field | DealRR col | Write mode |
|---|---|---|
| `entry_yield` | H | OVERRIDE |
| `exit_yield` | I | OVERRIDE |
| `nef` | Q | FILL_BLANK |
| `erv_growth` | R | FILL_BLANK (+ GA D49 at deal tier) |
| `rateable_value` | V | FILL_BLANK |
| `business_rates` | W | FILL_BLANK |
| `service_charge` | X | FILL_BLANK |
| `void_mths` | Y | FILL_BLANK |
| `rent_free_mths` | Z | FILL_BLANK |
| `reletting_capex_psf` | AA | FILL_BLANK |
| `term_certain_mths` | BC | FILL_BLANK |
| unit `break_taken` | M=1 + O="X" | explicit |
| unit `vacate_at_expiry` | O="X" | explicit |

Precedence unit > asset > deal. `pct_fields` (nef, erv_growth, entry/exit yield) are percentage-
tolerant: `6.25 → 0.0625`, `0.0625 → 0.0625`.

## §8 Tie-out (the gate)

1. Register → West Craig only: `CFO Q5=1, Q6:Q10=0`; `GA G15="Yield-derived"`.
2. Headless recalc.
3. **`GA D16` must equal `8,203,713.29`** to the penny (`ANCHOR_TIEOUT` in adapter.py; `verify.py`
   ANCHOR_DEFAULT 8203713).
4. `verify.py <recalc>` → `RESULT: PASS`; zero workbook error cells.

Validation record for the 2026-07 Newbury v21 re-pin: raw base ties out + full verify PASS;
5-unit deal £5.35m yield-derived, 0 errors, no reference-row leakage; 3-asset deal shows all three
assets in the register with West Craig excluded; hardcode PP → D16 = the input; injected-model West
Craig anchor → 8,203,713.29 exact.
