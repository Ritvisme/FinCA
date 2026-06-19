from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import date,datetime

Categories=["Food","Transport",
            "Entertainment","Utilities","Healthcare",
            "Education","Shopping","Subscriptions","Other"]

class TransactionCreate(BaseModel):
    amount:float
    category:str
    date:Optional[str]=None
    description:Optional[str]=None
    merchant:Optional[str]=None

class TransactionUpdate(BaseModel):
    amount:Optional[float]=None
    category:Optional[str]=None
    date:Optional[str]=None
    description:Optional[str]=None
    merchant:Optional[str]=None

class TransactionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id:str = Field(alias="_id")
    client_id:str
    amount:float
    category:str
    merchant: Optional[str] = None
    description: Optional[str] = None
    date: str
    source: str
    created_at: datetime

#Budget schemas
class BudgetCreate(BaseModel):
    month: str                          # "2026-06"
    income: Optional[float] = None
    allocations: dict                   # {"food": 3000, "transport": 1500, ...}

class BudgetOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    client_id: str
    month: str
    income: Optional[float] = None
    allocations: dict