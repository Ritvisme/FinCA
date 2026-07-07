from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.auth.middleware import get_current_user
from app.invest.service import (
    create_holding,
    get_holdings,
    update_holding,
    delete_holding,
    create_goal,
    get_goals,
    update_goal,
    delete_goal,
    create_sip,
    get_sips,
    cancel_sip,
    get_portfolio_summary,
)
from app.invest.schemas import (
    HoldingCreate,
    HoldingUpdate,
    HoldingOut,
    GoalCreate,
    GoalUpdate,
    GoalOut,
    SIPCreate,
    SIPOut,
)

router = APIRouter(prefix="/invest", tags=["Investment"])


# --- Investor profile (used to personalize the stock-ideas screen) ---
from typing import Literal
from pydantic import BaseModel, Field
from app.database import get_db


class InvestorProfile(BaseModel):
    age: int = Field(ge=14, le=100)
    horizon: Literal["short", "medium", "long"]  # <3y / 3-7y / >7y


@router.get("/profile")
async def get_investor_profile(user=Depends(get_current_user)):
    return user.get("investor_profile") or {}


@router.put("/profile")
async def set_investor_profile(data: InvestorProfile, user=Depends(get_current_user)):
    profile = data.model_dump()
    await get_db()["users"].update_one({"_id": user["_id"]}, {"$set": {"investor_profile": profile}})
    return profile


# --- Holdings ---
@router.post("/holdings", response_model=HoldingOut)
async def add_holding(data: HoldingCreate, user=Depends(get_current_user)):
    holding = await create_holding(
        client_id=user["_id"],
        name=data.name,
        asset_type=data.asset_type,
        quantity=data.quantity,
        purchase_price=data.purchase_price,
        buy_date=data.buy_date.isoformat() if data.buy_date else None,
    )
    return holding


@router.get("/holdings")
async def list_holdings(
    asset_type: Optional[str] = Query(None),
    user=Depends(get_current_user),
):
    return await get_holdings(user["_id"], asset_type)


@router.put("/holdings/{holding_id}")
async def edit_holding(holding_id: str, data: HoldingUpdate, user=Depends(get_current_user)):
    updates = data.model_dump(exclude_unset=True)
    result = await update_holding(holding_id, user["_id"], updates)
    if not result:
        raise HTTPException(status_code=404, detail="Holding not found")
    return result


@router.delete("/holdings/{holding_id}")
async def remove_holding(holding_id: str, user=Depends(get_current_user)):
    deleted = await delete_holding(holding_id, user["_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"message": "Holding deleted"}


# --- Goals ---
@router.post("/goals", response_model=GoalOut)
async def add_goal(data: GoalCreate, user=Depends(get_current_user)):
    goal = await create_goal(
        client_id=user["_id"],
        name=data.name,
        target_amount=data.target_amount,
        target_date=data.target_date.isoformat(),
        current_amount=data.current_amount,
    )
    return goal


@router.get("/goals")
async def list_goals(user=Depends(get_current_user)):
    return await get_goals(user["_id"])


@router.put("/goals/{goal_id}")
async def edit_goal(goal_id: str, data: GoalUpdate, user=Depends(get_current_user)):
    updates = data.model_dump(exclude_unset=True)
    result = await update_goal(goal_id, user["_id"], updates)
    if not result:
        raise HTTPException(status_code=404, detail="Goal not found")
    return result


@router.delete("/goals/{goal_id}")
async def remove_goal(goal_id: str, user=Depends(get_current_user)):
    deleted = await delete_goal(goal_id, user["_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"message": "Goal deleted"}


# --- SIPs ---
@router.post("/sips", response_model=SIPOut)
async def add_sip(data: SIPCreate, user=Depends(get_current_user)):
    sip = await create_sip(
        client_id=user["_id"],
        name=data.name,
        amount=data.amount,
        frequency=data.frequency,
        start_date=data.start_date.isoformat(),
    )
    return sip


@router.get("/sips")
async def list_sips(
    active_only: bool = Query(True),
    user=Depends(get_current_user),
):
    return await get_sips(user["_id"], active_only)


@router.post("/sips/{sip_id}/cancel")
async def stop_sip(sip_id: str, user=Depends(get_current_user)):
    result = await cancel_sip(sip_id, user["_id"])
    if not result:
        raise HTTPException(status_code=404, detail="SIP not found or already cancelled")
    return result


# --- Portfolio ---
@router.get("/portfolio")
async def portfolio_summary(user=Depends(get_current_user)):
    return await get_portfolio_summary(user["_id"])