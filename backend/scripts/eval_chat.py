"""
Manual eval — run against a real client_id to sanity-check the agent handles
varied phrasings without crashing. Run by hand after any prompt/tool change.

Usage: PYTHONPATH=. venv/bin/python scripts/eval_chat.py <client_id>
"""
import asyncio
import sys

from app.database import connect_db, close_db
from app.agents.chat import run_chat_stream

CASES = [
    "what's my total expense this month",
    "how much have i spent",
    "whats my outflow for june",
    "am i over budget",
    "log 200 for coffee",
    "add my june income as 15000",
    "how are my goals doing",
    "what's in my portfolio",
    "compare my spending to last month",   # no tool for this — checks graceful handling
    "asdkjfh nonsense question",            # garbage input — should not crash
]


async def run_one(client_id: str, question: str):
    print(f"\n{'='*60}\nQ: {question}\n{'-'*60}")
    reply = ""
    try:
        async for event in run_chat_stream(client_id, question, []):
            if event["type"] == "token":
                reply += event["text"]
            elif event["type"] == "tool":
                print(f"  [tool: {event['name']}]")
        print(f"A: {reply.strip() or '(empty — investigate)'}")
    except Exception as e:
        print(f"CRASHED: {e}")


async def main():
    client_id = sys.argv[1]
    # FastAPI normally opens the DB in its lifespan; standalone scripts must do it.
    await connect_db()
    try:
        for q in CASES:
            await run_one(client_id, q)
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())