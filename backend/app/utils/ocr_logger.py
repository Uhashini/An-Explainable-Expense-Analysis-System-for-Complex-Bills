import json
import time
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
import os

logger = logging.getLogger(__name__)

class OCRLogger:
    """
    Utility to record technical telemetry for the OCR pipeline.
    Captures latency, confidence distributions, and engine decision paths.
    """

    def __init__(self, log_dir: str = "logs/ocr"):
        self.log_dir = log_dir
        os.makedirs(self.log_dir, exist_ok=True)

    def log_session(self, 
                    session_id: str, 
                    input_type: str, 
                    start_time: float, 
                    results: List[Dict[str, Any]], 
                    metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Logs a full OCR extraction session to a JSON file.
        """
        end_time = time.time()
        latency = end_time - start_time
        
        # Calculate aggregate metrics
        confidences = [res.get("confidence", 0) for res in results]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        fallback_hits = len([res for res in results if res.get("is_fallback")])
        
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": session_id,
            "input_type": input_type,
            "performance": {
                "latency_seconds": round(latency, 3),
                "avg_confidence": round(avg_confidence, 4),
                "field_count": len(results)
            },
            "decisions": {
                "fallback_count": fallback_hits,
                "voting_applied": metadata.get("voting_applied", False) if metadata else False
            },
            "results": results,
            "metadata": metadata or {}
        }

        log_path = os.path.join(self.log_dir, f"{session_id}.json")
        try:
            with open(log_path, "w") as f:
                json.dump(log_entry, f, indent=4)
            logger.info(f"OCR Session logged to {log_path}")
        except Exception as e:
            logger.error(f"Failed to write OCR log: {e}")
        
        return log_path

    def get_summary_metrics(self) -> Dict[str, Any]:
        """
        Processes all logs in the directory to provide aggregate health metrics.
        """
        # This would be used for the 'Analytics Dashboard' or 'Evaluation Report'
        pass
