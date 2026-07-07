"""
Streaming chat agent over Groq/Llama with tool calling and a live snapshot.
Yields events: {"type":"token","text":...} | {"type":"tool","name":...}.
"""

import json
from datetime import date
from openai import AsyncOpenAI

from app.config import settings
from app.agents.tools import TOOLS, dispatch
from app.expense.service import get_monthly_summary
from app.invest.service import get_portfolio_summary, get_goals

_client = AsyncOpenAI(base_url="https://api.groq.com/openai/v1", api_key=settings.GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"
MAX_STEPS = 5

# Compact per-user snapshot so the model doesn't need a tool call for every question.
async def build_snapshot(client_id: str) -> str:
    """A compact, always-injected summary so the model is grounded before any tool call."""
    month = date.today().strftime("%Y-%m")
    s = await get_monthly_summary(client_id, month)
    p = await get_portfolio_summary(client_id)
    goals = await get_goals(client_id)
    by_cat = s.get("by_category") or {}
    top = max(by_cat, key=by_cat.get) if by_cat else None
    income = s.get("income")
    lines = [f"Snapshot for {month}:"]
    lines.append(f"- Total spend ₹{s.get('total_spend', 0):,.0f} · {s.get('transaction_count', 0)} transactions")
    if top:
        lines.append(f"- Top category: {top} (₹{by_cat[top]:,.0f})")
    if income is not None:
        lines.append(f"- Income ₹{income:,.0f} · surplus after spend+investing ₹{(s.get('surplus') or 0):,.0f}")
    lines.append(f"- Invested ₹{p.get('total_invested', 0):,.0f} · "
                 f"{p.get('holding_count', 0)} holdings · {p.get('active_sips', 0)} active SIPs")
    lines.append(f"- Active goals: {len(goals)}")
    return "\n".join(lines)


SYSTEM_PROMPT = """You are FinCA, a personal CFO assistant with live access to the user's financial data via tools.

- A USER FINANCIAL SNAPSHOT is provided below — use it for quick questions without a tool call.
- For anything not in the snapshot, CALL A TOOL. Never invent numbers; cite the real values you fetched.
- You can LOG expenses with add_expense. If the amount and category are clear, log it and confirm what you logged. If ambiguous, ask first.
- INCOME / salary / earnings are NOT expenses. To record income, call set_income (never add_expense). add_expense is only for money the user SPENT.
- If a tool call returns an "error" field, read it — it tells you what went wrong. Fix the arguments and retry ONCE. If it still fails, answer from the SNAPSHOT and tell the user live data wasn't available for that part.
- For "what should I invest in" / portfolio-review questions: call get_investment_profile AND get_market_data, then give EDUCATIONAL analysis grounded in their numbers — diversification gaps, surplus available to invest, goal pace vs SIP rate, how benchmarks have moved. Frame options and trade-offs ("index funds spread risk; gold hedges equity dips"), never commands ("buy X now"). End with: "This is educational analysis, not investment advice."
- Today is {today}. If the user says "this month", use {month}.
- Be concise and direct. Use ₹ with Indian formatting (₹40,000)."""


async def run_chat_stream(client_id: str, message: str, history: list[dict] | None = None):
    try:
        snapshot = await build_snapshot(client_id)
    except Exception:
        import traceback
        traceback.print_exc()
        snapshot = "(Snapshot unavailable right now — rely on tools, or say live data is unreachable.)"
    today = date.today().isoformat()
    system = SYSTEM_PROMPT.format(today=today, month=today[:7]) + "\n\n" + snapshot

    messages = [{"role": "system", "content": system}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": message})

    try:
        async for event in _agent_loop(messages, client_id):
            yield event
    except Exception:
        import traceback
        traceback.print_exc()
        async for event in _fallback_loop(message, snapshot):
            yield event


async def _agent_loop(messages: list[dict], client_id: str):
    """Tool-calling loop. Can raise on Groq/network errors; caller falls back to snapshot."""
    for _ in range(MAX_STEPS):
        stream = await _client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            temperature=0.3,
            stream=True,
        )
        content, calls = "", {}
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                content += delta.content
                yield {"type": "token", "text": delta.content}
            for tc in (delta.tool_calls or []):
                slot = calls.setdefault(tc.index, {"id": "", "name": "", "args": ""})
                if tc.id:
                    slot["id"] = tc.id
                if tc.function and tc.function.name:
                    slot["name"] = tc.function.name
                if tc.function and tc.function.arguments:
                    slot["args"] += tc.function.arguments

        if not calls:
            return

        messages.append({"role": "assistant", "content": content or None,
                         "tool_calls": [{"id": c["id"], "type": "function",
                                         "function": {"name": c["name"], "arguments": c["args"] or "{}"}}
                                        for c in calls.values()]})
        for c in calls.values():
            yield {"type": "tool", "name": c["name"]}
            try:
                args = json.loads(c["args"] or "{}")
            except json.JSONDecodeError:
                args = {}
            result = await dispatch(c["name"], args, client_id)
            messages.append({"role": "tool", "tool_call_id": c["id"],
                             "content": json.dumps(result, default=str)})


async def _fallback_loop(message: str, snapshot: str):
    """Last resort: answer using ONLY the snapshot, no tools — personalized
    with the user's real numbers instead of a generic error string."""
    try:
        stream = await _client.chat.completions.create(
            model=MODEL, temperature=0.3, stream=True,
            messages=[
                {"role": "system", "content":
                    "You are FinCA. Live data tools are temporarily unavailable. "
                    "Answer using ONLY the snapshot below, with the user's real numbers. "
                    "If the answer isn't in the snapshot, say you can't reach live data right now "
                    "and suggest trying again in a moment.\n\n" + snapshot},
                {"role": "user", "content": message},
            ],
        )
        async for chunk in stream:
            d = chunk.choices[0].delta.content
            if d:
                yield {"type": "token", "text": d}
    except Exception:
        import traceback
        traceback.print_exc()
        yield {"type": "token", "text": "I can't reach your data right now — please try again in a moment."}
