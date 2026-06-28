from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.config import settings
from app.auth.middleware import require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


class PromoteRequest(BaseModel):
    email: EmailStr
    secret: str


@router.post("/promote")
async def promote_to_admin(data: PromoteRequest):
    """One-time bootstrap: promote a user to admin by supplying ADMIN_SETUP_SECRET.
    Intentionally not behind auth — you call this from a terminal/Postman with the secret."""
    if not settings.ADMIN_SETUP_SECRET:
        raise HTTPException(status_code=500, detail="Admin promotion not configured")
    if data.secret != settings.ADMIN_SETUP_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret")

    db = get_db()
    result = await db["users"].update_one(
        {"email": data.email}, {"$set": {"role": "admin"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"{data.email} is now an admin"}


@router.get("/users")
async def list_users(_=Depends(require_admin)):
    """List all users with basic stats."""
    db = get_db()
    users = await db["users"].find({}, {"password_hash": 0}).sort("created_at", -1).to_list(length=500)

    # attach transaction counts in one aggregation
    counts_cursor = db["expense_transactions"].aggregate([
        {"$group": {"_id": "$client_id", "count": {"$sum": 1}, "spent": {"$sum": "$amount"}}}
    ])
    counts = {c["_id"]: c async for c in counts_cursor}

    out = []
    for u in users:
        c = counts.get(u["_id"], {})
        out.append({
            "id": u["_id"],
            "name": u.get("name"),
            "email": u.get("email"),
            "role": u.get("role"),
            "created_at": u.get("created_at"),
            "google_id": u.get("google_id"),
            "transaction_count": c.get("count", 0),
            "total_spent": c.get("spent", 0),
        })
    return out


@router.get("/stats")
async def overview_stats(_=Depends(require_admin)):
    """Top-line numbers for the admin dashboard."""
    db = get_db()
    total_users = await db["users"].count_documents({})
    total_txns = await db["expense_transactions"].count_documents({})
    total_holdings = await db["invest_holdings"].count_documents({})
    total_sips = await db["invest_sips"].count_documents({})
    google_users = await db["users"].count_documents({"google_id": {"$exists": True, "$ne": None}})
    return {
        "total_users": total_users,
        "total_transactions": total_txns,
        "total_holdings": total_holdings,
        "total_sips": total_sips,
        "google_users": google_users,
    }
