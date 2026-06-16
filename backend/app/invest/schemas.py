from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import date,datetime

Asset_Types=["Stock","etf","crypto","Mutual Fund","Bonds","Real Estate","Gold","Fixed Deposit","Other"]


class HoldingCreate(BaseModel):
    asset_type:str
    name:str
    quantity:float
    purchase_price:float
    buy_date:Optional[date]=None

class HoldingUpdate(BaseModel):
    quantity:Optional[float]=None
    purchase_price:Optional[float]=None

class HoldingOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    client_id: str
    name: str
    asset_type: str
    quantity: float
    purchase_price: float
    buy_date: Optional[date] = None
    created_at: datetime

class GoalCreate(BaseModel):
    name:str
    target_amount:float
    target_date:date
    current_amount:float=0.0

class GoalUpdate(BaseModel):
    name:Optional[str]=None
    target_amount:Optional[float]=None
    target_date:Optional[date]=None
    current_amount:Optional[float]=None

class GoalOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id:str = Field(alias="_id")
    client_id:str
    name:str
    target_amount:float
    target_date:date
    current_amount:float
    created_at:datetime



class SIPCreate(BaseModel):
    name:str
    amount:float
    frequency:int=30
    start_date:date

class SIPOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id:str = Field(alias="_id")
    client_id:str
    name:str
    amount:float
    frequency:int
    start_date:date
    end_date:Optional[date]=None
    active:bool
    created_at:datetime
    