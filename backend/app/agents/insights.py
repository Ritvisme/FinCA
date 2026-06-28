"""
Insights agent — reads a user's monthly financial data and returns 2-4
specific, actionable observations as structured cards.
"""

import json
from openai import OpenAI

from app.config import settings
from app.expense.service import get_monthly_summary
from app.invest.service import get_portfolio_summary, get_goals


# A "client" for the Groq API. OpenAI SDK + Groq base URL = OpenAI-compatible.
_client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=settings.GROQ_API_KEY,
)

MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are FinCA, a personal CFO. Your job: read a user's monthly financial data and surface 2-4 SPECIFIC, ACTIONABLE insights they wouldn't have noticed on their own.

Hard rules:
- Each insight MUST reference real numbers from the data (e.g. "₹4,000 on Shopping", not "lots on shopping").
- Each insight MUST be actionable or interpretable — avoid pure observations like "you spent ₹5,000".
- Prefer insights that connect multiple data points (budget breach, category trend, goal pace, surplus shrinking).
- Avoid generic advice ("save more", "track expenses", "review your budget").
- Use ₹ for currency and Indian number formatting (₹40,000 not ₹40000).
- Be direct. No fluff, no caveats. 1-2 short sentences per insight body.

Severity values (pick the one that fits):
- "alert"   — over budget, large unusual expense, urgent attention
- "warning" — trending in a bad direction
- "info"    — neutral observation worth knowing
- "good"    — positive trend, on track, achievement

Output STRICT JSON in exactly this shape and NOTHING else:
{
  "insights": [
    {
      "title": "short headline (under 60 chars)",
      "body": "1-2 sentence explanation + suggestion",
      "severity": "alert" | "warning" | "info" | "good",
      "category": "Food" | "Transport" | "..." | null
    }
  ]
}
"""


async def generate_insights(client_id: str, month: str) -> dict:
    """Run the agent and return parsed insights."""
    # 1. Gather what the agent gets to see
    summary = await get_monthly_summary(client_id, month)
    portfolio = await get_portfolio_summary(client_id)
    goals = await get_goals(client_id)

    # 2. Build the user-facing prompt
    user_prompt = f"""USER DATA — {month}

Spending summary:
{json.dumps(summary, default=str, indent=2)}

Portfolio:
- Total invested: ₹{portfolio.get('total_invested', 0)}
- Holdings: {portfolio.get('holding_count', 0)}
- Active SIPs: {portfolio.get('active_sips', 0)}
- By asset type: {portfolio.get('by_asset_type', {})}

Goals:
{json.dumps(goals, default=str, indent=2)}

Now produce 2-4 insights as the JSON described in your system prompt."""

    # 3. Ask Llama
    response = _client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        # Force JSON output — Groq supports OpenAI's response_format
        response_format={"type": "json_object"},
        temperature=0.4,
    )

    # 4. Parse and return
    raw = response.choices[0].message.content
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fall back to wrapping the raw text so we don't crash the UI
        return {"insights": [{
            "title": "Couldn't parse insights this time",
            "body": "The agent returned non-JSON output. Try again in a moment.",
            "severity": "info",
            "category": None,
        }]}