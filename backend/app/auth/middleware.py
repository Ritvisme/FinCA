#effectively the authentication and authorization of tokens that are being sent from the front end , 
# to verify if that client, or token should be processed or not and if the user has the appropriate role to access the resources that 
# they are trying to access

from fastapi import depends,HTTPexception,status
from fastapi.security import HTTPbearer, HTTPauthorizationcredentials
import jwt

from app.auth.utils import decode_access_token
from app.database import get_db

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security),):#here we are running the security dependency to extract the token from the request header and then we are decoding the token to get the user id and then we are fetching the user from the database using the user id and returning the user object if everything is fine otherwise we are raising appropriate HTTP exceptions
    token=credentials.credentials
    try:
        payload=decode_access_token(token)
        user_id=payload.get("user_id")
        if not user_id:
            raise HTTException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:#dealing with a valid but expire token
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:#dealing with an invalid token
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
