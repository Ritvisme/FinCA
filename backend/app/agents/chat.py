"""
Chat agent — a tool-calling loop over Groq/Llama. Unlike insights.py (one-shot,
pre-fetched data), the model here decides which tools to call and when.
"""

import json
from openai import AsyncOpenAI

from app.config import settings
from app.agents.tools import TOOLS, dispatch

_client = AsyncOpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=settings.GROQ_API_KEY,
)

MODEL = "llama-3.3-70b-versatile"   # supports tool calling on Groq
MAX_STEPS = 5                        # cap tool-call rounds

SYSTEM_PROMPT = """You are FinCA, a personal CFO assistant with live access to the user's financial data through tools.

- When a question needs data, CALL A TOOL. Never guess or invent numbers.
- You may call several tools before answering (e.g. spending + goals to judge affordability).
- If the user says "this month", infer the current YYYY-MM.
- Answer in plain language, cite real numbers, use ₹ with Indian formatting (₹40,000).
- Be concise and direct. If the data doesn't support an answer, say so.
"""


async def run_chat(client_id: str, message: str, history: list[dict] | None = None) -> dict:
    """One turn of the agent. Returns {reply, steps} (steps = tools used)."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(history)                 # prior {role, content} turns
    messages.append({"role": "user", "content": message})

    used = []
    for _ in range(MAX_STEPS):
        resp = await _client.chat.completions.create(
            model=MODEL, messages=messages, tools=TOOLS, temperature=0.3,
        )
        msg = resp.choices[0].message

        if not msg.tool_calls:                    # model is done
            return {"reply": msg.content or "", "steps": used}

        messages.append(msg.model_dump(exclude_none=True))
        for call in msg.tool_calls:
            try:
                args = json.loads(call.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            result = await dispatch(call.function.name, args, client_id)
            used.append(call.function.name)
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result, default=str),
            })

    # Hit the step cap — force a final answer with no more tools.
    resp = await _client.chat.completions.create(
        model=MODEL,
        messages=messages + [{"role": "user", "content": "Answer now with what you have."}],
        temperature=0.3,
    )
    return {"reply": resp.choices[0].message.content or "", "steps": used}