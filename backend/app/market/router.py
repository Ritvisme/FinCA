from datetime import datetime, timezone, date

from fastapi import APIRouter, Depends

from app.auth.middleware import get_current_user
from app.invest.service import get_holdings, get_portfolio_summary
from app.expense.service import get_monthly_summary
from app.market.screener import stock_ideas

router = APIRouter(prefix="/market", tags=["Market"])


@router.get("/ideas")
async def ideas(user=Depends(get_current_user)):
    client_id = user["_id"]
    holdings = await get_holdings(client_id)
    portfolio = await get_portfolio_summary(client_id)
    month = date.today().strftime("%Y-%m")
    summary = await get_monthly_summary(client_id, month)

    result = await stock_ideas(
        owned_names=[h.get("name", "") for h in holdings],
        profile=user.get("investor_profile"),
        by_asset_type=portfolio.get("by_asset_type") or {},
        total_invested=portfolio.get("total_invested") or 0,
        surplus=summary.get("surplus"),
    )
    result["as_of"] = datetime.now(timezone.utc).isoformat()
    return result
