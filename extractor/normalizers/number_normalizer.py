"""
Number normalization: convert abbreviated/formatted numbers to full integers or decimals.

Handles:
- Abbreviations: 1.5M, 500k, 2.3 million, 150 MSEK, 1.2 mdr
- European formats: 1 500 000 (space thousands), 1.500.000 (dot thousands)
- Currency prefixes/suffixes: SEK 1,500,000, €500k, 1.5M EUR
- Percentage values: 95%, 4.5%
- Decimal handling: preserves decimals for yields/percentages, integers for prices/areas
"""

import re
from typing import Any, Optional, Tuple, Union

# Multiplier mappings (case-insensitive)
MULTIPLIERS = {
    # Thousands
    "k": 1_000,
    "thousand": 1_000,
    "tusen": 1_000,  # Swedish
    "tusind": 1_000,  # Danish
    "tuhatta": 1_000,  # Finnish
    "tkr": 1_000,  # Swedish: tusen kronor (thousand kronor)
    # Millions
    "m": 1_000_000,
    "mn": 1_000_000,
    "mil": 1_000_000,
    "mill": 1_000_000,
    "million": 1_000_000,
    "millions": 1_000_000,
    "milj": 1_000_000,  # Swedish abbrev
    "miljoner": 1_000_000,  # Swedish
    "millioner": 1_000_000,  # Danish
    "miljoonaa": 1_000_000,  # Finnish
    "msek": 1_000_000,
    "mdkk": 1_000_000,
    "meur": 1_000_000,
    "mkr": 1_000_000,  # Swedish: miljoner kronor (million kronor)
    # Billions
    "b": 1_000_000_000,
    "bn": 1_000_000_000,
    "billion": 1_000_000_000,
    "mrd": 1_000_000_000,  # Swedish/Danish "miljarder"
    "mdr": 1_000_000_000,
    "miljarder": 1_000_000_000,
    "milliarder": 1_000_000_000,  # Danish
    "miljardia": 1_000_000_000,  # Finnish
}

# Currency symbols/codes to strip (use word boundaries for "kr" to avoid matching "tkr")
CURRENCY_PATTERNS = re.compile(
    r"(?:SEK|DKK|EUR|USD|NOK|GBP|\bkr\b|€|\$|£)\s*",
    re.IGNORECASE
)

# Unit suffixes to strip (area, percentage, etc.)
UNIT_PATTERNS = re.compile(
    r"\s*(?:m2|m²|sqm|kvm|square\s*meters?|kvadratmeter|år|years?|procent|percent)\s*$",
    re.IGNORECASE
)

# Common Swedish trailing descriptive phrases to strip (after the number + unit)
# These appear after the value and don't affect the numeric parsing
TRAILING_TEXT_PATTERNS = re.compile(
    r"\s+(?:uthyrningsbar\s+yta|total(?:t|a)?|underliggande(?:\s+\w+)*|köpeskilling|fastighetsvärde)\b.*$",
    re.IGNORECASE
)


def normalize_number(raw_value: Any, as_integer: bool = True) -> Tuple[Union[str, int, float], str]:
    """
    Normalize a number value, expanding abbreviations to full numbers.

    Args:
        raw_value: The raw input (string, int, float, etc.)
        as_integer: If True, return integer for whole numbers; if False, preserve decimals

    Returns: (normalized_value, confidence)
    - normalized_value: The parsed number (int or float), or "" if unparseable
    - confidence: "high" if parsed successfully, "low" if failed
    """
    if raw_value is None:
        return ("", "low")

    # Already a number?
    if isinstance(raw_value, (int, float)):
        if as_integer and float(raw_value).is_integer():
            return (int(raw_value), "high")
        return (raw_value, "high")

    text = str(raw_value).strip()
    if not text:
        return ("", "low")

    # Pre-process: strip common Swedish trailing descriptive phrases
    # This handles cases like "47,696 kvm uthyrningsbar yta" -> "47,696 kvm"
    text = TRAILING_TEXT_PATTERNS.sub("", text).strip()

    # Remove unit suffixes (m2, sqm, etc.)
    text = UNIT_PATTERNS.sub("", text).strip()

    # Remove currency symbols/codes
    text = CURRENCY_PATTERNS.sub("", text).strip()

    # Handle percentage symbol (but keep the number)
    is_percentage = "%" in text
    text = text.replace("%", "").strip()

    # Try to parse
    parsed = _parse_number_with_multiplier(text)
    if parsed is not None:
        # For percentages and yields, keep decimals
        if is_percentage or not as_integer:
            return (parsed if not float(parsed).is_integer() else int(parsed), "high")
        # For prices/areas, return integer if whole
        if float(parsed).is_integer():
            return (int(parsed), "high")
        return (parsed, "high")

    return ("", "low")


