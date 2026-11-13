"""
LLM Evaluation & Benchmarking Runner.
Runs standardized DeepEval & Ragas test cases against the Pantrix AI Chatbot,
computes automated quality metrics, logs performance telemetry,
and outputs an interactive HTML report and terminal dashboard.
"""

import os
import sys
import json
import time
from typing import Dict, Any, List

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.gemma_chatbot_service import gemma_chatbot_service
from app.evaluation.evaluator import LLMEvaluator


def run_evaluation() -> Dict[str, Any]:
    test_cases_path = os.path.join(os.path.dirname(__file__), "test_cases.json")
    with open(test_cases_path, "r", encoding="utf-8") as f:
        test_cases = json.load(f)

    evaluator = LLMEvaluator()
    results = []

    print("\n" + "=" * 80)
    print("🚀 STARTING DEEPEVAL & RAGAS LLM EVALUATION BENCHMARK")
    print("   Target Model: Google Gemma 3 / Gemini (Pantrix Reasoning Engine)")
    print(f"   Benchmark Suite: {len(test_cases)} Standardized Scenarios")
    print("=" * 80 + "\n")

    for tc in test_cases:
        tc_id = tc["id"]
        tc_name = tc["name"]
        query = tc["query"]
        user_context = tc["user_context"]
        is_long = tc.get("is_long_requested", False)

        # Execute Chatbot Service
        t0 = time.time()
        reply = gemma_chatbot_service._generate_contextual_response(
            user_message=query,
            user_context=user_context,
            conversation_history=[],
            is_long_requested=is_long,
        )
        latency_ms = (time.time() - t0) * 1000.0

        # Evaluate against Ragas / DeepEval metrics
        eval_metrics = evaluator.evaluate_all(
            query=query,
            response=reply,
            user_context=user_context,
            is_long_requested=is_long,
            latency_ms=latency_ms,
        )

        # Keyword checks
        exp_kw = tc.get("expected_keywords", [])
        neg_kw = tc.get("negative_keywords", [])
        kw_passed = True
        kw_notes = []

        resp_lower = reply.lower()
        for kw in exp_kw:
            if kw.lower() not in resp_lower:
                kw_passed = False
                kw_notes.append(f"Missing expected keyword: '{kw}'")

        for nkw in neg_kw:
            if nkw.lower() in resp_lower:
                kw_passed = False
                kw_notes.append(f"Leaked negative/hallucinated keyword: '{nkw}'")

        overall_passed = eval_metrics["passed"] and kw_passed

        res_item = {
            "id": tc_id,
            "name": tc_name,
            "query": query,
            "response": reply,
            "latency_ms": round(latency_ms, 2),
            "word_count": len(reply.split()),
            "is_long_requested": is_long,
            "metrics": eval_metrics["metrics"],
            "overall_score": eval_metrics["overall_score"],
            "passed": overall_passed,
            "kw_passed": kw_passed,
            "kw_notes": kw_notes,
        }
        results.append(res_item)

        # Console row
        status_icon = "✅ PASS" if overall_passed else "❌ FAIL"
        f_score = eval_metrics["metrics"]["faithfulness"]["score"]
        r_score = eval_metrics["metrics"]["relevancy"]["score"]
        g_score = eval_metrics["metrics"]["goal_alignment"]["score"]
        l_score = eval_metrics["metrics"]["length_constraint"]["score"]

        print(f"[{tc_id}] {tc_name:<46} {status_icon}")
        print(f"       Query: \"{query}\"")
        print(f"       Scores: Faithfulness: {f_score:.2f} | Relevancy: {r_score:.2f} | Goal Align: {g_score:.2f} | Length: {l_score:.2f}")
        print(f"       Latency: {latency_ms:.1f}ms | Words: {len(reply.split())} | Overall: {eval_metrics['overall_score']:.2f}")
        if not overall_passed:
            print(f"       Issues: {kw_notes or eval_metrics['metrics']}")
        print("-" * 80)

    # Aggregates
    total = len(results)
    passed_count = sum(1 for r in results if r["passed"])
    pass_rate = (passed_count / total) * 100.0
    avg_score = sum(r["overall_score"] for r in results) / total
    avg_faith = sum(r["metrics"]["faithfulness"]["score"] for r in results) / total
    avg_relevancy = sum(r["metrics"]["relevancy"]["score"] for r in results) / total
    avg_goal = sum(r["metrics"]["goal_alignment"]["score"] for r in results) / total
    avg_length = sum(r["metrics"]["length_constraint"]["score"] for r in results) / total
    avg_latency = sum(r["latency_ms"] for r in results) / total

    print("\n" + "=" * 80)
    print("📊 BENCHMARK EVALUATION SUMMARY")
    print("=" * 80)
    print(f"  Total Scenarios Evaluated: {total}")
    print(f"  Passed:                    {passed_count} / {total} ({pass_rate:.1f}%)")
    print(f"  Average Overall Quality:   {avg_score * 100:.1f} / 100")
    print(f"  Faithfulness (No Halluc):  {avg_faith * 100:.1f}%")
    print(f"  Answer Relevancy:          {avg_relevancy * 100:.1f}%")
    print(f"  Goal & Profile Alignment:  {avg_goal * 100:.1f}%")
    print(f"  Length / Brevity Adhere:   {avg_length * 100:.1f}%")
    print(f"  Average Latency:           {avg_latency:.2f} ms")
    print("=" * 80 + "\n")

    # Generate HTML Report
    html_report_path = os.path.join(os.path.dirname(__file__), "eval_report.html")
    generate_html_report(html_report_path, results, {
        "total": total,
        "passed": passed_count,
        "pass_rate": round(pass_rate, 1),
        "avg_score": round(avg_score * 100, 1),
        "avg_faith": round(avg_faith * 100, 1),
        "avg_relevancy": round(avg_relevancy * 100, 1),
        "avg_goal": round(avg_goal * 100, 1),
        "avg_length": round(avg_length * 100, 1),
        "avg_latency": round(avg_latency, 1),
    })
    print(f"📄 Interactive HTML Evaluation Report saved to: {html_report_path}\n")

    return {
        "total": total,
        "passed": passed_count,
        "pass_rate": pass_rate,
        "average_score": avg_score,
        "results": results,
    }


