# Template Field Dictionary — `TENANCY SCHEDULE (template)`

The target of normalisation. One row per **unit** (a tenant's demise), not per asset. The underwrite (`Tenancy Inputs`) reads from this sheet: template row `r` feeds TI row `r + 11` (template row 24 → TI row 35). Live deal rows start at **row 24**; rows 18–20 are worked examples (leave them, or clear before writing live data); the header is **row 17**.

Each entry below: **template column · field · required? · format · meaning · broker aliases seen in the wild · derivation/validation**.

Priority key:
- **REQUIRED** — the underwrite is wrong/blank without it.
- **MATERIAL** — materially moves the cashflow; populate whenever the schedule has it.
- **OPTIONAL** — metadata or has a safe default.

---

## Identity & classification

- **B · Asset Name · REQUIRED · text.** The property the unit belongs to. **Critical:** must match the Asset Register on `Cash Flow Output!P5:P30` *exactly* (character-for-character) or the per-unit Include toggle resolves to 0 and the unit silently drops out of every total. A new asset → add it to the register too. Aliases: "Asset", "Asset Name", "Property", "Scheme". Validation: list distinct asset names; flag any not present in the register.
- **C · Region · OPTIONAL · text.** Display/grouping only. Aliases: "Asset Region", "Postcode" (derive region from it), "Location".
- **D · Sector · OPTIONAL · text.** e.g. Industrial / Trade / Office. Aliases: "Type", "Use", "Sub-Type".
- **E · Unit Number · REQUIRED · text.** Unique within the asset. Aliases: "Unit", "Unit Number", "Demise", "Suite".
- **F · Tenant Name · MATERIAL · text.** "Vacant"/blank ⇒ likely Vacant @ Entry (see P). Aliases: "Tenant", "Tenant Name", "Occupier", "Lessee", "Name".
- **G · Area GIA (sq ft) · REQUIRED · number.** Gross internal area. Aliases: "Size (sq.ft)", "GIA (Sq Ft)", "Sq Ft (GIA)", "SF", "Area", "NIA". Validation: > 0; flag implausible (<100 or >1,000,000).

## Pricing & yields

- **H · Entry Yield (NIY) · REQUIRED · decimal (0.06 = 6%).** Net initial yield at acquisition. Aliases: "Entry Yield", "NIY", "Net Initial Yield". One value per asset is common — apply to all its units. Validation: 0.03–0.12.
- **I · Exit Yield · REQUIRED · decimal.** Aliases: "Exit", "Exit Yield", "Exit NIY". Validation: 0.03–0.12.
- **S · Passing Rent (£ pa) · REQUIRED · number.** Contracted rent currently payable. 0 if vacant. Aliases: "Rent (pa)", "Passing Rent", "Marketing Rent (p.a.)" (when let), "Rent p.a.", "Contracted Rent". Validation: psf = S/G should land ~£3–£40 for UK MLI/industrial; flag outliers.
- **T · ERV (£ pa) · REQUIRED · number.** Estimated rental value (market rent). Aliases: "ERV", "Headline Rent", "Headline ERVs (pa)", "Market Rent", "ERV - Next Lease". If only £psf given (col U), ERV = U × G. Validation: usually ERV ≥ passing (reversionary); flag ERV materially below passing.
- **U · ERV (£ psf) · OPTIONAL · number.** Used to derive T if £pa absent. Aliases: "ERV psf", "Headline ERVs (sqft)", "Marketing Rent (psf)".
- **V · Rateable Value (£) · OPTIONAL · number.** Aliases: "RV", "Rateable Value".
- **W · Business Rates (£ pa) · MATERIAL · number.** Void holding cost. Aliases: "Business Rates", "Rates Payable", "Rates (pa)". If only RV given, rates ≈ RV × UBR multiplier (ask).
- **X · Service Charge (£ pa) · MATERIAL · number.** Void holding cost. Aliases: "Service Charge", "SC", "Service Charge (pa)".

## Lease dates & events

- **J · Lease Start · REQUIRED · date.** Aliases: "Lease Start", "Start", "Commencement". Must be a real Excel date — never leave as broker text (see "Date handling").
- **K · Lease Expiry · REQUIRED · date.** Aliases: "Lease Expiry", "Expiry", "Lease End", "New Expiry" (post-renewal). Validation: K > J.
- **L · Break Date · MATERIAL · date (blank if none).** Tenant/landlord break option. Aliases: "Break", "Break Option", "Break Date". Validation: J < L < K.
- **M · Break Taken (1=Yes,0=No) · MATERIAL · 0/1.** Whether the break is exercised (lease ends at the break). Aliases: "Break Taken", "Vacating" (Y→1). **Derive** if absent: 1 if the schedule shows the unit vacating/ending at the break (break date ≈ lease end within ~2 days, or an explicit vacate flag), else 0.
- **N · Rent Review / MTM Date · REQUIRED · date.** Next rent review or mark-to-market. Aliases: "Rent Review", "Review", "MTM", "Mark to Market". If none, use a far-future date or lease expiry per house convention (ask). Validation: J ≤ N ≤ K.
- **O · Event @ Expiry (Y=Renew / X=Vacate) · REQUIRED · "Y"/"X".** What happens at lease end. Aliases: "Remain/Vacate" (Remain→Y, Vacate→X), "Vacating" (Yes→X), "Renew/Vacate". Drives the re-let vs void cascade.
- **P · Vacant @ Entry (Y/N) · REQUIRED · "Y"/"N".** Is the unit empty at acquisition? Aliases: explicit "Vacant" column, or derive: Y if no tenant AND passing = 0. Validation: if P="Y" then S should be ~0; if P="N" then S should be > 0 (else flag).

## Re-letting assumptions (on vacancy / lease event)

- **Q · Rent Review NEF · MATERIAL · decimal (e.g. 0.925).** Net effective factor applied at review/re-let. Aliases: "Rent Review Net Effective", "NEF", "Net Effective". Default ~0.95 if not given (ask).
- **R · ERV Growth to Lease Start (% pa) · MATERIAL · decimal.** Growth applied to ERV up to the (re-)letting date. Aliases: "Grow ERV to Lease Start", "ERV growth". Default = the deal rental growth (GA!D49, currently 4.5%).
- **Y · Assumed Void (mths) · MATERIAL · number.** Void period on re-letting. Aliases: "Void", "Letting Void", "Void Period", "Total Void". 0 if none.
- **Z · Assumed Rent Free (mths) · MATERIAL · number.** Incentive on re-letting. Aliases: "RF", "Rent Free", "Incentive". Note brokers often split incentives by *new letting* vs *renewal* — capture the one matching the Event @ Expiry.
- **AA · Re-letting Capex (£ psf) · MATERIAL · number.** Landlord capex on re-let. Aliases: "Capex", "Landlord Capex (sqft)", "Re-letting Capex". 0 if none.

## Rent steps (stepped/indexed leases — Anniesland-style)

- **AB–AK · Rent Step 1–10 Amount (£ pa) · OPTIONAL · number.** Contractual stepped rents.
- **AL–AU · Rent Step 1–10 Date · OPTIONAL · date.** Date each step takes effect. Pair amount AB↔date AL, AC↔AM, etc. Most deals have none; leave blank. Only fixed-uplift/indexed leases use these.

## Lease metadata & flags

- **AY · 1954 Act (Y/N) · OPTIONAL · "Y"/"N".** Security of tenure. Aliases: "1954 Act", "LTA 1954".
- **AZ · EPC Rating · OPTIONAL · text.** Aliases: "EPC", "EPC Rating".
- **BA · Lease WAULT (yrs) · OPTIONAL · number.** Aliases: "WAULT", "WAULT to Expiry". Usually derivable from dates; leave to the model if absent.
- **BB · Rent Review (Y/N) · OPTIONAL · "Y"/"N".** Whether the lease has reviews. Aliases: "Rent Review (Y/N)", "Indexation Type" (present→Y).
- **BC · Term Certain (mths) · MATERIAL · number.** Term certain for re-let leases. Aliases: "Term Certain", "Mark to Market (Years)" ×12. House default currently 36–59 mths (ask).
- **BD · Service Charge Cap (£ pa) · OPTIONAL · number.** Aliases: "SC Cap", "Service Charge Cap".

## Vendor rental guarantee (default OFF)

- **BE · Rental Guarantee (Y/N) · OPTIONAL · "Y"/"N" · default "N".** Whether the vendor bridges rent on a vacant unit. Aliases: "Rental Guarantee", "Vendor Guarantee", "Income Guarantee".
- **BF · Guarantee Rent (£ pa) · OPTIONAL · number.** Only if BE="Y".
- **BG · Guarantee Period (mths) · OPTIONAL · number.** Months from acquisition. Only if BE="Y".

---

## Date handling — read this, it has bitten this model before

Broker schedules often store dates as **text** ("Mar-25", "25/03/2032", "Q1 2027"). The underwrite uses `DATEVALUE`-style parsing that LibreOffice cannot reproduce — migrating a date field through a LibreOffice recalc froze blank dates and silently dropped £1.33m of Cannon rent. So:

- Parse every date field to a **real Python `datetime`** and write it as a true Excel date (the writer script does this).
- Never round-trip the populated file through a headless LibreOffice recalc to "fix" dates — open in Excel.
- If a date is genuinely ambiguous (e.g. "Mar-25" = Mar 2025 or 25 Mar?), flag it for the user rather than guessing.

## Mapping the four known brokers (worked synonym sets)

These are the real layouts already in the model — use them as the canonical examples of how messy inputs map:

- **West Craig** (header row 5): "Size (sq.ft)"→G, "Rent (pa)"→S, "Rent Review"→N, "Break Option"→L, "Remain/Vacate"→O, "Headline ERVs (pa)"→T, "Headline ERVs (sqft)"→U, "Void Period"→Y, "incentive (New letting)"/"incentive (lease renewal…)"→Z (pick by event), "Landlord Capex (sqft)"→AA.
- **Cannon** (header row 1): "GIA (Sq Ft)"→G, "Marketing Rent (p.a.)"→S, "ERV"→T, "NIY"→H, "Exit"→I, "Void"/"Letting Void"→Y, "RF"→Z, "Capex"→AA, "Break Date"→L, "Vacating"→O/M, "1954 Act"→AY, "EPC Rating"→AZ. *(Cannon's date columns are the ones that caused the text-date bug — be careful.)*
- **Meadow** (header row 1, the cleanest — the template was modelled on it): "Sq Ft (GIA)"→G, "Entry Yield"→H, "Exit Yield"→I, "Passing Rent"→S, "Headline Rent"→T, "Rent Free"→Z, "Total Void"/"Letting Void"→Y, "Grow ERV to Lease Start"→R, "Rent Review 1 Net Effective"→Q, "Mark to Market (Years)"→BC, "Break Taken (1=Yes,0=No)"→M, "Start"→J, "Expiry"/"New Expiry"→K, "Break"→L.
- **Anniesland** (header row 5, hardest — cryptic + positional, paired £pa/£PSF columns, merged headers): rely on position and the £pa/£PSF pairing; "SF"→G, the £pa rent columns→S/T, "1954 Act obligation"→AY. When headers are this ambiguous, show the user your proposed mapping with a few sample rows and confirm before writing.

## Cannon layout aliases (added 2026-06-03 — verified on the 28-unit MK estate)
Header **row 1**. Column → template mapping:
"GIA (Sq Ft)"→G, "NIY"→H, "Exit"→I, "Lease Start"→J, "Expiry"→K, "Break Date"→L,
"Break"(Y/N)→M (break taken), "Rent Review"→N, "Vacating"(Y/N)→O (Y→X vacate),
"Marketing Rent (p.a.)"→S **passing for let units; but the ERV/agreed rent for vacant & UO units**,
"ERV"(psf)→U and T=U×area, "Letting Void"→Y, "RF"→Z, "Capex"→AA (per-unit, blank→0 not 25!),
"1954 Act"(Inside/Outside)→AY(Y/N), "EPC Rating"→AZ, "Comments"→classifier.
Comments patterns seen: in-liquidation→vacant@entry; "Under Offer"+no dates→let from entry on
the agreed term (assume 5yr / yr-3 break not taken); "vendor to top up"/"half rent"→passing =
full marketing rent; "service charge capped"/"yard overage rentalised"→colour only.
Dates are **mixed text and real datetimes** — parse all to real datetimes.
Vacant@entry (Cannon basis): T/AA=ERV (capitalise on ERV); BF=guarantee£pa (→TI U, deducted
off PP); re-let void/RF = I8/I9. Capex (AA) only on the break/vacate re-let units.

## Meadow layout + rates/SC wiring (added 2026-06-03 — `scripts/normalise_meadow.py`)
Meadow header row 1, one estate at a time via `--asset-filter`. Map: A→B asset, B→C region,
C→E unit, D→F tenant, E→G area, G→H entry yield, H→I exit yield, L→J start, M→K expiry,
O→L break date, P→M break taken, Q→N review date, AJ→O event(Y/X), W→S passing, AA→T ERV£pa,
AC→U ERV£psf, **AD→V rateable value, AE→W business rates, AF→X service charge** (the RATES/SC
wiring), AU→Y void / AV→Z RF / AR→AA capex ("Assumed" cols; relet blanks default 9/6/£20).
Vacant tenant → P="Y" (ignore the break flag). Per-asset yields come straight from the schedule.
Rates(W)/SC(X) flow → TI AX/BB → the vacant-entry deduction AD (only bites on vacant@entry units).
