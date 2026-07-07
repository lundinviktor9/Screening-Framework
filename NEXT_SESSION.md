# NEXT SESSION — MLI Underwrite (handover)
_Last updated: 2026-06-10. Repo now lives at `C:\Screening Framework` (off OneDrive)._

Paste this into Claude Code (recommended for hands-on work) or Cowork to pick up.

---

## TL;DR status
The MLI underwrite stage is **built, committed, and proven end-to-end**. The engine recalcs the
populated Excel model with **headless LibreOffice**. In the last session all three eval deals tied
out through Mode B (checks.pass, anchor tie-out, 0 error cells):
- Newbury (auto/known mapping): Unlevered IRR ≈ 15.7%
- Cannon (hand adapter): ≈ 15.2%
- Meadow portfolio (hand adapter, 39 units): ≈ 18.0%

The app shows the underwrite UI from the **Pipeline tab → "Underwrite" button on a deal row →
drawer** (upload rent roll → review mapping + flags → assumptions → Run → returns card + checks
badge + model download + run history).

## ⚠️ IMMEDIATE BLOCKER — install LibreOffice (one-time, free)
"Run underwrite" currently fails with `Mode B failed: [WinError 2] ... cannot find the file
specified`. That is **`soffice` (LibreOffice) not installed / not on PATH** on this PC.
1. Install LibreOffice: https://www.libreoffice.org/download/  (defaults are fine)
2. Add `C:\Program Files\LibreOffice\program` to the system PATH.
3. New terminal → `soffice --version` must print a version.
4. Restart `npm run extractor`, click Run again. Done — no other infra is missing.

## How to run
```
cd "C:\Screening Framework"
npm run dev          # React, http://localhost:5173
npm run extractor    # FastAPI, http://localhost:8787   (needs LibreOffice for Mode B)
```
Read first: `CLAUDE.md`, `TASKS.md`, `underwrite/INTERFACE.md`.

## Environment notes (important)
- Repo is at `C:\Screening Framework` — **local, NOT OneDrive**. Keep it that way; OneDrive caused
  truncated/locked files all last session.
- The old `C:\Users\vilu\Dokument\Screening-Framework-v1` was a leftover copy; its contents were
  cleared. Delete the empty folder in File Explorer if it's still there. Do not work in it.
- **Prefer Claude Code for coding** (edits host files directly, runs npm/tsc/git with your
  credentials — no sandbox mount lag, can build/commit/push itself). Use Cowork for
  questions/research/review/design and document generation.
- Git identity is set in this repo. Commit + push via GitHub Desktop or Claude Code.

## Uncommitted right now — COMMIT THESE
Last session's "Underwrite button + drawer wiring" fix is uncommitted:
- `src/components/pipeline/PipelineTab.tsx`  (renders DealProfileDrawer on selected deal)
- `src/components/pipeline/EditableDealTable.tsx`  ("Underwrite" button per row)
Commit them (host files are complete and correct). Pre-existing data changes (`deals.json`,
scraper outputs, etc.) remain uncommitted on purpose — commit separately if wanted.

## What's done & committed (commit 3e3faac + the regression-harness commit)
- FastAPI endpoints (`extractor/underwrite_routes.py`, wired in `server.py`):
  `POST /underwrite/{id}` (upload→normalise→Mode A flags), `/confirm-mapping`, `/run` (Mode B),
  `GET /underwrite/{id}`, `/history`, `/model[?version=N]`.
- Hybrid normaliser `underwrite/engine/normalisers/normalise_auto.py`: hand-adapter fast path →
  known column-map → LLM mapping. Header detection widened (Newbury header is row 11).
- Hand adapters `underwrite/engine/normalisers/hand_adapters.py` (Cannon 28/28, Meadow 39/39 vs
  trusted), with a guard so full models don't mis-dispatch.
- Entry-yield dial wired pre-injection (`underwrite/adapter.py`).
- Audit trail: every flag carries a `rationale`; first run frozen as immutable `baseline`; every
  run versioned with `vs_baseline`/`vs_previous` assumption diffs + analyst `note`; flag
  resolutions persisted.
- React `UnderwritingPanel.tsx` (upload, mapping + 3 sample rows, per-flag sign-off + notes,
  assumptions form, Run, returns card + checks badge, model download, run history).
- Batch CLI `extractor/underwrite_batch.py` — run propose_mapping over many broker files for review.
- Golden-regression harness `tests/test_underwrite_regression.py` + fixtures. Run
  `python tests/test_underwrite_regression.py --update` once locally to capture snapshots
  (verify ~15.7 / 15.2 / 18.0), commit `tests/underwrite_snapshots.json`, then it guards the numbers.

## Outstanding tasks (priority order)
1. **Install LibreOffice** (above) and confirm Run works end-to-end on a real rent roll.
2. **Commit** the two uncommitted UI files; capture + commit regression snapshots.
3. **Split Underwrite into its own sidebar tab** (separate from Pipeline). Sidebar:
   `src/components/layout/Sidebar.tsx`; routing: `src/App.tsx`; add `src/pages/UnderwritePage.tsx`
   listing deals → select → UnderwritingPanel/DealProfileDrawer. Keep Pipeline for extraction.
4. **Fix number formats in deal profiles**: GIA thousands-comma (28,000); yields as % (6.25%);
   deal value full comma form (28,000,000, not £28m). Files: `EditableDealTable.tsx` (use the
   full-comma formatter), `DealProfileDrawer.tsx` Key Financials. Use
   `Intl.NumberFormat('en-GB',{maximumFractionDigits:0})`.
5. **Run-button UX**: it is disabled until BOTH sign-off checkboxes are ticked AND entry date set —
   make that obvious (helper text / tooltip), add a spinner + "~30s LibreOffice recalc" note, and
   surface the /run error text in the panel.
6. **Backlog**: live-LLM mapping hardening on real brokers (`python -m extractor.underwrite_batch
   <folder>`); exit-yield/hold sensitivity strip on the returns card; fix the latent metric-weight
   scoring bug noted in CLAUDE.md; final Excel Ctrl+Alt+F9 check before any IC number.

## Conventions to honor
- Human-in-the-loop is mandatory: don't remove the mapping + flag sign-off gate before Mode B.
- No false precision: never display returns when `checks.pass` is false.
- Values come from the model cells, never the LLM (the LLM only maps layout).
- Engine source of truth is `C:\MLI`; the repo's pinned base is a deliberate snapshot — re-cut
  per `underwrite/engine/README.md`, don't let them drift.
- Headless LibreOffice masks some Excel errors; `checks.workbook_error_cells` uses the v21 verify
  logic, but a final Excel Ctrl+Alt+F9 is the gold standard before any IC number.
