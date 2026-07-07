"""
Profile generator for extracted deals.

Takes an extracted row + matched market(s) and:
1. Calculates deterministic fit score (based on market pillar scores + strategy weights)
2. Generates narrative from top-2 pillars
3. Returns as part of DealRecord

Designed for Task 4: deterministic (no LLM calls), auditable fit scoring.
"""

import json
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path


class ProfileGenerator:
    """Generate fit scores and narratives for deals matched to markets."""

    def __init__(self, strategy_weights_path: str):
        """
        Initialize with strategy weights.

        Args:
            strategy_weights_path: Path to extractor/strategy_weights.json
        """
        with open(strategy_weights_path) as f:
            self.strategy_weights = json.load(f)

    def generate(
        self,
        market_ids: List[str],
        pillar_scores: Dict[str, Dict[str, float]],
        deal_type: Optional[str] = None,
        extracted_row: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate profile for a deal.

        Args:
            market_ids: List of matched market IDs (e.g., ['uk-73'] or ['uk-73', 'uk-03'])
            pillar_scores: Dict mapping market_id -> pillar_name -> score (0-100)
                          Example: {'uk-73': {'Rents & Yields': 85, 'Labour': 82, ...}}
            deal_type: Deal strategy (MLI, Big Box, Office, Net Lease, default)
            extracted_row: Extracted deal data (used for narrative context)

        Returns:
            Dict with:
              - market_ids: list of matched markets
              - microlocation_fit_score: 0-100 weighted score
              - microlocation_narrative: text description (1-2 sentences per market)
              - narrative_detail: structured breakdown per market (for future analytics)
        """
        deal_type = deal_type or "default"
        weights = self._get_weights(deal_type)

        result = {
            "market_ids": market_ids,
            "microlocation_fit_score": 0,
            "microlocation_narrative": "",
            "narrative_detail": {},
        }

        # Single market: simple case
        if len(market_ids) == 1:
            market_id = market_ids[0]
            if market_id not in pillar_scores:
                # No score data available
                result["microlocation_fit_score"] = 50
                result["microlocation_narrative"] = "Market matched but score data unavailable."
                return result

            scores = pillar_scores[market_id]
            fit_score = self._calculate_fit_score(scores, weights)
            narrative = self._generate_narrative(market_id, scores)

            result["microlocation_fit_score"] = fit_score
            result["microlocation_narrative"] = narrative
            result["narrative_detail"][market_id] = {
                "fit_score": fit_score,
                "narrative": narrative,
                "top_pillars": self._get_top_pillars(scores, 2),
            }

        # Portfolio: multiple markets
        else:
            fit_scores = []
            narratives = {}

            for market_id in market_ids:
                if market_id not in pillar_scores:
                    narratives[market_id] = "Market matched but score data unavailable."
                    fit_scores.append(50)
                    continue

                scores = pillar_scores[market_id]
                fit_score = self._calculate_fit_score(scores, weights)
                narrative = self._generate_narrative(market_id, scores)

                fit_scores.append(fit_score)
                narratives[market_id] = narrative
                result["narrative_detail"][market_id] = {
                    "fit_score": fit_score,
                    "narrative": narrative,
                    "top_pillars": self._get_top_pillars(scores, 2),
                }

            # Aggregate: average fit score, concatenated narrative with market leades
            avg_fit_score = sum(fit_scores) / len(fit_scores) if fit_scores else 50
            narrative_lines = [
                f"{market_id}: {narratives[market_id]}" for market_id in market_ids
            ]
            combined_narrative = " ".join(narrative_lines)

            result["microlocation_fit_score"] = avg_fit_score
            result["microlocation_narrative"] = combined_narrative

        return result

    def _get_weights(self, deal_type: str) -> Dict[str, float]:
        """Get pillar weights for the deal type."""
        return self.strategy_weights.get(deal_type, self.strategy_weights["default"])

    def _calculate_fit_score(
        self, pillar_scores: Dict[str, float], weights: Dict[str, float]
    ) -> float:
        """
        Calculate weighted fit score (0-100).

        Args:
            pillar_scores: {pillar_name: score (0-100)}
            weights: {pillar_name: weight (0-1)}

        Returns:
            Weighted fit score (0-100)
        """
        score = 0.0
        for pillar, weight in weights.items():
            if pillar in pillar_scores:
                score += pillar_scores[pillar] * weight

        return round(score, 1)

    def _get_top_pillars(
        self, pillar_scores: Dict[str, float], n: int = 2
    ) -> List[Tuple[str, float]]:
        """Get top N pillars by score."""
        return sorted(pillar_scores.items(), key=lambda x: x[1], reverse=True)[:n]

    def _generate_narrative(self, market_id: str, pillar_scores: Dict[str, float]) -> str:
        """
        Generate 1-2 sentence narrative from top-2 pillars.

        Template: "{Market} ranks in the top quartile on {Pillar1} ({key metric})
        and {Pillar2} ({key metric}). {Investment angle from market characteristics}."

        For now, a simplified version using pillar scores and names.
        """
        top_pillars = self._get_top_pillars(pillar_scores, 2)

        if not top_pillars:
            return f"{market_id} has limited score data available."

        # Format pillar names for readability
        pillar_strs = []
        for pillar, score in top_pillars:
            pillar_strs.append(f"{pillar} (score {int(score)})")

        pillars_text = " and ".join(pillar_strs)
        narrative = f"{market_id} ranks strongly on {pillars_text}."

        return narrative


def generate_deal_profile(
    market_ids: List[str],
    pillar_scores: Dict[str, Dict[str, float]],
    deal_type: Optional[str] = None,
    strategy_weights_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Convenience function: generate profile for a single deal.

    Args:
        market_ids: Matched market ID(s)
        pillar_scores: Market pillar scores
        deal_type: Deal strategy (MLI, Big Box, Office, Net Lease, default)
        strategy_weights_path: Path to strategy_weights.json

    Returns:
        Profile dict with fit_score and narrative
    """
    if strategy_weights_path is None:
        strategy_weights_path = str(Path(__file__).parent / "strategy_weights.json")

    generator = ProfileGenerator(strategy_weights_path)
    return generator.generate(market_ids, pillar_scores, deal_type)
