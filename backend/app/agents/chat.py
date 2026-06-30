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

#the snapshot is the compact summary of each user so the model doesnt have to call the tools for every question.
async def build_snapshot(client_id: str) -> str:
    """A compact, always-injected summary so the model is grounded before any tool call."""
    month=date.today().strftime("%Y-%m")
    s=await get_monthly_summary(client_id,month)
    p=await get_portfolio_summary(client_id)
    goals=await get_goals(client_id)
    by_cat=s.get("by_category") or {}
    top=max(by_cat,key=by_cat.get) if by_cat else None
    income=s.get("income")
    lines=[f"Snapshot for {month}:"]
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
- Today is {today}. If the user says "this month", use {month}.
- Be concise and direct. Use ₹ with Indian formatting (₹40,000)."""


async def run_chat_stream(client_id: str, message: str, history: list[dict] | None = None):
    snapshot = await build_snapshot(client_id)
    today = date.today().isoformat()
    system = SYSTEM_PROMPT.format(today=today, month=today[:7]) + "\n\n" + snapshot

    messages = [{"role": "system", "content": system}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": message})

    for _ in range(MAX_STEPS):
        stream = await _client.chat.completions.create(
            model=MODEL, messages=messages, tools=TOOLS, temperature=0.3, stream=True)

        content, calls = "", {}   # calls: index -> {id, name, args}
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                content += delta.content
                yield {"type": "token", "text": delta.content}
            for tc in (delta.tool_calls or []):
                slot = calls.setdefault(tc.index, {"id": "", "name": "", "args": ""})
                if tc.id: slot["id"] = tc.id
                if tc.function and tc.function.name: slot["name"] = tc.function.name
                if tc.function and tc.function.arguments: slot["args"] += tc.function.arguments

        if not calls:
            return  # the final answer was just streamed

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