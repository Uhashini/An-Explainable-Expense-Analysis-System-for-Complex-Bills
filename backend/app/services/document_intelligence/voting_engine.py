import logging
from typing import List, Dict, Any, Optional
from difflib import SequenceMatcher
import re

logger = logging.getLogger(__name__)

class VotingEngine:
    """
    Implements a multi-engine agreement logic to resolve OCR discrepancies.
    Assigns higher weights to specific engines based on the field type.
    """

    def __init__(self, engine_weights: Optional[Dict[str, float]] = None):
        """
        - engine_weights: Dict mapping engine names to their reliability scores.
          e.g., {"paddle": 0.7, "trocr": 0.9}
        """
        self.weights = engine_weights or {
            "paddle": 0.7,
            "trocr": 0.9,
            "native": 1.0  # Native PDF text is trusted most
        }

    def string_similarity(self, a: str, b: str) -> float:
        """
        Returns the similarity ratio between two strings.
        """
        return SequenceMatcher(None, a, b).ratio()

    def is_currency_match(self, text: str) -> bool:
        """
        Regex to identify if a string looks like a currency/price.
        """
        return bool(re.search(r'\d+[.,]\d{2}', text))

    def resolve_discrepancy(self, candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Given a list of candidate extractions for the same region/field,
        returns the most probable result.
        
        candidates: List of {"engine": str, "text": str, "confidence": float}
        """
        if not candidates:
            return {}

        # 1. Weighted scoring
        scored_candidates = []
        for c in candidates:
            engine_weight = self.weights.get(c["engine"], 0.5)
            # Total score = engine_reliability * instance_confidence
            score = engine_weight * c["confidence"]
            
            # Boost score if it matches domain patterns (e.g., price format)
            if self.is_currency_match(str(c["text"])):
                score *= 1.1
            
            scored_candidates.append({**c, "score": score})

        # 2. Return highest score
        winner = max(scored_candidates, key=lambda x: x["score"])
        logger.info(f"Resolution winner: '{winner['text']}' from {winner['engine']} (Score: {winner['score']:.2f})")
        
        return winner

    def aggregate_results(self, paddle_results: List[Dict[str, Any]], trocr_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Simple geometric aggregation.
        Maps TrOCR results back to PaddleOCR regions based on bbox overlap.
        """
        # In a real system, we'd use IoU (Intersection over Union) for spatial mapping.
        # For now, we assume trocr_results is already a list of corrected segments 
        # that correlate 1:1 with paddle_results in order or ID.
        
        final_results = []
        for p, t in zip(paddle_results, trocr_results):
            if p["text"] == t["text"]:
                final_results.append(p)
            else:
                candidates = [
                    {"engine": "paddle", "text": p["text"], "confidence": p["confidence"]},
                    {"engine": "trocr", "text": t["text"], "confidence": t["confidence"]}
                ]
                final_results.append(self.resolve_discrepancy(candidates))
        
        return final_results
