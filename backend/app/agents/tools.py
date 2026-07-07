"""
Agent tools — wrappers over existing services the LLM may call. The model picks
WHICH tool and the args; client_id is injected from the authed request, never
supplied by the model (so a user can't touch another user's data).
"""
from app.expense.service import (
    get_monthly_summary, get_transactions, create_transaction,
    create_or_update_budget, get_budgets,
)
from app.invest.service import get_portfolio_summary, get_goals, get_holdings, get_sips
from app.market.service import summarize_symbol, market_overview

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_monthly_summary",
            "description": "Spending totals, by-category breakdown and budget for a month. Use for spend/budget questions.",
            "parameters": {
                "type": "object",
                "properties": {"month": {"type": "string", "description": "YYYY-MM, e.g. 2026-06"}},
                "required": ["month"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_expenses",
            "description": "Individual expense transactions, newest first. Optional date range or category filter.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string"},
                    "end_date": {"type": "string"},
                    "category": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_portfolio_summary",
            "description": "Total invested, holding count, active SIPs, breakdown by asset type.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_goals",
            "description": "Financial goals with target amount, date and progress.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_holdings",
            "description": "Investment holdings. Optional asset_type filter.",
            "parameters": {
                "type": "object",
                "properties": {"asset_type": {"type": "string"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sips",
            "description": "Systematic investment plans. active_only defaults to true.",
            "parameters": {
                "type": "object",
                "properties": {"active_only": {"type": "boolean"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_expense",
            "description": "Log a NEW expense. Only call when the user clearly wants to record a spend AND you know the amount and category. If anything is ambiguous, ask in text first instead of calling this.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number", "description": "Amount in rupees"},
                    "category": {"type": "string", "description": "e.g. Food, Transport, Shopping, Bills"},
                    "merchant": {"type": "string"},
                    "description": {"type": "string"},
                    "date": {"type": "string", "description": "YYYY-MM-DD; omit for today"},
                },
                "required": ["amount", "category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_income",
            "description": "Set the user's monthly INCOME on their budget. Use this for income/salary/earnings — income is NOT an expense and must never be logged with add_expense.",
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {"type": "string", "description": "YYYY-MM, e.g. 2026-06"},
                    "income": {"type": "number", "description": "Monthly income in rupees"},
                },
                "required": ["month", "income"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_market_data",
            "description": "Live market context: Indian benchmarks (Nifty 50, Gold, USD/INR) plus optional specific tickers (e.g. 'RELIANCE', 'NIFTYBEES'). Returns last price, 1m/6m/1y returns and 52-week range. Use for any market/price/suggestion question.",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbols": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional NSE tickers or index symbols to look up in addition to the benchmarks.",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_investment_profile",
            "description": "The user's full investment picture in one call: portfolio allocation, SIPs, goals with progress, and this month's income/spend/surplus. ALWAYS call this (with get_market_data) before answering 'what should I invest in' style questions.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def _default_month(args: dict) -> str:
    """Return args['month'] if provided, otherwise the current YYYY-MM."""
    if args.get("month"):
        return args["month"]
    from datetime import date
    return date.today().strftime("%Y-%m")


async def dispatch(name, args, client_id):
    """Safe entry point — never raises. Tool failures become {"error": ...} so the model can retry."""
    try:
        return await _dispatch(name, args, client_id)
    except KeyError as e:
        return {"error": f"{name} is missing required argument {e}. Retry with all required fields."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": f"{name} failed ({e}). You can retry once, or tell the user this data isn't available right now."}


async def _dispatch(name: str, args: dict, client_id: str) -> dict:
    if name == "get_monthly_summary":
        return await get_monthly_summary(client_id, _default_month(args))
    if name == "get_recent_expenses":
        return await get_transactions(
            client_id,
            start_date=args.get("start_date"),
            end_date=args.get("end_date"),
            category=args.get("category"),
        )
    if name == "get_portfolio_summary":
        return await get_portfolio_summary(client_id)
    if name == "get_goals":
        return await get_goals(client_id)
    if name == "get_holdings":
        return await get_holdings(client_id, args.get("asset_type"))
    if name == "get_sips":
        return await get_sips(client_id, args.get("active_only", True))
    if name == "add_expense":
        if args.get("category", "").strip().lower() in {"income", "salary", "earning", "earnings", "wage", "wages"}:
            return {"error": "Income is not an expense — use set_income to record income."}
        doc = await create_transaction(
            client_id, amount=args["amount"], category=args["category"],
            merchant=args.get("merchant"), description=args.get("description"),
            txn_date=args.get("date"), source="chat",
        )
        return {"logged": True, "amount": doc["amount"], "category": doc["category"], "date": doc["date"]}
    if name == "set_income":
        month = _default_month(args)
        budgets = await get_budgets(client_id)
        existing = next((b for b in budgets if b["month"] == month), None)
        allocations = existing.get("allocations", {}) if existing else {}
        budget = await create_or_update_budget(client_id, month, args["income"], allocations)
        return {"income_set": budget["income"], "month": month}
    if name == "get_market_data":
        overview = await market_overview()
        extra = {}
        for sym in (args.get("symbols") or [])[:5]:  # cap lookups per call
            extra[sym] = await summarize_symbol(sym)
        return {"benchmarks": overview, "requested": extra}
    if name == "get_investment_profile":
        month = _default_month(args)
        portfolio = await get_portfolio_summary(client_id)
        goals = await get_goals(client_id)
        sips = await get_sips(client_id, True)
        summary = await get_monthly_summary(client_id, month)
        return {
            "portfolio": portfolio,
            "goals": goals,
            "active_sips": sips,
            "this_month": {
                "income": summary.get("income"),
                "total_spend": summary.get("total_spend"),
                "invested": summary.get("invested"),
                "surplus": summary.get("surplus"),
            },
        }
    return {"error": f"unknown tool {name}"}