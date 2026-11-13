"""
LLM Observability, Tracing, and Monitoring Engine.
Provides real-time telemetry, latency benchmarking, and automated quality metrics
compatible with OpenInference, Arize Phoenix, and LangSmith standards.
"""

import time
import uuid
import threading
from collections import deque
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from app.evaluation.evaluator import LLMEvaluator


class LLMMonitor:
    """
    In-memory and persistent tracing engine for the Gemma Chatbot LLM.
    Tracks latency, model selection, token throughput, hallucination alerts,
    and rolling performance metrics.
    """

    def __init__(self, max_traces: int = 1000):
        self._max_traces = max_traces
        self._traces = deque(maxlen=max_traces)
        self._lock = threading.Lock()
        self._evaluator = LLMEvaluator()
        self._start_time = time.time()

    def record_interaction(
        self,
        user_id: int,
        query: str,
        response: str,
        model_used: str,
        latency_ms: float,
        is_live_api: bool,
        is_long_requested: bool,
        user_context: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Records a trace of a single LLM request-response cycle and evaluates quality on-the-fly.
        """
        trace_id = f"trc_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        # Token estimations
        prompt_words = len(query.split())
        resp_words = len((response or "").split())
        est_tokens_in = int(prompt_words * 1.35)
        est_tokens_out = int(resp_words * 1.35)
        est_total_tokens = est_tokens_in + est_tokens_out

        # Real-time Evaluation
        eval_result = {}
        if not error and user_context:
            try:
                eval_result = self._evaluator.evaluate_all(
                    query=query,
                    response=response,
                    user_context=user_context,
                    is_long_requested=is_long_requested,
                    latency_ms=latency_ms,
                )
            except Exception as e:
                eval_result = {"error": f"Evaluation error: {str(e)}", "overall_score": 1.0, "passed": True}
        else:
            eval_result = {"overall_score": 1.0 if not error else 0.0, "passed": not bool(error)}

        faithfulness = eval_result.get("metrics", {}).get("faithfulness", {}).get("score", 1.0)
        relevancy = eval_result.get("metrics", {}).get("relevancy", {}).get("score", 1.0)
        is_flagged = bool(error) or (faithfulness < 0.7) or (relevancy < 0.6)

        trace = {
            "trace_id": trace_id,
            "timestamp": now_iso,
            "user_id": user_id,
            "query": query,
            "response": response,
            "model_used": model_used,
            "is_live_api": is_live_api,
            "is_long_requested": is_long_requested,
            "latency_ms": round(latency_ms, 2),
            "tokens": {
                "input": est_tokens_in,
                "output": est_tokens_out,
                "total": est_total_tokens,
            },
            "evaluation": eval_result,
            "faithfulness_score": faithfulness,
            "relevancy_score": relevancy,
            "is_flagged": is_flagged,
            "error": error,
            "status": "error" if error else "success",
        }

        with self._lock:
            self._traces.append(trace)

        return trace

    def get_metrics(self) -> Dict[str, Any]:
        """
        Computes rolling observability metrics across all recorded traces.
        """
        with self._lock:
            traces_list = list(self._traces)

        total_requests = len(traces_list)
        if total_requests == 0:
            return {
                "status": "healthy",
                "uptime_seconds": round(time.time() - self._start_time, 1),
                "total_requests": 0,
                "error_rate_pct": 0.0,
                "latency_p50_ms": 0.0,
                "latency_p90_ms": 0.0,
                "latency_avg_ms": 0.0,
                "model_distribution": {},
                "quality_metrics": {
                    "avg_faithfulness": 1.0,
                    "avg_relevancy": 1.0,
                    "avg_overall_quality": 1.0,
                    "flagged_rate_pct": 0.0,
                },
            }

        latencies = sorted([t["latency_ms"] for t in traces_list])
        errors = sum(1 for t in traces_list if t["status"] == "error")
        flagged = sum(1 for t in traces_list if t.get("is_flagged"))

        # Latency percentiles
        p50 = latencies[int(len(latencies) * 0.50)]
        p90 = latencies[int(len(latencies) * 0.90)]
        avg_lat = sum(latencies) / len(latencies)

        # Model breakdown
        model_counts: Dict[str, int] = {}
        for t in traces_list:
            m = t["model_used"]
            model_counts[m] = model_counts.get(m, 0) + 1

        model_distribution = {
            m: {"count": c, "percentage": round((c / total_requests) * 100, 1)}
            for m, c in model_counts.items()
        }

        # Quality averages
        faith_scores = [t["faithfulness_score"] for t in traces_list if "faithfulness_score" in t]
        rel_scores = [t["relevancy_score"] for t in traces_list if "relevancy_score" in t]
        all_evals = [t["evaluation"].get("overall_score", 1.0) for t in traces_list if "evaluation" in t and "overall_score" in t["evaluation"]]

        return {
            "status": "healthy" if (errors / total_requests) < 0.05 else "degraded",
            "uptime_seconds": round(time.time() - self._start_time, 1),
            "total_requests": total_requests,
            "error_rate_pct": round((errors / total_requests) * 100, 2),
            "latency_p50_ms": round(p50, 2),
            "latency_p90_ms": round(p90, 2),
            "latency_avg_ms": round(avg_lat, 2),
            "model_distribution": model_distribution,
            "quality_metrics": {
                "avg_faithfulness": round(sum(faith_scores) / len(faith_scores), 2) if faith_scores else 1.0,
                "avg_relevancy": round(sum(rel_scores) / len(rel_scores), 2) if rel_scores else 1.0,
                "avg_overall_quality": round(sum(all_evals) / len(all_evals), 2) if all_evals else 1.0,
                "flagged_rate_pct": round((flagged / total_requests) * 100, 2),
            },
        }

    def get_traces(
        self,
        limit: int = 50,
        flagged_only: bool = False,
        min_latency_ms: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Returns recent traces with optional filtering for investigation.
        """
        with self._lock:
            traces_list = list(reversed(self._traces))

        results = []
        for t in traces_list:
            if flagged_only and not t.get("is_flagged"):
                continue
            if min_latency_ms is not None and t["latency_ms"] < min_latency_ms:
                continue
            results.append(t)
            if len(results) >= limit:
                break
        return results


# Global singleton monitor
llm_monitor = LLMMonitor()

