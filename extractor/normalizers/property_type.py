from typing import Any, Dict, Optional, Tuple


def normalize_property_type(raw_text: Any, mapping: Dict[str, Any]) -> Tuple[str, str]:
    """
    Returns: (canonical_type, confidence)
    confidence is one of: high | medium | low

    - high: exact/single strong match
    - medium: multiple matches or weaker cues
    - low: nothing matched
    """
    if raw_text is None:
        return ("", "low")

    text = str(raw_text).strip().lower()
    if text == "":
        return ("", "low")

    synonyms = mapping.get("synonyms", {})
    matches = []

    for canonical, keys in synonyms.items():
        for k in keys or []:
            k2 = str(k).strip().lower()
            if not k2:
                continue
            if k2 in text:
                matches.append(canonical)
                break

    if not matches:
        # If no match, keep original but flag low confidence? For now return Other/low.
        return ("Other", "low")

    # de-dup while preserving order
    seen = set()
    uniq = []
    for m in matches:
        if m not in seen:
            uniq.append(m)
            seen.add(m)

    if len(uniq) == 1:
        return (uniq[0], "high")

    # If multiple hits, Mixed Use is only valid if clearly mixed; otherwise choose first and mark medium.
    if "Mixed Use" in uniq:
        return ("Mixed Use", "medium")

    return (uniq[0], "medium")