def normalize_yield(raw_value: Any) -> Tuple[Union[str, float], str]:
    """
    Normalize yield/percentage values. Always preserves decimals.
    Returns value as-is (e.g., 4.5 means 4.5%, not 0.045).
    """
    return normalize_number(raw_value, as_integer=False)


def normalize_area(raw_value: Any) -> Tuple[Union[str, int], str]:
    """
    Normalize area values (sqm). Always returns integer.
    """
    result, conf = normalize_number(raw_value, as_integer=True)
    if isinstance(result, float):
        return (int(round(result)), conf)
    return (result, conf)


def normalize_price(raw_value: Any) -> Tuple[Union[str, int], str]:
    """
    Normalize price values. Always returns integer (full number, no decimals).
    """
    result, conf = normalize_number(raw_value, as_integer=True)
    if isinstance(result, float):
        return (int(round(result)), conf)
    return (result, conf)


def _parse_number_with_multiplier(text: str) -> Optional[float]:
    """
    Parse a number string that may contain multipliers.

    Handles:
    - "1.5M" -> 1500000
    - "500 thousand" -> 500000
    - "1 500 000" -> 1500000
    - "1,500,000" -> 1500000
    - "1.500.000" -> 1500000 (European)
    """
    text = text.strip().lower()
    if not text:
        return None

    # Check for multiplier suffix
    multiplier = 1
    for suffix, mult in MULTIPLIERS.items():
        # Match suffix at end of string (with optional space)
        pattern = rf"([\d\s.,]+)\s*{re.escape(suffix)}$"
        match = re.match(pattern, text, re.IGNORECASE)
        if match:
            text = match.group(1).strip()
            multiplier = mult
            break

    # Also check for standalone multiplier words
    if multiplier == 1:
        for suffix, mult in MULTIPLIERS.items():
            if len(suffix) > 2:  # Only check word-length multipliers
                pattern = rf"([\d\s.,]+)\s+{re.escape(suffix)}s?$"
                match = re.match(pattern, text, re.IGNORECASE)
                if match:
                    text = match.group(1).strip()
                    multiplier = mult
                    break

    # Now parse the numeric part
    base_number = _parse_formatted_number(text)
    if base_number is not None:
        return base_number * multiplier

    return None


def _parse_formatted_number(text: str) -> Optional[float]:
    """
    Parse a formatted number string.

    Handles various formats:
    - "1500000" -> 1500000
    - "1,500,000" -> 1500000
    - "1 500 000" -> 1500000
    - "1.500.000" -> 1500000 (European thousands)
    - "1500.50" -> 1500.5 (decimal)
    - "1500,50" -> 1500.5 (European decimal)
    """
    text = text.strip()
    if not text:
        return None

    # Remove spaces (thousand separators in some formats)
    text = text.replace(" ", "")
    text = text.replace("\u00a0", "")  # non-breaking space

    # Determine decimal separator
    # Heuristic: if there's a single dot/comma near the end with 1-2 digits after, it's decimal
    # If there are multiple dots or commas, they're thousand separators

    dot_count = text.count(".")
    comma_count = text.count(",")

    if dot_count == 0 and comma_count == 0:
        # Plain integer
        try:
            return float(text)
        except ValueError:
            return None

    if dot_count == 1 and comma_count == 0:
        # Could be decimal (1500.50) or European thousands (1.500)
        parts = text.split(".")
        if len(parts[1]) <= 2:
            # Likely decimal
            try:
                return float(text)
            except ValueError:
                return None
        else:
            # Likely European thousands separator
            try:
                return float(text.replace(".", ""))
            except ValueError:
                return None

    if comma_count == 1 and dot_count == 0:
        # Could be European decimal (1500,50) or US thousands (1,500)
        parts = text.split(",")
        if len(parts[1]) <= 2:
            # Likely European decimal
            try:
                return float(text.replace(",", "."))
            except ValueError:
                return None
        else:
            # Likely US thousands separator
            try:
                return float(text.replace(",", ""))
            except ValueError:
                return None

    # Multiple separators - assume thousands separators
    # Remove all commas and dots, but check for trailing decimal
    if dot_count > 0 and comma_count > 0:
        # Mixed format - last separator is likely decimal
        # "1.500.000,50" or "1,500,000.50"
        last_dot = text.rfind(".")
        last_comma = text.rfind(",")

        if last_comma > last_dot:
            # European: dots are thousands, comma is decimal
            text = text.replace(".", "").replace(",", ".")
        else:
            # US: commas are thousands, dot is decimal
            text = text.replace(",", "")
    elif dot_count > 1:
        # Multiple dots = European thousands
        text = text.replace(".", "")
    elif comma_count > 1:
        # Multiple commas = US thousands
        text = text.replace(",", "")

    try:
        return float(text)
    except ValueError:
        return None
