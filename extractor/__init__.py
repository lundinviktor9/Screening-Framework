"""
Deal-pipeline extractor — UK-only PDF → structured deal row.

Ported from sibling repo `nordics-real-estate-automation` as Task 1 of
the deal-pipeline integration. See DEAL_PIPELINE_INTEGRATION_PLAN.md for
the full 7-task plan.

Public surface:
    from extractor.pdf_reader import read_pdf
    from extractor.extractor import extract_inbound_uk, Extractor, ExtractionError
    from extractor.normalizer import normalize_inbound_uk_row
"""
