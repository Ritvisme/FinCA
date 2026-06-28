"""
Agent tools — wrappers over existing services the LLM may call. The model picks
WHICH tool and the args; client_id is injected from the authed request, never
supplied by the model (so a user can't touch another user's data).
"""

from app.expense.service import get_monthly_summary, get_transactions, create_transaction
from app.invest.service import get_portfolio_summary, get_goals, get_holdings, get_sips

TOOLS = [
    {"type": "function", "function": {
        "name": "get_monthly_summary",
        "description": "Spending totals, by-category breakdown and budget for a month. Use for spend/budget questions.",
        "parameters": {"type": "object",
            "properties": {"month": {"type": "string", "description": "YYYY-MM, e.g. 2026-06"}},
            "required": ["month"]}}},
    {"type": "function", "function": {
        "name": "get_recent_expenses",
        "description": "Individual expense transactions, newest first. Optional date range or category filter.",
        "parameters": {"type": "object", "properties": {
            "start_date": {"type": "string"}, "end_date": {"type": "string"},
            "category": {"type": "string"}}}}},
    {"type": "function", "function": {
        "name": "get_portfolio_summary",
        "description": "Total invested, holding count, active SIPs, breakdown by asset type.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "get_goals",
        "description": "Financial goals with target amount, date and progress.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "get_holdings",
        "description": "Investment holdings. Optional asset_type filter.",
        "parameters": {"type": "object", "properties": {"asset_type": {"type": "string"}}}}},
    {"type": "function", "function": {
        "name": "get_sips",
        "description": "Systematic investment plans. active_only defaults to true.",
        "parameters": {"type": "object", "properties": {"active_only": {"type": "boolean"}}}}},
    {"type": "function", "function": {
        "name": "add_expense",
        "description": "Log a NEW expense. Only call when the user clearly wants to record a spend AND you know the amount and category. If anything is ambiguous, ask in text first instead of calling this.",
        "parameters": {"type": "object", "properties": {
            "amount": {"type": "number", "description": "Amount in rupees"},
            "category": {"type": "string", "description": "e.g. Food, Transport, Shopping, Bills"},
            "merchant": {"type": "string"},
            "description": {"type": "string"},
            "date": {"type": "string", "description": "YYYY-MM-DD; omit for today"}},
            "required": ["amount", "category"]}}},
]
#we are making these tools because the LLM can never see the python functions so we are defining these tools so that the LLM can call them and get the data it needs to answer the user's questions. The LLM will call these tools with the appropriate arguments, and the dispatch function will route the call to the correct service function.

async def dispatch(name: str, args: dict, client_id: str):
    if name == "get_monthly_summary":
        return await get_monthly_summary(client_id, args["month"])
    if name == "get_recent_expenses":
        return await get_transactions(client_id, start_date=args.get("start_date"),
                                      end_date=args.get("end_date"), category=args.get("category"))
    if name == "get_portfolio_summary":
        return await get_portfolio_summary(client_id)
    if name == "get_goals":
        return await get_goals(client_id)
    if name == "get_holdings":
        return await get_holdings(client_id, args.get("asset_type"))
    if name == "get_sips":
        return await get_sips(client_id, args.get("active_only", True))
    if name == "add_expense":
        doc = await create_transaction(
            client_id, amount=args["amount"], category=args["category"],
            merchant=args.get("merchant"), description=args.get("description"),
            txn_date=args.get("date"), source="chat",
        )
        return {"logged": True, "amount": doc["amount"], "category": doc["category"], "date": doc["date"]}
    return {"error": f"unknown tool {name}"}