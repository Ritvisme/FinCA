from fastapi import depends,HTTPexception,status
from fastapi.security import HTTPbearer, HTTPauthorizationcredentials
import jwt

from app.auth.utils import decode_access_token
from app.database import get_db

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security),):
    token=credentials.credentials
    try:
        payload=decode_access_token(token)
        user_id=payload.get("user_id")
        if not user_id:
            raise HTTException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    db=get_db()

    user=await db["users"].find_one({"_id":user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

async def require_manager(user=Depends(get_current_user)):
    if user["role"] != "manager":
        raise HTTPException(status_code=403, detail="Access forbidden: Managers only")
    return user

async def require_client(user=Depends(get_current_user)):
    if user["role"]!="client":
        raise HTTPException(status_code=403,detail="Access forbidden: Clients only")
    return user
