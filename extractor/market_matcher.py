"""
Market matching for extracted deal locations.

Three-tier matching strategy:
1. Primary: exact case-insensitive match against market names + aliases
2. Postcode: map postcode prefix (first 1-2 chars) to market
3. Fuzzy: token overlap or Levenshtein distance against market names

Returns confidence scores:
  >= 0.9: auto-match
  0.5-0.9: uncertain (user review)
  < 0.5: unmatched (show market picker)
"""

import json
import os
from typing import Optional, Tuple, List
from pathlib import Path


class MarketMatcher:
    """Match extracted deal locations to screening matrix markets."""

    def __init__(self, markets_config_path: str, postcode_map_path: str):
        """
        Initialize matcher with market configs.

        Args:
            markets_config_path: Path to scrapers/config/markets.json
            postcode_map_path: Path to extractor/postcode_area_to_market.json
        """
        with open(markets_config_path) as f:
            self.markets = json.load(f)  # dict of market_id -> {name, region, aliases, ...}

        with open(postcode_map_path) as f:
            self.postcode_map = json.load(f)  # dict of prefix -> market_id

        # Build lookup dicts
        self.market_names = {}  # lowercase name -> market_id
        self.market_aliases = {}  # lowercase alias -> market_id
        self.market_by_id = self.markets  # market_id -> market data

        for market_id, market_data in self.markets.items():
            name = market_data["name"].lower()
            self.market_names[name] = market_id

            # Add aliases
            for alias in market_data.get("aliases", []):
                self.market_aliases[alias.lower()] = market_id

    def match(
        self, location: Optional[str], postcode: Optional[str]
    ) -> Tuple[List[str], float, str]:
        """
        Match a location + postcode to market(s).

        Args:
            location: Extracted 'Location' field (e.g., "Edinburgh", "Greater London")
            postcode: Extracted 'Postal code' field (e.g., "EH12 0BD")

        Returns:
            Tuple of:
              - market_ids: list of matched market IDs (empty if no match)
              - confidence: 0.0-1.0
              - method: which tier matched (exact, postcode, fuzzy, unmatched)
        """
        if not location and not postcode:
            return [], 0.0, "unmatched"

        # Tier 1: Exact match on location
        if location:
            location_lower = location.lower()
            if location_lower in self.market_names:
                market_id = self.market_names[location_lower]
                return [market_id], 1.0, "exact_name"

            if location_lower in self.market_aliases:
                market_id = self.market_aliases[location_lower]
                return [market_id], 1.0, "exact_alias"

            # Check for multi-market portfolio (e.g., "Tolworth; Edinburgh; Peterborough")
            if ";" in location or "," in location:
                sep = ";" if ";" in location else ","
                locations = [l.strip() for l in location.split(sep)]
                matched_ids = []
                all_exact = True
                for loc in locations:
                    loc_lower = loc.lower()
                    if loc_lower in self.market_names:
                        matched_ids.append(self.market_names[loc_lower])
                    elif loc_lower in self.market_aliases:
                        matched_ids.append(self.market_aliases[loc_lower])
                    else:
                        all_exact = False
                if matched_ids and len(matched_ids) == len(locations):
                    return matched_ids, 1.0, "portfolio_exact"
                elif matched_ids:
                    return matched_ids, 0.7, "portfolio_partial"

        # Tier 2: Postcode prefix match
        if postcode:
            postcode = postcode.upper().strip()
            # Try 2-char then 1-char prefix
            for prefix_len in [2, 1]:
                prefix = postcode[:prefix_len]
                if prefix in self.postcode_map:
                    market_id = self.postcode_map[prefix]
                    confidence = 0.85 if prefix_len == 2 else 0.75
                    return [market_id], confidence, f"postcode_{prefix}"

        # Tier 3: Fuzzy match on location tokens
        if location:
            confidence, matched_ids = self._fuzzy_match(location)
            if confidence > 0.5:
                return matched_ids, confidence, "fuzzy"

        # Unmatched
        return [], 0.0, "unmatched"

    def _fuzzy_match(self, location: str) -> Tuple[float, List[str]]:
        """
        Token-overlap fuzzy matching.

        Split location and market names into words, calculate overlap score.
        Return highest scoring match (must be > 0.3 to consider a match).
        """
        location_tokens = set(location.lower().split())
        best_score = 0.0
        best_market_id = None

        for market_id, market_data in self.markets.items():
            name = market_data["name"].lower()
            name_tokens = set(name.split())

            if not name_tokens or not location_tokens:
                continue

            # Overlap score: how many location tokens appear in market name?
            # Metric: intersection / location_tokens (recall-oriented)
            overlap = len(location_tokens & name_tokens)
            score = overlap / len(location_tokens) if location_tokens else 0.0

            # Require at least one token match
            if overlap > 0 and score > best_score:
                best_score = score
                best_market_id = market_id

        # Accept if at least one token matched and score > 0.3
        if best_market_id and best_score > 0.3:
            return best_score, [best_market_id]
        return 0.0, []

    def log_unmatched(self, location: Optional[str]):
        """
        Append unmatched location to log for weekly review.

        Args:
            location: The unmatched location string from the IM.
        """
        if not location:
            return

        log_path = Path(__file__).parent / "unmatched_locations.log"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"{location}\n")


def match_deal_location(
    location: Optional[str],
    postcode: Optional[str],
    markets_config_path: Optional[str] = None,
) -> Tuple[List[str], float, str]:
    """
    Convenience function: match a single deal location.

    Args:
        location: Extracted location string
        postcode: Extracted postcode string
        markets_config_path: Path to markets.json (defaults to standard location)

    Returns:
        Tuple of (market_ids, confidence, method)
    """
    if markets_config_path is None:
        repo_root = Path(__file__).parent.parent
        markets_config_path = repo_root / "scrapers" / "config" / "markets.json"
    postcode_map_path = Path(__file__).parent / "postcode_area_to_market.json"

    matcher = MarketMatcher(str(markets_config_path), str(postcode_map_path))
    return matcher.match(location, postcode)
