from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from typing import Optional
from pydantic import BaseModel

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


# --- PDF bank-statement import ---
from app.expense.pdf_import import parse_statement


class ImportTxn(BaseModel):
    date: str
    merchant: str
    amount: float
    category: str


class ImportCommit(BaseModel):
    transactions: list[ImportTxn]


@router.post("/import/preview")
async def import_preview(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Parse a statement PDF and return transactions for review — writes nothing."""
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Upload a PDF file")
    pdf_bytes = await file.read()
    if len(pdf_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF too large (max 5 MB)")
    try:
        return await parse_statement(pdf_bytes)
    except Exception:
        raise HTTPException(status_code=422, detail="Couldn't parse this PDF — is it a text-based bank statement?")


@router.post("/import/commit")
async def import_commit(data: ImportCommit, user=Depends(get_current_user)):
    """Write the user-approved rows from the preview as transactions."""
    created = 0
    for t in data.transactions[:200]:  # sanity cap per import
        await create_transaction(
            client_id=user["_id"],
            amount=t.amount,
            category=t.category,
            merchant=t.merchant,
            txn_date=t.date,
            source="pdf_import",
        )
        created += 1
    return {"created": created}
