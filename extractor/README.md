# Deal-pipeline extractor (Task 1)

UK-only PDF → structured deal row. Ported from the sibling
`nordics-real-estate-automation` repo; non-UK paths stripped.

See [`DEAL_PIPELINE_INTEGRATION_PLAN.md`](../DEAL_PIPELINE_INTEGRATION_PLAN.md)
for the full 7-task plan. This directory implements **Task 1 only**.

## Install

```bash
cd <repo root>
python -m pip install -r extractor/requirements.txt
```

## Configure

The Nordic sibling repo ships only a `.env.example` (no populated `.env`).
Create your own:

```bash
cp extractor/.env.example extractor/.env
# then edit extractor/.env and set ANTHROPIC_API_KEY=sk-ant-...
```

Alternative: export `ANTHROPIC_API_KEY` in your shell — `extract_inbound_uk`
picks it up from the environment if no explicit key is passed.

## Quick verification (Gate 1 — no API call)

```bash
python -c "from extractor.pdf_reader import read_pdf; from extractor.extractor import extract_inbound_uk; from extractor.normalizer import normalize_inbound_uk_row; print('imports ok')"
```

Expected: `imports ok`.

## Live extraction (Gate 2 — one Claude API call)

Place a UK IM/teaser PDF in the project root's `deals_inbox/` directory,
then from the project root:

```bash
python extractor/run_once.py deals_inbox/YOUR_FILE.pdf
```

Or inline:

```bash
python -c "
import json
from dotenv import load_dotenv
load_dotenv('extractor/.env')
from extractor.pdf_reader import read_pdf
from extractor.extractor import extract_inbound_uk
from extractor.normalizer import normalize_inbound_uk_row

text = read_pdf('deals_inbox/YOUR_FILE.pdf')
raw, raw_meta = extract_inbound_uk(text)
normed, norm_meta = normalize_inbound_uk_row(raw, property_map={})
print(json.dumps(normed, indent=2, default=str))
"
```

Expected: non-null `Project Name`, `Location`, `Country = "United Kingdom"`,
partially populated financial fields, coherent `Comment`.

## Public surface

```python
from extractor.pdf_reader import read_pdf                        # PDF → str
from extractor.extractor import extract_inbound_uk, Extractor    # str → extracted dict + metadata
from extractor.normalizer import normalize_inbound_uk_row        # dict → normalized dict + per-field confidence
```

## What Task 1 does NOT do

- Match the extracted row to a market in `scrapers/config/markets.json` — Task 3
- Generate a microlocation fit score or narrative — Task 4
- Persist to `src/data/deals.json` — Task 4
- Expose a FastAPI endpoint — Task 5
- Any React / TypeScript changes — Tasks 6–7

## Files

```
extractor/
├── __init__.py
├── README.md                 ← this file
├── pdf_reader.py             ← Nordic src/fetch/pdf_reader.py (verbatim)
├── extractor.py              ← Nordic src/extract/extractor.py, non-UK paths stripped
├── prompts.py                ← Nordic src/extract/prompts.py, only INBOUND_UK_* kept
├── normalizer.py             ← Nordic src/normalize/row_normalizer.py, UK row only
├── normalizers/              ← field-level normalizers (unused modules removed 2026-07-05)
│   ├── __init__.py
│   ├── city_normalizer.py
│   ├── number_normalizer.py
│   └── property_type.py
├── schemas/
│   └── inbound_uk.schema.json
├── requirements.txt
└── .env.example              (populate .env separately)
```
