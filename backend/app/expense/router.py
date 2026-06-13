from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.auth.middleware import get_current_user
from app.expense.service import (
    create_transaction,
    get_transactions,
    update_transaction,
    delete_transaction,
    create_or_update_budget,
    get_budgets,
    get_monthly_summary,
)
from app.expense.schemas import (
    TransactionCreate,
    TransactionUpdate,
    TransactionOut,
    BudgetCreate,
    BudgetOut,
)

router = APIRouter(prefix="/expense", tags=["Expense"])


@router.post("/transactions", response_model=TransactionOut)
async def add_transaction(data: TransactionCreate, user=Depends(get_current_user)):
    txn = await create_transaction(
        client_id=user["_id"],
        amount=data.amount,
        category=data.category,
        merchant=data.merchant,
        description=data.description,
        txn_date=data.date,
        source="manual",
    )
    return txn


@router.get("/transactions")
async def list_transactions(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    user=Depends(get_current_user),
):
    return await get_transactions(user["_id"], start_date, end_date, category)


@router.put("/transactions/{txn_id}")
async def edit_transaction(txn_id: str, data: TransactionUpdate, user=Depends(get_current_user)):
    updates = data.model_dump(exclude_unset=True)
    result = await update_transaction(txn_id, user["_id"], updates)
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return result


@router.delete("/transactions/{txn_id}")
async def remove_transaction(txn_id: str, user=Depends(get_current_user)):
    deleted = await delete_transaction(txn_id, user["_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Transaction deleted"}


@router.post("/budgets", response_model=BudgetOut)
async def set_budget(data: BudgetCreate, user=Depends(get_current_user)):
    budget = await create_or_update_budget(
        client_id=user["_id"],
        month=data.month,
        income=data.income,
        allocations=data.allocations,
    )
    return budget


@router.get("/budgets")
async def list_budgets(user=Depends(get_current_user)):
    return await get_budgets(user["_id"])


@router.get("/summary/{month}")
async def monthly_summary(month: str, user=Depends(get_current_user)):
    return await get_monthly_summary(user["_id"], month)
