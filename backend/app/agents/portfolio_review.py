"""
Portfolio review agent — one-shot (like insights.py): reads the user's
investment profile plus live benchmark data and returns 3-5 educational
suggestion cards for the Investments page. No tool loop needed since we
already know exactly what data the review requires.
"""

import json
from openai import AsyncOpenAI

from app.config import settings
from app.agents.tools import dispatch
from app.market.service import market_overview

_client = AsyncOpenAI(base_url="https://api.groq.com/openai/v1", api_key=settings.GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are FinCA's portfolio reviewer. From the user's investment profile and live market benchmarks, produce 3-5 SPECIFIC, educational observations.

Hard rules:
- Every card MUST cite real numbers from the data (₹ amounts, percentages, counts).
- Pair each observation with an option to consider and its trade-off. Never commands ("buy X") — this is education, not advice.
- Cover different angles: diversification, surplus deployment, SIP pace vs goals, market context, missing goals.
- Use ₹ with Indian formatting (₹40,000).

Output STRICT JSON, nothing else:
{
  "suggestions": [
    {
      "title": "short headline (under 55 chars)",
      "body": "2-3 sentences: observation + option + trade-off",
      "kind": "diversify" | "surplus" | "sip" | "goal" | "market"
    }
  ]
}
"""


async def generate_portfolio_review(client_id: str) -> dict:
    profile = await dispatch("get_investment_profile", {}, client_id)
    market = await market_overview()

    user_prompt = (
        "INVESTMENT PROFILE:\n" + json.dumps(profile, indent=1, default=str)
        + "\n\nMARKET BENCHMARKS (live):\n" + json.dumps(market, indent=1, default=str)
        + "\n\nProduce the suggestion cards JSON now."
    )

    response = await _client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.4,
    )
    try:
        data = json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return {"suggestions": []}
    valid_kinds = {"diversify", "surplus", "sip", "goal", "market"}
    cards = []
    for s in data.get("suggestions", [])[:5]:
        if s.get("title") and s.get("body"):
            cards.append({
                "title": str(s["title"])[:80],
                "body": str(s["body"])[:500],
                "kind": s.get("kind") if s.get("kind") in valid_kinds else "market",
            })
    return {"suggestions": cards, "disclaimer": "Educational analysis, not investment advice."}
