from datetime import date, datetime, timezone, timedelta
from typing import Optional
import uuid

from app.database import get_db


def sip_invested_to_date(sip: dict) -> float:
    """Money actually put in through a SIP so far = installments that have occurred x amount.
    Cancelling a SIP stops future installments (via end_date) but the past ones stay invested."""
    freq = sip.get("frequency") or 0
    if freq <= 0:
        return 0.0
    try:
        d = date.fromisoformat(sip["start_date"])
    except (ValueError, KeyError):
        return 0.0
    limit = date.today()
    if sip.get("end_date"):
        try:
            limit = min(limit, date.fromisoformat(sip["end_date"]))
        except ValueError:
            pass
    n = 0
    while d <= limit:
        n += 1
        d += timedelta(days=freq)
    return n * sip["amount"]

async def create_holding(
    client_id:str,
    name:str,
    asset_type:str,
    quantity:float,
    purchase_price:float,
    buy_date:Optional[str]=None,

):
    db=get_db()

    holding_id=str(uuid.uuid4())
    doc={
    "_id":holding_id,
    "client_id":client_id,
    "name":name,
    "asset_type":asset_type,
    "quantity":quantity,
    "purchase_price":purchase_price,
    "buy_date":buy_date,
    "created_at":datetime.now(timezone.utc),
    }

    await db["invest_holdings"].insert_one(doc)
    return doc


async def get_holdings(client_id: str, asset_type: Optional[str] = None):
    db = get_db()
    query = {"client_id": client_id}
    if asset_type:
        query["asset_type"] = asset_type
    cursor = db["invest_holdings"].find(query).sort("created_at", -1)
    return await cursor.to_list(length=200)

async def update_holding(holding_id:str,client_id:str,updates:dict):
    db=get_db()
    clean={k:v for k,v in updates.items() if v is not None}
    if not clean:
        return None
    result=await db["invest_holdings"].find_one_and_update(
        {"_id":holding_id,"client_id":client_id},
        {"$set":clean},
        return_document=True
    )
    return result

async def delete_holding(holding_id:str,client_id:str):
    db=get_db()
    result=await db["invest_holdings"].delete_one({"_id":holding_id,"client_id":client_id})
    return result.deleted_count > 0

#goals

async def create_goal(client_id:str,name:str,target_amount:float,target_date:str,current_amount:float=0.0):
    db= get_db()
    goal_id=str(uuid.uuid4())
    doc={
        "_id":goal_id,
        "client_id":client_id,
        "name":name,
        "target_amount":target_amount,
        "target_date":target_date,
        "current_amount":current_amount,
        "created_at":datetime.now(timezone.utc),
    }
    await db["invest_goals"].insert_one(doc)
    return doc

async def get_goals(client_id:str):
    db=get_db()
    cursor=db["invest_goals"].find({"client_id":client_id}).sort("target_date",1)
    return await cursor.to_list(length=50)

async def update_goal(goal_id:str,client_id:str,updates:dict):
    db=get_db()
    clean={k:v for k,v in updates.items() if v is not None}
    if not clean:
        return None
    result=await db["invest_goals"].find_one_and_update({
        "_id":goal_id,"client_id":client_id},{"$set":clean},return_document=True)
    return result
async def delete_goal(goal_id: str, client_id: str):
    db = get_db()
    result = await db["invest_goals"].delete_one(
        {"_id": goal_id, "client_id": client_id}
    )
    return result.deleted_count > 0


# --- SIPs ---
async def create_sip(
    client_id: str,
    name: str,
    amount: float,
    frequency: int,
    start_date: str,
):
    db = get_db()
    sip_id = str(uuid.uuid4())
    doc = {
        "_id": sip_id,
        "client_id": client_id,
        "name": name,
        "amount": amount,
        "frequency": frequency,
        "start_date": start_date,
        "end_date": None,
        "active": True,
        "created_at": datetime.now(timezone.utc),
    }
    await db["invest_sips"].insert_one(doc)
    return doc


async def get_sips(client_id: str, active_only: bool = True):
    db = get_db()
    query = {"client_id": client_id}
    if active_only:
        query["active"] = True
    cursor = db["invest_sips"].find(query).sort("start_date", -1)
    return await cursor.to_list(length=50)


async def cancel_sip(sip_id: str, client_id: str):
    db = get_db()
    result = await db["invest_sips"].find_one_and_update(
        {"_id": sip_id, "client_id": client_id, "active": True},
        {"$set": {"active": False, "end_date": datetime.now(timezone.utc).date().isoformat()}},
        return_document=True,
    )
    return result


# --- Portfolio Summary ---
async def get_portfolio_summary(client_id: str):
    db = get_db()
    holdings = await get_holdings(client_id)
    goals = await get_goals(client_id)
    sips = await get_sips(client_id, active_only=False)

    holdings_value = sum(h["quantity"] * h["purchase_price"] for h in holdings)
    by_asset_type = {}
    for h in holdings:
        at = h["asset_type"]
        by_asset_type[at] = by_asset_type.get(at, 0) + (h["quantity"] * h["purchase_price"])

    # Money accumulated through SIP installments counts as invested too — even after cancel.
    sip_invested = sum(sip_invested_to_date(s) for s in sips)
    if sip_invested > 0:
        by_asset_type["SIP"] = by_asset_type.get("SIP", 0) + sip_invested

    total_invested = holdings_value + sip_invested

    sip_by_month = {}
    for s in sips:
        month = s["start_date"][:7]
        sip_by_month.setdefault(month, []).append({
            "name": s["name"],
            "amount": s["amount"],
            "active": s["active"],
        })

    return {
        "total_invested": total_invested,
        "holdings_value": holdings_value,
        "sip_invested": sip_invested,
        "holding_count": len(holdings),
        "by_asset_type": by_asset_type,
        "active_goals": len(goals),
        "active_sips": len([s for s in sips if s["active"]]),
        "sip_by_month": sip_by_month,
    }