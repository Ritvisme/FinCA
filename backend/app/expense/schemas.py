from pydantic import BaseModel
from typing import Optional
from datetime import date,datetime

Categories=["Food","Transport",
            "Entertainment","Utilities","Healthcare",
            "Education","Shopping","Subscriptions","Other"]

class TransactionCreate(BaseModel):
    amount:float
    category:str
    date:date=None
    description:Optional[str]
    merchant=Optional[str]

class TransactionUpdate(BaseModel):
    amount:Optional[float]
    category:Optional[str]
    date:Optional[date]
    description:Optional[str]
    merchant:Optional[str]
class TransactionOut(BaseModel):
    id:str
    client_id:str
    amount:float
    category:str
    merchant: Optional[str] = None
    description: Optional[str] = None
    date: date
    source: str
    created_at: datetime

#Budget schemas
class BudgetCreate(BaseModel):
    month: str                          # "2026-06"
    income: Optional[float] = None
    allocations: dict                   # {"food": 3000, "transport": 1500, ...}

class BudgetOut(BaseModel):
    id: str
    client_id: str
    month: str
    income: Optional[float] = None
    allocations: dict