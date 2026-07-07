from datetime import date, datetime, timezone, timedelta
from typing import Optional
import calendar
import uuid

from app.database import get_db


async def _invested_in_month(db, client_id: str, month: str):
    """Total money put into investments during `month` (YYYY-MM):
    lump-sum holdings bought that month + every SIP installment that falls in it."""
    y, m = map(int, month.split("-"))
    month_start = date(y, m, 1)
    month_end = date(y, m, calendar.monthrange(y, m)[1])
    start_s, end_s = month_start.isoformat(), month_end.isoformat()

    # Holdings purchased this month
    holdings = await db["invest_holdings"].find({"client_id": client_id}).to_list(length=500)
    invested = sum(
        h["quantity"] * h["purchase_price"]
        for h in holdings
        if h.get("buy_date") and start_s <= h["buy_date"] <= end_s
    )

    # SIP installments scheduled this month
    sips = await db["invest_sips"].find({"client_id": client_id}).to_list(length=200)
    for s in sips:
        freq = s.get("frequency") or 0
        if freq <= 0:
            continue
        try:
            d = date.fromisoformat(s["start_date"])
        except (ValueError, KeyError):
            continue
        # cancelled SIPs stop contributing after their end_date
        limit = month_end
        if s.get("end_date"):
            try:
                limit = min(month_end, date.fromisoformat(s["end_date"]))
            except ValueError:
                pass
        while d < month_start:
            d += timedelta(days=freq)
        while d <= limit:
            invested += s["amount"]
            d += timedelta(days=freq)

    return invested


# --- Transactions ---
async def create_transaction(
    client_id: str,
    amount: float,
    category: str,
    merchant: Optional[str] = None,
    description: Optional[str] = None,
    txn_date: Optional[str] = None,
    source: str = "manual",
    raw_input: Optional[str] = None,
):
    db = get_db()
    txn_id = str(uuid.uuid4())
    doc = {
        "_id": txn_id,
        "client_id": client_id,
        "amount": amount,
        "category": category,
        "merchant": merchant,
        "description": description,
        "date": txn_date or date.today().isoformat(),
        "source": source,
        "raw_input": raw_input,
        "flagged": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db["expense_transactions"].insert_one(doc)
    return doc


async def get_transactions(
    client_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
):
    db = get_db()
    query = {"client_id": client_id}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    if category:
        query["category"] = category
    cursor = db["expense_transactions"].find(query).sort("date", -1)
    return await cursor.to_list(length=500)#safety cap so if someone imports lets say a csv file with 10k transactions we dont want to upload that to our server which can potentially crash it.


async def update_transaction(txn_id: str, client_id: str, updates: dict):
    db = get_db()
    clean = {k: v for k, v in updates.items() if v is not None}
    if not clean:
        return None
    result = await db["expense_transactions"].find_one_and_update(
        {"_id": txn_id, "client_id": client_id},
        {"$set": clean},
        return_document=True,
    )
    return result


async def delete_transaction(txn_id: str, client_id: str):
    db = get_db()
    result = await db["expense_transactions"].delete_one(
        {"_id": txn_id, "client_id": client_id}
    )
    return result.deleted_count > 0


# --- Budgets ---
async def create_or_update_budget(client_id: str, month: str, income: Optional[float], allocations: dict):
    db = get_db()
    existing = await db["expense_budgets"].find_one(
        {"client_id": client_id, "month": month}
    )
    if existing:
        await db["expense_budgets"].update_one(
            {"_id": existing["_id"]},
            {"$set": {"income": income, "allocations": allocations}},
        )
        existing.update({"income": income, "allocations": allocations})
        return existing
    else:
        budget_id = str(uuid.uuid4())
        doc = {
            "_id": budget_id,
            "client_id": client_id,
            "month": month,
            "income": income,
            "allocations": allocations,
        }
        await db["expense_budgets"].insert_one(doc)
        return doc


async def get_budgets(client_id: str):
    db = get_db()
    cursor = db["expense_budgets"].find({"client_id": client_id}).sort("month", -1)
    return await cursor.to_list(length=24)


# --- Analytics ---
async def get_monthly_summary(client_id: str, month: str):
    db = get_db()
    y, m = map(int, month.split("-"))
    start = f"{month}-01"
    end = date(y, m, calendar.monthrange(y, m)[1]).isoformat()  # real last day, valid ISO

    transactions = await get_transactions(client_id, start_date=start, end_date=end)

    total_spend = sum(t["amount"] for t in transactions)
    by_category = {}
    for t in transactions:
        cat = t["category"]
        by_category[cat] = by_category.get(cat, 0) + t["amount"]

    budget = await db["expense_budgets"].find_one(
        {"client_id": client_id, "month": month}
    )

    invested = await _invested_in_month(db, client_id, month)
    income = budget.get("income") if budget else None

    return {
        "month": month,
        "total_spend": total_spend,
        "transaction_count": len(transactions),
        "by_category": by_category,
        "budget": budget,
        "income": income,
        "invested": invested,
        # surplus is what's left after both spending AND investing
        "surplus": (income - total_spend - invested) if income is not None else None,
    }