def generate_html_report(output_path: str, results: List[Dict[str, Any]], stats: Dict[str, Any]):
    cards_html = ""
    for r in results:
        status_badge = '<span style="background:#22c55e22; color:#16a34a; padding:4px 10px; border-radius:20px; font-weight:700; font-size:12px;">PASSED</span>' if r["passed"] else '<span style="background:#ef444422; color:#dc2626; padding:4px 10px; border-radius:20px; font-weight:700; font-size:12px;">FAILED</span>'
        cards_html += f"""
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:20px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <strong style="font-size:16px; color:#0f172a;">[{r['id']}] {r['name']}</strong>
            </div>
            {status_badge}
          </div>
          <p style="margin:4px 0 10px 0; color:#475569; font-size:14px;"><strong>User Query:</strong> <em>"{r['query']}"</em></p>
          <div style="background:#f8fafc; border-left:4px solid #3b82f6; padding:12px 16px; border-radius:6px; margin-bottom:12px; font-size:14px; color:#1e293b; white-space:pre-wrap;">{r['response']}</div>
          <div style="display:flex; gap:16px; font-size:12px; color:#64748b; flex-wrap:wrap;">
            <span>🎯 <strong>Overall:</strong> {r['overall_score']:.2f}</span>
            <span>🛡️ <strong>Faithfulness:</strong> {r['metrics']['faithfulness']['score']:.2f}</span>
            <span>💡 <strong>Relevancy:</strong> {r['metrics']['relevancy']['score']:.2f}</span>
            <span>🥗 <strong>Goal Align:</strong> {r['metrics']['goal_alignment']['score']:.2f}</span>
            <span>📏 <strong>Length:</strong> {r['metrics']['length_constraint']['score']:.2f} ({r['word_count']} words)</span>
            <span>⚡ <strong>Latency:</strong> {r['latency_ms']}ms</span>
          </div>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pantrix AI - LLM Evaluation Report (DeepEval & Ragas)</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:#f1f5f9; color:#0f172a; margin:0; padding:32px; }}
    .container {{ max-width: 1000px; margin: 0 auto; }}
    .stat-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 28px; }}
    .stat-card {{ background:#ffffff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.06); border:1px solid #e2e8f0; text-align:center; }}
    .stat-val {{ font-size: 28px; font-weight: 800; color: #1e293b; margin-top: 6px; }}
    .stat-label {{ font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }}
  </style>
</head>
<body>
  <div class="container">
    <div style="margin-bottom:28px;">
      <h1 style="margin:0 0 8px 0; font-size:26px;">Pantrix AI Chatbot - LLM Evaluation Benchmark</h1>
      <p style="margin:0; color:#64748b; font-size:14px;">Evaluated using <strong>DeepEval</strong> and <strong>Ragas</strong> metrics: Faithfulness, Answer Relevancy, Goal Alignment & Latency.</p>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Pass Rate</div>
        <div class="stat-val" style="color:#16a34a;">{stats['pass_rate']}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Overall Quality</div>
        <div class="stat-val" style="color:#2563eb;">{stats['avg_score']}/100</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Faithfulness (Zero Hallucination)</div>
        <div class="stat-val" style="color:#059669;">{stats['avg_faith']}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Average Latency</div>
        <div class="stat-val" style="color:#7c3aed;">{stats['avg_latency']}ms</div>
      </div>
    </div>

    <h2 style="font-size:18px; margin:24px 0 16px 0;">Test Scenario Drill-Down</h2>
    {cards_html}
  </div>
</body>
</html>
"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)


if __name__ == "__main__":
    run_evaluation()
